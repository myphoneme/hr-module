import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import type {
  OfferLetter,
  OfferLetterWithCreator,
  OfferLetterWithSignatory,
  CreateOfferLetterInput,
  UpdateOfferLetterInput,
  SalaryComponent
} from '../types.js';

const router = Router();

// Helper function to convert image file to base64 data URL
function getImageAsBase64(filename: string | null | undefined, folder: string): string | null {
  if (!filename) return null;

  try {
    const filePath = path.join(process.cwd(), 'uploads', folder, filename);
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      return null;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString('base64');

    // Determine MIME type from extension
    const ext = path.extname(filename).toLowerCase();
    let mimeType = 'image/jpeg';
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.gif') mimeType = 'image/gif';
    else if (ext === '.webp') mimeType = 'image/webp';

    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error(`Error reading image file ${filename}:`, error);
    return null;
  }
}

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

    console.log('Creating offer letter with data:', JSON.stringify(input, null, 2));

    // Validate required fields
    const missingFields = [];
    if (!input.candidate_name) missingFields.push('candidate_name');
    if (!input.candidate_address) missingFields.push('candidate_address');
    if (!input.designation) missingFields.push('designation');
    if (!input.joining_date) missingFields.push('joining_date');
    if (input.annual_ctc === undefined) missingFields.push('annual_ctc');
    if (!input.salary_breakdown) missingFields.push('salary_breakdown');
    if (!input.working_location) missingFields.push('working_location');
    if (!input.hr_manager_name) missingFields.push('hr_manager_name');
    if (!input.offer_valid_till) missingFields.push('offer_valid_till');
    if (!input.letter_date) missingFields.push('letter_date');

    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
    }

    // Validate salary breakdown
    if (!Array.isArray(input.salary_breakdown) || input.salary_breakdown.length === 0) {
      return res.status(400).json({ error: 'Salary breakdown must be a non-empty array' });
    }

    // Auto-detect template type based on designation if not provided
    let templateType = input.template_type || 'long';
    if (!input.template_type) {
      const designation = input.designation.toLowerCase();
      if (designation.includes('intern')) {
        templateType = 'internship';
      } else if (designation.includes('trainee') || designation.includes('junior')) {
        templateType = 'short';
      }
    }

    // Get default letterhead if not specified
    let letterheadId = input.letterhead_id || null;
    if (!letterheadId) {
      const defaultLetterhead = db.prepare('SELECT id FROM letterheads WHERE is_default = 1 AND isActive = 1').get() as { id: number } | undefined;
      if (defaultLetterhead) {
        letterheadId = defaultLetterhead.id;
      }
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
      input.hr_manager_title || 'Manager-Human Resource',
      input.offer_valid_till,
      input.letter_date,
      templateType,
      JSON.stringify(input.optional_sections || []),
      input.kra_details ? JSON.stringify(input.kra_details) : null,
      input.joining_bonus || null,
      input.signatory_id || null,
      input.secondary_signatory_id || null,
      letterheadId,
      input.template_profile_id || null,
      userId
    );

    const newOfferLetter = db.prepare(`
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
      WHERE ol.id = ?
    `).get(result.lastInsertRowid) as OfferLetterWithSignatory;

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

    console.log(`Updating offer letter ${id} with data:`, JSON.stringify(input, null, 2));

    // Check if offer letter exists
    const existingOfferLetter = db.prepare(
      'SELECT * FROM offer_letters WHERE id = ? AND isActive = 1'
    ).get(id) as OfferLetter | undefined;

    if (!existingOfferLetter) {
      console.error(`Offer letter ${id} not found`);
      return res.status(404).json({ error: 'Offer letter not found' });
    }

    console.log(`Found offer letter ${id}, current status: ${existingOfferLetter.status}`);

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (input.candidate_name !== undefined) {
      updates.push('candidate_name = ?');
      values.push(input.candidate_name);
    }
    if (input.candidate_address !== undefined) {
      updates.push('candidate_address = ?');
      values.push(input.candidate_address);
    }
    if (input.designation !== undefined) {
      updates.push('designation = ?');
      values.push(input.designation);
    }
    if (input.joining_date !== undefined) {
      updates.push('joining_date = ?');
      values.push(input.joining_date);
    }
    if (input.annual_ctc !== undefined) {
      updates.push('annual_ctc = ?');
      values.push(input.annual_ctc);
    }
    if (input.salary_breakdown !== undefined) {
      updates.push('salary_breakdown = ?');
      values.push(JSON.stringify(input.salary_breakdown));
    }
    if (input.working_location !== undefined) {
      updates.push('working_location = ?');
      values.push(input.working_location);
    }
    if (input.hr_manager_name !== undefined) {
      updates.push('hr_manager_name = ?');
      values.push(input.hr_manager_name);
    }
    if (input.hr_manager_title !== undefined) {
      updates.push('hr_manager_title = ?');
      values.push(input.hr_manager_title);
    }
    if (input.offer_valid_till !== undefined) {
      updates.push('offer_valid_till = ?');
      values.push(input.offer_valid_till);
    }
    if (input.letter_date !== undefined) {
      updates.push('letter_date = ?');
      values.push(input.letter_date);
    }
    if (input.status !== undefined) {
      updates.push('status = ?');
      values.push(input.status);
    }
    if (input.template_type !== undefined) {
      updates.push('template_type = ?');
      values.push(input.template_type);
    }
    if (input.optional_sections !== undefined) {
      updates.push('optional_sections = ?');
      values.push(JSON.stringify(input.optional_sections));
    }
    if (input.kra_details !== undefined) {
      updates.push('kra_details = ?');
      values.push(input.kra_details ? JSON.stringify(input.kra_details) : null);
    }
    if (input.joining_bonus !== undefined) {
      updates.push('joining_bonus = ?');
      values.push(input.joining_bonus);
    }
    if (input.signatory_id !== undefined) {
      updates.push('signatory_id = ?');
      values.push(input.signatory_id || null);
    }
    if (input.secondary_signatory_id !== undefined) {
      updates.push('secondary_signatory_id = ?');
      values.push(input.secondary_signatory_id || null);
    }
    if (input.isActive !== undefined) {
      updates.push('isActive = ?');
      values.push(input.isActive ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push("updatedAt = datetime('now')");
    values.push(id);

    try {
      db.prepare(`
        UPDATE offer_letters
        SET ${updates.join(', ')}
        WHERE id = ?
      `).run(...values);

      console.log(`Successfully updated offer letter ${id}`);
    } catch (dbError: any) {
      console.error('Database error during update:', dbError.message);
      return res.status(500).json({ error: `Database error: ${dbError.message}` });
    }

    const updatedOfferLetter = db.prepare(`
      SELECT
        ol.*,
        u.name as creator_name,
        u.email as creator_email
      FROM offer_letters ol
      JOIN users u ON ol.created_by = u.id
      WHERE ol.id = ?
    `).get(id) as OfferLetterWithCreator;

    res.json(updatedOfferLetter);
  } catch (error: any) {
    console.error('Error updating offer letter:', error);
    res.status(500).json({ error: error.message || 'Failed to update offer letter' });
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

    const offerLetter = db.prepare(`
      SELECT ol.*,
        s.name as signatory_name,
        s.position as signatory_position,
        s.signature_image as signatory_signature,
        s.stamp_image as signatory_stamp,
        ss.name as secondary_signatory_name,
        ss.position as secondary_signatory_position,
        ss.signature_image as secondary_signatory_signature,
        ss.stamp_image as secondary_signatory_stamp
      FROM offer_letters ol
      LEFT JOIN signatories s ON ol.signatory_id = s.id
      LEFT JOIN signatories ss ON ol.secondary_signatory_id = ss.id
      WHERE ol.id = ? AND ol.isActive = 1
    `).get(id) as OfferLetterWithSignatory | undefined;

    if (!offerLetter) {
      return res.status(404).json({ error: 'Offer letter not found' });
    }

    const salaryBreakdown: SalaryComponent[] = JSON.parse(offerLetter.salary_breakdown);
    const optionalSections: string[] = JSON.parse(offerLetter.optional_sections || '[]');
    const kraDetails = offerLetter.kra_details ? JSON.parse(offerLetter.kra_details) : [];

    // Generate designation-specific responsibilities
    let responsibilityText = '';
    const designation = offerLetter.designation.toLowerCase();

    if (designation.includes('developer') || designation.includes('programmer')) {
      responsibilityText = 'software development responsibilities';
    } else if (designation.includes('designer') || designation.includes('ui') || designation.includes('ux')) {
      responsibilityText = 'creative design and UI responsibilities';
    } else if (designation.includes('tester') || designation.includes('qa') || designation.includes('quality')) {
      responsibilityText = 'test planning and execution responsibilities';
    } else if (designation.includes('manager') || designation.includes('lead')) {
      responsibilityText = 'leadership and management responsibilities';
    } else {
      responsibilityText = 'your assigned role responsibilities';
    }

    // Format currency
    const formatCurrency = (amount: number) => {
      return amount.toLocaleString('en-IN');
    };

    // Convert number to words (simplified for Indian numbering)
    const numberToWords = (num: number): string => {
      const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
      const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
      const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

      if (num === 0) return 'Zero';

      let words = '';

      if (num >= 10000000) {
        const crores = Math.floor(num / 10000000);
        words += numberToWords(crores) + ' Crore ';
        num %= 10000000;
      }

      if (num >= 100000) {
        const lakhs = Math.floor(num / 100000);
        words += numberToWords(lakhs) + ' Lakh ';
        num %= 100000;
      }

      if (num >= 1000) {
        const thousands = Math.floor(num / 1000);
        words += numberToWords(thousands) + ' Thousand ';
        num %= 1000;
      }

      if (num >= 100) {
        words += ones[Math.floor(num / 100)] + ' Hundred ';
        num %= 100;
      }

      if (num >= 20) {
        words += tens[Math.floor(num / 10)] + ' ';
        num %= 10;
      } else if (num >= 10) {
        words += teens[num - 10] + ' ';
        num = 0;
      }

      if (num > 0) {
        words += ones[num] + ' ';
      }

      return words.trim();
    };

    const ctcInWords = numberToWords(offerLetter.annual_ctc);

    // Format dates
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = date.getDate();
      const suffix = day === 1 || day === 21 || day === 31 ? 'st' :
                     day === 2 || day === 22 ? 'nd' :
                     day === 3 || day === 23 ? 'rd' : 'th';
      return `${months[date.getMonth()]} ${day}${suffix}, ${date.getFullYear()}`;
    };

    // Generate reference number in format HR/Offer/YY-YY/XXXXXX
    const letterDate = new Date(offerLetter.letter_date);
    const fiscalYear = letterDate.getMonth() >= 3 ? letterDate.getFullYear() : letterDate.getFullYear() - 1;
    const nextYear = (fiscalYear + 1) % 100;
    const currentYear = fiscalYear % 100;
    const paddedId = String(offerLetter.id).padStart(6, '0');
    const referenceNumber = `HR/Offer/${currentYear}-${String(nextYear).padStart(2, '0')}/${paddedId}`;

    // Use different header based on template type
    const headerTitle = offerLetter.template_type === 'short'
      ? 'OFFER LETTER'
      : 'OFFER CUM APPOINTMENT LETTER';

    const letterContent = {
      templateType: offerLetter.template_type,
      optionalSections,
      joiningBonus: offerLetter.joining_bonus,
      header: headerTitle,
      referenceNumber,
      date: formatDate(offerLetter.letter_date),
      to: offerLetter.candidate_name,
      address: offerLetter.candidate_address,
      subject: `Offer for the post of ${offerLetter.designation}`,
      signatory: offerLetter.signatory_id ? {
        name: offerLetter.signatory_name,
        position: offerLetter.signatory_position,
        signature: getImageAsBase64(offerLetter.signatory_signature, 'signatures'),
        stamp: getImageAsBase64(offerLetter.signatory_stamp, 'stamps')
      } : null,
      secondarySignatory: offerLetter.secondary_signatory_id ? {
        name: offerLetter.secondary_signatory_name,
        position: offerLetter.secondary_signatory_position,
        signature: getImageAsBase64(offerLetter.secondary_signatory_signature, 'signatures'),
        stamp: getImageAsBase64(offerLetter.secondary_signatory_stamp, 'stamps')
      } : null,
      body: {
        // Fields for short form template
        joiningDate: formatDate(offerLetter.joining_date),
        ctcFormatted: formatCurrency(offerLetter.annual_ctc),
        ctcInWords: ctcInWords,
        workingLocation: offerLetter.working_location || 'Delhi',
        offerValidDate: formatDate(offerLetter.offer_valid_till),
        // Additional fields for long form template
        joiningLocation: offerLetter.working_location || '703-7th Floor Narain Manzil, Barakhamba Road, Connaught Place, New Delhi-110001',
        reportingManager: null, // Can be added to DB schema if needed
        reportingLocation: null, // Can be added to DB schema if needed
        // Long form template fields
        greeting: `Dear ${offerLetter.candidate_name.split(' ')[0]},`,
        congratulations: 'Congratulations!',
        opening: `This is with reference to your application and subsequent interview held with Phoneme Solution Pvt. Ltd. We are pleased to offer you as "${offerLetter.designation}" in our organization on the following terms and conditions.`,
        commencement: `Commencement of employment: Your joining date is ${formatDate(offerLetter.joining_date)}.`,
        remuneration: `Remuneration: Your total annual compensation would be in INR ${formatCurrency(offerLetter.annual_ctc)}/- (${ctcInWords}) per annum. CTC Breakup is at Annexure A.`,
        salaryNote: `Please note that the salary structure of the company may be altered/modified at any time with notice and your remuneration package may accordingly be altered /modified from time to time. Further, salary, allowances and all other payments/benefits will be governed by the rules as well as statutory provisions in force from time to time and subject to deduction of taxes at source.`,
        workingHours: `Working Hours: Your working hours will be 9:00 am to 06:00 pm. as per the current company policy you need to complete 9 hours in a day, company observes a 5-day work week and all Saturday and Sunday will be full day week off.`,
        probation: `Probation/Confirmation: You will be on a Probation period for Six months. Based on your performance your services will be confirmed with the company in written after six months. During the probation period your services can be terminated with seven days' notice on either side and without any reasons whatsoever. If your services are found satisfactory during the probation period, you will be confirmed in the present position and thereafter your services can be terminated on one month's notice on either side.`,
        leave: `Leave: You will be entitled for the benefits of leaves as per the company's leave policy after successful completion of your probation period.`,
        notice: `Notice Period: This appointment may be terminated by either side by giving Thirty days' notice or one months' salary in lieu of notice period. During the Notice period, you are supposed to hand over all the assets, and belonging and do the complete knowledge transfer. Upon receipt of the above all, during signed by your manager, your full and final settlement will be done. You are not supposed to take any leaves during this period.`,
        general: {
          title: 'General:',
          points: [
            'You will be governed by the company\'s rules and regulations (as well as practices) as enforced from time to time in respect of matters not covered by this letter of offer The Company\'s decisions on all such shall be final and binding on you.',
            'If you remain absent for more than three days without any information or beyond the period of leave originally granted or subsequently extended, you shall be considers as abscond and your employment will be terminated without any notice with immediate effects unless give an explanation to the satisfaction of the company regarding such absence',
            'Your services are transferable at short notice, to any group company. The working hours applicable to you will be the same as are observed depending upon your place of posting and as amended from time to time. Further, you should be prepared to work on any shift as may be warranted by the company\'s/client\'s work requirements.'
          ]
        },
        confidentiality: {
          title: 'Confidentiality:',
          text: `During your employment with the company and thereafter you will, at all times, hold in strictest confidence, and not use, except for the benefit of the company, or dispose to any person, firm, or corporation without the written authorization of the Board of Directors of the company, any confidential information of the company or related corporations, clients, etc. You will understand that 'Confidential Information' means proprietary information of the company or any related corporation, including (without limiting the generality of the foregoing), technical data, trade secrets or know-how, including but not limited to, research, product plans, products, services, customer lists and customers (including but not limited to users or potential users of the company's products on whom you (may call or with whom you may become acquainted during the terms of your employment), market. software, developments, inventions, processes, formulae, technology, designs, drawings, and engineering. hardware configuration information, marketing finance, or any other information disclosed to you by the company or related corporations, either directly or indirectly in writing, orally or by drawings or inspections of parts or equipment. You will also be responsible for the protection and furtherance of the company's best interest at all times, including after you cease to be in the company's role.`
        },
        conflictOfInterest: {
          title: 'Conflict of Interest:',
          points: [
            'During the period of your employment with the Company, you will devote full time to the work of the Company. Further, you will not take up any other full time or part time employment or assignment without the prior written permission of the Company.',
            'You will not accept any present, commission or any sort of gratification in cash or kind from any person, party or firm or Company having dealing with the company and if you are offered any, you should immediately report the same to the Management.',
            'If at any time in our opinion, which is final in this matter you are found non- performer or guilty of fraud, dishonest, disobedience, disorderly behavior, negligence, indiscipline, absence from duty without permission or any other conduct considered by us deterrent to our interest or of violation of one or more terms of this letter, your services may be terminated without notice and on account of reason of any of the acts or omission the company shall be entitled to recover the damages from you.'
          ]
        },
        termination: {
          title: 'Termination:',
          text: `The Company reserves the right to terminate your employment without any notice period or termination payment, if it has reasonable ground to believe you are guilty of misconduct or negligence, or have committed any fundamental breach of contract or caused any loss to the Company. On the termination of your employment for whatever reason, you will return to the Company all property; documents and paper, both original and copies thereof, including all correspondence, documents, market data, cost data, effect, records or confidential information etc , in your possession or under your control relating to your employment or to clients' business affairs.`,
          nonCompete: `In addition in the event of your leaving the company's services, or upon the termination of your employment, you shall not be engaged whether directly or indirectly, whether by employment, consultancy, partnership, or otherwise in any type of business/commercial association with any of company's competitors for a period of two years from the date of your leaving the services of the company, without the express written consent of the company being first obtained. Further, you will agree to execute any further documentation regarding the protection of any information as the company may require or request from time to time after the commencement of your employment.`
        },
        acceptance: `If the terms and conditions offered herein are acceptable to you, please return the acceptance copy (attached) to Manager - HRD, duly affixing your full signature on the last page and initials on the remaining pages on or before ${formatDate(offerLetter.offer_valid_till)} else this offer will automatically be cancelled.`,
        closing: 'We welcome you to the Phoneme family and wish you a successful career with us.'
      },
      signature: {
        regards: 'Regards,',
        company: 'For Phoneme Solutions Private Limited.',
        name: offerLetter.hr_manager_name,
        title: offerLetter.hr_manager_title
      },
      acceptance: {
        title: 'Acceptance Copy',
        text: '(I have read and understood the above terms & conditions of employment and I accept them)',
        signature: '(Employee Signature)'
      },
      annexure: {
        title: 'Annexure A',
        subtitle: 'Salary Break Up',
        table: salaryBreakdown,
        total: {
          perMonth: salaryBreakdown.reduce((sum, item) => sum + item.perMonth, 0),
          annual: salaryBreakdown.reduce((sum, item) => sum + item.annual, 0)
        }
      },
      annexureB: kraDetails.length > 0 ? {
        title: 'Annexure B',
        subtitle: 'Key Responsibility Areas (KRA)',
        responsibilities: kraDetails
      } : null
    };

    res.json(letterContent);
  } catch (error) {
    console.error('Error generating offer letter:', error);
    res.status(500).json({ error: 'Failed to generate offer letter' });
  }
});

// Generate PDF for offer letter
router.get('/:id/pdf', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const offerLetter = db.prepare(`
      SELECT ol.*,
        s.name as signatory_name,
        s.position as signatory_position,
        s.signature_image as signatory_signature,
        s.stamp_image as signatory_stamp,
        ss.name as secondary_signatory_name,
        ss.position as secondary_signatory_position,
        ss.signature_image as secondary_signatory_signature,
        ss.stamp_image as secondary_signatory_stamp,
        l.header_image as letterhead_header,
        l.footer_image as letterhead_footer,
        l.logo_image as letterhead_logo,
        l.company_name as letterhead_company_name,
        l.company_address as letterhead_company_address,
        l.company_cin as letterhead_cin,
        l.company_gstin as letterhead_gstin,
        l.company_email as letterhead_email,
        l.company_website as letterhead_website
      FROM offer_letters ol
      LEFT JOIN signatories s ON ol.signatory_id = s.id
      LEFT JOIN signatories ss ON ol.secondary_signatory_id = ss.id
      LEFT JOIN letterheads l ON ol.letterhead_id = l.id
      WHERE ol.id = ? AND ol.isActive = 1
    `).get(id) as any;

    if (!offerLetter) {
      return res.status(404).json({ error: 'Offer letter not found' });
    }

    // If no letterhead assigned, try to get the default one
    let letterhead = null;
    if (!offerLetter.letterhead_header) {
      letterhead = db.prepare(`
        SELECT * FROM letterheads WHERE is_default = 1 AND isActive = 1
      `).get() as any;
    }

    // Get RAG learned patterns for content (policies, clauses)
    const learnedPatterns = db.prepare(`
      SELECT * FROM rag_learned_patterns ORDER BY createdAt DESC LIMIT 1
    `).get() as any;

    // Get template profile if specified for format-specific clauses
    let templateProfile: any = null;
    if (offerLetter.template_profile_id) {
      templateProfile = db.prepare(`
        SELECT * FROM rag_template_profiles WHERE id = ?
      `).get(offerLetter.template_profile_id) as any;
    }

    const salaryBreakdown: SalaryComponent[] = JSON.parse(offerLetter.salary_breakdown);

    // Format currency
    const formatCurrency = (amount: number) => {
      return amount.toLocaleString('en-IN');
    };

    // Convert number to words
    const numberToWords = (num: number): string => {
      const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
      const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
      const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

      if (num === 0) return 'Zero';

      let words = '';

      if (num >= 10000000) {
        const crores = Math.floor(num / 10000000);
        words += numberToWords(crores) + ' Crore ';
        num %= 10000000;
      }

      if (num >= 100000) {
        const lakhs = Math.floor(num / 100000);
        words += numberToWords(lakhs) + ' Lakh ';
        num %= 100000;
      }

      if (num >= 1000) {
        const thousands = Math.floor(num / 1000);
        words += numberToWords(thousands) + ' Thousand ';
        num %= 1000;
      }

      if (num >= 100) {
        words += ones[Math.floor(num / 100)] + ' Hundred ';
        num %= 100;
      }

      if (num >= 20) {
        words += tens[Math.floor(num / 10)] + ' ';
        num %= 10;
      } else if (num >= 10) {
        words += teens[num - 10] + ' ';
        num = 0;
      }

      if (num > 0) {
        words += ones[num] + ' ';
      }

      return words.trim();
    };

    // Format dates
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const day = date.getDate();
      const suffix = day === 1 || day === 21 || day === 31 ? 'st' :
                     day === 2 || day === 22 ? 'nd' :
                     day === 3 || day === 23 ? 'rd' : 'th';
      return `${day}${suffix} ${months[date.getMonth()]}, ${date.getFullYear()}`;
    };

    const ctcInWords = numberToWords(offerLetter.annual_ctc);

    // Get letterhead images
    const headerImage = offerLetter.letterhead_header || letterhead?.header_image;
    const footerImage = offerLetter.letterhead_footer || letterhead?.footer_image;
    const logoImage = offerLetter.letterhead_logo || letterhead?.logo_image;

    // Create PDF document with proper margins for letterhead
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: headerImage ? 100 : 50, bottom: footerImage ? 80 : 50, left: 50, right: 50 }
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Offer_Letter_${offerLetter.candidate_name.replace(/\s+/g, '_')}.pdf"`);

    // Pipe the PDF to the response
    doc.pipe(res);

    // Add header image from letterhead (PHONEME logo at top)
    const letterheadDir = path.join(process.cwd(), 'uploads', 'letterheads');
    if (headerImage) {
      const headerPath = path.join(letterheadDir, headerImage);
      if (fs.existsSync(headerPath)) {
        // Get image dimensions to maintain aspect ratio
        doc.image(headerPath, 0, 0, { width: 595.28 }); // A4 width in points
      }
    } else if (logoImage) {
      // Fallback to logo if no header
      const logoPath = path.join(letterheadDir, logoImage);
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 20, { width: 120 });
      }
    }

    // Add footer to each page
    const addFooter = () => {
      if (footerImage) {
        const footerPath = path.join(letterheadDir, footerImage);
        if (fs.existsSync(footerPath)) {
          // Position footer at bottom of page
          doc.image(footerPath, 0, 770, { width: 595.28 }); // Position near bottom
        }
      }
    };

    // Start content after header
    doc.y = headerImage ? 100 : 60;

    // Get RAG learned content - prioritize template profile clauses, then learned patterns, then defaults
    const workingHours = templateProfile?.working_hours_clause || learnedPatterns?.working_hours || 'Your working hours will be 9:00 am to 06:00 pm. As per current company policy, you need to complete 9 hours in a day. The company observes a 5-day work week, with Saturday and Sunday as weekly off.';
    const probationPeriod = templateProfile?.probation_clause || learnedPatterns?.probation_period || 'You will be on probation for six months. Based on your performance, your services will be confirmed with the company in writing after six months.';
    const noticePeriod = templateProfile?.notice_period_clause || learnedPatterns?.notice_period || 'This appointment may be terminated by either side by giving thirty days notice or one month\'s salary in lieu of notice period.';
    const leavePolicy = templateProfile?.leave_policy_clause || learnedPatterns?.leave_policy || null;
    const confidentialityClause = templateProfile?.confidentiality_clause || null;
    const terminationClause = templateProfile?.termination_clause || null;
    const generalTermsClause = templateProfile?.general_terms_clause || null;
    const benefitsSection = templateProfile?.benefits_section || null;
    const companyName = offerLetter.letterhead_company_name || letterhead?.company_name || 'Phoneme Solutions Pvt. Ltd.';

    // Add footer on first page
    addFooter();

    // Title
    doc.fontSize(14).font('Helvetica-Bold').text('OFFER LETTER', { align: 'center', underline: true });
    doc.moveDown(1);

    // Date
    doc.fontSize(10).font('Helvetica').text(`Date: ${formatDate(offerLetter.letter_date)}`, { align: 'right' });
    doc.moveDown(1);

    // To
    doc.font('Helvetica-Bold').text('To,');
    doc.font('Helvetica').text(offerLetter.candidate_name);
    doc.text(offerLetter.candidate_address);
    doc.moveDown(1);

    // Subject
    doc.font('Helvetica-Bold').text(`Subject: Offer for the post of ${offerLetter.designation}`, { underline: true });
    doc.moveDown(1);

    // Greeting
    doc.font('Helvetica').text(`Dear ${offerLetter.candidate_name.split(' ')[0]},`);
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('Congratulations!');
    doc.moveDown(0.5);

    // Body - using company name from letterhead
    const bodyText = `This is with reference to your application and subsequent interview held with ${companyName}. We are pleased to offer you as "${offerLetter.designation}" in our organization on the following terms and conditions.`;
    doc.font('Helvetica').text(bodyText, { align: 'justify' });
    doc.moveDown(1);

    // Terms and Conditions - using RAG learned patterns
    doc.font('Helvetica-Bold').text('1. Commencement of Employment:');
    doc.font('Helvetica').text(`Your joining date is ${formatDate(offerLetter.joining_date)}.`, { align: 'justify' });
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').text('2. Remuneration:');
    doc.font('Helvetica').text(`Your total annual compensation would be INR ${formatCurrency(offerLetter.annual_ctc)}/- (${ctcInWords} Rupees Only) per annum. CTC Breakup is provided in Annexure A.`, { align: 'justify' });
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').text('3. Place of Work:');
    doc.font('Helvetica').text(`Your place of work will be ${offerLetter.working_location}.`, { align: 'justify' });
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').text('4. Working Hours:');
    doc.font('Helvetica').text(workingHours, { align: 'justify' });
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').text('5. Probation Period:');
    doc.font('Helvetica').text(probationPeriod, { align: 'justify' });
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').text('6. Notice Period:');
    doc.font('Helvetica').text(noticePeriod, { align: 'justify' });
    doc.moveDown(0.5);

    let sectionNum = 7;

    // Add leave policy if available from RAG
    if (leavePolicy) {
      doc.font('Helvetica-Bold').text(`${sectionNum}. Leave Policy:`);
      doc.font('Helvetica').text(leavePolicy, { align: 'justify' });
      doc.moveDown(0.5);
      sectionNum++;
    }

    // Add benefits section if available from template
    if (benefitsSection) {
      doc.font('Helvetica-Bold').text(`${sectionNum}. Benefits:`);
      doc.font('Helvetica').text(benefitsSection, { align: 'justify' });
      doc.moveDown(0.5);
      sectionNum++;
    }

    doc.font('Helvetica-Bold').text(`${sectionNum}. Confidentiality:`);
    const confidentialityText = confidentialityClause || 'During your employment with the company and thereafter, you will hold in strictest confidence all proprietary information and trade secrets of the company.';
    doc.font('Helvetica').text(confidentialityText, { align: 'justify' });
    doc.moveDown(0.5);
    sectionNum++;

    // Add general terms if available from template
    if (generalTermsClause) {
      doc.font('Helvetica-Bold').text(`${sectionNum}. General Terms:`);
      doc.font('Helvetica').text(generalTermsClause, { align: 'justify' });
      doc.moveDown(0.5);
      sectionNum++;
    }

    // Add termination clause if available from template
    if (terminationClause) {
      doc.font('Helvetica-Bold').text(`${sectionNum}. Termination:`);
      doc.font('Helvetica').text(terminationClause, { align: 'justify' });
      doc.moveDown(0.5);
    }
    doc.moveDown(0.5);

    // Acceptance
    doc.font('Helvetica').text(`Please accept this offer by signing and returning the acceptance copy on or before ${formatDate(offerLetter.offer_valid_till)}, failing which this offer stands cancelled.`, { align: 'justify' });
    doc.moveDown(1);

    doc.text(`We welcome you to the ${companyName.replace(' Pvt. Ltd.', '').replace(' Private Limited', '')} family and wish you a successful career with us.`);
    doc.moveDown(2);

    // Signatures Section
    doc.font('Helvetica').text('Regards,');
    doc.text(`For ${companyName}.`);
    doc.moveDown(1.5);

    // Two signature columns
    const leftX = 50;
    const rightX = 320;
    const currentY = doc.y;

    // HR Signature (Left)
    if (offerLetter.signatory_signature) {
      const sigPath = path.join(process.cwd(), 'uploads', 'signatures', offerLetter.signatory_signature);
      if (fs.existsSync(sigPath)) {
        doc.image(sigPath, leftX, currentY, { width: 80 });
      }
    }
    doc.y = currentY + 50;
    doc.fontSize(10).text(offerLetter.signatory_name || offerLetter.hr_manager_name, leftX, doc.y, { width: 200 });
    doc.text(offerLetter.signatory_position || offerLetter.hr_manager_title, leftX, doc.y, { width: 200 });

    // Director Signature (Right)
    if (offerLetter.secondary_signatory_signature) {
      const secSigPath = path.join(process.cwd(), 'uploads', 'signatures', offerLetter.secondary_signatory_signature);
      if (fs.existsSync(secSigPath)) {
        doc.image(secSigPath, rightX, currentY, { width: 80 });
      }
    }
    doc.y = currentY + 50;
    if (offerLetter.secondary_signatory_name) {
      doc.text(offerLetter.secondary_signatory_name, rightX, doc.y, { width: 200 });
      doc.text(offerLetter.secondary_signatory_position || 'Director', rightX, doc.y, { width: 200 });
    }

    // Add new page for Annexure A with header and footer
    doc.addPage();
    // Add header on new page
    if (headerImage) {
      const headerPath = path.join(letterheadDir, headerImage);
      if (fs.existsSync(headerPath)) {
        doc.image(headerPath, 0, 0, { width: 595.28 });
      }
    }
    addFooter();
    doc.y = headerImage ? 100 : 50;

    // Annexure A - Salary Breakup
    doc.fontSize(14).font('Helvetica-Bold').text('ANNEXURE A', { align: 'center' });
    doc.fontSize(12).text('Salary Break Up', { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(10).font('Helvetica-Bold').text(`Candidate Name: ${offerLetter.candidate_name}`);
    doc.text(`Designation: ${offerLetter.designation}`);
    doc.moveDown(1);

    // Salary Table
    const tableTop = doc.y;
    const tableLeft = 50;
    const colWidths = [250, 120, 120];

    // Table Header
    doc.rect(tableLeft, tableTop, colWidths[0], 25).fill('#f0f0f0').stroke();
    doc.rect(tableLeft + colWidths[0], tableTop, colWidths[1], 25).fill('#f0f0f0').stroke();
    doc.rect(tableLeft + colWidths[0] + colWidths[1], tableTop, colWidths[2], 25).fill('#f0f0f0').stroke();

    doc.fillColor('black');
    doc.font('Helvetica-Bold');
    doc.text('Component', tableLeft + 5, tableTop + 8);
    doc.text('Per Month (INR)', tableLeft + colWidths[0] + 5, tableTop + 8);
    doc.text('Annual (INR)', tableLeft + colWidths[0] + colWidths[1] + 5, tableTop + 8);

    // Table Rows
    let yPos = tableTop + 25;
    doc.font('Helvetica');
    salaryBreakdown.forEach((item) => {
      doc.rect(tableLeft, yPos, colWidths[0], 22).stroke();
      doc.rect(tableLeft + colWidths[0], yPos, colWidths[1], 22).stroke();
      doc.rect(tableLeft + colWidths[0] + colWidths[1], yPos, colWidths[2], 22).stroke();

      doc.text(item.component, tableLeft + 5, yPos + 6);
      doc.text(formatCurrency(item.perMonth), tableLeft + colWidths[0] + 5, yPos + 6);
      doc.text(formatCurrency(item.annual), tableLeft + colWidths[0] + colWidths[1] + 5, yPos + 6);

      yPos += 22;
    });

    // Total Row
    const totalMonthly = salaryBreakdown.reduce((sum, item) => sum + item.perMonth, 0);
    const totalAnnual = salaryBreakdown.reduce((sum, item) => sum + item.annual, 0);

    doc.rect(tableLeft, yPos, colWidths[0], 25).fill('#e0e0e0').stroke();
    doc.rect(tableLeft + colWidths[0], yPos, colWidths[1], 25).fill('#e0e0e0').stroke();
    doc.rect(tableLeft + colWidths[0] + colWidths[1], yPos, colWidths[2], 25).fill('#e0e0e0').stroke();

    doc.fillColor('black');
    doc.font('Helvetica-Bold');
    doc.text('Total CTC', tableLeft + 5, yPos + 8);
    doc.text(formatCurrency(totalMonthly), tableLeft + colWidths[0] + 5, yPos + 8);
    doc.text(formatCurrency(totalAnnual), tableLeft + colWidths[0] + colWidths[1] + 5, yPos + 8);

    doc.moveDown(3);

    // Acceptance Section - new page with header and footer
    doc.addPage();
    // Add header on acceptance page
    if (headerImage) {
      const headerPath = path.join(letterheadDir, headerImage);
      if (fs.existsSync(headerPath)) {
        doc.image(headerPath, 0, 0, { width: 595.28 });
      }
    }
    addFooter();
    doc.y = headerImage ? 100 : 50;

    doc.fontSize(14).font('Helvetica-Bold').text('ACCEPTANCE COPY', { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(10).font('Helvetica').text('I have read and understood the above terms & conditions of employment and I accept them.', { align: 'justify' });
    doc.moveDown(3);

    doc.text('Signature: ________________________');
    doc.moveDown(1);
    doc.text(`Name: ${offerLetter.candidate_name}`);
    doc.moveDown(1);
    doc.text('Date: ________________________');

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

export default router;
