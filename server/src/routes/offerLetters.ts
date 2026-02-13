import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';
import Handlebars from 'handlebars'; // Import Handlebars
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import type {
  OfferLetter,
  OfferLetterWithSignatory,
  CreateOfferLetterInput,
  UpdateOfferLetterInput,
  SalaryComponent,
  KRADetail,
} from '../types.js';

const router = Router();

// Helper function to get ordinal suffix for a day
const getOrdinalSuffix = (day: number): string => {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

// Helper function to format date as "6th December 2025"
const formatDateLong = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const day = date.getDate();
  const month = date.toLocaleDateString('en-GB', { month: 'long' });
  const year = date.getFullYear();
  return `${day}${getOrdinalSuffix(day)} ${month} ${year}`;
};

// Helper function to convert number to words (Indian numbering system)
const numberToWords = (num: number): string => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertGroup = (n: number): string => {
    let str = '';
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 10 && n <= 19) {
      str += teens[n - 10] + ' ';
    } else if (n >= 20) {
      str += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0 && n < 10) {
      str += ones[n] + ' ';
    }
    return str;
  };

  if (num === 0) return 'Zero';

  let words = '';
  let n = num;

  if (n >= 10000000) {
    words += convertGroup(Math.floor(n / 10000000)) + 'Crore ';
    n %= 10000000;
  }
  if (n >= 100000) {
    words += convertGroup(Math.floor(n / 100000)) + 'Lakh ';
    n %= 100000;
  }
  if (n >= 1000) {
    words += convertGroup(Math.floor(n / 1000)) + 'Thousand ';
    n %= 1000;
  }
  words += convertGroup(n);

  return words.trim();
};


// Get all offer letters
router.get('/', authenticateToken, (req, res) => {
  try {
    const offerLetters = db.prepare(`
      SELECT
        ol.*,
        u.name as creator_name,
        u.email as creator_email,
        s.name as signatory_name,
        s.position as signatory_position,
        s.signature_image as signatory_signature,
        s.stamp_image as signatory_stamp,
        ss.name as secondary_signatory_name,
        ss.position as secondary_signatory_position,
        ss.signature_image as secondary_signatory_signature,
        ss.stamp_image as secondary_signatory_stamp
      FROM offer_letters ol
      JOIN users u ON ol.created_by = u.id
      LEFT JOIN signatories s ON ol.signatory_id = s.id
      LEFT JOIN signatories ss ON ol.secondary_signatory_id = ss.id
      WHERE ol.isActive = 1
      ORDER BY ol.createdAt DESC
    `).all() as OfferLetterWithSignatory[];

    res.json(offerLetters);
  } catch (error) {
    console.error('Error fetching offer letters:', error);
    res.status(500).json({ error: 'Failed to fetch offer letters' });
  }
});

// Get single offer letter by ID
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const offerLetter = db.prepare(`
      SELECT
        ol.*,
        u.name as creator_name,
        u.email as creator_email,
        s.name as signatory_name,
        s.position as signatory_position,
        s.signature_image as signatory_signature,
        s.stamp_image as signatory_stamp,
        ss.name as secondary_signatory_name,
        ss.position as secondary_signatory_position,
        ss.signature_image as secondary_signatory_signature,
        ss.stamp_image as secondary_signatory_stamp
      FROM offer_letters ol
      JOIN users u ON ol.created_by = u.id
      LEFT JOIN signatories s ON ol.signatory_id = s.id
      LEFT JOIN signatories ss ON ol.secondary_signatory_id = ss.id
      WHERE ol.id = ? AND ol.isActive = 1
    `).get(id) as OfferLetterWithSignatory | undefined;

    if (!offerLetter) {
      return res.status(404).json({ error: 'Offer letter not found' });
    }

    res.json(offerLetter);
  } catch (error) {
    console.error('Error fetching offer letter:', error);
    res.status(500).json({ error: 'Failed to fetch offer letter' });
  }
});

// Create new offer letter
router.post('/', authenticateToken, (req, res) => {
  try {
    const input: CreateOfferLetterInput = req.body;
    const userId = req.user!.userId;

    const missingFields = [];
    if (!input.candidate_name) missingFields.push('candidate_name');
    if (!input.candidate_address) missingFields.push('candidate_address');
    if (!input.designation) missingFields.push('designation');
    if (!input.joining_date) missingFields.push('joining_date');
    if (input.annual_ctc === undefined) missingFields.push('annual_ctc');
    if (!input.salary_breakdown) missingFields.push('salary_breakdown');
    
    if (missingFields.length > 0) {
      return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
    }

    const result = db.prepare(`
      INSERT INTO offer_letters (
        candidate_name, candidate_address, designation, joining_date,
        annual_ctc, salary_breakdown, working_location, hr_manager_name,
        hr_manager_title, offer_valid_till, letter_date, template_type,
        optional_sections, kra_details, joining_bonus, signatory_id, secondary_signatory_id, letterhead_id, template_profile_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.candidate_name,
      input.candidate_address,
      input.designation,
      input.joining_date,
      input.annual_ctc,
      JSON.stringify(input.salary_breakdown),
      input.working_location,
      input.hr_manager_name,
      input.hr_manager_title,
      input.offer_valid_till,
      input.letter_date,
      'default', // template_type
      JSON.stringify([]), // optional_sections
      JSON.stringify(input.kra_details || []),
      input.joining_bonus || null,
      input.signatory_id,
      input.secondary_signatory_id,
      null, // letterhead_id
      null, // template_profile_id
      userId
    );

    const newOfferLetter = db.prepare(`
      SELECT * FROM offer_letters WHERE id = ?
    `).get(result.lastInsertRowid) as OfferLetter;

    res.status(201).json(newOfferLetter);
  } catch (error) {
    console.error('Error creating offer letter:', error);
    res.status(500).json({ error: 'Failed to create offer letter' });
  }
});

// Update offer letter
router.put('/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const input: UpdateOfferLetterInput = req.body;

        const existingOfferLetter = db.prepare('SELECT * FROM offer_letters WHERE id = ?').get(id) as OfferLetter | undefined;

        if (!existingOfferLetter) {
            return res.status(404).json({ error: 'Offer letter not found' });
        }

        const updates: string[] = [];
        const values: any[] = [];

        Object.keys(input).forEach(key => {
            if (input[key as keyof UpdateOfferLetterInput] !== undefined) {
                updates.push(`${key} = ?`);
                const value = input[key as keyof UpdateOfferLetterInput];
                if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
                    values.push(JSON.stringify(value));
                } else {
                    values.push(value);
                }
            }
        });

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push("updatedAt = datetime('now')");
        values.push(id);

        db.prepare(`UPDATE offer_letters SET ${updates.join(', ')} WHERE id = ?`).run(...values);

        const updatedOfferLetter = db.prepare('SELECT * FROM offer_letters WHERE id = ?').get(id);

        res.json(updatedOfferLetter);
    } catch (error) {
        console.error('Error updating offer letter:', error);
        res.status(500).json({ error: 'Failed to update offer letter' });
    }
});


// Delete offer letter (soft delete)
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    const offerLetter = db.prepare(
      'SELECT * FROM offer_letters WHERE id = ? AND isActive = 1'
    ).get(id) as OfferLetter | undefined;

    if (!offerLetter) {
      return res.status(404).json({ error: 'Offer letter not found' });
    }

    db.prepare(`
      UPDATE offer_letters
      SET isActive = 0, updatedAt = datetime('now')
      WHERE id = ?
    `).run(id);

    res.json({ message: 'Offer letter deleted successfully' });
  } catch (error) {
    console.error('Error deleting offer letter:', error);
    res.status(500).json({ error: 'Failed to delete offer letter' });
  }
});


// Generate offer letter content (template)
router.post('/:id/generate', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const offerLetter = db.prepare('SELECT * FROM offer_letters WHERE id = ?').get(id);
    if (!offerLetter) {
        return res.status(404).json({ error: 'Offer letter not found' });
    }
    res.json(offerLetter);
  } catch (error) {
    console.error('Error fetching offer letter:', error);
    res.status(500).json({ error: 'Failed to generate offer letter' });
  }
});

// Generate PDF for offer letter
router.get('/:id/pdf', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const offerLetter = db.prepare(`
        SELECT ol.*, s.name as signatory_name, s.position as signatory_position,
        lh.header_image as letterhead_header_image, lh.footer_image as letterhead_footer_image
        FROM offer_letters ol
        LEFT JOIN signatories s ON ol.signatory_id = s.id
        LEFT JOIN signatories ss ON ol.secondary_signatory_id = ss.id
        LEFT JOIN letterheads lh ON ol.letterhead_id = lh.id
        WHERE ol.id = ?
    `).get(id) as OfferLetterWithSignatory;

    if (!offerLetter) {
      return res.status(404).json({ error: 'Offer letter not found' });
    }

    const templatePath = path.join(__dirname, '..', '..', 'templates', 'final-letter-template.html');
    const htmlContent = await fs.readFile(templatePath, 'utf-8');
    const template = Handlebars.compile(htmlContent);

    // Load logo and signature and convert to base64
    const logoPath = path.join(__dirname, '..', '..', '..', 'client', 'public', 'logo.png');
    const signaturePath = path.join(__dirname, '..', '..', '..', 'client', 'public', 'hr-signature.jpg');

    const logoBase64 = await fs.readFile(logoPath, 'base64');
    const signatureBase64 = await fs.readFile(signaturePath, 'base64');

    const salaryBreakdown: SalaryComponent[] = JSON.parse(offerLetter.salary_breakdown as string);

    const basicSalaryMonthly = salaryBreakdown.find(c => c.component.toLowerCase() === 'basic salary')?.perMonth || 0;
    const hraMonthly = salaryBreakdown.find(c => c.component.toLowerCase() === 'hra')?.perMonth || 0;
    const travelAllowanceMonthly = salaryBreakdown.find(c => c.component.toLowerCase() === 'travel reimbursement')?.perMonth || 0;
    const specialAllowanceMonthly = salaryBreakdown.find(c => c.component.toLowerCase() === 'special allowance')?.perMonth || 0;
    const otherAllowancesMonthly = salaryBreakdown.find(c => c.component.toLowerCase() === 'other expenditure *')?.perMonth || 0;

    const fixedSalaryTotalMonthly = basicSalaryMonthly + hraMonthly + travelAllowanceMonthly + specialAllowanceMonthly + otherAllowancesMonthly;
    const fixedSalaryTotalAnnual = offerLetter.annual_ctc; // Assume annual_ctc is the total fixed
    const variableAnnual = 0; // Or calculate if there's a variable component

    const annexureADetails = salaryBreakdown.map(item => ({
        component: item.component,
        monthly_amount: item.perMonth?.toLocaleString('en-IN') || '0',
        annual_amount: item.annual?.toLocaleString('en-IN') || '0',
    }));

    const parsedKraDetails: KRADetail[] = offerLetter.kra_details ? JSON.parse(offerLetter.kra_details as string) : [];

    const context = {
        reference_number: `HR/Offer/24-25/${String(offerLetter.id).padStart(6, '0')}`,
        letter_date: formatDateLong(offerLetter.letter_date),
        candidate_name: offerLetter.candidate_name,
        candidate_address: offerLetter.candidate_address.replace(/\n/g, '<br>'),
        designation: offerLetter.designation,
        project_details: offerLetter.project_details || "a specified project",
        working_location: offerLetter.working_location || "the company's premises",
        joining_date: formatDateLong(offerLetter.joining_date),
        company_full_address: "1003, Unicorn Chandak, Andheri (West), Mumbai – 400053, India.",
        ctc_amount: offerLetter.annual_ctc.toLocaleString('en-IN'),
        ctc_words: numberToWords(offerLetter.annual_ctc),
        hr_manager_name: offerLetter.signatory_name,
        hr_manager_title: offerLetter.signatory_position,
        hr_signature: signatureBase64,
        annexure_a_details: annexureADetails,
        total_fixed_monthly: fixedSalaryTotalMonthly.toLocaleString('en-IN'),
        total_fixed_annual: fixedSalaryTotalAnnual.toLocaleString('en-IN'),
        variable_annual: variableAnnual.toLocaleString('en-IN'),
        kra_details: parsedKraDetails,
    };

    const html = template(context);

    const headerTemplate = `
      <div style="width: 100%; padding: 0 1in; box-sizing: border-box;">
        <img src="data:image/png;base64,${logoBase64}" style="height: 45px;" />
      </div>
    `;

    const footerTemplate = `
      <div style="font-family: Roboto, sans-serif; font-size: 9px; width: 100%; border-top: 1px solid #ff6600; padding: 10px 1in; box-sizing: border-box; text-align: left;">
        Phoneme Solutions Pvt Ltd. Advant Navis Business Park,B- 614 Sector 142,Noida -201307 CIN: U74999DL2015PTC275921GST:<br>
        07AAHCP9748G1ZX Reg.Off: 1/22, 2nd Floor, Asaf Ali Road, New Delhi-110017<a href="mailto:info@myphoneme.com" style="color:#333; text-decoration: none;">info@myphoneme.com</a><br>
        <a href="http://www.myphoneme.com" style="color:#333; text-decoration: none;">http://www.myphoneme.com</a>
      </div>
    `;

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: headerTemplate,
        footerTemplate: footerTemplate,
        margin: {
            top: '1.5in',
            bottom: '1in',
            left: '1in',
            right: '1in'
        }
    });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Offer_Letter_${offerLetter.candidate_name.replace(/\s+/g, '_')}.pdf"`);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

export default router;
