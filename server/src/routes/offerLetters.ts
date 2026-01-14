import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import OpenAI from 'openai';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { getGmailClient } from '../utils/googleAuth.js';
import type {
  OfferLetter,
  OfferLetterWithCreator,
  OfferLetterWithSignatory,
  CreateOfferLetterInput,
  UpdateOfferLetterInput,
  SalaryComponent
} from '../types.js';

const router = Router();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// RAG Helper: Generate embedding for text
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return [];
  }
}

// RAG Helper: Calculate cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// RAG Helper: Find similar content from HR documents
async function findSimilarContent(query: string, topK: number = 3): Promise<string[]> {
  try {
    const queryEmbedding = await generateEmbedding(query);
    if (queryEmbedding.length === 0) return [];

    const embeddings = db.prepare(`
      SELECT e.chunk_text, e.embedding, d.original_name
      FROM rag_embeddings e
      JOIN rag_documents d ON e.document_id = d.id
      WHERE d.isActive = 1 AND d.status = 'completed'
    `).all() as { chunk_text: string; embedding: string; original_name: string }[];

    const similarities = embeddings.map(emb => {
      const embVector = JSON.parse(emb.embedding) as number[];
      return {
        chunk: emb.chunk_text,
        similarity: cosineSimilarity(queryEmbedding, embVector),
        documentName: emb.original_name,
      };
    });

    similarities.sort((a, b) => b.similarity - a.similarity);
    return similarities.slice(0, topK).map(s => s.chunk);
  } catch (error) {
    console.error('Error finding similar content:', error);
    return [];
  }
}

// Helper: Replace placeholders in template clauses with actual values
function replacePlaceholders(template: string | null, data: {
  candidate_name?: string;
  first_name?: string;
  designation?: string;
  joining_date?: string;
  joining_date_formatted?: string;
  annual_ctc?: number;
  ctc_formatted?: string;
  ctc_in_words?: string;
  working_location?: string;
  office_location?: string;
  company_name?: string;
  company_address?: string;
  hr_manager_name?: string;
  hr_manager_title?: string;
  reporting_manager?: string;
  probation_period?: string;
  notice_period?: string;
  offer_valid_till?: string;
  offer_valid_till_formatted?: string;
}): string {
  if (!template) return '';

  let result = template;

  // Replace all placeholders - support multiple formats: {{placeholder}}, [placeholder], and plain text
  const replacements: Record<string, string> = {
    // Candidate name variants
    '{{candidate_name}}': data.candidate_name || '',
    '[candidate_name]': data.candidate_name || '',
    '[Candidate Name]': data.candidate_name || '',
    // First name variants
    '{{first_name}}': data.first_name || '',
    '{{First Name}}': data.first_name || '',
    '[First Name]': data.first_name || '',
    '[first_name]': data.first_name || '',
    // Position/Designation variants
    '{{designation}}': data.designation || '',
    '{{position}}': data.designation || '',
    '[designation]': data.designation || '',
    '[position]': data.designation || '',
    // Date variants
    '{{joining_date}}': data.joining_date_formatted || data.joining_date || '',
    '[joining_date]': data.joining_date_formatted || data.joining_date || '',
    // CTC variants
    '{{annual_ctc}}': data.ctc_formatted || String(data.annual_ctc || ''),
    '[annual_ctc]': data.ctc_formatted || String(data.annual_ctc || ''),
    '{{ctc_in_words}}': data.ctc_in_words || '',
    '[ctc_in_words]': data.ctc_in_words || '',
    // Location variants
    '{{working_location}}': data.working_location || data.office_location || '',
    '{{office_location}}': data.office_location || data.working_location || '',
    '[working_location]': data.working_location || data.office_location || '',
    '[office_location]': data.office_location || data.working_location || '',
    // Company variants
    '{{company_name}}': data.company_name || '',
    '[company_name]': data.company_name || '',
    '{{company_address}}': data.company_address || '',
    '[company_address]': data.company_address || '',
    // Manager variants
    '{{hr_manager_name}}': data.hr_manager_name || '',
    '[hr_manager_name]': data.hr_manager_name || '',
    '{{hr_manager_title}}': data.hr_manager_title || '',
    '[hr_manager_title]': data.hr_manager_title || '',
    '{{reporting_manager}}': data.reporting_manager || data.hr_manager_name || '',
    '[reporting_manager]': data.reporting_manager || data.hr_manager_name || '',
    // Period variants
    '{{probation_period}}': data.probation_period || '6 months',
    '[probation_period]': data.probation_period || '6 months',
    '{{notice_period}}': data.notice_period || '1 month',
    '[notice_period]': data.notice_period || '1 month',
    // Offer validity
    '{{offer_valid_till}}': data.offer_valid_till_formatted || data.offer_valid_till || '',
    '[offer_valid_till]': data.offer_valid_till_formatted || data.offer_valid_till || '',
  };

  for (const [placeholder, value] of Object.entries(replacements)) {
    // Escape special regex characters in placeholder
    const escapedPlaceholder = placeholder.replace(/[{}[\]]/g, '\\$&');
    result = result.replace(new RegExp(escapedPlaceholder, 'gi'), value);
  }

  return result;
}

// RAG Helper: Get offer letter section content from uploaded documents
async function getOfferLetterSectionContent(sectionType: string, candidateData: any): Promise<string> {
  try {
    // Query for relevant content
    const query = `${sectionType} section in offer letter for ${candidateData.designation}`;
    const similarChunks = await findSimilarContent(query, 3);

    if (similarChunks.length === 0) {
      return ''; // Return empty to use default
    }

    // Use AI to generate contextual content based on learned patterns
    const prompt = `Based on these reference offer letter sections, generate the "${sectionType}" content for:
- Candidate: ${candidateData.candidate_name}
- Designation: ${candidateData.designation}
- Company: Phoneme Solutions Pvt. Ltd.
- Location: ${candidateData.working_location}
- Joining Date: ${candidateData.joining_date}
- Annual CTC: ${candidateData.annual_ctc}

Reference sections from existing offer letters:
${similarChunks.join('\n\n---\n\n')}

Generate ONLY the section content (no headers), maintaining the same professional tone and legal language. Keep it concise but comprehensive.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an HR expert generating offer letter content. Use the reference sections to maintain consistency in language and format.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    return response.choices[0].message.content || '';
  } catch (error) {
    console.error(`Error getting section content for ${sectionType}:`, error);
    return '';
  }
}

// Get company info from RAG documents
function getCompanyInfoFromRAG(): { name: string; address: string; cin: string; gstin: string; email: string; website: string; regOffice: string } {
  try {
    // Try to get from letterhead document
    const letterhead = db.prepare(`
      SELECT extracted_text FROM rag_documents
      WHERE original_name LIKE '%Letterhead%' AND isActive = 1
      LIMIT 1
    `).get() as { extracted_text: string } | undefined;

    if (letterhead && letterhead.extracted_text) {
      const text = letterhead.extracted_text;
      return {
        name: 'Phoneme Solutions Pvt Ltd.',
        address: text.match(/Advant Navis Business Park[^C]*/i)?.[0]?.replace(/,\s*$/, '').trim() || 'Advant Navis Business Park, B-614 Sector 142, Noida-201307',
        cin: text.match(/CIN:\s*([A-Z0-9]+)/i)?.[1] || 'U74999DL2015PTC275921',
        gstin: text.match(/GST(?:IN)?:\s*([A-Z0-9]+)/i)?.[1] || '07AAHCP9748G1ZX',
        email: text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]+)/)?.[1] || 'info@myphoneme.com',
        website: text.match(/(http[s]?:\/\/[^\s]+)/)?.[1] || 'http://www.myphoneme.com',
        regOffice: text.match(/Reg\.?\s*Off[^:]*:\s*([^i]+?)(?=info|$)/i)?.[1]?.trim() || '1/22, 2nd Floor, Asaf Ali Road, New Delhi-110017',
      };
    }
  } catch (error) {
    console.error('Error getting company info from RAG:', error);
  }

  // Default values
  return {
    name: 'Phoneme Solutions Pvt Ltd.',
    address: 'Advant Navis Business Park, B-614 Sector 142, Noida-201307',
    cin: 'U74999DL2015PTC275921',
    gstin: '07AAHCP9748G1ZX',
    email: 'info@myphoneme.com',
    website: 'http://www.myphoneme.com',
    regOffice: '1/22, 2nd Floor, Asaf Ali Road, New Delhi-110017',
  };
}

// Interface for offer letter content sections
interface OfferLetterContent {
  opening: string;
  commencement: string;
  termsAndConditions: string;
  duties: string[];
  salary: string;
  workingHours: string;
  probation: string;
  noticePeriod: string;
  leave: string;
  confidentiality: string;
  conflictOfInterest: string[];
  termination: string;
  acceptance: string;
  closing: string;
}

// Generate offer letter content from RAG documents
async function generateOfferLetterContentFromRAG(candidateData: any, companyInfo: any): Promise<OfferLetterContent | null> {
  try {
    // Fetch relevant content from HR documents
    const offerLetterQuery = `offer letter sections terms conditions for ${candidateData.designation}`;
    const similarChunks = await findSimilarContent(offerLetterQuery, 5);

    if (similarChunks.length === 0) {
      console.log('No RAG content found, using defaults');
      return null;
    }

    const ragContext = similarChunks.join('\n\n---\n\n');

    // Generate content using AI based on learned patterns
    const prompt = `Based on the reference offer letter sections below, generate offer letter content for:
- Candidate Name: ${candidateData.candidate_name}
- Designation: ${candidateData.designation}
- Company: ${companyInfo.name}
- Location: ${candidateData.working_location}
- Joining Date: ${candidateData.joining_date}
- Annual CTC: Rs. ${candidateData.annual_ctc?.toLocaleString('en-IN')}/-

Reference offer letter sections from company documents:
${ragContext}

Generate a JSON object with these sections (maintain professional HR language from reference):
{
  "opening": "Opening paragraph welcoming candidate and mentioning position...",
  "commencement": "Commencement of appointment section text...",
  "termsAndConditions": "Terms and conditions intro text...",
  "duties": ["duty point 1", "duty point 2", ...],
  "salary": "Salary section text...",
  "workingHours": "Working hours section text...",
  "probation": "Probation period section text...",
  "noticePeriod": "Notice period section text...",
  "leave": "Leave policy section text...",
  "confidentiality": "Confidentiality clause text...",
  "conflictOfInterest": ["point 1", "point 2", ...],
  "termination": "Termination clause text...",
  "acceptance": "Acceptance instruction text...",
  "closing": "Closing message..."
}

Use the EXACT language patterns and legal phrasing from the reference documents. Replace placeholders with actual candidate data.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an HR expert generating offer letter content. Maintain the exact professional tone and legal language from the reference documents.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) return null;

    return JSON.parse(content) as OfferLetterContent;
  } catch (error) {
    console.error('Error generating offer letter content from RAG:', error);
    return null;
  }
}

// Get leave policy content from HR documents
function getLeavePolicy(): string {
  try {
    const leaveDoc = db.prepare(`
      SELECT extracted_text FROM rag_documents
      WHERE (original_name LIKE '%Leave%' OR original_name LIKE '%Policy%') AND isActive = 1
      ORDER BY createdAt DESC
      LIMIT 1
    `).get() as { extracted_text: string } | undefined;

    if (leaveDoc && leaveDoc.extracted_text) {
      // Extract summary of leave types
      const text = leaveDoc.extracted_text;
      const clMatch = text.match(/Casual\s*Leave.*?(\d+)\s*days/i);
      const slMatch = text.match(/Sick\s*Leave.*?(\d+)\s*days/i);
      const elMatch = text.match(/Earned\s*Leave.*?(\d+)\s*days/i);

      if (clMatch || slMatch || elMatch) {
        const parts = [];
        if (clMatch) parts.push(`Casual Leave: ${clMatch[1]} days`);
        if (slMatch) parts.push(`Sick Leave: ${slMatch[1]} days`);
        if (elMatch) parts.push(`Earned Leave: ${elMatch[1]} days`);
        return `You will be entitled for leaves as per company policy (${parts.join(', ')}) after successful completion of your probation period.`;
      }
    }
  } catch (error) {
    console.error('Error getting leave policy:', error);
  }
  return "You will be entitled for the benefits of leaves as per the company's leave policy after successful completion of your probation period.";
}

// Get working hours from HR documents
function getWorkingHours(): { hours: string; days: string } {
  try {
    const policyDoc = db.prepare(`
      SELECT extracted_text FROM rag_documents
      WHERE original_name LIKE '%Policy%' AND isActive = 1
      LIMIT 1
    `).get() as { extracted_text: string } | undefined;

    if (policyDoc && policyDoc.extracted_text) {
      const text = policyDoc.extracted_text;
      const hoursMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*to\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
      const daysMatch = text.match(/(Monday\s*to\s*(?:Friday|Saturday))/i);

      return {
        hours: hoursMatch ? `${hoursMatch[1]} to ${hoursMatch[2]}` : '9:00 AM to 6:00 PM',
        days: daysMatch ? daysMatch[1] : 'Monday to Saturday',
      };
    }
  } catch (error) {
    console.error('Error getting working hours:', error);
  }
  return { hours: '9:00 AM to 6:00 PM', days: 'Monday to Saturday' };
}

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
    if (!input.signatory_id) missingFields.push('signatory_id (HR Signatory)');
    // secondary_signatory_id is optional - user can skip director signatory

    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
    }

    // Validate that signatories exist
    const hrSignatory = db.prepare('SELECT id FROM signatories WHERE id = ? AND isActive = 1').get(input.signatory_id);
    if (!hrSignatory) {
      return res.status(400).json({ error: 'HR Signatory not found. Please select a valid HR signatory.' });
    }

    // Validate secondary signatory only if provided
    if (input.secondary_signatory_id) {
      const directorSignatory = db.prepare('SELECT id FROM signatories WHERE id = ? AND isActive = 1').get(input.secondary_signatory_id);
      if (!directorSignatory) {
        return res.status(400).json({ error: 'Director Signatory not found. Please select a valid Director signatory.' });
      }
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

    // Debug: Log KRA data being saved
    console.log('=== Creating Offer Letter ===');
    console.log('input.kra_details received:', JSON.stringify(input.kra_details, null, 2));
    console.log('KRA to be saved:', input.kra_details ? JSON.stringify(input.kra_details) : 'null');
    console.log('=== End KRA Debug ===');

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
      input.signatory_id,
      input.secondary_signatory_id,
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

// Generate PDF for offer letter - Complete PHONEME format with all sections
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

    // Get RAG template profile if available
    let templateProfile: any = null;
    if (offerLetter.template_profile_id) {
      templateProfile = db.prepare(`
        SELECT * FROM rag_template_profiles WHERE id = ? AND isActive = 1
      `).get(offerLetter.template_profile_id) as any;
    }
    if (!templateProfile) {
      templateProfile = db.prepare(`
        SELECT * FROM rag_template_profiles WHERE is_default = 1 AND isActive = 1
      `).get() as any;
    }

    // Debug: Log template profile info
    console.log('=== Template Profile Debug ===');
    console.log('Template profile ID:', templateProfile?.id);
    console.log('Template profile name:', templateProfile?.profile_name);
    console.log('Has all_sections_content:', !!templateProfile?.all_sections_content);
    if (templateProfile?.all_sections_content) {
      try {
        const sections = JSON.parse(templateProfile.all_sections_content);
        console.log('Number of sections in template:', sections.length);
        console.log('Section titles:', sections.map((s: any) => s.section_title).join(', '));
      } catch (e) {
        console.log('Error parsing all_sections_content:', e);
      }
    }

    // Get KRA details if available
    const kraDetails = offerLetter.kra_details ? JSON.parse(offerLetter.kra_details) : [];
    console.log('=== PDF Generation Debug ===');
    console.log('Offer letter ID:', offerLetter.id);
    console.log('Raw kra_details from DB:', offerLetter.kra_details);
    console.log('Parsed kraDetails:', JSON.stringify(kraDetails, null, 2));
    console.log('kraDetails length:', kraDetails.length);
    console.log('=== End Debug ===');

    const salaryBreakdown: SalaryComponent[] = JSON.parse(offerLetter.salary_breakdown);

    // Format currency (Indian format)
    const formatCurrency = (amount: number) => {
      return amount.toLocaleString('en-IN');
    };

    // Convert number to words (Indian format - Lakh)
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

    // Format date with superscript ordinal (e.g., "Sep 02nd, 2024")
    const formatDateWithOrdinal = (dateStr: string) => {
      const date = new Date(dateStr);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = date.getDate();
      const suffix = day === 1 || day === 21 || day === 31 ? 'st' :
                     day === 2 || day === 22 ? 'nd' :
                     day === 3 || day === 23 ? 'rd' : 'th';
      const paddedDay = day < 10 ? `0${day}` : day;
      return `${months[date.getMonth()]} ${paddedDay}${suffix}, ${date.getFullYear()}`;
    };

    // Format dates with ordinal suffix (short format DD-Mon-YY)
    const formatDateShort = (dateStr: string) => {
      const date = new Date(dateStr);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = date.getDate();
      const year = date.getFullYear().toString().slice(-2);
      return `${day}-${months[date.getMonth()]}-${year}`;
    };

    // Format dates with ordinal suffix (long format)
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const day = date.getDate();
      const suffix = day === 1 || day === 21 || day === 31 ? 'st' :
                     day === 2 || day === 22 ? 'nd' :
                     day === 3 || day === 23 ? 'rd' : 'th';
      return `${day}${suffix} ${months[date.getMonth()]} ${date.getFullYear()}`;
    };

    // Format date as "02 Sep 2024"
    const formatDateSimple = (dateStr: string) => {
      const date = new Date(dateStr);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = date.getDate();
      const paddedDay = day < 10 ? `0${day}` : day;
      return `${paddedDay} ${months[date.getMonth()]} ${date.getFullYear()}`;
    };

    const ctcInWords = numberToWords(offerLetter.annual_ctc);

    // Get company info from RAG documents (letterhead, etc.)
    const ragCompanyInfo = getCompanyInfoFromRAG();
    const companyName = offerLetter.letterhead_company_name || letterhead?.company_name || ragCompanyInfo.name;
    const companyAddress = offerLetter.letterhead_company_address || letterhead?.company_address || ragCompanyInfo.address;
    const companyCIN = ragCompanyInfo.cin;
    const companyGSTIN = ragCompanyInfo.gstin;
    const companyEmail = ragCompanyInfo.email;
    const companyWebsite = ragCompanyInfo.website;
    const companyRegOffice = ragCompanyInfo.regOffice;

    // Get leave policy and working hours from HR documents
    const leavePolicyText = getLeavePolicy();
    const workingHoursInfo = getWorkingHours();

    // Get letterhead images
    const headerImage = offerLetter.letterhead_header || letterhead?.header_image;
    const footerImage = offerLetter.letterhead_footer || letterhead?.footer_image;

    // Letterhead directory
    const letterheadDir = path.join(process.cwd(), 'uploads', 'letterheads');

    // Colors for branding
    const orangeColor = '#E65100';
    const blueColor = '#0066CC';
    const headingColor = '#000000'; // Black for headings (matching Phoneme format)
    const mainFont = 'Times-Roman';
    const boldFont = 'Times-Bold';
    const italicFont = 'Times-Italic';

    // Generate reference number
    const letterDate = new Date(offerLetter.letter_date);
    const fiscalYear = letterDate.getMonth() >= 3 ? letterDate.getFullYear() : letterDate.getFullYear() - 1;
    const nextYear = (fiscalYear + 1) % 100;
    const currentYear = fiscalYear % 100;
    const paddedId = String(offerLetter.id).padStart(6, '0');
    const refNumber = `HR/Offer/${currentYear}-${String(nextYear).padStart(2, '0')}/${paddedId}`;

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 70, left: 50, right: 50 },
      bufferPages: true
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Offer_Letter_${offerLetter.candidate_name.replace(/\s+/g, '_')}.pdf"`);

    // Pipe the PDF to the response
    doc.pipe(res);

    // Check if letterhead is full-page (has header but no separate footer)
    const isFullPageLetterhead = headerImage && !footerImage;

    // Helper function to add header/background for new pages
    const addHeader = () => {
      if (isFullPageLetterhead) {
        // Full-page letterhead - draw as background covering entire page
        const headerPath = path.join(letterheadDir, headerImage);
        if (fs.existsSync(headerPath)) {
          doc.image(headerPath, 0, 0, { width: 595.28, height: 841.89 });
        }
      } else if (headerImage) {
        // Separate header image only
        const headerPath = path.join(letterheadDir, headerImage);
        if (fs.existsSync(headerPath)) {
          doc.image(headerPath, 0, 0, { width: 595.28 });
        }
      } else {
        // Default PHONEME text header
        doc.fontSize(28).fillColor(orangeColor).font('Helvetica-Bold')
          .text('PHONEME', 50, 25, { lineBreak: false });
        doc.moveTo(50, 55).lineTo(545, 55).strokeColor(orangeColor).lineWidth(2).stroke();
      }
      // Reset to default state
      doc.fontSize(10).fillColor('black').font('Helvetica');
      doc.x = 50;
    };

    // Helper function to add footer (only for non-full-page letterheads)
    const addFooter = () => {
      // Skip footer for full-page letterhead (footer is part of the image)
      if (isFullPageLetterhead) return;

      const footerY = 765;
      if (footerImage) {
        const footerPath = path.join(letterheadDir, footerImage);
        if (fs.existsSync(footerPath)) {
          doc.image(footerPath, 0, footerY, { width: 595.28 });
        }
      } else if (!headerImage) {
        // Default orange footer (only if no letterhead at all)
        doc.rect(0, footerY, 595.28, 77).fill(orangeColor);
        doc.fontSize(7).fillColor('white').font('Helvetica')
          .text(`${companyName}. ${companyAddress} CIN: ${companyCIN} GST: ${companyGSTIN}`, 50, footerY + 10, { align: 'center', width: 495, lineBreak: false })
          .text(`Reg.Off: ${companyRegOffice} ${companyEmail}`, 50, footerY + 22, { align: 'center', width: 495, lineBreak: false });
        doc.fillColor(blueColor).text(companyWebsite, 50, footerY + 34, { align: 'center', width: 495, underline: true, lineBreak: false });
      }
      // Reset to default state
      doc.fontSize(10).fillColor('black').font('Helvetica');
    };

    // Helper function to check if new page needed
    const checkPageBreak = (requiredSpace: number = 100) => {
      if (doc.y > 700 - requiredSpace) {
        doc.addPage();
        addHeader();
        addFooter();
        doc.y = isFullPageLetterhead ? 100 : (headerImage ? 70 : 80);
        doc.x = 50;
        // Reset text state after page break
        doc.fontSize(10).fillColor('black').font('Helvetica');
      }
    };

    // Get first name for salutation
    const firstName = offerLetter.candidate_name.split(' ')[0];

    // Determine template type - short for trainee/intern, long for others
    const isShortFormat = false ||
      offerLetter.designation.toLowerCase().includes('trainee') ||
      offerLetter.designation.toLowerCase().includes('intern');

    // ==================== PAGE 1: OFFER CUM APPOINTMENT LETTER ====================
    console.log('PDF Generation - Starting page 1');
    console.log('Header image:', headerImage);
    console.log('Footer image:', footerImage);
    console.log('Candidate:', offerLetter.candidate_name);
    console.log('isFullPageLetterhead:', isFullPageLetterhead);

    // STEP 1: Draw letterhead/header as background FIRST (before any text)
    if (isFullPageLetterhead) {
      // Full-page letterhead - draw as background covering entire page
      const headerPath = path.join(letterheadDir, headerImage);
      if (fs.existsSync(headerPath)) {
        console.log('Drawing full-page letterhead as background:', headerPath);
        doc.image(headerPath, 0, 0, { width: 595.28, height: 841.89 });
      }
    } else if (headerImage) {
      // Separate header image only
      const headerPath = path.join(letterheadDir, headerImage);
      if (fs.existsSync(headerPath)) {
        doc.image(headerPath, 0, 0, { width: 595.28 });
      }
      // Draw footer if exists
      if (footerImage) {
        const footerPath = path.join(letterheadDir, footerImage);
        if (fs.existsSync(footerPath)) {
          doc.image(footerPath, 0, 765, { width: 595.28 });
        }
      }
    } else {
      // No letterhead image - draw default PHONEME header and footer
      doc.fontSize(28).fillColor(orangeColor).font('Helvetica-Bold');
      doc.text('PHONEME', 50, 25, { lineBreak: false });
      doc.moveTo(50, 55).lineTo(545, 55).strokeColor(orangeColor).lineWidth(2).stroke();

      // Default orange footer
      const defaultFooterY = 765;
      doc.rect(0, defaultFooterY, 595.28, 77).fill(orangeColor);
      doc.fontSize(7).fillColor('white').font('Helvetica');
      doc.text(`${companyName}. ${companyAddress} CIN: ${companyCIN} GST: ${companyGSTIN}`, 50, defaultFooterY + 10, { align: 'center', width: 495, lineBreak: false });
      doc.text(`Reg.Off: ${companyRegOffice} ${companyEmail}`, 50, defaultFooterY + 22, { align: 'center', width: 495, lineBreak: false });
      doc.fillColor(blueColor).text(companyWebsite, 50, defaultFooterY + 34, { align: 'center', width: 495, underline: true, lineBreak: false });
    }

    // STEP 2: Reset text properties and prepare for content
    doc.font(mainFont).fontSize(10).fillColor('black');
    doc.x = 50;

    // Set starting position for content based on letterhead type
    // Full-page letterhead: content starts around Y=100 (after header portion)
    // Separate header or no header: Y=70-80
    const startY = isFullPageLetterhead ? 100 : (headerImage ? 70 : 80);
    console.log('Content start Y:', startY);

    // Title - draw with explicit positioning (black heading, Times font)
    doc.font(boldFont).fontSize(12).fillColor(headingColor);
    const titleText = 'OFFER CUM APPOINTMENT LETTER';
    doc.text(titleText, 50, startY, { width: 495, align: 'center', underline: true });
    console.log('Title drawn');

    // Reference and Date
    doc.fillColor('black').font('Helvetica-Bold').fontSize(10);
    doc.text(refNumber, 50, startY + 30);
    doc.text(formatDateShort(offerLetter.letter_date), 400, startY + 30, { width: 145, align: 'right' });

    // Prepare template data for placeholder replacement (needed before greeting)
    const templateData: Record<string, any> = {
      candidate_name: offerLetter.candidate_name,
      first_name: firstName,
      'First Name': firstName,
      '[First Name]': firstName,
      designation: offerLetter.designation,
      position: offerLetter.designation,
      joining_date: offerLetter.joining_date,
      joining_date_formatted: formatDate(offerLetter.joining_date),
      annual_ctc: offerLetter.annual_ctc,
      ctc_formatted: `Rs. ${formatCurrency(offerLetter.annual_ctc)}/-`,
      ctc_in_words: ctcInWords,
      working_location: offerLetter.working_location || companyAddress,
      office_location: offerLetter.working_location || companyAddress,
      company_name: companyName,
      company_address: companyAddress,
      reporting_manager: offerLetter.hr_manager_name || 'Reporting Manager',
      hr_manager_name: offerLetter.hr_manager_name || offerLetter.signatory_name,
      hr_manager_title: offerLetter.hr_manager_title || offerLetter.signatory_position,
      probation_period: '6 months',
      notice_period: '1 month',
      offer_valid_till: offerLetter.offer_valid_till,
      offer_valid_till_formatted: formatDate(offerLetter.offer_valid_till),
    };

    // Greeting - use template format if available, replace all placeholder variants
    let greetingText = templateProfile?.greeting_format || `Dear ${firstName},`;
    greetingText = greetingText
      .replace(/\{\{first_name\}\}/gi, firstName)
      .replace(/\{\{First Name\}\}/gi, firstName)
      .replace(/\[First Name\]/gi, firstName)
      .replace(/Dear \[First Name\]/gi, `Dear ${firstName}`);
    doc.font(mainFont).fillColor('black');
    doc.text(greetingText, 50, startY + 55);

    // Opening paragraph - use template if available
    const defaultOpeningPara = `On behalf of ${companyName}. Based on your applications, interviews & discussions we have had, we are pleased to offer you the position of ${offerLetter.designation} at our office in ${offerLetter.working_location || 'Head Office as well as Regional Offices'}. You will be reporting to the concerned Manager at the designated office. Your employment with us shall be governed by the following terms and conditions. This offer will be valid till the Date of Joining ${formatDate(offerLetter.joining_date)}.`;
    const openingPara = templateProfile?.opening_paragraph
      ? replacePlaceholders(templateProfile.opening_paragraph, templateData)
      : defaultOpeningPara;
    doc.text(openingPara, 50, startY + 75, { width: 495, align: 'justify' });

    // Track position manually
    let yPos = startY + 75 + doc.heightOfString(openingPara, { width: 495 }) + 15;

    // ==================== CHECK IF USING FULL TEMPLATE MODE ====================
    // If template has all_sections_content, use ONLY template content (skip hardcoded sections)
    const useFullTemplateMode = templateProfile?.all_sections_content &&
      JSON.parse(templateProfile.all_sections_content).length > 0;

    if (useFullTemplateMode) {
      console.log('=== FULL TEMPLATE MODE: Using all sections from template ===');
      const templateSections = JSON.parse(templateProfile.all_sections_content);
      console.log(`Rendering ${templateSections.length} sections from template`);

      doc.y = yPos;
      let sectionNumber = 1;

      for (const section of templateSections) {
        const title = (section.section_title || '').toLowerCase();

        // Skip these sections (handled separately or are closing sections)
        if (title.includes('annexure') ||
            title.includes('acknowledgement') ||
            title.includes('for phoneme') ||
            title.includes('offer cum appointment letter')) {
          console.log(`Skipping section (handled separately): ${section.section_title}`);
          continue;
        }

        checkPageBreak(150);

        // Section heading
        const sectionTitle = section.section_title?.toUpperCase() || `SECTION ${sectionNumber}`;
        doc.fillColor(headingColor).font(boldFont);
        doc.text(`${sectionNumber}.    ${sectionTitle}:`);
        doc.moveDown(0.3);

        // Section content - replace placeholders
        let content = section.section_content || '';
        content = replacePlaceholders(content, templateData);

        if (content) {
          doc.fillColor('black').font(mainFont);
          doc.text(content, { align: 'justify' });
        }

        // Render subsections if present
        if (section.has_subsections && section.subsections && Array.isArray(section.subsections)) {
          doc.moveDown(0.3);
          for (const sub of section.subsections) {
            checkPageBreak(40);
            const subMarker = sub.marker || sub.letter || sub.number || '-';
            let subContent = sub.content || '';
            subContent = replacePlaceholders(subContent, templateData);
            doc.text(`    ${subMarker}.   ${subContent}`, { align: 'justify', indent: 20 });
            doc.moveDown(0.3);
          }
        }

        doc.moveDown(1);
        sectionNumber++;
        console.log(`Rendered section ${sectionNumber - 1}: ${section.section_title}`);
      }

      console.log(`=== Finished rendering ${sectionNumber - 1} sections from template ===`);

      // Skip to closing/signature section (jump past all hardcoded content)
      // The code below handles Annexures, Acknowledgement, and Signature
    } else {
      // ==================== FALLBACK: USE HARDCODED SECTIONS ====================
      console.log('=== Using hardcoded sections (no template content available) ===');

    // Section 1 heading (only in fallback mode)
    doc.fillColor(headingColor).font(boldFont);
    doc.text('1.    COMMENCEMENT OF APPOINTMENT:', 50, yPos);
    yPos += 18;
    doc.fillColor('black').font(mainFont);

    const section1Part1 = `Your appointment is effective from the date of joining which shall be not later than ${formatDate(offerLetter.joining_date)}. On the date of your joining, you are required to handover previous companies relieving letter & conduct certificate, before signing the hardcopy of this offer letter in order to complete the onboarding process headquartered at `;
    const section1Part2 = `. ${offerLetter.working_location || companyAddress}. Please note that if at any point in time, the Company is of the opinion that the documents provided are false or your background verification is not satisfactory, your employment may be terminated with immediate effect.`;

    // Write with bold company name
    doc.text(section1Part1, 50, yPos, { width: 495, align: 'justify', continued: true });
    doc.font(boldFont).text(companyName, { continued: true });
    doc.font(mainFont).text(section1Part2, { width: 495, align: 'justify' });

    const fullSection1Text = section1Part1 + companyName + section1Part2;
    yPos += doc.heightOfString(fullSection1Text, { width: 495 }) + 10;

    // CTC
    const ctcText = `During your period of employment, your Annual CTC will be Rs. ${formatCurrency(offerLetter.annual_ctc)}/- (${ctcInWords} only) Per Annum. For detailed breakup please refer to Annexure A.`;
    doc.text(ctcText, 50, yPos, { width: 495, align: 'justify' });
    yPos += doc.heightOfString(ctcText, { width: 495 }) + 10;

    // Note
    doc.font(italicFont).fontSize(9);
    const noteText = 'Note: - "Subject to Deduction of contributions, charges and taxes at source as per the Laws/Acts of Government of India, as may be applicable from time to time".';
    doc.text(noteText, 50, yPos, { width: 495, align: 'justify' });
    yPos += doc.heightOfString(noteText, { width: 495 }) + 10;

    // Terms intro
    doc.fontSize(10).font(mainFont);
    const termsIntro = "Your employment is subject to the terms and conditions set forth in this offer letter and the rules and regulations as set out in the Company's HR policy guidelines:";
    doc.text(termsIntro, 50, yPos, { width: 495, align: 'justify' });
    yPos += doc.heightOfString(termsIntro, { width: 495 }) + 10;

    // Bullets
    const bullet1 = "Pre-employment and ongoing screening: The Company shall conduct in its sole discretion, background and reference checks and verify your salary and employment history. Your initial and ongoing employment is conditional on the Company being satisfied that the results of the background check are compatible with the inherent requirements of your position in the Company.";
    doc.text(bullet1, 60, yPos, { width: 485, align: 'justify' });
    yPos += doc.heightOfString(bullet1, { width: 485 }) + 8;

    const bullet2 = "Termination shall be as per the terms of this agreement and the requirements of applicable law.";
    doc.text(bullet2, 60, yPos, { width: 485, align: 'justify' });
    yPos += doc.heightOfString(bullet2, { width: 485 }) + 15;

    // Set doc.y for the rest
    doc.y = yPos;
    doc.x = 50;

    console.log('PDF first page content written, current Y:', yPos);

    checkPageBreak(200);

    // Section 2: TERMS AND CONDITIONS OF EMPLOYMENT
    doc.fillColor(headingColor).font(boldFont).text('2.    TERMS AND CONDITIONS OF EMPLOYMENT:');
    doc.moveDown(0.3);
    doc.fillColor('black').font(mainFont).text(
      "You shall be required to work as per the requirements of the Company/Company's client and your duties may vary depending upon the requirement of the Company's Client from time to time.",
      { align: 'justify' }
    );
    doc.moveDown(0.5);

    // Duties section
    doc.font(boldFont).text('Duties:');
    doc.moveDown(0.3);
    doc.font(mainFont).text(
      "i.    You acknowledge that, depending on its needs (including, the needs of the Group) the Company may at its sole discretion change your designation and responsibilities, and you agree to serve the Company in such assigned capacities consistent with your position in the Company.",
      { align: 'justify', indent: 20 }
    );
    doc.moveDown(0.5);

    checkPageBreak(150);

    doc.font(boldFont).text('ii.   During the course of employment, you shall: -');
    doc.moveDown(0.3);

    const duringEmploymentPoints = [
      'Diligently, faithfully and to the best of your skill and ability perform and discharge all the duties and functions entrusted to you by the Company.',
      'In addition to the terms and conditions of employment set out herein, adhere to all rules, regulations, Policies, procedures, guidelines and other such items applicable to your work that the Company may from time-to-time frame/ revise/update for observance and compliance by you and the other employees.',
      'Be aware that a violation of any such Policies, procedures and guidelines by you could lead to disciplinary actions, including termination of your employment.',
      'Obey and comply with all lawful orders and directions given by the Company or by any person duly authorized on that behalf and faithfully obey all such rules, regulations and arrangements.',
      'Use all the knowledge, skill and experience that you possess to the best satisfaction of the Company.',
      'Not make any false, defamatory or disparaging statements about the Company and/or its Group Companies, or the employees, officers or directors of the Company and/or its Group Companies, during and after the term of your employment, that are reasonably likely to cause damage to any such entity or person; and',
      'Inform the Company at once of any act of dishonesty and/or any action prejudicial to the interest of the Company, by any person, which may come to your knowledge.'
    ];

    duringEmploymentPoints.forEach((point, idx) => {
      checkPageBreak(60);
      doc.font(mainFont).text(`    ${String.fromCharCode(97 + idx)}.   ${point}`, { align: 'justify', indent: 20 });
      doc.moveDown(0.3);
    });

    checkPageBreak(100);

    // Group Companies definition
    doc.moveDown(0.5);
    doc.font(boldFont).text('For the purpose of these terms and conditions, "Group Companies" or "Group" shall mean the Company and:');
    doc.moveDown(0.3);
    doc.font(mainFont).text('    i.    Any company or other person that directly or indirectly controls the Company; or', { indent: 20 });
    doc.text('    ii.   Any company or other person which is directly or indirectly controlled by the Company; or', { indent: 20 });
    doc.text('    iii.  Any company or other person which is under the common control of the same person who controls the Company.', { indent: 20 });
    doc.moveDown(0.5);

    checkPageBreak(150);

    // For the purpose of this definition
    doc.font(boldFont).text('For the purpose of this definition:');
    doc.moveDown(0.3);
    doc.font(mainFont).text(
      "'control' means in relation to a company, the ownership by any person of more than 50% of the voting rights of that company; and 'person' means any person, firm, company, corporation, society, trust, government, state or agency of a state or any association or partnership (whether having separate legal personality) or two or more of the above, including its successors and permitted assigns.",
      { align: 'justify' }
    );
    doc.moveDown(0.5);

    // Policies section
    doc.fillColor(headingColor).font(boldFont).text('➤  Policies, procedures, rules and code:');
    doc.fillColor('black').font(mainFont).moveDown(0.3);
    doc.text(
      "You agree that during your course of employment with the Company, you shall comply with the Company's policies and procedures, rules and codes in place and any client-related policies as applicable from time to time. These policies and procedures form part of your contract of employment [and the Company may adopt, vary or rescind these policies from time to time in its absolute discretion and without any limitation (implied or otherwise) on its ability to do so].",
      { align: 'justify' }
    );
    doc.moveDown(1);

    checkPageBreak(200);

    // Section 3: SALARY
    doc.fillColor(headingColor).font(boldFont).text('3.    SALARY:');
    doc.moveDown(0.3);
    doc.fillColor('black').font(mainFont).text(
      "You will be eligible for company benefits which are detailed as part of your compensation structure in Annexure-A, attached along with this letter. Your basic salary will be paid according to standard payroll practices, subject to any tax or other deduction provided or permitted by law in force from time to time, such as the employee's share of provident fund contributions if applicable, as well as such other sums as may be agreed with you from time to time. Your fixed salary may be reviewed from time to time in accordance with Company policy but will not necessarily be increased and is paid for in satisfying all the services rendered by you under this agreement, including overtime, to the extent permitted by law. You are encouraged to independently verify the tax implications on your salary. The taxable and non-taxable components of your salary may vary based on the prevailing law as amended from time to time.",
      { align: 'justify' }
    );
    doc.moveDown(0.5);

    // Confidentiality - use template clause if available
    const defaultConfidentialityText = "Your salary/benefit-related details are strictly confidential, and the Company requires that you should not reveal/discuss the same. You shall not indulge in matters pertaining to the salary of others in the Company. During the course of your employment with the Company or at any time thereafter, divulge or disclose to any person whomsoever makes any use whatsoever for your own purpose or for any other purpose other than that of the Company, of any information or knowledge obtained by you during your employment as to the business or affairs of the company including development, process reports and reporting system and you.";
    const confidentialityText = templateProfile?.confidentiality_clause
      ? replacePlaceholders(templateProfile.confidentiality_clause, templateData)
      : defaultConfidentialityText;
    doc.font(boldFont).text('Confidentiality: ', { continued: true });
    doc.font(mainFont).text(confidentialityText, { align: 'justify' });
    doc.moveDown(0.5);

    checkPageBreak(100);

    // Exclusivity
    doc.font(boldFont).text('Exclusivity: ', { continued: true });
    doc.font(mainFont).text(
      "Your position is a whole-time employment with the Company, and you shall devote yourself exclusively to the business of the company. You will not take up any other work for remuneration or work in an advisory capacity or be interested directly or indirectly in any other trade or business during employment with the Company without prior approval in writing from the Company's management.",
      { align: 'justify' }
    );
    doc.moveDown(1);

    checkPageBreak(150);

    // Section 4: WORKING HOURS (from HR documents)
    doc.fillColor(headingColor).font(boldFont).text('4.    WORKING HOURS:');
    doc.moveDown(0.3);
    doc.fillColor('black').font(mainFont).text(
      `Your working hours will be ${workingHoursInfo.hours}. As per current company policy, you need to complete 9 hours in a day. The company observes a ${workingHoursInfo.days.includes('Saturday') ? '6-day' : '5-day'} work week, ${workingHoursInfo.days.includes('Saturday') ? 'with Sunday as weekly off' : 'with Saturday and Sunday as weekly off'}.`,
      { align: 'justify' }
    );
    doc.moveDown(1);

    checkPageBreak(150);

    // Section 5: PROBATION PERIOD
    doc.fillColor(headingColor).font(boldFont).text('5.    PROBATION PERIOD:');
    doc.moveDown(0.3);
    // Use probation clause from template profile if available
    const defaultProbationText = "You will be on probation for six months. Based on your performance, your services will be confirmed with the company in writing after six months. During the probation period, your services can be terminated with seven days' notice on either side and without any reasons whatsoever. If your services are found satisfactory during the probation period, you will be confirmed in the present position.";
    const probationText = templateProfile?.probation_clause
      ? replacePlaceholders(templateProfile.probation_clause, templateData)
      : defaultProbationText;
    doc.fillColor('black').font(mainFont).text(probationText, { align: 'justify' });
    doc.moveDown(1);

    checkPageBreak(150);

    // Section 6: NOTICE PERIOD - use template clause if available
    doc.fillColor(headingColor).font(boldFont).text('6.    NOTICE PERIOD:');
    doc.moveDown(0.3);
    const defaultNoticePeriodText = "This appointment may be terminated by either side by giving thirty days' notice or one month's salary in lieu of notice period. During the notice period, you are supposed to hand over all the assets and belongings and do the complete knowledge transfer. Upon receipt of the above all, during signed by your manager, your full and final settlement will be done. You are not supposed to take any leaves during this period.";
    const noticePeriodText = templateProfile?.notice_period_clause
      ? replacePlaceholders(templateProfile.notice_period_clause, templateData)
      : defaultNoticePeriodText;
    doc.fillColor('black').font(mainFont).text(noticePeriodText, { align: 'justify' });
    doc.moveDown(1);

    checkPageBreak(150);

    // Section 7: LEAVE - use template clause or HR documents
    doc.fillColor(headingColor).font(boldFont).text('7.    LEAVE:');
    doc.moveDown(0.3);
    const leaveText = templateProfile?.leave_policy_clause
      ? replacePlaceholders(templateProfile.leave_policy_clause, templateData)
      : leavePolicyText;
    doc.fillColor('black').font(mainFont).text(leaveText, { align: 'justify' });
    doc.moveDown(1);
    } // End of else block (hardcoded sections fallback)

    // ==================== ADDITIONAL SECTIONS FROM TEMPLATE (LEGACY MODE) ====================
    // Only runs when NOT using full template mode (adds extra sections to hardcoded 1-7)
    if (!useFullTemplateMode && templateProfile?.all_sections_content) {
      try {
        const allSections = JSON.parse(templateProfile.all_sections_content);
        console.log(`Found ${allSections.length} sections in template profile`);
        console.log('All section titles:', allSections.map((s: any) => s.section_title));

        // Render ALL sections from the template that haven't been covered
        // We already rendered sections about: commencement, terms/conditions, salary, working hours, probation, notice, leave
        let nextSectionNumber = 8;

        for (const section of allSections) {
          const title = (section.section_title || '').toLowerCase().trim();
          const sectionNum = section.section_number;

          // Skip empty sections
          if (!section.section_content && (!section.subsections || section.subsections.length === 0)) {
            continue;
          }

          // Skip greeting/closing sections that aren't numbered content sections
          if (title.includes('dear ') || title.startsWith('dear') ||
              title === 'regards' || title === 'acknowledgement' ||
              title.includes('signature') || title.includes('for company')) {
            continue;
          }

          // Check if this is one of the 7 standard sections we already rendered
          // Only skip if it matches closely (not just contains a keyword)
          const standardPatterns = [
            /^(1\.?\s*)?commencement/i,
            /^(2\.?\s*)?terms\s*(and|&)?\s*conditions/i,
            /^(3\.?\s*)?salary$/i,
            /^(3\.?\s*)?remuneration$/i,
            /^(4\.?\s*)?working\s*hours$/i,
            /^(5\.?\s*)?probation/i,
            /^(6\.?\s*)?notice\s*period/i,
            /^(7\.?\s*)?leave$/i,
            /^(7\.?\s*)?leaves$/i,
          ];

          const isStandardSection = standardPatterns.some(pattern => pattern.test(title));

          // Also check by section number (skip sections 1-7)
          const numericSection = parseInt(sectionNum);
          if (!isNaN(numericSection) && numericSection >= 1 && numericSection <= 7) {
            continue;
          }

          if (isStandardSection) {
            console.log(`Skipping standard section: ${title}`);
            continue;
          }

          console.log(`Rendering section ${nextSectionNumber}: ${title}`);

          // Render this section
          checkPageBreak(150);

          // Section heading
          const sectionTitle = section.section_title?.toUpperCase() || `SECTION ${nextSectionNumber}`;
          doc.fillColor(headingColor).font(boldFont);
          doc.text(`${nextSectionNumber}.    ${sectionTitle}:`);
          doc.moveDown(0.3);

          // Section content - replace placeholders
          let content = section.section_content || '';
          content = replacePlaceholders(content, templateData);

          if (content) {
            doc.fillColor('black').font(mainFont);
            doc.text(content, { align: 'justify' });
          }

          // Render subsections if present
          if (section.has_subsections && section.subsections && Array.isArray(section.subsections)) {
            doc.moveDown(0.3);
            for (const sub of section.subsections) {
              checkPageBreak(40);
              const subMarker = sub.marker || sub.letter || sub.number || '-';
              let subContent = sub.content || '';
              subContent = replacePlaceholders(subContent, templateData);
              doc.text(`    ${subMarker}.   ${subContent}`, { align: 'justify', indent: 20 });
              doc.moveDown(0.3);
            }
          }

          doc.moveDown(1);
          nextSectionNumber++;
        }

        console.log(`Rendered ${nextSectionNumber - 8} additional sections from template`);
      } catch (error) {
        console.error('Error rendering additional sections from template:', error);
      }
    }

    checkPageBreak(200);

    // Closing text (italic - Phoneme format)
    doc.font(italicFont).fontSize(10).fillColor('black');
    doc.text(
      `We welcome you to ${companyName} and look forward to a long and mutually beneficial relationship.`,
      { align: 'left' }
    );
    doc.text(
      `Please confirm your acceptance of our offer by signing and returning the duplicate copy of this letter.`,
      { align: 'left' }
    );
    doc.moveDown(1.5);

    // For Company section
    doc.font(mainFont).text('For,');
    doc.font(boldFont).text(`${companyName}`);
    doc.moveDown(1);

    // HR name and title
    const hrName = offerLetter.signatory_name || offerLetter.hr_manager_name || 'HR Manager';
    const hrTitle = offerLetter.signatory_position || offerLetter.hr_manager_title || 'Manager-Human Resource';

    // HR Signature
    if (offerLetter.signatory_signature) {
      const sigPath = path.join(process.cwd(), 'uploads', 'signatures', offerLetter.signatory_signature);
      if (fs.existsSync(sigPath)) {
        doc.image(sigPath, 50, doc.y, { width: 60 });
        doc.y += 40;
      }
    }

    // HR name in blue with underline (Phoneme format)
    doc.fillColor(blueColor).font(boldFont).text(hrName, { underline: true });
    doc.moveDown(0.3);
    doc.fillColor('black').font(boldFont).text(hrTitle);
    doc.moveDown(1);

    // ==================== ACKNOWLEDGEMENT SECTION (Phoneme Format) ====================
    checkPageBreak(200);

    // ACKNOWLEDGEMENT title (black, underlined - Phoneme format)
    doc.fontSize(11).fillColor(headingColor).font(boldFont)
      .text('ACKNOWLEDGEMENT', { underline: true });
    doc.moveDown(1);

    // Acknowledgement text (Phoneme format)
    doc.fillColor('black').fontSize(10).font(mainFont);
    doc.text(
      `This is to certify that I have read this Agreement and all Annexure and understood all the terms and conditions mentioned therein and I hereby accept and agree to abide by them:`,
      { align: 'left' }
    );
    doc.moveDown(2);

    // Signature fields in two columns (Phoneme format)
    const leftColX = 50;
    const rightColX = 300;
    const fieldY = doc.y;

    doc.font(boldFont).text('Name of Employee:', leftColX, fieldY);
    doc.font(boldFont).text('Date:', rightColX, fieldY);
    doc.text('/', rightColX + 40, fieldY);
    doc.text('/', rightColX + 70, fieldY);
    doc.moveDown(1.5);

    doc.font(boldFont).text('Signature of Employee:', leftColX, doc.y);
    doc.font(boldFont).text('Place:', rightColX, doc.y);

    // ==================== NEW PAGE: ANNEXURE-A (Phoneme Format) ====================
    doc.addPage();
    addHeader();
    addFooter();

    // Set starting position for Annexure-A content
    doc.y = headerImage ? 100 : 80;
    doc.x = 50;

    // Annexure-A Title (black, centered, underlined - Phoneme format)
    doc.fontSize(12).fillColor(headingColor).font(boldFont)
      .text('ANNEXURE- A', 50, doc.y, { align: 'center', width: 495, underline: true });
    doc.moveDown(1.5);

    // Salary Break Up subtitle (left-aligned, underlined)
    doc.fontSize(11).font(boldFont).fillColor(headingColor)
      .text('Salary Break Up', 50, doc.y, { underline: true });
    doc.moveDown(1.5);

    // Salary Table - Simple Phoneme format (no colored headers)
    const tableLeft = 50;
    const salaryColWidths = [150, 150, 150];
    const rowHeight = 22;
    const tableTop = doc.y;

    // Table Header Row (simple border, bold text)
    doc.rect(tableLeft, tableTop, salaryColWidths[0], rowHeight).stroke('#000000');
    doc.rect(tableLeft + salaryColWidths[0], tableTop, salaryColWidths[1], rowHeight).stroke('#000000');
    doc.rect(tableLeft + salaryColWidths[0] + salaryColWidths[1], tableTop, salaryColWidths[2], rowHeight).stroke('#000000');

    doc.fillColor('black').font(boldFont).fontSize(10);
    doc.text('Components', tableLeft + 5, tableTop + 6, { width: salaryColWidths[0] - 10 });
    doc.text('Per Month (in Rs.)', tableLeft + salaryColWidths[0] + 5, tableTop + 6, { width: salaryColWidths[1] - 10, align: 'center' });
    doc.text('Annual (in Rs.)', tableLeft + salaryColWidths[0] + salaryColWidths[1] + 5, tableTop + 6, { width: salaryColWidths[2] - 10, align: 'center' });

    // Table Rows - Simple format
    let tableYPos = tableTop + rowHeight;
    doc.font(mainFont);

    salaryBreakdown.forEach((item) => {
      doc.rect(tableLeft, tableYPos, salaryColWidths[0], rowHeight).stroke('#000000');
      doc.rect(tableLeft + salaryColWidths[0], tableYPos, salaryColWidths[1], rowHeight).stroke('#000000');
      doc.rect(tableLeft + salaryColWidths[0] + salaryColWidths[1], tableYPos, salaryColWidths[2], rowHeight).stroke('#000000');

      doc.fillColor('black');
      doc.text(item.component, tableLeft + 5, tableYPos + 6, { width: salaryColWidths[0] - 10 });
      doc.text(formatCurrency(item.perMonth), tableLeft + salaryColWidths[0] + 5, tableYPos + 6, { width: salaryColWidths[1] - 10, align: 'center' });
      doc.text(formatCurrency(item.annual), tableLeft + salaryColWidths[0] + salaryColWidths[1] + 5, tableYPos + 6, { width: salaryColWidths[2] - 10, align: 'center' });

      tableYPos += rowHeight;
    });

    // Total Row (Fixed Salary Total) - with orange background
    const totalMonthly = salaryBreakdown.reduce((sum, item) => sum + item.perMonth, 0);
    const totalAnnual = salaryBreakdown.reduce((sum, item) => sum + item.annual, 0);

    doc.rect(tableLeft, tableYPos, salaryColWidths[0], rowHeight).stroke('#000000');
    doc.rect(tableLeft + salaryColWidths[0], tableYPos, salaryColWidths[1], rowHeight).stroke('#000000');
    doc.rect(tableLeft + salaryColWidths[0] + salaryColWidths[1], tableYPos, salaryColWidths[2], rowHeight).stroke('#000000');

    doc.fillColor('black').font(boldFont);

    tableYPos += rowHeight + 20;
    doc.y = tableYPos;
    doc.moveDown(2);



    // ==================== ANNEXURE-B (KRAs) - Phoneme Format ====================
    console.log('=== Annexure-B Generation ===');
    console.log('kraDetails.length:', kraDetails.length);
    console.log('kraDetails content:', JSON.stringify(kraDetails, null, 2));

    if (true) {
      console.log('Adding Annexure-B page...');
      doc.addPage();
      addHeader();
      addFooter();

      // Set starting position for Annexure-B content
      doc.y = headerImage ? 100 : 80;
      doc.x = 50;

      // Annexure-B Title (centered, underlined - matching image format "ANNEXURE- B")
      doc.fontSize(14).fillColor('black').font(boldFont)
        .text('ANNEXURE- B', 50, doc.y, { align: 'center', width: 495, underline: true });
      doc.moveDown(2);

      // KRA Title with designation (bold, left-aligned)
      doc.fontSize(12).fillColor('black').font(boldFont)
        .text(`Key Responsibility Areas (KRA) – ${offerLetter.designation}`, 50, doc.y);
      doc.moveDown(1.5);

      // KRA numbered list with proper indentation (matching image format)
      doc.fillColor('black').font(mainFont).fontSize(11);

      kraDetails.forEach((kra: any, index: number) => {
        const kraText = typeof kra === 'string' ? kra : kra.responsibility || kra.description || kra.title || '';
        console.log(`KRA ${index + 1}: ${kraText}`);
        checkPageBreak(40);

        // Number on left, text indented (like in the image)
        const kraNumber = `${index + 1}.`;
        const numberWidth = 25;
        const textStartX = 75; // Indented text start
        const textWidth = 470; // Width for text

        doc.font(mainFont).text(kraNumber, 50, doc.y);
        doc.text(kraText, textStartX, doc.y - 13, { width: textWidth, align: 'left' });
        doc.moveDown(0.8);
      });

      doc.moveDown(2);
      console.log('Annexure-B page added successfully');
    } else {
      console.log('No KRAs to add - skipping Annexure-B');
    }
    console.log('=== End Annexure-B ===');

    // ==================== FINAL PAGE: Director Signature (if available) ====================
    if (false) {
      // Check if we need a new page or have space on current page
      checkPageBreak(150);

      doc.moveDown(2);

      // For Company section
      doc.font(mainFont).fontSize(10).fillColor('black').text('For,');
      doc.font(boldFont).text(`${companyName}`);
      doc.moveDown(1);

      // Director Signature image
      if (offerLetter.secondary_signatory_signature) {
        const secSigPath = path.join(process.cwd(), 'uploads', 'signatures', offerLetter.secondary_signatory_signature);
        if (fs.existsSync(secSigPath)) {
          doc.image(secSigPath, 50, doc.y, { width: 60 });
          doc.y += 40;
        }
      }

      // Director name in blue with underline
      doc.fillColor(blueColor).font(boldFont).text(offerLetter.secondary_signatory_name, { underline: true });
      doc.moveDown(0.3);
      doc.fillColor('black').font(boldFont).text(offerLetter.secondary_signatory_position || 'Director');
    }

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Generate KRA using AI based on designation and RAG documents
router.post('/generate-kra', authenticateToken, async (req, res) => {
  try {
    const { designation, candidateName, vacancyId } = req.body;

    if (!designation) {
      return res.status(400).json({ error: 'Designation is required' });
    }

    // Get vacancy details if provided
    let vacancyDetails: any = null;
    if (vacancyId) {
      vacancyDetails = db.prepare(`
        SELECT title, job_description, responsibilities, requirements, skills_required
        FROM vacancies WHERE id = ? AND isActive = 1
      `).get(vacancyId) as any;
    }

    // Search for relevant KRA content from uploaded HR documents
    const kraQuery = `KRA key responsibility areas duties responsibilities for ${designation}`;
    const relevantChunks = await findSimilarContent(kraQuery, 5);

    // Also check for existing offer letters with similar designation
    const existingOfferLetters = db.prepare(`
      SELECT kra_details, designation FROM offer_letters
      WHERE designation LIKE ? AND kra_details IS NOT NULL AND isActive = 1
      ORDER BY createdAt DESC LIMIT 3
    `).all(`%${designation.split(' ')[0]}%`) as any[];

    // Extract existing KRAs for reference
    const existingKRAs: string[] = [];
    existingOfferLetters.forEach((letter: any) => {
      if (letter.kra_details) {
        try {
          const kraList = JSON.parse(letter.kra_details);
          existingKRAs.push(...kraList.slice(0, 5));
        } catch (e) {}
      }
    });

    // Build context from RAG documents and existing KRAs
    let ragContext = '';
    if (relevantChunks.length > 0) {
      ragContext = `\nRelevant content from HR documents:\n${relevantChunks.join('\n\n---\n\n')}`;
    }
    if (existingKRAs.length > 0) {
      ragContext += `\n\nExisting KRAs for similar roles:\n${existingKRAs.map((k, i) => `${i + 1}. ${k}`).join('\n')}`;
    }
    if (vacancyDetails?.job_description) {
      ragContext += `\n\nJob Description:\n${vacancyDetails.job_description}`;
    }
    if (vacancyDetails?.responsibilities) {
      ragContext += `\n\nResponsibilities from JD:\n${vacancyDetails.responsibilities}`;
    }

    // Generate KRA using AI
    const prompt = `Generate 8-12 Key Responsibility Areas (KRA) for the position of "${designation}"${candidateName ? ` for candidate ${candidateName}` : ''}.

${ragContext}

Requirements:
1. KRAs should be specific, measurable, and relevant to the role
2. Include both core job responsibilities and professional expectations
3. Cover technical skills, communication, teamwork, and compliance
4. Match the tone and style from existing company documents if available
5. Be concise but comprehensive (1-2 sentences each)

Return a JSON array of strings, each string being one KRA point.
Example format: ["Making outbound calls to clients", "Updating CRM records daily", "Achieving monthly targets"]`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an HR expert generating Key Responsibility Areas for offer letters. Generate professional, specific KRAs that match company standards. Return only valid JSON array.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      return res.status(500).json({ error: 'Failed to generate KRA content' });
    }

    // Parse the response - it might be wrapped in an object
    let kraList: string[] = [];
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        kraList = parsed;
      } else if (parsed.kras) {
        kraList = parsed.kras;
      } else if (parsed.kra) {
        kraList = parsed.kra;
      } else if (parsed.responsibilities) {
        kraList = parsed.responsibilities;
      } else {
        // Try to extract array from first array-like property
        const keys = Object.keys(parsed);
        for (const key of keys) {
          if (Array.isArray(parsed[key])) {
            kraList = parsed[key];
            break;
          }
        }
      }
    } catch (e) {
      console.error('Error parsing KRA response:', e);
      return res.status(500).json({ error: 'Failed to parse KRA content' });
    }

    // Ensure we have valid strings
    kraList = kraList.filter(k => typeof k === 'string' && k.trim().length > 0);

    if (kraList.length === 0) {
      // Fallback to default KRAs based on role type
      kraList = getDefaultKRAs(designation);
    }

    res.json({
      kras: kraList,
      designation,
      generated_from: {
        rag_documents: relevantChunks.length > 0,
        existing_offers: existingKRAs.length > 0,
        job_description: !!vacancyDetails?.job_description
      }
    });
  } catch (error) {
    console.error('Error generating KRA:', error);
    res.status(500).json({ error: 'Failed to generate KRA' });
  }
});

// Helper function to get default KRAs based on role type
function getDefaultKRAs(designation: string): string[] {
  const role = designation.toLowerCase();

  if (role.includes('telecaller') || role.includes('tele caller') || role.includes('calling')) {
    return [
      'Making outbound calls to potential and existing clients as per targets assigned',
      'Updating CRM/database with call outcomes and customer information',
      'Achieving daily, weekly, and monthly calling targets',
      'Following up with leads and converting them into sales/appointments',
      'Maintaining call quality standards and adhering to scripts',
      'Handling customer queries and providing accurate information',
      'Reporting daily call activities to the supervisor',
      'Participating in training sessions to improve skills'
    ];
  } else if (role.includes('developer') || role.includes('engineer') || role.includes('programmer')) {
    return [
      'Developing and maintaining software applications as per project requirements',
      'Writing clean, efficient, and well-documented code',
      'Participating in code reviews and maintaining coding standards',
      'Collaborating with team members on technical solutions',
      'Testing and debugging applications to ensure quality',
      'Meeting project deadlines and deliverables',
      'Staying updated with latest technologies and best practices',
      'Supporting production issues and providing timely fixes'
    ];
  } else if (role.includes('manager') || role.includes('lead')) {
    return [
      'Leading and mentoring team members to achieve targets',
      'Planning and executing projects within timelines',
      'Coordinating with stakeholders for project requirements',
      'Ensuring quality deliverables and client satisfaction',
      'Conducting performance reviews and providing feedback',
      'Identifying and resolving team/project issues',
      'Reporting project status to senior management',
      'Driving process improvements and best practices'
    ];
  } else if (role.includes('executive') || role.includes('associate')) {
    return [
      'Executing assigned tasks with accuracy and efficiency',
      'Maintaining proper documentation and records',
      'Coordinating with internal teams for smooth operations',
      'Meeting daily and monthly targets as assigned',
      'Following company policies and procedures',
      'Providing regular updates and reports to supervisor',
      'Participating in team meetings and training sessions',
      'Supporting team members when required'
    ];
  } else {
    return [
      'Performing duties as assigned by the reporting manager',
      'Meeting performance targets and deadlines',
      'Maintaining quality standards in all deliverables',
      'Coordinating with team members and stakeholders',
      'Following company policies and procedures',
      'Reporting progress and issues to supervisor',
      'Continuously improving skills and knowledge',
      'Contributing to team goals and objectives'
    ];
  }
}

// Get candidate with vacancy details (for location)
router.get('/candidate-vacancy/:candidateId', authenticateToken, (req, res) => {
  try {
    const { candidateId } = req.params;

    const candidate = db.prepare(`
      SELECT c.*, v.title as vacancy_title, v.location as vacancy_location,
        v.job_description, v.responsibilities, v.requirements, v.skills_required
      FROM candidates c
      LEFT JOIN vacancies v ON c.vacancy_id = v.id
      WHERE c.id = ? AND c.isActive = 1
    `).get(candidateId) as any;

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    res.json(candidate);
  } catch (error) {
    console.error('Error fetching candidate with vacancy:', error);
    res.status(500).json({ error: 'Failed to fetch candidate details' });
  }
});

// Email signature interface
interface EmailSignature {
  senderName: string;
  senderTitle: string;
  companyName: string;
  address: string;
  phone: string;
  mobile: string;
  website: string;
  logoUrl?: string;
}

// Default email signature for Phoneme
const defaultEmailSignature: EmailSignature = {
  senderName: 'Deepika',
  senderTitle: 'Manager-Human Resource',
  companyName: 'Phoneme Solutions Pvt Ltd.',
  address: 'Advant Business Tower\nOffice- 614, Tower-B, Sector 142, Tower 1,\nNoida-201307',
  phone: '+91 1204761617',
  mobile: '+91 7494957279',
  website: 'http://www.myphoneme.com'
};

// PHONEME logo as base64 data URI (JPEG)
const PHONEME_LOGO_BASE64 = 'data:image/jpeg;base64,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';

// Get the server's public URL for email assets
function getServerPublicUrl(): string {
  // Use environment variable for production, fallback to localhost for development
  return process.env.SERVER_PUBLIC_URL || process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
}

// Generate HTML email signature block with hosted logo image
function generateEmailSignatureHTML(signature: EmailSignature): string {
  const serverUrl = getServerPublicUrl();
  const logoUrl = `${serverUrl}/uploads/email-assets/phoneme-logo.jpg`;

  return `
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
      <p style="color: #E65100; font-weight: bold; margin: 0;">Regards</p>
      <p style="color: #E65100; font-weight: bold; margin: 5px 0;">${signature.senderName}</p>
      <p style="color: #E65100; font-weight: bold; margin: 5px 0;">${signature.senderTitle}</p>
      <div style="margin: 15px 0;">
        <img src="${logoUrl}" alt="PHONEME" style="height: 30px; width: auto;" />
      </div>
      <p style="margin: 5px 0; font-size: 13px; color: #333;">${signature.companyName}</p>
      <p style="margin: 5px 0; font-size: 13px; color: #333; white-space: pre-line;">${signature.address}</p>
      <p style="margin: 5px 0; font-size: 13px; color: #333;">T : ${signature.phone}</p>
      <p style="margin: 5px 0; font-size: 13px; color: #333;">M: ${signature.mobile}</p>
      <p style="margin: 5px 0; font-size: 13px;">W: <a href="${signature.website}" style="color: #0066CC;">${signature.website}</a></p>
    </div>
  `;
}

// Send offer letter via email
router.post('/:id/send-email', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      gmail_connection_id,
      email_signature
    } = req.body;

    if (!gmail_connection_id) {
      return res.status(400).json({ error: 'gmail_connection_id is required' });
    }

    // Get the offer letter details with candidate info
    const offerLetter = db.prepare(`
      SELECT ol.*,
        s.name as signatory_name,
        s.position as signatory_position,
        c.email as candidate_email
      FROM offer_letters ol
      LEFT JOIN signatories s ON ol.signatory_id = s.id
      LEFT JOIN candidates c ON ol.candidate_name = (c.first_name || ' ' || COALESCE(c.last_name, ''))
      WHERE ol.id = ? AND ol.isActive = 1
    `).get(id) as (OfferLetterWithSignatory & { candidate_email?: string }) | undefined;

    if (!offerLetter) {
      return res.status(404).json({ error: 'Offer letter not found' });
    }

    // Try to get candidate email from candidates table by name match
    let candidateEmail = offerLetter.candidate_email;
    if (!candidateEmail) {
      // Try a more flexible search
      const candidate = db.prepare(`
        SELECT email FROM candidates
        WHERE (first_name || ' ' || COALESCE(last_name, '')) LIKE ?
        OR first_name LIKE ?
        LIMIT 1
      `).get(`%${offerLetter.candidate_name}%`, `%${offerLetter.candidate_name.split(' ')[0]}%`) as { email: string } | undefined;

      candidateEmail = candidate?.email;
    }

    if (!candidateEmail) {
      return res.status(400).json({ error: 'Candidate email not found. Please ensure the candidate exists in the system.' });
    }

    // Use custom signature or default
    const signature: EmailSignature = email_signature || defaultEmailSignature;

    // Get Gmail client
    const gmail = await getGmailClient(gmail_connection_id);

    // Generate PDF as base64
    const pdfBuffer = await generatePDFBuffer(id);
    const pdfBase64 = pdfBuffer.toString('base64');

    // Email subject - auto generated
    const emailSubject = `Offer Letter - ${offerLetter.designation} Position at Phoneme Solutions`;

    // Get first name for greeting
    const firstName = offerLetter.candidate_name.split(' ')[0];

    // Email body - auto generated with candidate name and position
    const emailBody = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
        <p>Dear ${firstName},</p>

        <p>Greetings from Phoneme Solutions!</p>

        <p>We are pleased to extend to you this offer of employment for the position of <strong>${offerLetter.designation}</strong>.</p>

        <p>Please find attached your official Offer Letter with complete details regarding your compensation package and terms of employment.</p>

        <p>We request you to review the offer letter carefully and revert with your acceptance at the earliest. Should you have any questions, please do not hesitate to reach out.</p>

        <p>We look forward to welcoming you to our team!</p>

        ${generateEmailSignatureHTML(signature)}
      </div>
    `;

    // Build MIME email with PDF attachment
    const boundary = `----=_Part_${Date.now()}`;
    const fileName = `Offer_Letter_${offerLetter.candidate_name.replace(/\s+/g, '_')}.pdf`;

    const emailParts = [
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      `MIME-Version: 1.0`,
      `To: ${offerLetter.candidate_name} <${candidateEmail}>`,
      `Subject: ${emailSubject}`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      Buffer.from(emailBody).toString('base64'),
      ``,
      `--${boundary}`,
      `Content-Type: application/pdf; name="${fileName}"`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: attachment; filename="${fileName}"`,
      ``,
      pdfBase64,
      ``,
      `--${boundary}--`
    ];

    const rawEmail = emailParts.join('\r\n');
    const encodedEmail = Buffer.from(rawEmail)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send the email
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail
      }
    });

    // Update offer letter status to 'sent'
    db.prepare(`
      UPDATE offer_letters
      SET status = 'sent', updatedAt = datetime('now')
      WHERE id = ?
    `).run(id);

    res.json({
      message: 'Offer letter email sent successfully',
      recipient: candidateEmail
    });

  } catch (error: any) {
    console.error('Error sending offer letter email:', error);
    res.status(500).json({
      error: error.message || 'Failed to send offer letter email'
    });
  }
});

// Helper function to generate complete PDF buffer (same as /pdf endpoint)
// This generates the FULL offer letter PDF with all sections, annexures, and signatures
async function generatePDFBuffer(offerId: number | string): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      // Use the same comprehensive query as the /pdf endpoint
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
      `).get(offerId) as any;

      if (!offerLetter) {
        return reject(new Error('Offer letter not found'));
      }

      // Get default letterhead if not assigned
      let letterhead = null;
      if (!offerLetter.letterhead_header) {
        letterhead = db.prepare(`
          SELECT * FROM letterheads WHERE is_default = 1 AND isActive = 1
        `).get() as any;
      }

      // Get RAG template profile
      let templateProfile: any = null;
      if (offerLetter.template_profile_id) {
        templateProfile = db.prepare(`
          SELECT * FROM rag_template_profiles WHERE id = ? AND isActive = 1
        `).get(offerLetter.template_profile_id) as any;
      }
      if (!templateProfile) {
        templateProfile = db.prepare(`
          SELECT * FROM rag_template_profiles WHERE is_default = 1 AND isActive = 1
        `).get() as any;
      }

      // Parse KRA and salary
      const kraDetails = offerLetter.kra_details ? JSON.parse(offerLetter.kra_details) : [];
      const salaryBreakdown: SalaryComponent[] = JSON.parse(offerLetter.salary_breakdown || '[]');

      // Format functions
      const formatCurrency = (amount: number) => amount.toLocaleString('en-IN');

      const numberToWords = (num: number): string => {
        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        if (num === 0) return 'Zero';
        let words = '';
        if (num >= 10000000) { words += numberToWords(Math.floor(num / 10000000)) + ' Crore '; num %= 10000000; }
        if (num >= 100000) { words += numberToWords(Math.floor(num / 100000)) + ' Lakh '; num %= 100000; }
        if (num >= 1000) { words += numberToWords(Math.floor(num / 1000)) + ' Thousand '; num %= 1000; }
        if (num >= 100) { words += ones[Math.floor(num / 100)] + ' Hundred '; num %= 100; }
        if (num >= 20) { words += tens[Math.floor(num / 10)] + ' '; num %= 10; }
        else if (num >= 10) { words += teens[num - 10] + ' '; num = 0; }
        if (num > 0) words += ones[num] + ' ';
        return words.trim();
      };

      const formatDateShort = (dateStr: string) => {
        const date = new Date(dateStr);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${date.getDate()}-${months[date.getMonth()]}-${date.getFullYear().toString().slice(-2)}`;
      };

      const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const day = date.getDate();
        const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
        return `${day}${suffix} ${months[date.getMonth()]} ${date.getFullYear()}`;
      };

      const ctcInWords = numberToWords(offerLetter.annual_ctc);

      // Company info
      const ragCompanyInfo = getCompanyInfoFromRAG();
      const companyName = offerLetter.letterhead_company_name || letterhead?.company_name || ragCompanyInfo.name;
      const companyAddress = offerLetter.letterhead_company_address || letterhead?.company_address || ragCompanyInfo.address;
      const companyCIN = ragCompanyInfo.cin;
      const companyGSTIN = ragCompanyInfo.gstin;
      const companyEmail = ragCompanyInfo.email;
      const companyWebsite = ragCompanyInfo.website;
      const companyRegOffice = ragCompanyInfo.regOffice;

      // Get HR info
      const leavePolicyText = getLeavePolicy();
      const workingHoursInfo = getWorkingHours();

      // Letterhead
      const headerImage = offerLetter.letterhead_header || letterhead?.header_image;
      const footerImage = offerLetter.letterhead_footer || letterhead?.footer_image;
      const letterheadDir = path.join(process.cwd(), 'uploads', 'letterheads');

      // Colors and fonts
      const orangeColor = '#E65100';
      const blueColor = '#0066CC';
      const headingColor = '#000000';
      const mainFont = 'Times-Roman';
      const boldFont = 'Times-Bold';
      const italicFont = 'Times-Italic';

      // Reference number
      const letterDate = new Date(offerLetter.letter_date);
      const fiscalYear = letterDate.getMonth() >= 3 ? letterDate.getFullYear() : letterDate.getFullYear() - 1;
      const nextYear = (fiscalYear + 1) % 100;
      const currentYear = fiscalYear % 100;
      const paddedId = String(offerLetter.id).padStart(6, '0');
      const refNumber = `HR/Offer/${currentYear}-${String(nextYear).padStart(2, '0')}/${paddedId}`;

      // Create PDF
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 70, left: 50, right: 50 },
        bufferPages: true
      });

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const isFullPageLetterhead = headerImage && !footerImage;

      // Helper: Add header
      const addHeader = () => {
        if (isFullPageLetterhead) {
          const headerPath = path.join(letterheadDir, headerImage);
          if (fs.existsSync(headerPath)) doc.image(headerPath, 0, 0, { width: 595.28, height: 841.89 });
        } else if (headerImage) {
          const headerPath = path.join(letterheadDir, headerImage);
          if (fs.existsSync(headerPath)) doc.image(headerPath, 0, 0, { width: 595.28 });
        } else {
          doc.fontSize(28).fillColor(orangeColor).font('Helvetica-Bold').text('PHONEME', 50, 25, { lineBreak: false });
          doc.moveTo(50, 55).lineTo(545, 55).strokeColor(orangeColor).lineWidth(2).stroke();
        }
        doc.fontSize(10).fillColor('black').font('Helvetica');
        doc.x = 50;
      };

      // Helper: Add footer
      const addFooter = () => {
        if (isFullPageLetterhead) return;
        const footerY = 765;
        if (footerImage) {
          const footerPath = path.join(letterheadDir, footerImage);
          if (fs.existsSync(footerPath)) doc.image(footerPath, 0, footerY, { width: 595.28 });
        } else if (!headerImage) {
          doc.rect(0, footerY, 595.28, 77).fill(orangeColor);
          doc.fontSize(7).fillColor('white').font('Helvetica')
            .text(`${companyName}. ${companyAddress} CIN: ${companyCIN} GST: ${companyGSTIN}`, 50, footerY + 10, { align: 'center', width: 495, lineBreak: false })
            .text(`Reg.Off: ${companyRegOffice} ${companyEmail}`, 50, footerY + 22, { align: 'center', width: 495, lineBreak: false });
          doc.fillColor(blueColor).text(companyWebsite, 50, footerY + 34, { align: 'center', width: 495, underline: true, lineBreak: false });
        }
        doc.fontSize(10).fillColor('black').font('Helvetica');
      };

      // Helper: Check page break
      const checkPageBreak = (requiredSpace: number = 100) => {
        if (doc.y > 700 - requiredSpace) {
          doc.addPage();
          addHeader();
          addFooter();
          doc.y = isFullPageLetterhead ? 100 : (headerImage ? 70 : 80);
          doc.x = 50;
          doc.fontSize(10).fillColor('black').font('Helvetica');
        }
      };

      const firstName = offerLetter.candidate_name.split(' ')[0];

      // Template data
      const templateData = {
        candidate_name: offerLetter.candidate_name,
        first_name: firstName,
        designation: offerLetter.designation,
        joining_date: offerLetter.joining_date,
        joining_date_formatted: formatDate(offerLetter.joining_date),
        annual_ctc: offerLetter.annual_ctc,
        ctc_formatted: `Rs. ${formatCurrency(offerLetter.annual_ctc)}/-`,
        ctc_in_words: ctcInWords,
        working_location: offerLetter.working_location || companyAddress,
        company_name: companyName,
        company_address: companyAddress,
        hr_manager_name: offerLetter.hr_manager_name || offerLetter.signatory_name,
        hr_manager_title: offerLetter.hr_manager_title || offerLetter.signatory_position,
        probation_period: '6 months',
        notice_period: '1 month',
        offer_valid_till: offerLetter.offer_valid_till,
        offer_valid_till_formatted: formatDate(offerLetter.offer_valid_till),
      };

      // ==================== PAGE 1: OFFER LETTER ====================
      // Draw header/background
      if (isFullPageLetterhead) {
        const headerPath = path.join(letterheadDir, headerImage);
        if (fs.existsSync(headerPath)) doc.image(headerPath, 0, 0, { width: 595.28, height: 841.89 });
      } else if (headerImage) {
        const headerPath = path.join(letterheadDir, headerImage);
        if (fs.existsSync(headerPath)) doc.image(headerPath, 0, 0, { width: 595.28 });
        if (footerImage) {
          const footerPath = path.join(letterheadDir, footerImage);
          if (fs.existsSync(footerPath)) doc.image(footerPath, 0, 765, { width: 595.28 });
        }
      } else {
        doc.fontSize(28).fillColor(orangeColor).font('Helvetica-Bold').text('PHONEME', 50, 25, { lineBreak: false });
        doc.moveTo(50, 55).lineTo(545, 55).strokeColor(orangeColor).lineWidth(2).stroke();
        const defaultFooterY = 765;
        doc.rect(0, defaultFooterY, 595.28, 77).fill(orangeColor);
        doc.fontSize(7).fillColor('white').font('Helvetica');
        doc.text(`${companyName}. ${companyAddress} CIN: ${companyCIN} GST: ${companyGSTIN}`, 50, defaultFooterY + 10, { align: 'center', width: 495, lineBreak: false });
        doc.text(`Reg.Off: ${companyRegOffice} ${companyEmail}`, 50, defaultFooterY + 22, { align: 'center', width: 495, lineBreak: false });
        doc.fillColor(blueColor).text(companyWebsite, 50, defaultFooterY + 34, { align: 'center', width: 495, underline: true, lineBreak: false });
      }

      doc.font(mainFont).fontSize(10).fillColor('black');
      doc.x = 50;
      const startY = isFullPageLetterhead ? 100 : (headerImage ? 70 : 80);

      // Title
      doc.font(boldFont).fontSize(12).fillColor(headingColor);
      doc.text('OFFER CUM APPOINTMENT LETTER', 50, startY, { width: 495, align: 'center', underline: true });

      // Reference and Date
      doc.fillColor('black').font('Helvetica-Bold').fontSize(10);
      doc.text(refNumber, 50, startY + 30);
      doc.text(formatDateShort(offerLetter.letter_date), 400, startY + 30, { width: 145, align: 'right' });

      // Greeting
      const greetingFormat = templateProfile?.greeting_format || `Dear ${firstName},`;
      doc.font(mainFont).fillColor('black');
      doc.text(greetingFormat.replace(/\{\{first_name\}\}/gi, firstName).replace(/\{\{First Name\}\}/gi, firstName), 50, startY + 55);

      // Opening paragraph
      const defaultOpeningPara = `On behalf of ${companyName}. Based on your applications, interviews & discussions we have had, we are pleased to offer you the position of ${offerLetter.designation} at our office in ${offerLetter.working_location || 'Head Office as well as Regional Offices'}. You will be reporting to the concerned Manager at the designated office. Your employment with us shall be governed by the following terms and conditions. This offer will be valid till the Date of Joining ${formatDate(offerLetter.joining_date)}.`;
      const openingPara = templateProfile?.opening_paragraph ? replacePlaceholders(templateProfile.opening_paragraph, templateData) : defaultOpeningPara;
      doc.text(openingPara, 50, startY + 75, { width: 495, align: 'justify' });

      let yPos = startY + 75 + doc.heightOfString(openingPara, { width: 495 }) + 15;

      // Section 1 - COMMENCEMENT
      doc.fillColor(headingColor).font(boldFont);
      doc.text('1.    COMMENCEMENT OF APPOINTMENT:', 50, yPos);
      yPos += 18;

      doc.fillColor('black').font(mainFont);
      const section1Part1 = `Your appointment is effective from the date of joining which shall be not later than ${formatDate(offerLetter.joining_date)}. On the date of your joining, you are required to handover previous companies relieving letter & conduct certificate, before signing the hardcopy of this offer letter in order to complete the onboarding process headquartered at `;
      const section1Part2 = `. ${offerLetter.working_location || companyAddress}. Please note that if at any point in time, the Company is of the opinion that the documents provided are false or your background verification is not satisfactory, your employment may be terminated with immediate effect.`;
      doc.text(section1Part1, 50, yPos, { width: 495, align: 'justify', continued: true });
      doc.font(boldFont).text(companyName, { continued: true });
      doc.font(mainFont).text(section1Part2, { width: 495, align: 'justify' });
      const fullSection1Text = section1Part1 + companyName + section1Part2;
      yPos += doc.heightOfString(fullSection1Text, { width: 495 }) + 10;

      // CTC
      const ctcText = `During your period of employment, your Annual CTC will be Rs. ${formatCurrency(offerLetter.annual_ctc)}/- (${ctcInWords} only) Per Annum. For detailed breakup please refer to Annexure A.`;
      doc.text(ctcText, 50, yPos, { width: 495, align: 'justify' });
      yPos += doc.heightOfString(ctcText, { width: 495 }) + 10;

      // Note
      doc.font(italicFont).fontSize(9);
      const noteText = 'Note: - "Subject to Deduction of contributions, charges and taxes at source as per the Laws/Acts of Government of India, as may be applicable from time to time".';
      doc.text(noteText, 50, yPos, { width: 495, align: 'justify' });
      yPos += doc.heightOfString(noteText, { width: 495 }) + 10;

      // Terms intro
      doc.fontSize(10).font(mainFont);
      const termsIntro = "Your employment is subject to the terms and conditions set forth in this offer letter and the rules and regulations as set out in the Company's HR policy guidelines:";
      doc.text(termsIntro, 50, yPos, { width: 495, align: 'justify' });
      yPos += doc.heightOfString(termsIntro, { width: 495 }) + 10;

      doc.y = yPos;
      doc.x = 50;

      // ==================== FULL SECTIONS (matching /pdf endpoint exactly) ====================
      checkPageBreak(200);

      // Section 2: TERMS AND CONDITIONS OF EMPLOYMENT (FULL)
      doc.fillColor(headingColor).font(boldFont).text('2.    TERMS AND CONDITIONS OF EMPLOYMENT:');
      doc.moveDown(0.3);
      doc.fillColor('black').font(mainFont).text(
        "You shall be required to work as per the requirements of the Company/Company's client and your duties may vary depending upon the requirement of the Company's Client from time to time.",
        { align: 'justify' }
      );
      doc.moveDown(0.5);

      // Duties section
      doc.font(boldFont).text('Duties:');
      doc.moveDown(0.3);
      doc.font(mainFont).text(
        "i.    You acknowledge that, depending on its needs (including, the needs of the Group) the Company may at its sole discretion change your designation and responsibilities, and you agree to serve the Company in such assigned capacities consistent with your position in the Company.",
        { align: 'justify', indent: 20 }
      );
      doc.moveDown(0.5);

      checkPageBreak(150);

      doc.font(boldFont).text('ii.   During the course of employment, you shall: -');
      doc.moveDown(0.3);

      const duringEmploymentPoints = [
        'Diligently, faithfully and to the best of your skill and ability perform and discharge all the duties and functions entrusted to you by the Company.',
        'In addition to the terms and conditions of employment set out herein, adhere to all rules, regulations, Policies, procedures, guidelines and other such items applicable to your work that the Company may from time-to-time frame/ revise/update for observance and compliance by you and the other employees.',
        'Be aware that a violation of any such Policies, procedures and guidelines by you could lead to disciplinary actions, including termination of your employment.',
        'Obey and comply with all lawful orders and directions given by the Company or by any person duly authorized on that behalf and faithfully obey all such rules, regulations and arrangements.',
        'Use all the knowledge, skill and experience that you possess to the best satisfaction of the Company.',
        'Not make any false, defamatory or disparaging statements about the Company and/or its Group Companies, or the employees, officers or directors of the Company and/or its Group Companies, during and after the term of your employment, that are reasonably likely to cause damage to any such entity or person; and',
        'Inform the Company at once of any act of dishonesty and/or any action prejudicial to the interest of the Company, by any person, which may come to your knowledge.'
      ];

      duringEmploymentPoints.forEach((point, idx) => {
        checkPageBreak(60);
        doc.font(mainFont).text(`    ${String.fromCharCode(97 + idx)}.   ${point}`, { align: 'justify', indent: 20 });
        doc.moveDown(0.3);
      });

      checkPageBreak(100);

      // Group Companies definition
      doc.moveDown(0.5);
      doc.font(boldFont).text('For the purpose of these terms and conditions, "Group Companies" or "Group" shall mean the Company and:');
      doc.moveDown(0.3);
      doc.font(mainFont).text('    i.    Any company or other person that directly or indirectly controls the Company; or', { indent: 20 });
      doc.text('    ii.   Any company or other person which is directly or indirectly controlled by the Company; or', { indent: 20 });
      doc.text('    iii.  Any company or other person which is under the common control of the same person who controls the Company.', { indent: 20 });
      doc.moveDown(0.5);

      checkPageBreak(150);

      doc.font(boldFont).text('For the purpose of this definition:');
      doc.moveDown(0.3);
      doc.font(mainFont).text(
        "'control' means in relation to a company, the ownership by any person of more than 50% of the voting rights of that company; and 'person' means any person, firm, company, corporation, society, trust, government, state or agency of a state or any association or partnership (whether having separate legal personality) or two or more of the above, including its successors and permitted assigns.",
        { align: 'justify' }
      );
      doc.moveDown(0.5);

      // Policies section
      doc.fillColor(headingColor).font(boldFont).text('➤  Policies, procedures, rules and code:');
      doc.fillColor('black').font(mainFont).moveDown(0.3);
      doc.text(
        "You agree that during your course of employment with the Company, you shall comply with the Company's policies and procedures, rules and codes in place and any client-related policies as applicable from time to time. These policies and procedures form part of your contract of employment [and the Company may adopt, vary or rescind these policies from time to time in its absolute discretion and without any limitation (implied or otherwise) on its ability to do so].",
        { align: 'justify' }
      );
      doc.moveDown(1);

      checkPageBreak(200);

      // Section 3: SALARY (FULL)
      doc.fillColor(headingColor).font(boldFont).text('3.    SALARY:');
      doc.moveDown(0.3);
      doc.fillColor('black').font(mainFont).text(
        "You will be eligible for company benefits which are detailed as part of your compensation structure in Annexure-A, attached along with this letter. Your basic salary will be paid according to standard payroll practices, subject to any tax or other deduction provided or permitted by law in force from time to time, such as the employee's share of provident fund contributions if applicable, as well as such other sums as may be agreed with you from time to time. Your fixed salary may be reviewed from time to time in accordance with Company policy but will not necessarily be increased and is paid for in satisfying all the services rendered by you under this agreement, including overtime, to the extent permitted by law. You are encouraged to independently verify the tax implications on your salary. The taxable and non-taxable components of your salary may vary based on the prevailing law as amended from time to time.",
        { align: 'justify' }
      );
      doc.moveDown(0.5);

      // Confidentiality
      const defaultConfidentialityText = "Your salary/benefit-related details are strictly confidential, and the Company requires that you should not reveal/discuss the same. You shall not indulge in matters pertaining to the salary of others in the Company. During the course of your employment with the Company or at any time thereafter, divulge or disclose to any person whomsoever makes any use whatsoever for your own purpose or for any other purpose other than that of the Company, of any information or knowledge obtained by you during your employment as to the business or affairs of the company including development, process reports and reporting system and you.";
      const confidentialityText = templateProfile?.confidentiality_clause ? replacePlaceholders(templateProfile.confidentiality_clause, templateData) : defaultConfidentialityText;
      doc.font(boldFont).text('Confidentiality: ', { continued: true });
      doc.font(mainFont).text(confidentialityText, { align: 'justify' });
      doc.moveDown(0.5);

      checkPageBreak(100);

      // Exclusivity
      doc.font(boldFont).text('Exclusivity: ', { continued: true });
      doc.font(mainFont).text(
        "Your position is a whole-time employment with the Company, and you shall devote yourself exclusively to the business of the company. You will not take up any other work for remuneration or work in an advisory capacity or be interested directly or indirectly in any other trade or business during employment with the Company without prior approval in writing from the Company's management.",
        { align: 'justify' }
      );
      doc.moveDown(1);

      checkPageBreak(150);

      // Section 4: WORKING HOURS (FULL)
      doc.fillColor(headingColor).font(boldFont).text('4.    WORKING HOURS:');
      doc.moveDown(0.3);
      doc.fillColor('black').font(mainFont).text(
        `Your working hours will be ${workingHoursInfo.hours}. As per current company policy, you need to complete 9 hours in a day. The company observes a ${workingHoursInfo.days.includes('Saturday') ? '6-day' : '5-day'} work week, ${workingHoursInfo.days.includes('Saturday') ? 'with Sunday as weekly off' : 'with Saturday and Sunday as weekly off'}.`,
        { align: 'justify' }
      );
      doc.moveDown(1);

      checkPageBreak(150);

      // Section 5: PROBATION PERIOD (FULL)
      doc.fillColor(headingColor).font(boldFont).text('5.    PROBATION PERIOD:');
      doc.moveDown(0.3);
      const defaultProbationText = "You will be on probation for six months. Based on your performance, your services will be confirmed with the company in writing after six months. During the probation period, your services can be terminated with seven days' notice on either side and without any reasons whatsoever. If your services are found satisfactory during the probation period, you will be confirmed in the present position.";
      const probationText = templateProfile?.probation_clause ? replacePlaceholders(templateProfile.probation_clause, templateData) : defaultProbationText;
      doc.fillColor('black').font(mainFont).text(probationText, { align: 'justify' });
      doc.moveDown(1);

      checkPageBreak(150);

      // Section 6: NOTICE PERIOD (FULL)
      doc.fillColor(headingColor).font(boldFont).text('6.    NOTICE PERIOD:');
      doc.moveDown(0.3);
      const defaultNoticePeriodText = "This appointment may be terminated by either side by giving thirty days' notice or one month's salary in lieu of notice period. During the notice period, you are supposed to hand over all the assets and belongings and do the complete knowledge transfer. Upon receipt of the above all, during signed by your manager, your full and final settlement will be done. You are not supposed to take any leaves during this period.";
      const noticePeriodText = templateProfile?.notice_period_clause ? replacePlaceholders(templateProfile.notice_period_clause, templateData) : defaultNoticePeriodText;
      doc.fillColor('black').font(mainFont).text(noticePeriodText, { align: 'justify' });
      doc.moveDown(1);

      checkPageBreak(150);

      // Section 7: LEAVE (FULL)
      doc.fillColor(headingColor).font(boldFont).text('7.    LEAVE:');
      doc.moveDown(0.3);
      const leaveText = templateProfile?.leave_policy_clause ? replacePlaceholders(templateProfile.leave_policy_clause, templateData) : leavePolicyText;
      doc.fillColor('black').font(mainFont).text(leaveText, { align: 'justify' });
      doc.moveDown(1);

      // ==================== ADDITIONAL SECTIONS FROM TEMPLATE ====================
      // Render ALL sections from the uploaded HR document template (sections 8+)
      if (templateProfile?.all_sections_content) {
        try {
          const allSections = JSON.parse(templateProfile.all_sections_content);
          console.log(`[generatePDFBuffer] Found ${allSections.length} sections in template profile`);
          console.log('[generatePDFBuffer] All section titles:', allSections.map((s: any) => s.section_title));

          // Render ALL sections from the template that haven't been covered
          let nextSectionNumber = 8;

          for (const section of allSections) {
            const title = (section.section_title || '').toLowerCase().trim();
            const sectionNum = section.section_number;

            // Skip empty sections
            if (!section.section_content && (!section.subsections || section.subsections.length === 0)) {
              continue;
            }

            // Skip greeting/closing sections that aren't numbered content sections
            if (title.includes('dear ') || title.startsWith('dear') ||
                title === 'regards' || title === 'acknowledgement' ||
                title.includes('signature') || title.includes('for company')) {
              continue;
            }

            // Check if this is one of the 7 standard sections we already rendered
            const standardPatterns = [
              /^(1\.?\s*)?commencement/i,
              /^(2\.?\s*)?terms\s*(and|&)?\s*conditions/i,
              /^(3\.?\s*)?salary$/i,
              /^(3\.?\s*)?remuneration$/i,
              /^(4\.?\s*)?working\s*hours$/i,
              /^(5\.?\s*)?probation/i,
              /^(6\.?\s*)?notice\s*period/i,
              /^(7\.?\s*)?leave$/i,
              /^(7\.?\s*)?leaves$/i,
            ];

            const isStandardSection = standardPatterns.some(pattern => pattern.test(title));

            // Also check by section number (skip sections 1-7)
            const numericSection = parseInt(sectionNum);
            if (!isNaN(numericSection) && numericSection >= 1 && numericSection <= 7) {
              continue;
            }

            if (isStandardSection) {
              console.log(`[generatePDFBuffer] Skipping standard section: ${title}`);
              continue;
            }

            console.log(`[generatePDFBuffer] Rendering section ${nextSectionNumber}: ${title}`);

            // Render this section
            checkPageBreak(150);

            // Section heading
            const sectionTitle = section.section_title?.toUpperCase() || `SECTION ${nextSectionNumber}`;
            doc.fillColor(headingColor).font(boldFont);
            doc.text(`${nextSectionNumber}.    ${sectionTitle}:`);
            doc.moveDown(0.3);

            // Section content - replace placeholders
            let content = section.section_content || '';
            content = replacePlaceholders(content, templateData);

            if (content) {
              doc.fillColor('black').font(mainFont);
              doc.text(content, { align: 'justify' });
            }

            // Render subsections if present
            if (section.has_subsections && section.subsections && Array.isArray(section.subsections)) {
              doc.moveDown(0.3);
              for (const sub of section.subsections) {
                checkPageBreak(40);
                const subMarker = sub.marker || sub.letter || sub.number || '-';
                let subContent = sub.content || '';
                subContent = replacePlaceholders(subContent, templateData);
                doc.text(`    ${subMarker}.   ${subContent}`, { align: 'justify', indent: 20 });
                doc.moveDown(0.3);
              }
            }

            doc.moveDown(1);
            nextSectionNumber++;
          }

          console.log(`[generatePDFBuffer] Rendered ${nextSectionNumber - 8} additional sections from template`);
        } catch (error) {
          console.error('[generatePDFBuffer] Error rendering additional sections from template:', error);
        }
      }

      checkPageBreak(200);

      // Closing text (italic - Phoneme format)
      doc.font(italicFont).fontSize(10).fillColor('black');
      doc.text(`We welcome you to ${companyName} and look forward to a long and mutually beneficial relationship.`, { align: 'left' });
      doc.text(`Please confirm your acceptance of our offer by signing and returning the duplicate copy of this letter.`, { align: 'left' });
      doc.moveDown(1.5);

      // For Company section
      doc.font(mainFont).text('For,');
      doc.font(boldFont).text(`${companyName}`);
      doc.moveDown(1);

      const hrName = offerLetter.signatory_name || offerLetter.hr_manager_name || 'HR Manager';
      const hrTitle = offerLetter.signatory_position || offerLetter.hr_manager_title || 'Manager-Human Resource';

      // HR Signature
      if (offerLetter.signatory_signature) {
        const sigPath = path.join(process.cwd(), 'uploads', 'signatures', offerLetter.signatory_signature);
        if (fs.existsSync(sigPath)) {
          doc.image(sigPath, 50, doc.y, { width: 60 });
          doc.y += 40;
        }
      }

      // HR name in blue with underline (Phoneme format)
      doc.fillColor(blueColor).font(boldFont).text(hrName, { underline: true });
      doc.moveDown(0.3);
      doc.fillColor('black').font(boldFont).text(hrTitle);
      doc.moveDown(1);

      doc.moveDown(2);

      // ==================== ACKNOWLEDGEMENT SECTION (Phoneme Format) ====================
      checkPageBreak(200);

      // ACKNOWLEDGEMENT title (black, underlined - Phoneme format)
      doc.fontSize(11).fillColor(headingColor).font(boldFont).text('ACKNOWLEDGEMENT', { underline: true });
      doc.moveDown(1);

      // Acknowledgement text (Phoneme format)
      doc.fillColor('black').fontSize(10).font(mainFont);
      doc.text(`This is to certify that I have read this Agreement and all Annexure and understood all the terms and conditions mentioned therein and I hereby accept and agree to abide by them:`, { align: 'left' });
      doc.moveDown(2);

      // Signature fields in two columns (Phoneme format)
      const leftColX = 50;
      const rightColX = 300;
      const fieldY = doc.y;

      doc.font(boldFont).text('Name of Employee:', leftColX, fieldY);
      doc.font(boldFont).text('Date:', rightColX, fieldY);
      doc.text('/', rightColX + 40, fieldY);
      doc.text('/', rightColX + 70, fieldY);
      doc.moveDown(1.5);

      doc.font(boldFont).text('Signature of Employee:', leftColX, doc.y);
      doc.font(boldFont).text('Place:', rightColX, doc.y);
      doc.moveDown(2);

      // ==================== ANNEXURE-A ====================
      doc.addPage();
      addHeader();
      addFooter();
      doc.y = headerImage ? 100 : 80;
      doc.x = 50;

      doc.fontSize(12).fillColor(headingColor).font(boldFont).text('ANNEXURE- A', 50, doc.y, { align: 'center', width: 495, underline: true });
      doc.moveDown(1.5);
      doc.fontSize(11).font(boldFont).fillColor(headingColor).text('Salary Break Up', 50, doc.y, { underline: true });
      doc.moveDown(1.5);

      // Salary Table
      const tableLeft = 50;
      const salaryColWidths = [150, 150, 150];
      const rowHeight = 22;
      const tableTop = doc.y;

      // Header row
      doc.rect(tableLeft, tableTop, salaryColWidths[0], rowHeight).stroke('#000000');
      doc.rect(tableLeft + salaryColWidths[0], tableTop, salaryColWidths[1], rowHeight).stroke('#000000');
      doc.rect(tableLeft + salaryColWidths[0] + salaryColWidths[1], tableTop, salaryColWidths[2], rowHeight).stroke('#000000');
      doc.fillColor('black').font(boldFont).fontSize(10);
      doc.text('Components', tableLeft + 5, tableTop + 6, { width: salaryColWidths[0] - 10 });
      doc.text('Per Month (in Rs.)', tableLeft + salaryColWidths[0] + 5, tableTop + 6, { width: salaryColWidths[1] - 10, align: 'center' });
      doc.text('Annual (in Rs.)', tableLeft + salaryColWidths[0] + salaryColWidths[1] + 5, tableTop + 6, { width: salaryColWidths[2] - 10, align: 'center' });

      let tableYPos = tableTop + rowHeight;
      doc.font(mainFont);

      salaryBreakdown.forEach((item) => {
        doc.rect(tableLeft, tableYPos, salaryColWidths[0], rowHeight).stroke('#000000');
        doc.rect(tableLeft + salaryColWidths[0], tableYPos, salaryColWidths[1], rowHeight).stroke('#000000');
        doc.rect(tableLeft + salaryColWidths[0] + salaryColWidths[1], tableYPos, salaryColWidths[2], rowHeight).stroke('#000000');
        doc.fillColor('black');
        doc.text(item.component, tableLeft + 5, tableYPos + 6, { width: salaryColWidths[0] - 10 });
        doc.text(formatCurrency(item.perMonth), tableLeft + salaryColWidths[0] + 5, tableYPos + 6, { width: salaryColWidths[1] - 10, align: 'center' });
        doc.text(formatCurrency(item.annual), tableLeft + salaryColWidths[0] + salaryColWidths[1] + 5, tableYPos + 6, { width: salaryColWidths[2] - 10, align: 'center' });
        tableYPos += rowHeight;
      });

      // Total row
      const totalMonthly = salaryBreakdown.reduce((sum, item) => sum + item.perMonth, 0);
      const totalAnnual = salaryBreakdown.reduce((sum, item) => sum + item.annual, 0);
      doc.rect(tableLeft, tableYPos, salaryColWidths[0], rowHeight).stroke('#000000');
      doc.rect(tableLeft + salaryColWidths[0], tableYPos, salaryColWidths[1], rowHeight).stroke('#000000');
      doc.rect(tableLeft + salaryColWidths[0] + salaryColWidths[1], tableYPos, salaryColWidths[2], rowHeight).stroke('#000000');
          doc.fillColor('black').font(boldFont);
          doc.text('Fixed Salary (Total)', tableLeft + 5, tableYPos + 6, { width: salaryColWidths[0] - 10 });
          doc.text(formatCurrency(totalMonthly), tableLeft + salaryColWidths[0] + 5, tableYPos + 6, { width: salaryColWidths[1] - 10, align: 'center' });
          doc.text(formatCurrency(totalAnnual), tableLeft + salaryColWidths[0] + salaryColWidths[1] + 5, tableYPos + 6, { width: salaryColWidths[2] - 10, align: 'center' });
      tableYPos += rowHeight + 20;
      doc.y = tableYPos;
      doc.moveDown(2);

      // Signature area
      const annexureSigY = doc.y + 30;
      doc.font(mainFont).fillColor('black').text('Employee Signature:', 50, annexureSigY);
      doc.text('_____________________', 50, annexureSigY + 30);
      doc.text('For, ' + companyName, 320, annexureSigY);
      if (offerLetter.signatory_signature) {
        const sigPath = path.join(process.cwd(), 'uploads', 'signatures', offerLetter.signatory_signature);
        if (fs.existsSync(sigPath)) doc.image(sigPath, 320, annexureSigY + 15, { width: 60 });
      }
      doc.y = annexureSigY + 55;
      doc.fillColor(blueColor).font(boldFont).text(hrName, 320, doc.y, { underline: true });
      doc.fillColor('black').font(mainFont).text(hrTitle, 320, doc.y + 15);

      // ==================== ANNEXURE-B (KRAs) ====================
      if (true) {
        doc.addPage();
        addHeader();
        addFooter();
        doc.y = headerImage ? 100 : 80;
        doc.x = 50;

        doc.fontSize(12).fillColor(headingColor).font(boldFont).text('ANNEXURE-B', 50, doc.y, { align: 'center', width: 495, underline: true });
        doc.moveDown(1.5);
        doc.fontSize(11).fillColor(headingColor).font(boldFont).text(`Key Responsibility Areas (KRA) – ${offerLetter.designation}`, 50, doc.y);
        doc.moveDown(1);

        doc.fillColor('black').font(mainFont).fontSize(10);
        kraDetails.forEach((kra: any, index: number) => {
          const kraText = typeof kra === 'string' ? kra : kra.responsibility || kra.description || kra.title || '';
          checkPageBreak(30);
          doc.text(`${index + 1}. ${kraText}`, 50, doc.y, { width: 495, align: 'justify' });
          doc.moveDown(0.5);
        });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Get default email signature
router.get('/email-signature/default', authenticateToken, (req, res) => {
  res.json(defaultEmailSignature);
});

// Update email signature (save user preference)
router.post('/email-signature', authenticateToken, (req, res) => {
  try {
    const { signature } = req.body;
    const userId = req.user!.userId;

    // Save signature preference to settings or user table
    const existingSetting = db.prepare(`
      SELECT * FROM settings WHERE key = ?
    `).get(`email_signature_${userId}`) as any;

    if (existingSetting) {
      db.prepare(`
        UPDATE settings SET value = ? WHERE key = ?
      `).run(JSON.stringify(signature), `email_signature_${userId}`);
    } else {
      db.prepare(`
        INSERT INTO settings (key, value) VALUES (?, ?)
      `).run(`email_signature_${userId}`, JSON.stringify(signature));
    }

    res.json({ message: 'Email signature saved', signature });
  } catch (error: any) {
    console.error('Error saving email signature:', error);
    res.status(500).json({ error: 'Failed to save email signature' });
  }
});

// Get user's saved email signature
router.get('/email-signature', authenticateToken, (req, res) => {
  try {
    const userId = req.user!.userId;

    const setting = db.prepare(`
      SELECT value FROM settings WHERE key = ?
    `).get(`email_signature_${userId}`) as any;

    if (setting) {
      res.json(JSON.parse(setting.value));
    } else {
      res.json(defaultEmailSignature);
    }
  } catch (error: any) {
    console.error('Error fetching email signature:', error);
    res.json(defaultEmailSignature);
  }
});

export default router;



