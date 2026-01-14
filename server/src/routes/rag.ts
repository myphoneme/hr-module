import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import OpenAI from 'openai';
import db from '../db';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { extractTextFromPDF } from '../utils/pdfHelper';
import type {
  RAGDocument,
  RAGDocumentWithUser,
  RAGEmbedding,
  ResumeExtraction,
  ResumeExtractionWithUser,
  RAGGenerateRequest,
  RAGGenerateResponse,
  CreateOfferLetterInput,
  SalaryComponent,
} from '../types';

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Types for learned patterns
interface LearnedPattern {
  id: number;
  document_id: number;
  company_name: string | null;
  company_address: string | null;
  hr_manager_name: string | null;
  hr_manager_title: string | null;
  working_location: string | null;
  probation_period: string | null;
  notice_period: string | null;
  working_hours: string | null;
  leave_policy: string | null;
  benefits: string | null;
  salary_structure: string | null;
  designation_found: string | null;
  annual_ctc_found: number | null;
  template_style: string | null;
  clauses: string | null;
  full_analysis: string | null;
  createdAt: string;
}

interface SalaryBenchmark {
  id: number;
  designation: string;
  experience_min: number;
  experience_max: number;
  annual_ctc_min: number | null;
  annual_ctc_max: number | null;
  annual_ctc_avg: number | null;
  basic_percentage: number | null;
  hra_percentage: number | null;
  sample_count: number;
  source_document_ids: string | null;
  updatedAt: string;
}

interface CompanyDefault {
  id: number;
  setting_key: string;
  setting_value: string;
  source_document_id: number | null;
  updatedAt: string;
}

// Template Profile interface
interface TemplateProfile {
  id: number;
  profile_name: string;
  profile_description: string | null;
  source_document_ids: string | null;
  header_format: string | null;
  greeting_format: string | null;
  opening_paragraph: string | null;
  sections_order: string | null;
  closing_format: string | null;
  signature_format: string | null;
  tone_style: 'formal' | 'semi_formal' | 'friendly' | null;
  language_patterns: string | null;
  common_phrases: string | null;
  has_salary_table: number;
  has_kra_section: number;
  has_annexures: number;
  annexure_types: string | null;
  date_format: string | null;
  salary_format: string | null;
  paragraph_style: string | null;
  bullet_point_style: string | null;
  probation_clause: string | null;
  notice_period_clause: string | null;
  confidentiality_clause: string | null;
  termination_clause: string | null;
  general_terms_clause: string | null;
  benefits_section: string | null;
  working_hours_clause: string | null;
  leave_policy_clause: string | null;
  full_structure: string | null;
  sample_generated_content: string | null;
  designation_types: string | null;
  experience_levels: string | null;
  is_default: number;
  usage_count: number;
  match_score_avg: number;
  created_by: number | null;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

// Configure upload directories
const trainingUploadDir = path.join(process.cwd(), 'uploads', 'rag', 'training');
const resumeUploadDir = path.join(process.cwd(), 'uploads', 'rag', 'resumes');

// Create directories if they don't exist
[trainingUploadDir, resumeUploadDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for training document uploads
const trainingStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, trainingUploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'training-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure multer for resume uploads
const resumeStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, resumeUploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'resume-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadTraining = multer({
  storage: trainingStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

const uploadResume = multer({
  storage: resumeStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// ============ UTILITY FUNCTIONS ============

/**
 * Split text into chunks for embedding
 */
function chunkText(text: string, maxTokens: number = 500, overlap: number = 50): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let tokenCount = 0;

  for (const word of words) {
    const wordTokens = Math.ceil(word.length / 4); // Rough token estimate
    if (tokenCount + wordTokens > maxTokens && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
      // Keep overlap
      const overlapWords = Math.floor(overlap / 4);
      currentChunk = currentChunk.slice(-overlapWords);
      tokenCount = currentChunk.join(' ').length / 4;
    }
    currentChunk.push(word);
    tokenCount += wordTokens;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks;
}

/**
 * Generate embedding using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

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

/**
 * Find similar chunks using cosine similarity
 */
async function findSimilarChunks(query: string, topK: number = 5): Promise<{ chunk: string; similarity: number; documentId: number }[]> {
  const queryEmbedding = await generateEmbedding(query);

  const embeddings = db.prepare(`
    SELECT e.*, d.original_name
    FROM rag_embeddings e
    JOIN rag_documents d ON e.document_id = d.id
    WHERE d.isActive = 1 AND d.status = 'completed'
  `).all() as (RAGEmbedding & { original_name: string })[];

  const similarities = embeddings.map(emb => {
    const embVector = JSON.parse(emb.embedding) as number[];
    return {
      chunk: emb.chunk_text,
      similarity: cosineSimilarity(queryEmbedding, embVector),
      documentId: emb.document_id,
    };
  });

  similarities.sort((a, b) => b.similarity - a.similarity);
  return similarities.slice(0, topK);
}

/**
 * Analyze offer letter and extract patterns using GPT-4o
 */
async function analyzeOfferLetter(text: string, documentId: number): Promise<any> {
  const prompt = `Analyze this offer letter and extract all structured information. Return ONLY a valid JSON object with these fields:

{
  "company_name": "Company name that issued this offer letter",
  "company_address": "Full company address",
  "hr_manager_name": "Name of HR manager or signatory",
  "hr_manager_title": "Title/designation of HR manager",
  "working_location": "Office location where employee will work",
  "probation_period": "Probation period mentioned (e.g., '3 months', '6 months')",
  "notice_period": "Notice period mentioned (e.g., '1 month', '2 months')",
  "working_hours": "Working hours mentioned (e.g., '9 AM to 6 PM')",
  "leave_policy": "Any leave policy details mentioned",
  "benefits": ["List of benefits mentioned like health insurance, PF, etc."],
  "designation": "Job title/designation offered",
  "annual_ctc": numeric value of annual CTC without currency symbol,
  "monthly_salary": numeric value of monthly salary if mentioned,
  "salary_breakdown": {
    "basic": {"amount": number, "percentage": number},
    "hra": {"amount": number, "percentage": number},
    "special_allowance": {"amount": number, "percentage": number},
    "other_allowances": {"amount": number, "percentage": number}
  },
  "joining_bonus": numeric value if mentioned or null,
  "template_style": "short" or "long" based on letter length and detail,
  "key_clauses": ["List of important clauses like confidentiality, non-compete, etc."],
  "kra_responsibilities": ["Key responsibilities if mentioned"],
  "offer_validity_days": number of days offer is valid,
  "joining_date_pattern": "How joining date is typically formatted/mentioned"
}

If any field cannot be determined from the offer letter, use null for that field.
For numeric fields, extract just the number without currency symbols or formatting.
For percentage calculations, calculate based on annual CTC if available.

Offer Letter Text:
${text}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an HR document analysis expert. Extract structured information from offer letters. Always return valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) return null;

    const analysis = JSON.parse(content);

    // Store the learned pattern
    db.prepare(`
      INSERT INTO rag_learned_patterns (
        document_id, company_name, company_address, hr_manager_name, hr_manager_title,
        working_location, probation_period, notice_period, working_hours, leave_policy,
        benefits, salary_structure, designation_found, annual_ctc_found, template_style,
        clauses, full_analysis
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      documentId,
      analysis.company_name,
      analysis.company_address,
      analysis.hr_manager_name,
      analysis.hr_manager_title,
      analysis.working_location,
      analysis.probation_period,
      analysis.notice_period,
      analysis.working_hours,
      analysis.leave_policy,
      analysis.benefits ? JSON.stringify(analysis.benefits) : null,
      analysis.salary_breakdown ? JSON.stringify(analysis.salary_breakdown) : null,
      analysis.designation,
      analysis.annual_ctc,
      analysis.template_style,
      analysis.key_clauses ? JSON.stringify(analysis.key_clauses) : null,
      JSON.stringify(analysis)
    );

    // Update company defaults if we found useful patterns
    if (analysis.company_name) {
      upsertCompanyDefault('company_name', analysis.company_name, documentId);
    }
    if (analysis.company_address) {
      upsertCompanyDefault('company_address', analysis.company_address, documentId);
    }
    if (analysis.hr_manager_name) {
      upsertCompanyDefault('hr_manager_name', analysis.hr_manager_name, documentId);
    }
    if (analysis.hr_manager_title) {
      upsertCompanyDefault('hr_manager_title', analysis.hr_manager_title, documentId);
    }
    if (analysis.working_location) {
      upsertCompanyDefault('working_location', analysis.working_location, documentId);
    }
    if (analysis.probation_period) {
      upsertCompanyDefault('probation_period', analysis.probation_period, documentId);
    }
    if (analysis.notice_period) {
      upsertCompanyDefault('notice_period', analysis.notice_period, documentId);
    }
    if (analysis.benefits) {
      upsertCompanyDefault('benefits', JSON.stringify(analysis.benefits), documentId);
    }

    // Update salary benchmarks if we have designation and salary info
    if (analysis.designation && analysis.annual_ctc) {
      updateSalaryBenchmark(
        analysis.designation,
        analysis.annual_ctc,
        analysis.salary_breakdown,
        documentId
      );
    }

    return analysis;
  } catch (error) {
    console.error('Error analyzing offer letter:', error);
    return null;
  }
}

/**
 * Extract ALL sections with their complete content from offer letter
 * This preserves the full text of each section for use in PDF generation
 */
async function extractAllSectionsContent(text: string): Promise<any[]> {
  // Split into smaller chunks if text is very long (for token limits)
  const maxChunkSize = 12000; // Safe limit for GPT-4o-mini context
  const chunks: string[] = [];

  if (text.length > maxChunkSize) {
    // Split by section markers or paragraphs
    const parts = text.split(/(?=\d+\.\s+[A-Z]|\n\n(?=[A-Z]))/);
    let currentChunk = '';
    for (const part of parts) {
      if ((currentChunk + part).length > maxChunkSize && currentChunk) {
        chunks.push(currentChunk);
        currentChunk = part;
      } else {
        currentChunk += part;
      }
    }
    if (currentChunk) chunks.push(currentChunk);
  } else {
    chunks.push(text);
  }

  const allSections: any[] = [];

  for (const chunk of chunks) {
    const prompt = `You are an expert document analyst. Extract ALL sections from this offer letter document with their COMPLETE, EXACT content.

For each section, extract:
1. section_number - The section number (e.g., "1", "2", "3.1", etc.) or null if unnumbered
2. section_title - The section heading/title exactly as it appears
3. section_content - The COMPLETE, EXACT text content of the section (preserve all paragraphs, bullets, sub-points)
4. has_subsections - true if this section has numbered/lettered sub-items
5. subsections - Array of sub-items if present, each with: {letter/number, content}

Return a JSON object with this structure:
{
  "sections": [
    {
      "section_number": "1",
      "section_title": "COMMENCEMENT OF APPOINTMENT",
      "section_content": "The complete exact text...",
      "has_subsections": false,
      "subsections": []
    },
    {
      "section_number": "2",
      "section_title": "TERMS AND CONDITIONS",
      "section_content": "Main section text...",
      "has_subsections": true,
      "subsections": [
        {"marker": "a", "content": "First sub-point..."},
        {"marker": "b", "content": "Second sub-point..."}
      ]
    }
  ]
}

IMPORTANT:
1. Extract EVERY section from the document - do not skip any
2. Preserve the EXACT, COMPLETE text - do not summarize or truncate
3. Include ALL sub-points, bullets, and nested content
4. Keep all punctuation, formatting markers, and special characters
5. Replace specific candidate names/dates with {{placeholders}} like {{candidate_name}}, {{joining_date}}, {{annual_ctc}}, {{designation}}, {{working_location}}, {{company_name}}, {{probation_period}}, {{notice_period}}, {{offer_valid_till}}

Document text:
${chunk}`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert document analyst. Extract complete section content from offer letters. Always return valid JSON with all sections preserved exactly.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 8000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content;
      if (content) {
        const parsed = JSON.parse(content);
        if (parsed.sections && Array.isArray(parsed.sections)) {
          allSections.push(...parsed.sections);
        }
      }
    } catch (error) {
      console.error('Error extracting sections from chunk:', error);
    }
  }

  // Deduplicate sections by title (in case of overlap between chunks)
  const seenTitles = new Set<string>();
  const uniqueSections = allSections.filter(section => {
    const key = section.section_title?.toLowerCase().trim();
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  });

  console.log(`Extracted ${uniqueSections.length} unique sections from document`);
  return uniqueSections;
}

/**
 * Extract complete template structure from offer letter using GPT-4o
 * This function analyzes the document to extract its complete formatting and structure
 */
async function extractTemplateStructure(text: string, documentId: number): Promise<any> {
  const prompt = `You are an expert document analyst. Analyze this offer letter and extract its COMPLETE template structure.
Focus on the FORMAT, STRUCTURE, and LANGUAGE PATTERNS - not just the data.

Return ONLY a valid JSON object with these fields:

{
  "profile_name": "A descriptive name for this template style (e.g., 'Formal Corporate Template', 'Startup Friendly Template')",
  "profile_description": "Brief description of the template's characteristics",

  "structure": {
    "header_format": "How the header/title is formatted (e.g., 'OFFER LETTER' centered, 'Employment Offer' left-aligned)",
    "date_position": "Where the date appears (top-right, below header, etc.)",
    "recipient_format": "How recipient info is formatted (To: Name, Dear [Name], etc.)",
    "greeting_format": "The exact greeting pattern used (Dear Mr./Ms., Dear [First Name], etc.)",
    "opening_paragraph": "The EXACT opening paragraph template with {{placeholders}} for variables",
    "sections_order": ["ordered list of sections as they appear", "e.g. commencement", "remuneration", "probation", "notice", "confidentiality"],
    "closing_format": "How the letter closes (Regards, Best Regards, etc.)",
    "signature_format": "Signature block format (For Company Name, position, etc.)"
  },

  "language_patterns": {
    "tone_style": "formal" | "semi_formal" | "friendly",
    "common_phrases": ["List of recurring phrases used in the letter"],
    "sentence_structure": "Description of sentence style (long formal, short direct, etc.)",
    "paragraph_style": "dense" | "spaced" | "numbered" | "bulleted"
  },

  "clauses": {
    "commencement": "EXACT text of commencement/joining date clause with {{joining_date}} placeholder",
    "remuneration": "EXACT text of salary/CTC clause with {{annual_ctc}}, {{ctc_in_words}} placeholders",
    "probation": "EXACT text of probation clause with {{probation_period}} placeholder",
    "notice_period": "EXACT text of notice period clause with {{notice_period}} placeholder",
    "working_hours": "EXACT text of working hours clause",
    "leave_policy": "EXACT text of leave policy clause if present",
    "confidentiality": "EXACT text of confidentiality clause if present",
    "termination": "EXACT text of termination clause if present",
    "general_terms": "EXACT text of general terms/rules section",
    "conflict_of_interest": "EXACT text of conflict of interest clause if present",
    "acceptance": "EXACT text of acceptance instruction with {{offer_valid_till}} placeholder"
  },

  "formatting": {
    "has_salary_table": true/false,
    "salary_table_format": "Description of salary table structure (columns, headers, etc.)",
    "has_annexures": true/false,
    "annexure_types": ["Salary Breakup", "KRA", "etc."],
    "has_kra_section": true/false,
    "date_format": "The date format used (e.g., 'Month DDth, YYYY', 'DD/MM/YYYY')",
    "currency_format": "How amounts are formatted (INR X,XX,XXX/-, Rs. X Lakhs, etc.)",
    "bullet_style": "• or - or numbered or none"
  },

  "designation_suitability": {
    "experience_levels": ["fresher", "junior", "mid", "senior", "lead", "executive"],
    "designation_types": ["List of designations this template is suitable for"],
    "template_length": "short" | "medium" | "long"
  }
}

IMPORTANT:
1. For all clause fields, preserve the EXACT wording from the document, just replace specific values with {{placeholders}}
2. Identify the unique language patterns and phrases used
3. Note the exact order of sections
4. Capture the formatting style (formal headers, bullet points, etc.)

Offer Letter Text:
${text}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert document template analyst. Extract complete template structures with exact formatting and language patterns. Always return valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) return null;

    return JSON.parse(content);
  } catch (error) {
    console.error('Error extracting template structure:', error);
    return null;
  }
}

/**
 * Create or update template profile from extracted structure
 */
async function createOrUpdateTemplateProfile(
  structure: any,
  documentId: number,
  userId: number,
  allSectionsContent?: any[]
): Promise<number | null> {
  try {
    // Check if a similar template already exists
    const existingProfiles = db.prepare(`
      SELECT * FROM rag_template_profiles WHERE isActive = 1
    `).all() as TemplateProfile[];

    // Try to find a matching template based on structure similarity
    let matchedProfile: TemplateProfile | null = null;
    let highestSimilarity = 0;

    for (const profile of existingProfiles) {
      const similarity = calculateTemplateSimilarity(structure, profile);
      if (similarity > 0.8 && similarity > highestSimilarity) {
        matchedProfile = profile;
        highestSimilarity = similarity;
      }
    }

    if (matchedProfile) {
      // Update existing profile with additional document reference
      const sourceIds = matchedProfile.source_document_ids
        ? JSON.parse(matchedProfile.source_document_ids)
        : [];
      if (!sourceIds.includes(documentId)) {
        sourceIds.push(documentId);
      }

      // Also update all_sections_content if provided (to get the latest complete content)
      if (allSectionsContent && allSectionsContent.length > 0) {
        db.prepare(`
          UPDATE rag_template_profiles
          SET source_document_ids = ?,
              usage_count = usage_count + 1,
              all_sections_content = ?,
              updatedAt = datetime('now')
          WHERE id = ?
        `).run(JSON.stringify(sourceIds), JSON.stringify(allSectionsContent), matchedProfile.id);
      } else {
        db.prepare(`
          UPDATE rag_template_profiles
          SET source_document_ids = ?,
              usage_count = usage_count + 1,
              updatedAt = datetime('now')
          WHERE id = ?
        `).run(JSON.stringify(sourceIds), matchedProfile.id);
      }

      // Link document to template
      db.prepare(`
        INSERT INTO rag_document_templates (document_id, template_profile_id, match_confidence)
        VALUES (?, ?, ?)
      `).run(documentId, matchedProfile.id, highestSimilarity);

      console.log(`Document ${documentId} linked to existing template profile ${matchedProfile.id}`);
      return matchedProfile.id;
    }

    // Create new template profile
    const result = db.prepare(`
      INSERT INTO rag_template_profiles (
        profile_name, profile_description, source_document_ids,
        header_format, greeting_format, opening_paragraph, sections_order,
        closing_format, signature_format, tone_style, language_patterns,
        common_phrases, has_salary_table, has_kra_section, has_annexures,
        annexure_types, date_format, salary_format, paragraph_style,
        bullet_point_style, probation_clause, notice_period_clause,
        confidentiality_clause, termination_clause, general_terms_clause,
        benefits_section, working_hours_clause, leave_policy_clause,
        full_structure, designation_types, experience_levels, created_by,
        all_sections_content
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      structure.profile_name || 'Unnamed Template',
      structure.profile_description || null,
      JSON.stringify([documentId]),
      structure.structure?.header_format || null,
      structure.structure?.greeting_format || null,
      structure.structure?.opening_paragraph || null,
      structure.structure?.sections_order ? JSON.stringify(structure.structure.sections_order) : null,
      structure.structure?.closing_format || null,
      structure.structure?.signature_format || null,
      structure.language_patterns?.tone_style || 'formal',
      structure.language_patterns ? JSON.stringify(structure.language_patterns) : null,
      structure.language_patterns?.common_phrases ? JSON.stringify(structure.language_patterns.common_phrases) : null,
      structure.formatting?.has_salary_table ? 1 : 0,
      structure.formatting?.has_kra_section ? 1 : 0,
      structure.formatting?.has_annexures ? 1 : 0,
      structure.formatting?.annexure_types ? JSON.stringify(structure.formatting.annexure_types) : null,
      structure.formatting?.date_format || null,
      structure.formatting?.currency_format || null,
      structure.language_patterns?.paragraph_style || null,
      structure.formatting?.bullet_style || null,
      structure.clauses?.probation || null,
      structure.clauses?.notice_period || null,
      structure.clauses?.confidentiality || null,
      structure.clauses?.termination || null,
      structure.clauses?.general_terms || null,
      structure.clauses?.leave_policy || null,
      structure.clauses?.working_hours || null,
      structure.clauses?.leave_policy || null,
      JSON.stringify(structure),
      structure.designation_suitability?.designation_types ? JSON.stringify(structure.designation_suitability.designation_types) : null,
      structure.designation_suitability?.experience_levels ? JSON.stringify(structure.designation_suitability.experience_levels) : null,
      userId,
      allSectionsContent ? JSON.stringify(allSectionsContent) : null
    );

    const profileId = result.lastInsertRowid as number;

    // Link document to new template
    db.prepare(`
      INSERT INTO rag_document_templates (document_id, template_profile_id, match_confidence)
      VALUES (?, ?, 1.0)
    `).run(documentId, profileId);

    console.log(`Created new template profile ${profileId} from document ${documentId}`);
    return profileId;
  } catch (error) {
    console.error('Error creating template profile:', error);
    return null;
  }
}

/**
 * Calculate similarity between extracted structure and existing template profile
 */
function calculateTemplateSimilarity(structure: any, profile: TemplateProfile): number {
  let score = 0;
  let totalChecks = 0;

  // Compare tone style
  if (structure.language_patterns?.tone_style === profile.tone_style) {
    score += 1;
  }
  totalChecks += 1;

  // Compare sections order
  if (structure.structure?.sections_order && profile.sections_order) {
    const newSections = structure.structure.sections_order;
    const existingSections = JSON.parse(profile.sections_order);
    const commonSections = newSections.filter((s: string) => existingSections.includes(s));
    score += commonSections.length / Math.max(newSections.length, existingSections.length);
    totalChecks += 1;
  }

  // Compare structural elements
  if (structure.formatting?.has_salary_table === !!profile.has_salary_table) score += 0.5;
  if (structure.formatting?.has_kra_section === !!profile.has_kra_section) score += 0.5;
  if (structure.formatting?.has_annexures === !!profile.has_annexures) score += 0.5;
  totalChecks += 1.5;

  // Compare template length
  if (structure.designation_suitability?.template_length) {
    const fullStruct = profile.full_structure ? JSON.parse(profile.full_structure) : null;
    if (fullStruct?.designation_suitability?.template_length === structure.designation_suitability.template_length) {
      score += 1;
    }
  }
  totalChecks += 1;

  return totalChecks > 0 ? score / totalChecks : 0;
}

/**
 * Find best matching template profile for a candidate/designation
 * STRICT MATCHING: Only uses uploaded HR documents - no AI-generated content
 * Matches by: Job role, Employment type (Full-time/Contract/Intern), Location, Experience level
 */
function findBestTemplateProfile(
  designation: string,
  experienceYears: number,
  employmentType?: string,
  location?: string
): TemplateProfile | null {
  const experienceLevel = experienceYears < 1 ? 'fresher' :
                         experienceYears < 3 ? 'junior' :
                         experienceYears < 6 ? 'mid' :
                         experienceYears < 10 ? 'senior' : 'lead';

  // Normalize employment type
  const normalizedEmploymentType = employmentType?.toLowerCase() || '';
  const isIntern = normalizedEmploymentType.includes('intern') || designation.toLowerCase().includes('intern');
  const isContract = normalizedEmploymentType.includes('contract') || normalizedEmploymentType.includes('consultant');

  // STEP 1: Try exact match with designation + employment type + location
  if (location) {
    const profile = db.prepare(`
      SELECT * FROM rag_template_profiles
      WHERE isActive = 1
        AND (designation_types LIKE ? OR profile_name LIKE ?)
        AND full_structure LIKE ?
      ORDER BY usage_count DESC, is_default DESC
      LIMIT 1
    `).get(`%${designation}%`, `%${designation}%`, `%${location}%`) as TemplateProfile | undefined;
    if (profile) return profile;
  }

  // STEP 2: Try to find a template that matches designation AND employment type
  if (isIntern) {
    const profile = db.prepare(`
      SELECT * FROM rag_template_profiles
      WHERE isActive = 1
        AND (designation_types LIKE '%intern%' OR profile_name LIKE '%intern%')
      ORDER BY usage_count DESC, is_default DESC
      LIMIT 1
    `).get() as TemplateProfile | undefined;
    if (profile) return profile;
  }

  if (isContract) {
    const profile = db.prepare(`
      SELECT * FROM rag_template_profiles
      WHERE isActive = 1
        AND (designation_types LIKE '%contract%' OR profile_name LIKE '%contract%' OR profile_name LIKE '%consultant%')
      ORDER BY usage_count DESC, is_default DESC
      LIMIT 1
    `).get() as TemplateProfile | undefined;
    if (profile) return profile;
  }

  // STEP 3: Try to find a template that matches the designation
  let profile = db.prepare(`
    SELECT * FROM rag_template_profiles
    WHERE isActive = 1 AND designation_types LIKE ?
    ORDER BY usage_count DESC, is_default DESC
    LIMIT 1
  `).get(`%${designation}%`) as TemplateProfile | undefined;

  if (profile) return profile;

  // STEP 4: Try to find by experience level
  profile = db.prepare(`
    SELECT * FROM rag_template_profiles
    WHERE isActive = 1 AND experience_levels LIKE ?
    ORDER BY usage_count DESC, is_default DESC
    LIMIT 1
  `).get(`%${experienceLevel}%`) as TemplateProfile | undefined;

  if (profile) return profile;

  // STEP 5: Return default or most used template
  profile = db.prepare(`
    SELECT * FROM rag_template_profiles
    WHERE isActive = 1
    ORDER BY is_default DESC, usage_count DESC
    LIMIT 1
  `).get() as TemplateProfile | undefined;

  return profile || null;
}

/**
 * Generate offer letter using specific template profile
 */
async function generateOfferLetterWithTemplate(
  resumeData: ResumeExtraction,
  templateProfile: TemplateProfile,
  config: RAGGenerateRequest
): Promise<RAGGenerateResponse> {
  const candidateName = resumeData.candidate_name || 'Candidate Name';
  const candidateAddress = resumeData.candidate_address || 'Address not provided';
  const designation = resumeData.designation || config.designation || 'Software Engineer';
  const skills = resumeData.skills ? JSON.parse(resumeData.skills).join(', ') : '';
  const experience = resumeData.experience_years || 0;
  const expectedSalary = resumeData.expected_salary || 0;
  const currentSalary = resumeData.current_salary || 0;

  // Parse template structure
  const templateStructure = templateProfile.full_structure ? JSON.parse(templateProfile.full_structure) : null;
  const languagePatterns = templateProfile.language_patterns ? JSON.parse(templateProfile.language_patterns) : null;
  const sectionsOrder = templateProfile.sections_order ? JSON.parse(templateProfile.sections_order) : [];
  const commonPhrases = templateProfile.common_phrases ? JSON.parse(templateProfile.common_phrases) : [];

  // Get salary benchmark
  const salaryBenchmark = findSalaryBenchmark(designation, experience);

  // Build the generation prompt
  const prompt = `Generate a complete offer letter for the candidate using the EXACT template format provided below.
You MUST preserve the language style, phrases, and structure of the template.

CANDIDATE INFORMATION:
- Name: ${candidateName}
- Address: ${candidateAddress}
- Designation: ${designation}
- Skills: ${skills}
- Experience: ${experience} years
- Expected Salary: ${expectedSalary > 0 ? `₹${expectedSalary.toLocaleString()}` : 'Not mentioned'}
- Current Salary: ${currentSalary > 0 ? `₹${currentSalary.toLocaleString()}` : 'Not mentioned'}

TEMPLATE STRUCTURE TO FOLLOW:
- Profile Name: ${templateProfile.profile_name}
- Tone Style: ${templateProfile.tone_style}
- Header Format: ${templateProfile.header_format || 'OFFER LETTER'}
- Greeting Format: ${templateProfile.greeting_format || 'Dear {{candidate_name}},'}
- Sections Order: ${JSON.stringify(sectionsOrder)}

EXACT CLAUSES TO USE (preserve the wording, just fill in values):
${templateProfile.probation_clause ? `Probation: ${templateProfile.probation_clause}` : ''}
${templateProfile.notice_period_clause ? `Notice Period: ${templateProfile.notice_period_clause}` : ''}
${templateProfile.working_hours_clause ? `Working Hours: ${templateProfile.working_hours_clause}` : ''}
${templateProfile.confidentiality_clause ? `Confidentiality: ${templateProfile.confidentiality_clause}` : ''}
${templateProfile.termination_clause ? `Termination: ${templateProfile.termination_clause}` : ''}
${templateProfile.general_terms_clause ? `General Terms: ${templateProfile.general_terms_clause}` : ''}

COMMON PHRASES TO USE: ${commonPhrases.join(', ')}

SALARY BENCHMARK:
${salaryBenchmark ? `
- Average CTC for similar role: ₹${salaryBenchmark.annual_ctc_avg?.toLocaleString() || 'Unknown'}
- Range: ₹${salaryBenchmark.annual_ctc_min?.toLocaleString() || '0'} - ₹${salaryBenchmark.annual_ctc_max?.toLocaleString() || '0'}
- Basic: ${salaryBenchmark.basic_percentage || 40}%, HRA: ${salaryBenchmark.hra_percentage || 20}%
` : 'No benchmark - use market standards'}

CONFIGURATION:
- Working Location: ${config.working_location || 'Office'}
- HR Manager: ${config.hr_manager_name || 'HR Manager'}
- Joining Date: ${config.joining_date || '15-30 days from now'}
- Offer Valid Days: ${config.offer_valid_days || 7}

Generate the offer letter data as JSON with this structure:
{
  "candidate_name": "string",
  "candidate_address": "string",
  "designation": "string",
  "joining_date": "YYYY-MM-DD",
  "annual_ctc": number,
  "salary_breakdown": [
    {"component": "Basic Salary", "perMonth": number, "annual": number},
    {"component": "HRA", "perMonth": number, "annual": number},
    {"component": "Special Allowance", "perMonth": number, "annual": number},
    {"component": "Other Allowances", "perMonth": number, "annual": number}
  ],
  "working_location": "string",
  "hr_manager_name": "string",
  "hr_manager_title": "string",
  "offer_valid_till": "YYYY-MM-DD",
  "letter_date": "YYYY-MM-DD",
  "template_type": "${templateStructure?.designation_suitability?.template_length || 'long'}",
  "template_profile_id": ${templateProfile.id},

  "letter_content": {
    "header": "Use exact header format from template",
    "greeting": "Use exact greeting format from template with candidate name",
    "opening_paragraph": "Use exact opening paragraph style from template",
    "sections": [
      {
        "section_name": "section name from sections_order",
        "content": "Full content for this section using template clause style"
      }
    ],
    "closing": "Use exact closing format from template",
    "signature_block": "Use exact signature format from template"
  },

  "kra_details": [{"responsibility": "KRA based on designation"}],
  "joining_bonus": number or null
}

CRITICAL RULES:
1. PRESERVE the exact language style and phrases from the template
2. Use the same tone (${templateProfile.tone_style})
3. Follow the exact sections order: ${JSON.stringify(sectionsOrder)}
4. Calculate salary based on experience and benchmark
5. Generate relevant KRAs for the designation`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert HR professional. Generate offer letters that EXACTLY match the provided template format, preserving language style, phrases, and structure. Always return valid JSON.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      return { success: false, error: 'No response from AI' };
    }

    const offerData = JSON.parse(content);

    // Update template usage count
    db.prepare(`
      UPDATE rag_template_profiles
      SET usage_count = usage_count + 1, updatedAt = datetime('now')
      WHERE id = ?
    `).run(templateProfile.id);

    // Add signatory IDs if provided
    if (config.signatory_id) {
      offerData.signatory_id = config.signatory_id;
    }
    if (config.secondary_signatory_id) {
      offerData.secondary_signatory_id = config.secondary_signatory_id;
    }

    return {
      success: true,
      offer_letter_data: offerData,
      template_profile: {
        id: templateProfile.id,
        name: templateProfile.profile_name,
        tone: templateProfile.tone_style,
      },
      confidence_scores: {
        overall: 90,
        template_match: 95,
        name: resumeData.candidate_name ? 95 : 50,
        designation: resumeData.designation ? 90 : 70,
        salary: (expectedSalary > 0 || currentSalary > 0 || salaryBenchmark) ? 85 : 60,
      },
      suggestions: [],
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Upsert company default setting
 */
function upsertCompanyDefault(key: string, value: string, documentId: number) {
  const existing = db.prepare('SELECT * FROM rag_company_defaults WHERE setting_key = ?').get(key);
  if (existing) {
    db.prepare(`
      UPDATE rag_company_defaults
      SET setting_value = ?, source_document_id = ?, updatedAt = datetime('now')
      WHERE setting_key = ?
    `).run(value, documentId, key);
  } else {
    db.prepare(`
      INSERT INTO rag_company_defaults (setting_key, setting_value, source_document_id)
      VALUES (?, ?, ?)
    `).run(key, value, documentId);
  }
}

/**
 * Update salary benchmark for a designation
 */
function updateSalaryBenchmark(
  designation: string,
  annualCtc: number,
  salaryBreakdown: any,
  documentId: number
) {
  const normalizedDesignation = designation.toLowerCase().trim();

  const existing = db.prepare(`
    SELECT * FROM rag_salary_benchmarks
    WHERE LOWER(designation) = ?
  `).get(normalizedDesignation) as SalaryBenchmark | undefined;

  const basicPercentage = salaryBreakdown?.basic?.percentage || 40;
  const hraPercentage = salaryBreakdown?.hra?.percentage || 20;

  if (existing) {
    const newMin = Math.min(existing.annual_ctc_min || annualCtc, annualCtc);
    const newMax = Math.max(existing.annual_ctc_max || annualCtc, annualCtc);
    const newCount = existing.sample_count + 1;
    const newAvg = ((existing.annual_ctc_avg || 0) * existing.sample_count + annualCtc) / newCount;

    const sourceIds = existing.source_document_ids
      ? JSON.parse(existing.source_document_ids)
      : [];
    if (!sourceIds.includes(documentId)) {
      sourceIds.push(documentId);
    }

    db.prepare(`
      UPDATE rag_salary_benchmarks
      SET annual_ctc_min = ?, annual_ctc_max = ?, annual_ctc_avg = ?,
          basic_percentage = ?, hra_percentage = ?, sample_count = ?,
          source_document_ids = ?, updatedAt = datetime('now')
      WHERE id = ?
    `).run(
      newMin, newMax, newAvg,
      basicPercentage, hraPercentage, newCount,
      JSON.stringify(sourceIds), existing.id
    );
  } else {
    db.prepare(`
      INSERT INTO rag_salary_benchmarks (
        designation, annual_ctc_min, annual_ctc_max, annual_ctc_avg,
        basic_percentage, hra_percentage, sample_count, source_document_ids
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      designation, annualCtc, annualCtc, annualCtc,
      basicPercentage, hraPercentage,
      JSON.stringify([documentId])
    );
  }
}

/**
 * Get company defaults from learned patterns
 */
function getCompanyDefaults(): Record<string, string> {
  const defaults = db.prepare('SELECT * FROM rag_company_defaults').all() as CompanyDefault[];
  const result: Record<string, string> = {};
  for (const d of defaults) {
    result[d.setting_key] = d.setting_value;
  }
  return result;
}

/**
 * Find salary benchmark for a designation
 */
function findSalaryBenchmark(designation: string, experienceYears: number = 0): SalaryBenchmark | null {
  // First try exact match
  let benchmark = db.prepare(`
    SELECT * FROM rag_salary_benchmarks
    WHERE LOWER(designation) = LOWER(?)
    AND experience_min <= ? AND experience_max >= ?
  `).get(designation, experienceYears, experienceYears) as SalaryBenchmark | undefined;

  if (benchmark) return benchmark;

  // Try partial match
  benchmark = db.prepare(`
    SELECT * FROM rag_salary_benchmarks
    WHERE LOWER(designation) LIKE LOWER(?)
    ORDER BY sample_count DESC
    LIMIT 1
  `).get(`%${designation}%`) as SalaryBenchmark | undefined;

  if (benchmark) return benchmark;

  // Get average from all benchmarks
  const avgBenchmark = db.prepare(`
    SELECT
      AVG(annual_ctc_avg) as annual_ctc_avg,
      AVG(basic_percentage) as basic_percentage,
      AVG(hra_percentage) as hra_percentage
    FROM rag_salary_benchmarks
  `).get() as any;

  if (avgBenchmark && avgBenchmark.annual_ctc_avg) {
    return {
      id: 0,
      designation: 'Average',
      experience_min: 0,
      experience_max: 99,
      annual_ctc_min: avgBenchmark.annual_ctc_avg * 0.8,
      annual_ctc_max: avgBenchmark.annual_ctc_avg * 1.2,
      annual_ctc_avg: avgBenchmark.annual_ctc_avg,
      basic_percentage: avgBenchmark.basic_percentage || 40,
      hra_percentage: avgBenchmark.hra_percentage || 20,
      sample_count: 1,
      source_document_ids: null,
      updatedAt: new Date().toISOString()
    };
  }

  return null;
}

/**
 * Get all learned clauses from patterns
 */
function getLearnedClauses(): string[] {
  const patterns = db.prepare(`
    SELECT clauses FROM rag_learned_patterns
    WHERE clauses IS NOT NULL
  `).all() as { clauses: string }[];

  const allClauses = new Set<string>();
  for (const p of patterns) {
    try {
      const clauses = JSON.parse(p.clauses);
      if (Array.isArray(clauses)) {
        clauses.forEach(c => allClauses.add(c));
      }
    } catch {}
  }
  return Array.from(allClauses);
}

/**
 * Extract profile from resume using GPT-4o
 */
async function extractResumeProfile(text: string): Promise<any> {
  const prompt = `Extract the following information from this resume text. Return ONLY a valid JSON object with these fields:
{
  "candidate_name": "Full name of the candidate",
  "candidate_email": "Email address",
  "candidate_phone": "Phone number",
  "candidate_address": "Full address",
  "designation": "Current or target job title/designation",
  "skills": ["Array of technical and soft skills"],
  "experience_years": numeric value of total years of experience,
  "experience_details": [{"company": "Company Name", "role": "Job Title", "duration": "Duration", "description": "Key responsibilities"}],
  "education": [{"degree": "Degree Name", "institution": "Institution Name", "year": "Year of completion"}],
  "expected_salary": numeric value or null if not mentioned,
  "current_salary": numeric value or null if not mentioned,
  "notice_period": "Notice period if mentioned, or null"
}

If any field cannot be determined from the resume, use null for that field.
For arrays, use empty arrays [] if no data is found.
For numeric fields like experience_years, expected_salary, current_salary - extract just the number without currency symbols.

Resume text:
${text}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a resume parsing expert. Extract structured information from resumes. Always return valid JSON.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('No response from AI');

  return JSON.parse(content);
}

/**
 * Generate offer letter data using RAG + GPT-4o
 */
async function generateOfferLetterData(
  resumeData: ResumeExtraction,
  config: RAGGenerateRequest
): Promise<RAGGenerateResponse> {
  // Build query from resume data
  const designation = resumeData.designation || 'Software Engineer';
  const skills = resumeData.skills ? JSON.parse(resumeData.skills).join(', ') : '';
  const experience = resumeData.experience_years || 0;

  const query = `Offer letter for ${designation} with ${experience} years experience. Skills: ${skills}`;

  // Find similar chunks from training data
  const similarChunks = await findSimilarChunks(query, 5);
  const ragContext = similarChunks.map(c => c.chunk).join('\n\n---\n\n');

  // Parse resume data for prompt
  const candidateName = resumeData.candidate_name || 'Candidate Name';
  const candidateAddress = resumeData.candidate_address || 'Address not provided';
  const expectedSalary = resumeData.expected_salary || 0;
  const currentSalary = resumeData.current_salary || 0;

  const prompt = `Generate offer letter data for a new employee based on the following information:

CANDIDATE INFORMATION:
- Name: ${candidateName}
- Address: ${candidateAddress}
- Designation: ${designation}
- Skills: ${skills}
- Experience: ${experience} years
- Expected Salary: ${expectedSalary > 0 ? `₹${expectedSalary.toLocaleString()}` : 'Not mentioned'}
- Current Salary: ${currentSalary > 0 ? `₹${currentSalary.toLocaleString()}` : 'Not mentioned'}

REFERENCE OFFER LETTERS (for context on salary structure and benefits):
${ragContext}

CONFIGURATION:
- Template Type: ${config.template_type || 'long'}
- Working Location: ${config.working_location || 'Noida'}
- HR Manager Name: ${config.hr_manager_name || 'HR Manager'}
- HR Manager Title: ${config.hr_manager_title || 'Manager-Human Resource'}
- Offer Valid Days: ${config.offer_valid_days || 7}

Generate offer letter data as JSON with the following structure:
{
  "candidate_name": "string",
  "candidate_address": "string",
  "designation": "string",
  "joining_date": "YYYY-MM-DD (suggest a date 15-30 days from now)",
  "annual_ctc": number,
  "salary_breakdown": [
    {"component": "Basic Salary", "perMonth": number, "annual": number},
    {"component": "HRA", "perMonth": number, "annual": number},
    {"component": "Special Allowance", "perMonth": number, "annual": number},
    {"component": "Other Allowances", "perMonth": number, "annual": number}
  ],
  "working_location": "string",
  "hr_manager_name": "string",
  "hr_manager_title": "string",
  "offer_valid_till": "YYYY-MM-DD",
  "letter_date": "YYYY-MM-DD (today)",
  "template_type": "${config.template_type || 'long'}",
  "optional_sections": ["probation", "benefits", "leave_policy"],
  "kra_details": [{"responsibility": "Key responsibility 1"}, {"responsibility": "Key responsibility 2"}],
  "joining_bonus": number or null
}

IMPORTANT:
1. Calculate realistic salary based on experience, skills, and reference letters
2. If expected/current salary is provided, use it as a reference but don't necessarily match it exactly
3. Salary breakdown should follow standard Indian payroll structure (Basic ~40-50%, HRA ~40-50% of Basic, remaining as allowances)
4. Annual CTC should equal sum of all salary components
5. Include 3-5 relevant KRAs based on the designation`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are an HR expert specializing in creating offer letters. Generate structured offer letter data based on candidate information and company standards.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0].message.content;
  if (!content) {
    return { success: false, error: 'No response from AI' };
  }

  try {
    const offerData = JSON.parse(content) as CreateOfferLetterInput;

    // Add signatory IDs if provided
    if (config.signatory_id) {
      offerData.signatory_id = config.signatory_id;
    }
    if (config.secondary_signatory_id) {
      offerData.secondary_signatory_id = config.secondary_signatory_id;
    }

    // Calculate confidence scores based on RAG similarity
    const avgSimilarity = similarChunks.length > 0
      ? similarChunks.reduce((sum, c) => sum + c.similarity, 0) / similarChunks.length
      : 0;

    return {
      success: true,
      offer_letter_data: offerData,
      confidence_scores: {
        overall: Math.round(avgSimilarity * 100),
        name: resumeData.candidate_name ? 95 : 50,
        address: resumeData.candidate_address ? 90 : 40,
        designation: resumeData.designation ? 85 : 60,
        salary: expectedSalary > 0 || currentSalary > 0 ? 80 : 50,
      },
      suggestions: similarChunks.length < 3
        ? ['Consider uploading more training documents for better accuracy']
        : [],
    };
  } catch (error) {
    return { success: false, error: 'Failed to parse AI response' };
  }
}

// ============ TRAINING DOCUMENT ROUTES ============

// Upload training document
router.post('/upload-training', authenticateToken, requireAdmin, uploadTraining.single('document'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({ error: 'AI service not configured. Set OPENAI_API_KEY environment variable.' });
      return;
    }

    const userId = req.user!.userId;
    const filePath = req.file.path;
    const filename = req.file.filename;
    const originalName = req.file.originalname;
    const fileSize = req.file.size;

    // Insert document record as pending
    const result = db.prepare(`
      INSERT INTO rag_documents (filename, original_name, file_path, file_size, status, uploaded_by)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `).run(filename, originalName, filePath, fileSize, userId);

    const documentId = result.lastInsertRowid as number;

    // Process document asynchronously
    (async () => {
      try {
        // Update status to processing
        db.prepare(`UPDATE rag_documents SET status = 'processing', updatedAt = datetime('now') WHERE id = ?`).run(documentId);

        // Extract text from PDF
        const pdfBuffer = fs.readFileSync(filePath);
        const extractedText = await extractTextFromPDF(pdfBuffer);

        // Chunk the text
        const chunks = chunkText(extractedText);

        // Generate embeddings for each chunk
        for (let i = 0; i < chunks.length; i++) {
          const embedding = await generateEmbedding(chunks[i]);
          db.prepare(`
            INSERT INTO rag_embeddings (document_id, chunk_index, chunk_text, embedding)
            VALUES (?, ?, ?, ?)
          `).run(documentId, i, chunks[i], JSON.stringify(embedding));
        }

        // Analyze offer letter and extract patterns
        console.log(`Analyzing offer letter patterns for document ${documentId}...`);
        await analyzeOfferLetter(extractedText, documentId);

        // Extract template structure and create/update profile
        console.log(`Extracting template structure for document ${documentId}...`);
        const templateStructure = await extractTemplateStructure(extractedText, documentId);

        // Extract ALL sections content for complete document preservation
        console.log(`Extracting all sections content for document ${documentId}...`);
        const allSectionsContent = await extractAllSectionsContent(extractedText);
        console.log(`Extracted ${allSectionsContent.length} sections from document ${documentId}`);

        if (templateStructure) {
          const profileId = await createOrUpdateTemplateProfile(templateStructure, documentId, userId, allSectionsContent);
          console.log(`Template profile ${profileId} created/updated for document ${documentId}`);
        }

        // Update document as completed
        db.prepare(`
          UPDATE rag_documents
          SET status = 'completed', extracted_text = ?, chunk_count = ?, updatedAt = datetime('now')
          WHERE id = ?
        `).run(extractedText, chunks.length, documentId);

        console.log(`RAG document ${documentId} processed successfully: ${chunks.length} chunks + patterns learned`);
      } catch (error: any) {
        console.error(`Error processing RAG document ${documentId}:`, error);
        db.prepare(`
          UPDATE rag_documents
          SET status = 'failed', error_message = ?, updatedAt = datetime('now')
          WHERE id = ?
        `).run(error.message, documentId);
      }
    })();

    // Return immediately with pending status
    const document = db.prepare(`
      SELECT d.*, u.name as uploader_name, u.email as uploader_email
      FROM rag_documents d
      JOIN users u ON d.uploaded_by = u.id
      WHERE d.id = ?
    `).get(documentId) as RAGDocumentWithUser;

    res.status(201).json({
      ...document,
      isActive: Boolean(document.isActive),
    });
  } catch (error: any) {
    console.error('Error uploading training document:', error);
    res.status(500).json({ error: 'Failed to upload document', details: error.message });
  }
});

// Get all training documents
router.get('/documents', authenticateToken, requireAdmin, (_req: Request, res: Response): void => {
  try {
    const documents = db.prepare(`
      SELECT d.*, u.name as uploader_name, u.email as uploader_email
      FROM rag_documents d
      JOIN users u ON d.uploaded_by = u.id
      WHERE d.isActive = 1
      ORDER BY d.createdAt DESC
    `).all() as RAGDocumentWithUser[];

    res.json(documents.map(d => ({
      ...d,
      isActive: Boolean(d.isActive),
    })));
  } catch (error) {
    console.error('Error fetching training documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Get single training document
router.get('/documents/:id', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const document = db.prepare(`
      SELECT d.*, u.name as uploader_name, u.email as uploader_email
      FROM rag_documents d
      JOIN users u ON d.uploaded_by = u.id
      WHERE d.id = ? AND d.isActive = 1
    `).get(id) as RAGDocumentWithUser | undefined;

    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.json({
      ...document,
      isActive: Boolean(document.isActive),
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// Download/view training document file
router.get('/documents/:id/download', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const document = db.prepare(`
      SELECT * FROM rag_documents WHERE id = ? AND isActive = 1
    `).get(id) as RAGDocument | undefined;

    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // file_path is stored as absolute path, use directly
    const filePath = path.isAbsolute(document.file_path)
      ? document.file_path
      : path.join(process.cwd(), document.file_path);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found on disk' });
      return;
    }

    res.setHeader('Content-Disposition', `inline; filename="${document.original_name}"`);
    res.setHeader('Content-Type', 'application/pdf');
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// Delete training document
router.delete('/documents/:id', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const document = db.prepare('SELECT * FROM rag_documents WHERE id = ?').get(id) as RAGDocument | undefined;
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Delete embeddings (will cascade due to foreign key)
    db.prepare('DELETE FROM rag_embeddings WHERE document_id = ?').run(id);

    // Soft delete document
    db.prepare(`UPDATE rag_documents SET isActive = 0, updatedAt = datetime('now') WHERE id = ?`).run(id);

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Re-process all documents to extract template profiles
router.post('/reprocess-templates', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({ error: 'AI service not configured. Set OPENAI_API_KEY environment variable.' });
      return;
    }

    const userId = req.user!.userId;

    // Get all completed documents with extracted text (especially offer letters)
    const documents = db.prepare(`
      SELECT id, original_name, extracted_text, uploaded_by
      FROM rag_documents
      WHERE isActive = 1 AND status = 'completed' AND extracted_text IS NOT NULL
      AND (
        LOWER(original_name) LIKE '%offer%'
        OR LOWER(original_name) LIKE '%letter%'
        OR LOWER(original_name) LIKE '%appointment%'
      )
    `).all() as { id: number; original_name: string; extracted_text: string; uploaded_by: number }[];

    if (documents.length === 0) {
      res.status(404).json({ error: 'No offer letter documents found to process' });
      return;
    }

    console.log(`Re-processing ${documents.length} documents for template extraction...`);

    const results: { id: number; name: string; success: boolean; profileId?: number; error?: string }[] = [];

    for (const doc of documents) {
      try {
        console.log(`Processing document ${doc.id}: ${doc.original_name}`);

        // Analyze offer letter patterns
        const analysis = await analyzeOfferLetter(doc.extracted_text, doc.id);

        // Extract template structure
        const templateStructure = await extractTemplateStructure(doc.extracted_text, doc.id);

        // Extract ALL sections content for complete document preservation
        const allSectionsContent = await extractAllSectionsContent(doc.extracted_text);
        console.log(`Extracted ${allSectionsContent.length} sections from document ${doc.id}`);

        if (templateStructure) {
          const profileId = await createOrUpdateTemplateProfile(templateStructure, doc.id, doc.uploaded_by || userId, allSectionsContent);
          results.push({ id: doc.id, name: doc.original_name, success: true, profileId });
          console.log(`Template profile ${profileId} created for document ${doc.id}`);
        } else {
          results.push({ id: doc.id, name: doc.original_name, success: false, error: 'Failed to extract template structure' });
        }
      } catch (err: any) {
        console.error(`Error processing document ${doc.id}:`, err);
        results.push({ id: doc.id, name: doc.original_name, success: false, error: err.message });
      }
    }

    const successful = results.filter(r => r.success).length;
    res.json({
      message: `Processed ${documents.length} documents. ${successful} templates created/updated.`,
      results
    });
  } catch (error: any) {
    console.error('Error re-processing templates:', error);
    res.status(500).json({ error: 'Failed to re-process templates', details: error.message });
  }
});

// ============ RESUME ROUTES ============

// Upload and extract resume
router.post('/upload-resume', authenticateToken, uploadResume.single('resume'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({ error: 'AI service not configured. Set OPENAI_API_KEY environment variable.' });
      return;
    }

    const userId = req.user!.userId;
    const filePath = req.file.path;
    const filename = req.file.filename;
    const originalName = req.file.originalname;

    // Extract text from PDF
    const pdfBuffer = fs.readFileSync(filePath);
    const extractedText = await extractTextFromPDF(pdfBuffer);

    // Extract profile using GPT-4o
    const profile = await extractResumeProfile(extractedText);

    // Insert extraction record
    const result = db.prepare(`
      INSERT INTO resume_extractions (
        filename, original_name, file_path, extracted_text,
        candidate_name, candidate_email, candidate_phone, candidate_address,
        designation, skills, experience_years, experience_details,
        education, expected_salary, current_salary, notice_period,
        full_extraction, status, uploaded_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'extracted', ?)
    `).run(
      filename,
      originalName,
      filePath,
      extractedText,
      profile.candidate_name,
      profile.candidate_email,
      profile.candidate_phone,
      profile.candidate_address,
      profile.designation,
      profile.skills ? JSON.stringify(profile.skills) : null,
      profile.experience_years,
      profile.experience_details ? JSON.stringify(profile.experience_details) : null,
      profile.education ? JSON.stringify(profile.education) : null,
      profile.expected_salary,
      profile.current_salary,
      profile.notice_period,
      JSON.stringify(profile),
      userId
    );

    const extraction = db.prepare(`
      SELECT r.*, u.name as uploader_name, u.email as uploader_email
      FROM resume_extractions r
      JOIN users u ON r.uploaded_by = u.id
      WHERE r.id = ?
    `).get(result.lastInsertRowid) as ResumeExtractionWithUser;

    res.status(201).json({
      ...extraction,
      isActive: Boolean(extraction.isActive),
      skills: extraction.skills ? JSON.parse(extraction.skills) : [],
      experience_details: extraction.experience_details ? JSON.parse(extraction.experience_details) : [],
      education: extraction.education ? JSON.parse(extraction.education) : [],
      full_extraction: extraction.full_extraction ? JSON.parse(extraction.full_extraction) : null,
    });
  } catch (error: any) {
    console.error('Error processing resume:', error);
    res.status(500).json({ error: 'Failed to process resume', details: error.message });
  }
});

// Get all resume extractions
router.get('/resumes', authenticateToken, (_req: Request, res: Response): void => {
  try {
    const extractions = db.prepare(`
      SELECT r.*, u.name as uploader_name, u.email as uploader_email
      FROM resume_extractions r
      JOIN users u ON r.uploaded_by = u.id
      WHERE r.isActive = 1
      ORDER BY r.createdAt DESC
    `).all() as ResumeExtractionWithUser[];

    res.json(extractions.map(e => ({
      ...e,
      isActive: Boolean(e.isActive),
      skills: e.skills ? JSON.parse(e.skills) : [],
      experience_details: e.experience_details ? JSON.parse(e.experience_details) : [],
      education: e.education ? JSON.parse(e.education) : [],
    })));
  } catch (error) {
    console.error('Error fetching resumes:', error);
    res.status(500).json({ error: 'Failed to fetch resumes' });
  }
});

// Get single resume extraction
router.get('/resumes/:id', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const extraction = db.prepare(`
      SELECT r.*, u.name as uploader_name, u.email as uploader_email
      FROM resume_extractions r
      JOIN users u ON r.uploaded_by = u.id
      WHERE r.id = ? AND r.isActive = 1
    `).get(id) as ResumeExtractionWithUser | undefined;

    if (!extraction) {
      res.status(404).json({ error: 'Resume not found' });
      return;
    }

    res.json({
      ...extraction,
      isActive: Boolean(extraction.isActive),
      skills: extraction.skills ? JSON.parse(extraction.skills) : [],
      experience_details: extraction.experience_details ? JSON.parse(extraction.experience_details) : [],
      education: extraction.education ? JSON.parse(extraction.education) : [],
      full_extraction: extraction.full_extraction ? JSON.parse(extraction.full_extraction) : null,
    });
  } catch (error) {
    console.error('Error fetching resume:', error);
    res.status(500).json({ error: 'Failed to fetch resume' });
  }
});

// Delete resume extraction
router.delete('/resumes/:id', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const extraction = db.prepare('SELECT * FROM resume_extractions WHERE id = ?').get(id) as ResumeExtraction | undefined;
    if (!extraction) {
      res.status(404).json({ error: 'Resume not found' });
      return;
    }

    // Only allow deletion by uploader or admin
    if (extraction.uploaded_by !== userId && userRole !== 'admin') {
      res.status(403).json({ error: 'Not authorized to delete this resume' });
      return;
    }

    // Soft delete
    db.prepare(`UPDATE resume_extractions SET isActive = 0, updatedAt = datetime('now') WHERE id = ?`).run(id);

    res.json({ message: 'Resume deleted successfully' });
  } catch (error) {
    console.error('Error deleting resume:', error);
    res.status(500).json({ error: 'Failed to delete resume' });
  }
});

// ============ GENERATION ROUTES ============

// Generate offer letter from resume
router.post('/generate', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({ error: 'AI service not configured. Set OPENAI_API_KEY environment variable.' });
      return;
    }

    const config = req.body as RAGGenerateRequest;

    if (!config.resume_id) {
      res.status(400).json({ error: 'resume_id is required' });
      return;
    }

    // Get resume extraction
    const resume = db.prepare('SELECT * FROM resume_extractions WHERE id = ? AND isActive = 1').get(config.resume_id) as ResumeExtraction | undefined;
    if (!resume) {
      res.status(404).json({ error: 'Resume not found' });
      return;
    }

    // Check if there are any training documents
    const docCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM rag_documents
      WHERE isActive = 1 AND status = 'completed'
    `).get() as { count: number };

    if (docCount.count === 0) {
      res.status(400).json({
        error: 'No training documents available. Please upload some offer letter samples first.',
        suggestions: ['Upload at least 3-5 sample offer letters for best results']
      });
      return;
    }

    // Generate offer letter data
    const result = await generateOfferLetterData(resume, config);

    res.json(result);
  } catch (error: any) {
    console.error('Error generating offer letter:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate offer letter',
      details: error.message
    });
  }
});

// Generate offer letter from resume using a specific template
router.post('/generate-with-template', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({ error: 'AI service not configured. Set OPENAI_API_KEY environment variable.' });
      return;
    }

    const config = req.body as RAGGenerateRequest & { template_profile_id?: number };

    if (!config.resume_id) {
      res.status(400).json({ error: 'resume_id is required' });
      return;
    }

    // Get resume extraction
    const resume = db.prepare('SELECT * FROM resume_extractions WHERE id = ? AND isActive = 1').get(config.resume_id) as ResumeExtraction | undefined;
    if (!resume) {
      res.status(404).json({ error: 'Resume not found' });
      return;
    }

    // Find template profile
    const templateProfile = config.template_profile_id
      ? db.prepare('SELECT * FROM rag_template_profiles WHERE id = ?').get(config.template_profile_id) as TemplateProfile | undefined
      : findBestTemplateProfile(resume.designation || 'Default', resume.experience_years || 0);

    if (!templateProfile) {
      res.status(404).json({ error: 'No suitable offer letter template found. Please upload more samples.' });
      return;
    }

    // Generate offer letter data using the specific template
    const result = await generateOfferLetterWithTemplate(resume, templateProfile, config);

    res.json(result);
  } catch (error: any) {
    console.error('Error generating offer letter with template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate offer letter with template',
      details: error.message
    });
  }
});

// ============ ONE-CLICK GENERATION - Upload resume and get offer letter directly ============

// One-click: Upload resume and generate offer letter in one step
router.post('/quick-generate', authenticateToken, uploadResume.single('resume'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No resume file uploaded' });
      return;
    }

    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({ error: 'AI service not configured. Set OPENAI_API_KEY environment variable.' });
      return;
    }

    // Check if there are any training documents
    const docCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM rag_documents
      WHERE isActive = 1 AND status = 'completed'
    `).get() as { count: number };

    if (docCount.count === 0) {
      // Clean up uploaded file
      if (req.file.path) fs.unlinkSync(req.file.path);
      res.status(400).json({
        error: 'No training documents available. Please upload some offer letter samples first.',
        suggestions: ['Upload at least 3-5 sample offer letters for best results']
      });
      return;
    }

    const userId = req.user!.userId;
    const filePath = req.file.path;
    const filename = req.file.filename;
    const originalName = req.file.originalname;

    // Step 1: Extract text from PDF
    console.log('Quick-generate: Extracting text from resume...');
    const pdfBuffer = fs.readFileSync(filePath);
    const extractedText = await extractTextFromPDF(pdfBuffer);

    // Step 2: Extract profile using GPT-4o
    console.log('Quick-generate: Extracting candidate profile...');
    const profile = await extractResumeProfile(extractedText);

    // Step 3: Save resume extraction to database
    const result = db.prepare(`
      INSERT INTO resume_extractions (
        filename, original_name, file_path, extracted_text,
        candidate_name, candidate_email, candidate_phone, candidate_address,
        designation, skills, experience_years, experience_details,
        education, expected_salary, current_salary, notice_period,
        full_extraction, status, uploaded_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'extracted', ?)
    `).run(
      filename,
      originalName,
      filePath,
      extractedText,
      profile.candidate_name,
      profile.candidate_email,
      profile.candidate_phone,
      profile.candidate_address,
      profile.designation,
      profile.skills ? JSON.stringify(profile.skills) : null,
      profile.experience_years,
      profile.experience_details ? JSON.stringify(profile.experience_details) : null,
      profile.education ? JSON.stringify(profile.education) : null,
      profile.expected_salary,
      profile.current_salary,
      profile.notice_period,
      JSON.stringify(profile),
      userId
    );

    const resumeId = result.lastInsertRowid as number;

    // Step 4: Get learned company defaults
    const companyDefaults = getCompanyDefaults();

    // Step 5: Generate offer letter using learned patterns
    console.log('Quick-generate: Generating offer letter with learned patterns...');
    const resumeData: ResumeExtraction = {
      id: resumeId,
      filename,
      original_name: originalName,
      file_path: filePath,
      extracted_text: extractedText,
      candidate_name: profile.candidate_name,
      candidate_email: profile.candidate_email,
      candidate_phone: profile.candidate_phone,
      candidate_address: profile.candidate_address,
      designation: profile.designation,
      skills: profile.skills ? JSON.stringify(profile.skills) : null,
      experience_years: profile.experience_years,
      experience_details: profile.experience_details ? JSON.stringify(profile.experience_details) : null,
      education: profile.education ? JSON.stringify(profile.education) : null,
      expected_salary: profile.expected_salary,
      current_salary: profile.current_salary,
      notice_period: profile.notice_period,
      full_extraction: JSON.stringify(profile),
      offer_letter_id: null,
      status: 'extracted',
      uploaded_by: userId,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Use learned defaults for generation
    const generateConfig: RAGGenerateRequest = {
      resume_id: resumeId,
      template_type: 'long',
      hr_manager_name: companyDefaults.hr_manager_name || 'HR Manager',
      hr_manager_title: companyDefaults.hr_manager_title || 'Manager-Human Resource',
      working_location: companyDefaults.working_location || 'Office',
      offer_valid_days: 7,
    };

    const offerResult = await generateOfferLetterWithLearnedPatterns(resumeData, generateConfig, companyDefaults);

    res.json({
      success: true,
      resume: {
        id: resumeId,
        candidate_name: profile.candidate_name,
        designation: profile.designation,
        experience_years: profile.experience_years,
        skills: profile.skills,
      },
      offer_letter: offerResult,
      learned_defaults: companyDefaults,
    });
  } catch (error: any) {
    console.error('Error in quick-generate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate offer letter',
      details: error.message
    });
  }
});

/**
 * Generate offer letter using learned patterns from training documents
 */
async function generateOfferLetterWithLearnedPatterns(
  resumeData: ResumeExtraction,
  config: RAGGenerateRequest,
  companyDefaults: Record<string, string>
): Promise<RAGGenerateResponse> {
  // Get candidate info
  const candidateName = resumeData.candidate_name || 'Candidate Name';
  const candidateAddress = resumeData.candidate_address || 'Address not provided';
  const designation = resumeData.designation || 'Software Engineer';
  const skills = resumeData.skills ? JSON.parse(resumeData.skills).join(', ') : '';
  const experience = resumeData.experience_years || 0;
  const expectedSalary = resumeData.expected_salary || 0;
  const currentSalary = resumeData.current_salary || 0;

  // Find similar chunks from training data for context
  const query = `Offer letter for ${designation} with ${experience} years experience. Skills: ${skills}`;
  const similarChunks = await findSimilarChunks(query, 5);
  const ragContext = similarChunks.map(c => c.chunk).join('\n\n---\n\n');

  // Get salary benchmark
  const salaryBenchmark = findSalaryBenchmark(designation, experience);

  // Get learned clauses
  const learnedClauses = getLearnedClauses();

  // Get all learned patterns for comprehensive context
  const patterns = db.prepare(`
    SELECT full_analysis FROM rag_learned_patterns
    WHERE full_analysis IS NOT NULL
    ORDER BY createdAt DESC
    LIMIT 5
  `).all() as { full_analysis: string }[];

  const patternSummaries = patterns.map(p => {
    try {
      const analysis = JSON.parse(p.full_analysis);
      return `Company: ${analysis.company_name || 'Unknown'}, Designation: ${analysis.designation || 'Unknown'}, CTC: ${analysis.annual_ctc || 'Unknown'}`;
    } catch {
      return '';
    }
  }).filter(Boolean).join('\n');

  // Build comprehensive prompt
  const prompt = `Generate a complete offer letter data based on the following:

CANDIDATE INFORMATION:
- Name: ${candidateName}
- Address: ${candidateAddress}
- Designation Applied For: ${designation}
- Skills: ${skills}
- Experience: ${experience} years
- Expected Salary: ${expectedSalary > 0 ? `₹${expectedSalary.toLocaleString()}` : 'Not mentioned'}
- Current Salary: ${currentSalary > 0 ? `₹${currentSalary.toLocaleString()}` : 'Not mentioned'}

LEARNED COMPANY PATTERNS:
- Company Name: ${companyDefaults.company_name || 'Not learned yet'}
- Company Address: ${companyDefaults.company_address || 'Not learned yet'}
- HR Manager: ${companyDefaults.hr_manager_name || config.hr_manager_name || 'HR Manager'}
- HR Title: ${companyDefaults.hr_manager_title || config.hr_manager_title || 'Manager-Human Resource'}
- Working Location: ${companyDefaults.working_location || config.working_location || 'Office'}
- Probation Period: ${companyDefaults.probation_period || '6 months'}
- Notice Period: ${companyDefaults.notice_period || '1 month'}
- Benefits: ${companyDefaults.benefits || 'Standard benefits'}

SALARY BENCHMARK FOR SIMILAR ROLES:
${salaryBenchmark ? `
- Average CTC: ₹${salaryBenchmark.annual_ctc_avg?.toLocaleString() || 'Unknown'}
- Range: ₹${salaryBenchmark.annual_ctc_min?.toLocaleString() || '0'} - ₹${salaryBenchmark.annual_ctc_max?.toLocaleString() || '0'}
- Basic Percentage: ${salaryBenchmark.basic_percentage || 40}%
- HRA Percentage: ${salaryBenchmark.hra_percentage || 20}%
` : 'No benchmark available - use industry standards'}

REFERENCE FROM SIMILAR OFFER LETTERS:
${ragContext}

LEARNED PATTERNS SUMMARY:
${patternSummaries || 'No patterns learned yet'}

KEY CLAUSES TO INCLUDE:
${learnedClauses.length > 0 ? learnedClauses.join(', ') : 'Standard employment clauses'}

Generate offer letter data as JSON with the following structure:
{
  "candidate_name": "string",
  "candidate_address": "string",
  "designation": "string",
  "joining_date": "YYYY-MM-DD (suggest a date 15-30 days from now)",
  "annual_ctc": number (calculate based on experience, skills, and benchmarks),
  "salary_breakdown": [
    {"component": "Basic Salary", "perMonth": number, "annual": number},
    {"component": "HRA", "perMonth": number, "annual": number},
    {"component": "Special Allowance", "perMonth": number, "annual": number},
    {"component": "Other Allowances", "perMonth": number, "annual": number}
  ],
  "working_location": "string",
  "hr_manager_name": "string",
  "hr_manager_title": "string",
  "offer_valid_till": "YYYY-MM-DD (${config.offer_valid_days || 7} days from today)",
  "letter_date": "YYYY-MM-DD (today)",
  "template_type": "${config.template_type || 'long'}",
  "optional_sections": ["probation", "benefits", "leave_policy"],
  "kra_details": [{"responsibility": "Key responsibility based on designation"}, ...3-5 more],
  "joining_bonus": number or null
}

IMPORTANT RULES:
1. Use the salary benchmark as a guide, but adjust based on candidate's experience and expected salary
2. If expected salary is provided, try to match or exceed it slightly (within 10%)
3. Salary breakdown: Basic ~40-50% of CTC, HRA ~40-50% of Basic, rest as allowances
4. Annual CTC = sum of all salary components × 12
5. Generate 4-6 relevant KRAs based on the designation
6. Use learned patterns for company info when available`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert HR professional who creates offer letters. Use the learned patterns and benchmarks to generate accurate, professional offer letter data. Always return valid JSON.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      return { success: false, error: 'No response from AI' };
    }

    const offerData = JSON.parse(content) as CreateOfferLetterInput;

    // Add signatory IDs if provided
    if (config.signatory_id) {
      offerData.signatory_id = config.signatory_id;
    }
    if (config.secondary_signatory_id) {
      offerData.secondary_signatory_id = config.secondary_signatory_id;
    }

    // Calculate confidence scores
    const avgSimilarity = similarChunks.length > 0
      ? similarChunks.reduce((sum, c) => sum + c.similarity, 0) / similarChunks.length
      : 0;

    const hasBenchmark = salaryBenchmark && salaryBenchmark.id !== 0;
    const hasPatterns = patterns.length > 0;

    return {
      success: true,
      offer_letter_data: offerData,
      confidence_scores: {
        overall: Math.round((avgSimilarity * 50) + (hasBenchmark ? 25 : 0) + (hasPatterns ? 25 : 0)),
        name: resumeData.candidate_name ? 95 : 50,
        address: resumeData.candidate_address ? 90 : 40,
        designation: resumeData.designation ? 85 : 60,
        salary: (expectedSalary > 0 || currentSalary > 0 || hasBenchmark) ? 85 : 50,
      },
      suggestions: [
        ...(similarChunks.length < 3 ? ['Upload more sample offer letters for better accuracy'] : []),
        ...(!hasBenchmark ? ['No salary benchmark found for this role - using estimated values'] : []),
        ...(!hasPatterns ? ['Upload more training documents to learn company patterns'] : []),
      ],
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============ PROMPT-BASED GENERATION ============

// Prompt-based offer letter generation - HR describes offer in plain English
router.post('/prompt-generate', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({ error: 'AI service not configured. Set OPENAI_API_KEY environment variable.' });
      return;
    }

    const { resume_id, prompt, signatory_id, letterhead_id } = req.body;

    if (!resume_id) {
      res.status(400).json({ error: 'resume_id is required' });
      return;
    }

    if (!prompt) {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }

    // Get resume data
    const resume = db.prepare('SELECT * FROM resume_extractions WHERE id = ? AND isActive = 1').get(resume_id) as ResumeExtraction | undefined;
    if (!resume) {
      res.status(404).json({ error: 'Resume not found' });
      return;
    }

    // Get company defaults
    const companyDefaults = getCompanyDefaults();

    // Get signatory info if provided
    let signatoryInfo: any = null;
    if (signatory_id) {
      signatoryInfo = db.prepare('SELECT * FROM signatories WHERE id = ? AND isActive = 1').get(signatory_id);
    }

    // Get letterhead info if provided
    let letterheadInfo: any = null;
    if (letterhead_id) {
      letterheadInfo = db.prepare('SELECT * FROM letterheads WHERE id = ? AND isActive = 1').get(letterhead_id);
    }

    // Find salary benchmarks
    const benchmarks = db.prepare('SELECT * FROM rag_salary_benchmarks').all() as SalaryBenchmark[];
    const benchmarkSummary = benchmarks.map(b =>
      `${b.designation}: ₹${b.annual_ctc_min?.toLocaleString()}-${b.annual_ctc_max?.toLocaleString()} (avg: ₹${b.annual_ctc_avg?.toLocaleString()})`
    ).join('\n');

    // Get signatories list for AI to understand options
    const signatories = db.prepare('SELECT id, name, position FROM signatories WHERE isActive = 1').all();
    const signatoriesList = signatories.map((s: any) => `${s.name} (${s.position})`).join(', ');

    // Build AI prompt
    const aiPrompt = `You are an HR assistant generating offer letters. Based on the HR's instructions and candidate resume, generate complete offer letter data.

CANDIDATE RESUME DATA:
- Name: ${resume.candidate_name || 'Not found'}
- Email: ${resume.candidate_email || 'Not found'}
- Phone: ${resume.candidate_phone || 'Not found'}
- Address: ${resume.candidate_address || 'Not found'}
- Current/Target Designation: ${resume.designation || 'Not specified'}
- Experience: ${resume.experience_years || 0} years
- Skills: ${resume.skills ? JSON.parse(resume.skills).join(', ') : 'Not found'}
- Expected Salary: ${resume.expected_salary ? `₹${resume.expected_salary.toLocaleString()}` : 'Not mentioned'}
- Current Salary: ${resume.current_salary ? `₹${resume.current_salary.toLocaleString()}` : 'Not mentioned'}

COMPANY DEFAULTS (learned from previous offer letters):
- Company Name: ${companyDefaults.company_name || 'Phoneme Solutions Pvt Ltd'}
- Working Location: ${companyDefaults.working_location || 'Noida'}
- HR Manager: ${companyDefaults.hr_manager_name || 'HR Manager'}
- HR Title: ${companyDefaults.hr_manager_title || 'Manager-Human Resource'}
- Probation: ${companyDefaults.probation_period || '6 months'}
- Notice Period: ${companyDefaults.notice_period || '30 days'}

SALARY BENCHMARKS:
${benchmarkSummary || 'No benchmarks available'}

AVAILABLE SIGNATORIES (with their IDs and positions):
${signatories.map((s: any) => `- ID ${s.id}: ${s.name} (${s.position})`).join('\n') || 'None configured'}

HR'S INSTRUCTIONS:
"${prompt}"

Based on the HR's instructions, generate offer letter data. Parse the prompt carefully to understand:
1. Designation (if different from resume)
2. Salary/CTC (parse values like "6 LPA", "8 lakhs", "500000", etc.)
3. Joining date (parse dates like "15th Jan", "next Monday", "1st February 2024")
4. **IMPORTANT - Signatory**: If HR mentions any signatory by name OR position (like "Director", "CEO", "HR Manager"), extract EXACTLY what they said. Look for keywords like "signatory", "signed by", "authorized by", or just the position/name mentioned.
5. Working location if mentioned
6. Template type (short/long - default to 'long' for senior roles, 'short' for junior/trainee)

Return ONLY valid JSON in this exact format:
{
  "candidate_name": "${resume.candidate_name || 'Candidate Name'}",
  "candidate_address": "${resume.candidate_address || 'Address'}",
  "designation": "extracted or inferred designation",
  "joining_date": "YYYY-MM-DD format",
  "annual_ctc": numeric value (convert LPA to actual number, e.g., 6 LPA = 600000),
  "salary_breakdown": [
    {"component": "Basic Salary", "perMonth": number, "annual": number},
    {"component": "HRA", "perMonth": number, "annual": number},
    {"component": "Special Allowance", "perMonth": number, "annual": number},
    {"component": "Other Allowances", "perMonth": number, "annual": number}
  ],
  "working_location": "location",
  "hr_manager_name": "name",
  "hr_manager_title": "title",
  "offer_valid_till": "YYYY-MM-DD (7 days from today)",
  "letter_date": "${new Date().toISOString().split('T')[0]}",
  "template_type": "short" or "long",
  "signatory_mentioned": "EXACT name or position mentioned by HR (e.g., 'Director', 'Rajesh Kumar', 'CEO'). Extract from prompt if HR said things like 'signatory Director' or 'signed by CEO'. Return null only if no signatory mentioned.",
  "kra_details": [{"responsibility": "relevant KRA 1"}, {"responsibility": "relevant KRA 2"}, ...]
}

SALARY CALCULATION RULES:
- Basic Salary: 40-45% of CTC
- HRA: 40-50% of Basic
- Special Allowance: ~25% of CTC
- Other Allowances: remaining amount
- Monthly = Annual / 12
- Sum of all components × 12 should equal annual_ctc`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert HR assistant. Parse the HR prompt and generate accurate offer letter data. Always return valid JSON.' },
        { role: 'user', content: aiPrompt }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      res.status(500).json({ success: false, error: 'No response from AI' });
      return;
    }

    const offerData = JSON.parse(content);

    // If signatory was mentioned in prompt, try to find them by name or position
    if (offerData.signatory_mentioned && !signatory_id) {
      const searchTerm = offerData.signatory_mentioned.toLowerCase();
      console.log(`Searching for signatory: "${searchTerm}"`);

      // Search by name or position (case insensitive)
      const mentionedSignatory = db.prepare(`
        SELECT * FROM signatories
        WHERE isActive = 1 AND (LOWER(name) LIKE ? OR LOWER(position) LIKE ?)
        LIMIT 1
      `).get(`%${searchTerm}%`, `%${searchTerm}%`) as any;

      if (mentionedSignatory) {
        offerData.signatory_id = mentionedSignatory.id;
        signatoryInfo = mentionedSignatory; // Use the found signatory
        console.log(`Found signatory from prompt: ${mentionedSignatory.name} (${mentionedSignatory.position})`);
      } else {
        console.log(`Signatory not found for search term: "${searchTerm}"`);
      }
    } else if (signatory_id) {
      offerData.signatory_id = signatory_id;
      // signatoryInfo already loaded above at line 1406-1408
    }

    // If still no signatory found, use the first available active signatory as default
    // Director signature is MANDATORY for all offer letters
    if (!signatoryInfo) {
      const defaultSignatory = db.prepare('SELECT * FROM signatories WHERE isActive = 1 ORDER BY id LIMIT 1').get() as any;
      if (defaultSignatory) {
        signatoryInfo = defaultSignatory;
        offerData.signatory_id = defaultSignatory.id;
        console.log(`Using default signatory (MANDATORY): ${defaultSignatory.name} (${defaultSignatory.position})`);
      } else {
        // No signatories available - this is an error since signature is mandatory
        console.error('ERROR: No active signatories found. Director signature is mandatory!');
        res.status(400).json({
          success: false,
          error: 'No signatory available. Please add at least one signatory (Director) in the Signatories section before generating offer letters.'
        });
        return;
      }
    }

    // Get default letterhead if not provided
    if (!letterheadInfo) {
      letterheadInfo = db.prepare('SELECT * FROM letterheads WHERE is_default = 1 AND isActive = 1').get();
      if (letterheadInfo) {
        offerData.letterhead_id = letterheadInfo.id;
        console.log(`Using default letterhead: ${letterheadInfo.name}`);
      }
    }

    // Add letterhead_id if provided
    if (letterhead_id && !offerData.letterhead_id) {
      offerData.letterhead_id = letterhead_id;
    }

    // Generate letter content for PDF
    const letterContent = generateLetterContent(offerData, signatoryInfo, letterheadInfo);

    res.json({
      success: true,
      offer_letter_data: offerData,
      letter_content: letterContent,
      parsed_from_prompt: {
        designation: offerData.designation,
        salary: offerData.annual_ctc,
        joining_date: offerData.joining_date,
      },
    });
  } catch (error: any) {
    console.error('Error in prompt-generate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate offer letter',
      details: error.message
    });
  }
});

/**
 * Generate letter content object for PDF rendering
 * STRICT MODE: Uses ONLY exact wording from uploaded HR documents
 * NO AI-generated content, NO paraphrasing, NO new sentences
 * Only replaces variable placeholders (name, date, salary, etc.)
 */
function generateLetterContent(offerData: any, signatoryInfo: any, letterheadInfo: any, templateProfile?: TemplateProfile | null) {
  // STRICT: Get clauses ONLY from uploaded template profiles - no fallbacks
  let effectiveProfile = templateProfile;

  // If no template profile provided, find the best matching one from uploaded documents
  if (!effectiveProfile) {
    effectiveProfile = db.prepare(`
      SELECT * FROM rag_template_profiles
      WHERE isActive = 1
      ORDER BY is_default DESC, usage_count DESC
      LIMIT 1
    `).get() as TemplateProfile | undefined || null;
  }

  // Extract EXACT clauses from uploaded documents only
  const documentClauses = {
    probation: effectiveProfile?.probation_clause || null,
    notice_period: effectiveProfile?.notice_period_clause || null,
    confidentiality: effectiveProfile?.confidentiality_clause || null,
    termination: effectiveProfile?.termination_clause || null,
    general_terms: effectiveProfile?.general_terms_clause || null,
    working_hours: effectiveProfile?.working_hours_clause || null,
    leave_policy: effectiveProfile?.leave_policy_clause || null,
    benefits: effectiveProfile?.benefits_section || null,
    opening_paragraph: effectiveProfile?.opening_paragraph || null,
    closing_format: effectiveProfile?.closing_format || null,
  };

  // Also try to get additional clauses from learned patterns (extracted from uploaded docs)
  const learnedPatterns = db.prepare(`
    SELECT clauses, full_analysis FROM rag_learned_patterns
    WHERE clauses IS NOT NULL
    ORDER BY createdAt DESC
    LIMIT 1
  `).get() as { clauses: string; full_analysis: string } | undefined;

  if (learnedPatterns?.clauses) {
    try {
      const parsed = JSON.parse(learnedPatterns.clauses);
      // Only use if not already set from template profile (uploaded docs take priority)
      if (!documentClauses.probation && parsed.probation) documentClauses.probation = parsed.probation;
      if (!documentClauses.notice_period && parsed.notice_period) documentClauses.notice_period = parsed.notice_period;
      if (!documentClauses.confidentiality && parsed.confidentiality) documentClauses.confidentiality = parsed.confidentiality;
      if (!documentClauses.termination && parsed.termination) documentClauses.termination = parsed.termination;
      if (!documentClauses.leave_policy && parsed.leave_policy) documentClauses.leave_policy = parsed.leave_policy;
      if (!documentClauses.working_hours && parsed.working_hours) documentClauses.working_hours = parsed.working_hours;
      if (!documentClauses.general_terms && parsed.general_terms) documentClauses.general_terms = parsed.general_terms;
    } catch (e) {
      console.log('Failed to parse learned clauses:', e);
    }
  }

  // Alias for backward compatibility
  const learnedClauses = documentClauses;
  const formatCurrency = (amount: number) => amount.toLocaleString('en-IN');

  const numberToWords = (num: number): string => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

    if (num === 0) return 'Zero';
    let words = '';

    if (num >= 10000000) {
      words += numberToWords(Math.floor(num / 10000000)) + ' Crore ';
      num %= 10000000;
    }
    if (num >= 100000) {
      words += numberToWords(Math.floor(num / 100000)) + ' Lakh ';
      num %= 100000;
    }
    if (num >= 1000) {
      words += numberToWords(Math.floor(num / 1000)) + ' Thousand ';
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = date.getDate();
    const suffix = day === 1 || day === 21 || day === 31 ? 'st' :
                   day === 2 || day === 22 ? 'nd' :
                   day === 3 || day === 23 ? 'rd' : 'th';
    return `${months[date.getMonth()]} ${day}${suffix}, ${date.getFullYear()}`;
  };

  const ctcInWords = numberToWords(offerData.annual_ctc);

  // Get signatory images as base64 if available
  const getImageAsBase64 = (filename: string | null, folder: string): string | null => {
    if (!filename) return null;
    try {
      const filePath = path.join(process.cwd(), 'uploads', folder, filename);
      if (!fs.existsSync(filePath)) return null;
      const fileBuffer = fs.readFileSync(filePath);
      const ext = path.extname(filename).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
      return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
    } catch {
      return null;
    }
  };

  // Determine header based on template type
  const headerTitle = offerData.template_type === 'short'
    ? 'OFFER LETTER'
    : 'OFFER CUM APPOINTMENT LETTER';

  // Get secondary signatory (Director) if available
  let secondarySignatoryInfo = null;
  if (offerData.secondary_signatory_id) {
    secondarySignatoryInfo = db.prepare('SELECT * FROM signatories WHERE id = ? AND isActive = 1').get(offerData.secondary_signatory_id);
  }
  // If no secondary signatory specified, try to get Director
  if (!secondarySignatoryInfo) {
    secondarySignatoryInfo = db.prepare(`
      SELECT * FROM signatories
      WHERE isActive = 1 AND LOWER(position) LIKE '%director%'
      ORDER BY id
      LIMIT 1
    `).get();
  }

  return {
    templateType: offerData.template_type || 'short',
    optionalSections: [],
    joiningBonus: offerData.joining_bonus || null,
    header: headerTitle,
    date: formatDate(offerData.letter_date),
    to: offerData.candidate_name,
    address: offerData.candidate_address,
    subject: `Offer for the post of ${offerData.designation}`,
    signatory: signatoryInfo ? {
      name: signatoryInfo.name,
      position: signatoryInfo.position,
      signature: getImageAsBase64(signatoryInfo.signature_image, 'signatures'),
      stamp: getImageAsBase64(signatoryInfo.stamp_image, 'stamps')
    } : null,
    secondarySignatory: secondarySignatoryInfo ? {
      name: (secondarySignatoryInfo as any).name,
      position: (secondarySignatoryInfo as any).position,
      signature: getImageAsBase64((secondarySignatoryInfo as any).signature_image, 'signatures'),
      stamp: getImageAsBase64((secondarySignatoryInfo as any).stamp_image, 'stamps')
    } : null,
    letterhead: letterheadInfo ? {
      header_image_base64: getImageAsBase64(letterheadInfo.header_image, 'letterheads'),
      footer_image_base64: getImageAsBase64(letterheadInfo.footer_image, 'letterheads'),
      logo_image_base64: getImageAsBase64(letterheadInfo.logo_image, 'letterheads'),
      company_name: letterheadInfo.company_name,
      company_address: letterheadInfo.company_address,
      company_email: letterheadInfo.company_email,
      company_website: letterheadInfo.company_website,
      company_cin: letterheadInfo.company_cin,
      company_gstin: letterheadInfo.company_gstin,
    } : null,
    body: {
      // Variable fields - ONLY these get replaced with candidate-specific data
      joiningDate: formatDate(offerData.joining_date),
      ctcFormatted: formatCurrency(offerData.annual_ctc),
      ctcInWords: ctcInWords,
      workingLocation: offerData.working_location || 'Phoneme Solutions Pvt Ltd, Advant Navis Business Park, B-614 Sector 142, Noida-201307',
      offerValidDate: formatDate(offerData.offer_valid_till),
      joiningLocation: offerData.working_location || 'Phoneme Solutions Pvt Ltd, Advant Navis Business Park, B-614 Sector 142, Noida-201307',
      reportingManager: offerData.reporting_manager || null,
      reportingLocation: offerData.reporting_location || null,

      // STRICT MODE: Use ONLY exact text from uploaded HR documents
      // Variable placeholders in document text are replaced: {{candidate_name}}, {{designation}}, {{joining_date}}, {{ctc}}, {{offer_valid_date}}
      greeting: `Dear ${offerData.candidate_name.split(' ')[0]},`,
      congratulations: 'Congratulations!',

      // Opening paragraph - use EXACT text from uploaded document with variable replacement
      opening: documentClauses.opening_paragraph
        ? documentClauses.opening_paragraph
            .replace(/\{\{designation\}\}/gi, offerData.designation)
            .replace(/\{\{candidate_name\}\}/gi, offerData.candidate_name)
        : `On behalf of Phoneme Solutions Pvt. Ltd. Based on your applications, interviews & discussions we have had, we are pleased to offer you the position of ${offerData.designation}. Your employment with us shall be governed by the following terms and conditions.`,

      // These fields use EXACT text from uploaded documents - NO AI-generated fallbacks
      workingHours: learnedClauses.working_hours || null,
      probation: learnedClauses.probation || null,
      leave: learnedClauses.leave_policy || null,
      notice: learnedClauses.notice_period || null,

      // General terms - EXACT from uploaded documents
      general: learnedClauses.general_terms ? {
        title: 'General:',
        points: Array.isArray(learnedClauses.general_terms) ? learnedClauses.general_terms : [learnedClauses.general_terms]
      } : null,

      // Confidentiality - EXACT from uploaded documents
      confidentiality: learnedClauses.confidentiality ? {
        title: 'Confidentiality:',
        text: learnedClauses.confidentiality
      } : null,

      // Termination - EXACT from uploaded documents
      termination: learnedClauses.termination ? {
        title: 'Termination:',
        text: learnedClauses.termination
      } : null,

      // Acceptance and closing - variable replacement only
      acceptance: `Please accept this offer by signing and returning the acceptance copy on or before ${formatDate(offerData.offer_valid_till)}, failing which this offer stands cancelled.`,
      closing: documentClauses.closing_format || 'We welcome you to the Phoneme Solutions family and wish you a successful career with us.'
    },
    signature: {
      regards: 'Regards,',
      company: 'For Phoneme Solutions Private Limited.',
      name: offerData.hr_manager_name,
      title: offerData.hr_manager_title
    },
    annexure: {
      title: 'Annexure A',
      subtitle: 'Salary Break Up',
      table: offerData.salary_breakdown,
      total: {
        perMonth: offerData.salary_breakdown.reduce((sum: number, item: any) => sum + item.perMonth, 0),
        annual: offerData.salary_breakdown.reduce((sum: number, item: any) => sum + item.annual, 0)
      }
    },
    annexureB: offerData.kra_details?.length > 0 ? {
      title: 'Annexure B',
      subtitle: 'Key Responsibility Areas (KRA)',
      responsibilities: offerData.kra_details
    } : null
  };
}

// Get learned patterns and company defaults
router.get('/learned-patterns', authenticateToken, requireAdmin, (_req: Request, res: Response): void => {
  try {
    const patterns = db.prepare(`
      SELECT lp.*, rd.original_name as document_name
      FROM rag_learned_patterns lp
      JOIN rag_documents rd ON lp.document_id = rd.id
      ORDER BY lp.createdAt DESC
    `).all() as (LearnedPattern & { document_name: string })[];

    const companyDefaults = getCompanyDefaults();

    const salaryBenchmarks = db.prepare(`
      SELECT * FROM rag_salary_benchmarks
      ORDER BY designation
    `).all() as SalaryBenchmark[];

    res.json({
      patterns: patterns.map(p => ({
        ...p,
        benefits: p.benefits ? JSON.parse(p.benefits) : null,
        salary_structure: p.salary_structure ? JSON.parse(p.salary_structure) : null,
        clauses: p.clauses ? JSON.parse(p.clauses) : null,
        full_analysis: p.full_analysis ? JSON.parse(p.full_analysis) : null,
      })),
      companyDefaults,
      salaryBenchmarks,
    });
  } catch (error) {
    console.error('Error fetching learned patterns:', error);
    res.status(500).json({ error: 'Failed to fetch learned patterns' });
  }
});

// Get RAG system stats (enhanced)
router.get('/stats', authenticateToken, requireAdmin, (_req: Request, res: Response): void => {
  try {
    const docStats = db.prepare(`
      SELECT
        COUNT(*) as total_documents,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_documents,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_documents,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_documents,
        SUM(chunk_count) as total_chunks
      FROM rag_documents
      WHERE isActive = 1
    `).get() as any;

    const resumeStats = db.prepare(`
      SELECT
        COUNT(*) as total_resumes,
        SUM(CASE WHEN offer_letter_id IS NOT NULL THEN 1 ELSE 0 END) as converted_to_offers
      FROM resume_extractions
      WHERE isActive = 1
    `).get() as any;

    const patternStats = db.prepare(`
      SELECT COUNT(*) as total_patterns
      FROM rag_learned_patterns
    `).get() as any;

    const benchmarkStats = db.prepare(`
      SELECT COUNT(*) as total_benchmarks
      FROM rag_salary_benchmarks
    `).get() as any;

    const defaultsCount = db.prepare(`
      SELECT COUNT(*) as total_defaults
      FROM rag_company_defaults
    `).get() as any;

    res.json({
      training: {
        total: docStats.total_documents,
        completed: docStats.completed_documents,
        processing: docStats.processing_documents,
        failed: docStats.failed_documents,
        totalChunks: docStats.total_chunks || 0,
      },
      resumes: {
        total: resumeStats.total_resumes,
        convertedToOffers: resumeStats.converted_to_offers,
      },
      learning: {
        patternsLearned: patternStats.total_patterns,
        salaryBenchmarks: benchmarkStats.total_benchmarks,
        companyDefaults: defaultsCount.total_defaults,
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ============ EXTRACT OFFER LETTER DETAILS ============

// Extract details from an existing offer letter PDF
router.post('/extract-offer-letter', authenticateToken, uploadTraining.single('document'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({ error: 'AI service not configured. Set OPENAI_API_KEY environment variable.' });
      return;
    }

    const filePath = req.file.path;

    // Extract text from PDF
    const pdfBuffer = fs.readFileSync(filePath);
    const extractedText = await extractTextFromPDF(pdfBuffer);

    // Use GPT-4o to extract structured data from offer letter
    const prompt = `Extract the following details from this offer letter. Return ONLY a valid JSON object.

Offer Letter Text:
${extractedText}

Extract and return this JSON structure:
{
  "candidate_name": "Full name of the candidate",
  "candidate_address": "Full address of the candidate (if not found, return empty string)",
  "designation": "Job title/designation offered",
  "joining_date": "YYYY-MM-DD format joining date",
  "annual_ctc": numeric value of annual CTC (e.g., 144000 for 1.44 LPA),
  "salary_breakdown": [
    {"component": "Basic", "perMonth": number, "annual": number},
    {"component": "HRA", "perMonth": number, "annual": number},
    {"component": "Travel Allowance", "perMonth": number, "annual": number},
    {"component": "Mobile Reimbursement", "perMonth": number, "annual": number},
    {"component": "Special Allowance", "perMonth": number, "annual": number}
  ],
  "working_location": "Office location/address",
  "hr_manager_name": "Name of HR manager/signatory",
  "hr_manager_title": "Title of HR manager",
  "offer_valid_till": "YYYY-MM-DD format offer validity date",
  "letter_date": "YYYY-MM-DD format letter date",
  "template_type": "short" for trainee/junior or "long" for regular positions
}

IMPORTANT:
1. Parse any salary/CTC values mentioned (like "1,44,000" or "1.44 LPA" or "144000")
2. If salary breakdown is in a table, extract each component
3. Parse Indian date formats (like "02 Sep 2024") to YYYY-MM-DD format
4. If address is not found, return an empty string - DO NOT make up an address
5. Calculate perMonth as annual/12 if only annual is given
6. Detect template_type based on designation (Trainee/Junior = short, others = long)`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert at extracting structured data from offer letters. Always return valid JSON. Be precise with salary calculations.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      res.status(500).json({ error: 'No response from AI' });
      return;
    }

    const extractedData = JSON.parse(content);

    // Clean up the uploaded file (optional - remove if you want to keep it)
    // fs.unlinkSync(filePath);

    res.json({
      success: true,
      ...extractedData,
      extracted_text_preview: extractedText.substring(0, 500) + '...',
    });
  } catch (error: any) {
    console.error('Error extracting offer letter:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to extract offer letter details',
      details: error.message
    });
  }
});

// ============ DIAGNOSTIC AND FIX ENDPOINTS ============

// Set a template profile as default
router.post('/set-default-template/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Reset all to non-default
    db.prepare(`UPDATE rag_template_profiles SET is_default = 0`).run();

    // Set the specified one as default
    db.prepare(`UPDATE rag_template_profiles SET is_default = 1 WHERE id = ?`).run(id);

    const profile = db.prepare(`SELECT id, profile_name, is_default, all_sections_content FROM rag_template_profiles WHERE id = ?`).get(id) as any;

    res.json({
      success: true,
      message: `Template profile ${id} set as default`,
      profile: {
        id: profile?.id,
        name: profile?.profile_name,
        is_default: profile?.is_default,
        has_sections: !!profile?.all_sections_content,
        sections_count: profile?.all_sections_content ? JSON.parse(profile.all_sections_content).length : 0
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reprocess stuck documents
router.post('/reprocess-stuck-documents', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('=== Reprocessing Stuck Documents ===');

    // Find documents stuck in processing
    const stuckDocs = db.prepare(`
      SELECT id, original_name, file_path
      FROM rag_documents
      WHERE status = 'processing' AND isActive = 1
    `).all() as { id: number; original_name: string; file_path: string }[];

    console.log(`Found ${stuckDocs.length} stuck documents`);

    if (stuckDocs.length === 0) {
      res.json({ success: true, message: 'No stuck documents found', processed: 0 });
      return;
    }

    const results: { id: number; name: string; success: boolean; error?: string; text_length?: number }[] = [];

    for (const doc of stuckDocs) {
      try {
        console.log(`Reprocessing document ${doc.id}: ${doc.original_name}`);

        const filePath = path.join(process.cwd(), doc.file_path);

        if (!fs.existsSync(filePath)) {
          results.push({ id: doc.id, name: doc.original_name, success: false, error: 'File not found' });
          db.prepare(`UPDATE rag_documents SET status = 'failed', error_message = 'File not found' WHERE id = ?`).run(doc.id);
          continue;
        }

        // Extract text from PDF
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        const extractedText = pdfData.text;

        console.log(`Extracted ${extractedText.length} characters from ${doc.original_name}`);

        if (extractedText.length < 10) {
          results.push({ id: doc.id, name: doc.original_name, success: false, error: 'No text extracted (might be image-based PDF)' });
          db.prepare(`UPDATE rag_documents SET status = 'failed', error_message = 'No text could be extracted' WHERE id = ?`).run(doc.id);
          continue;
        }

        // Update document with extracted text
        db.prepare(`
          UPDATE rag_documents
          SET status = 'completed', extracted_text = ?, updatedAt = datetime('now')
          WHERE id = ?
        `).run(extractedText, doc.id);

        results.push({ id: doc.id, name: doc.original_name, success: true, text_length: extractedText.length });
        console.log(`Successfully processed ${doc.original_name}`);

      } catch (err: any) {
        console.error(`Error processing ${doc.original_name}:`, err);
        results.push({ id: doc.id, name: doc.original_name, success: false, error: err.message });
        db.prepare(`UPDATE rag_documents SET status = 'failed', error_message = ? WHERE id = ?`).run(err.message, doc.id);
      }
    }

    const successful = results.filter(r => r.success).length;
    res.json({
      success: true,
      message: `Processed ${stuckDocs.length} documents. ${successful} successful.`,
      results
    });

  } catch (error: any) {
    console.error('Error reprocessing stuck documents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Diagnose and fix template profile issues
router.post('/fix-template-profiles', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('=== Starting Template Profile Fix ===');

    const { document_id } = req.body || {};

    // Step 1: Check existing documents
    const documents = db.prepare(`
      SELECT id, original_name, extracted_text, status, LENGTH(extracted_text) as text_length
      FROM rag_documents
      WHERE isActive = 1 AND status = 'completed' AND extracted_text IS NOT NULL
      ORDER BY LENGTH(extracted_text) DESC
    `).all() as { id: number; original_name: string; extracted_text: string; status: string; text_length: number }[];

    console.log(`Found ${documents.length} completed documents`);

    if (documents.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No completed documents found. Please upload an HR document first.',
        diagnosis: {
          documents_count: 0,
          template_profiles_count: 0
        }
      });
      return;
    }

    // Step 2: Check existing template profiles
    const existingProfiles = db.prepare(`
      SELECT id, profile_name, is_default, all_sections_content
      FROM rag_template_profiles
      WHERE isActive = 1
    `).all() as { id: number; profile_name: string; is_default: number; all_sections_content: string | null }[];

    console.log(`Found ${existingProfiles.length} template profiles`);

    // Step 3: Select document - use specified document_id or the one with longest text (most likely offer letter)
    let doc = documents[0]; // Default to longest text

    if (document_id) {
      const specified = documents.find(d => d.id === parseInt(document_id));
      if (specified) {
        doc = specified;
      }
    } else {
      // Skip letterhead files, prefer offer letter documents
      const offerLetterDoc = documents.find(d =>
        !d.original_name.toLowerCase().includes('letterhead') &&
        d.text_length > 1000
      );
      if (offerLetterDoc) {
        doc = offerLetterDoc;
      }
    }

    console.log(`Selected document: ${doc.original_name} (ID: ${doc.id}, text length: ${doc.extracted_text.length})`);
    console.log('Available documents:', documents.map(d => `${d.id}: ${d.original_name} (${d.text_length} chars)`));

    const allSections = await extractAllSectionsContent(doc.extracted_text);
    console.log(`Extracted ${allSections.length} sections`);
    console.log('Section titles:', allSections.map(s => s.section_title));

    if (allSections.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Failed to extract sections from document. Try specifying a different document_id.',
        diagnosis: {
          documents_count: documents.length,
          template_profiles_count: existingProfiles.length,
          document_used: doc.original_name,
          document_id_used: doc.id,
          extracted_sections: 0,
          available_documents: documents.map(d => ({
            id: d.id,
            name: d.original_name,
            text_length: d.text_length
          }))
        },
        hint: 'Use: fetch("/api/rag/fix-template-profiles", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({document_id: YOUR_ID}), credentials:"include"}).then(r=>r.json()).then(console.log)'
      });
      return;
    }

    // Step 4: Create or update template profile
    let profileId: number;

    if (existingProfiles.length > 0) {
      // Update the first profile and make it default
      profileId = existingProfiles[0].id;
      db.prepare(`
        UPDATE rag_template_profiles
        SET all_sections_content = ?,
            is_default = 1,
            updatedAt = datetime('now')
        WHERE id = ?
      `).run(JSON.stringify(allSections), profileId);

      // Make sure only this one is default
      db.prepare(`
        UPDATE rag_template_profiles
        SET is_default = 0
        WHERE id != ?
      `).run(profileId);

      console.log(`Updated existing template profile ${profileId} with ${allSections.length} sections`);
    } else {
      // Create new default template profile
      const result = db.prepare(`
        INSERT INTO rag_template_profiles (
          profile_name, profile_description, source_document_ids,
          is_default, all_sections_content, created_by
        ) VALUES (?, ?, ?, 1, ?, ?)
      `).run(
        'Default Offer Letter Template',
        `Auto-generated from ${doc.original_name}`,
        JSON.stringify([doc.id]),
        JSON.stringify(allSections),
        (req as any).user?.id || 1
      );
      profileId = result.lastInsertRowid as number;
      console.log(`Created new default template profile ${profileId}`);
    }

    // Verify the fix
    const updatedProfile = db.prepare(`
      SELECT id, profile_name, is_default, all_sections_content
      FROM rag_template_profiles
      WHERE id = ?
    `).get(profileId) as any;

    const sectionsCount = updatedProfile.all_sections_content
      ? JSON.parse(updatedProfile.all_sections_content).length
      : 0;

    res.json({
      success: true,
      message: `Successfully extracted ${allSections.length} sections and updated template profile`,
      diagnosis: {
        documents_count: documents.length,
        document_used: doc.original_name,
        document_text_length: doc.extracted_text.length,
        template_profile_id: profileId,
        template_profile_name: updatedProfile.profile_name,
        is_default: updatedProfile.is_default === 1,
        sections_count: sectionsCount,
        section_titles: allSections.map(s => s.section_title)
      }
    });

  } catch (error: any) {
    console.error('Error fixing template profiles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fix template profiles',
      details: error.message
    });
  }
});

// ============ TEMPLATE PROFILE ROUTES ============

// Get all template profiles
router.get('/template-profiles', authenticateToken, (_req: Request, res: Response): void => {
  try {
    const profiles = db.prepare(`
      SELECT tp.*,
        (SELECT COUNT(*) FROM rag_document_templates WHERE template_profile_id = tp.id) as document_count
      FROM rag_template_profiles tp
      WHERE tp.isActive = 1
      ORDER BY tp.usage_count DESC, tp.is_default DESC
    `).all() as (TemplateProfile & { document_count: number })[];

    res.json(profiles.map(p => ({
      ...p,
      source_document_ids: p.source_document_ids ? JSON.parse(p.source_document_ids) : [],
      sections_order: p.sections_order ? JSON.parse(p.sections_order) : [],
      language_patterns: p.language_patterns ? JSON.parse(p.language_patterns) : null,
      common_phrases: p.common_phrases ? JSON.parse(p.common_phrases) : [],
      annexure_types: p.annexure_types ? JSON.parse(p.annexure_types) : [],
      full_structure: p.full_structure ? JSON.parse(p.full_structure) : null,
      designation_types: p.designation_types ? JSON.parse(p.designation_types) : [],
      experience_levels: p.experience_levels ? JSON.parse(p.experience_levels) : [],
      has_salary_table: Boolean(p.has_salary_table),
      has_kra_section: Boolean(p.has_kra_section),
      has_annexures: Boolean(p.has_annexures),
      is_default: Boolean(p.is_default),
      isActive: Boolean(p.isActive),
    })));
  } catch (error) {
    console.error('Error fetching template profiles:', error);
    res.status(500).json({ error: 'Failed to fetch template profiles' });
  }
});

// Get single template profile with linked documents
router.get('/template-profiles/:id', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const profile = db.prepare(`
      SELECT * FROM rag_template_profiles WHERE id = ? AND isActive = 1
    `).get(id) as TemplateProfile | undefined;

    if (!profile) {
      res.status(404).json({ error: 'Template profile not found' });
      return;
    }

    // Get linked documents
    const linkedDocs = db.prepare(`
      SELECT d.id, d.original_name, dt.match_confidence
      FROM rag_document_templates dt
      JOIN rag_documents d ON dt.document_id = d.id
      WHERE dt.template_profile_id = ?
    `).all(id) as { id: number; original_name: string; match_confidence: number }[];

    res.json({
      ...profile,
      source_document_ids: profile.source_document_ids ? JSON.parse(profile.source_document_ids) : [],
      sections_order: profile.sections_order ? JSON.parse(profile.sections_order) : [],
      language_patterns: profile.language_patterns ? JSON.parse(profile.language_patterns) : null,
      common_phrases: profile.common_phrases ? JSON.parse(profile.common_phrases) : [],
      annexure_types: profile.annexure_types ? JSON.parse(profile.annexure_types) : [],
      full_structure: profile.full_structure ? JSON.parse(profile.full_structure) : null,
      designation_types: profile.designation_types ? JSON.parse(profile.designation_types) : [],
      experience_levels: profile.experience_levels ? JSON.parse(profile.experience_levels) : [],
      has_salary_table: Boolean(profile.has_salary_table),
      has_kra_section: Boolean(profile.has_kra_section),
      has_annexures: Boolean(profile.has_annexures),
      is_default: Boolean(profile.is_default),
      isActive: Boolean(profile.isActive),
      linked_documents: linkedDocs,
    });
  } catch (error) {
    console.error('Error fetching template profile:', error);
    res.status(500).json({ error: 'Failed to fetch template profile' });
  }
});

// Set default template profile
router.put('/template-profiles/:id/set-default', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    // Remove default from all profiles
    db.prepare(`UPDATE rag_template_profiles SET is_default = 0`).run();

    // Set this profile as default
    db.prepare(`UPDATE rag_template_profiles SET is_default = 1 WHERE id = ?`).run(id);

    res.json({ message: 'Default template profile updated' });
  } catch (error) {
    console.error('Error setting default template:', error);
    res.status(500).json({ error: 'Failed to set default template' });
  }
});

// Delete template profile
router.delete('/template-profiles/:id', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    // Soft delete
    db.prepare(`UPDATE rag_template_profiles SET isActive = 0, updatedAt = datetime('now') WHERE id = ?`).run(id);

    // Remove document links
    db.prepare(`DELETE FROM rag_document_templates WHERE template_profile_id = ?`).run(id);

    res.json({ message: 'Template profile deleted successfully' });
  } catch (error) {
    console.error('Error deleting template profile:', error);
    res.status(500).json({ error: 'Failed to delete template profile' });
  }
});

// Re-extract all sections from a document and update the template profile
router.post('/re-extract-sections/:documentId', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { documentId } = req.params;

    // Get the document
    const document = db.prepare(`
      SELECT * FROM rag_documents WHERE id = ? AND isActive = 1 AND status = 'completed'
    `).get(documentId) as RAGDocument | undefined;

    if (!document) {
      res.status(404).json({ error: 'Document not found or not processed yet' });
      return;
    }

    if (!document.extracted_text) {
      res.status(400).json({ error: 'Document has no extracted text' });
      return;
    }

    console.log(`Re-extracting sections from document ${documentId}: ${document.original_name}`);
    console.log(`Document text length: ${document.extracted_text.length} characters`);

    // Extract ALL sections from the document
    const allSections = await extractAllSectionsContent(document.extracted_text);
    console.log(`Extracted ${allSections.length} sections from document`);

    if (allSections.length === 0) {
      res.status(400).json({ error: 'No sections could be extracted from document' });
      return;
    }

    // Find the template profile linked to this document
    const templateLink = db.prepare(`
      SELECT template_profile_id FROM rag_document_templates WHERE document_id = ?
    `).get(documentId) as { template_profile_id: number } | undefined;

    if (templateLink) {
      // Update the existing template profile
      db.prepare(`
        UPDATE rag_template_profiles
        SET all_sections_content = ?, updatedAt = datetime('now')
        WHERE id = ?
      `).run(JSON.stringify(allSections), templateLink.template_profile_id);

      console.log(`Updated template profile ${templateLink.template_profile_id} with ${allSections.length} sections`);

      res.json({
        success: true,
        message: `Successfully extracted ${allSections.length} sections and updated template profile`,
        template_profile_id: templateLink.template_profile_id,
        sections_count: allSections.length,
        section_titles: allSections.map(s => s.section_title)
      });
    } else {
      // No template profile linked, create one or update default
      const defaultProfile = db.prepare(`
        SELECT * FROM rag_template_profiles WHERE is_default = 1 AND isActive = 1
      `).get() as TemplateProfile | undefined;

      if (defaultProfile) {
        db.prepare(`
          UPDATE rag_template_profiles
          SET all_sections_content = ?, updatedAt = datetime('now')
          WHERE id = ?
        `).run(JSON.stringify(allSections), defaultProfile.id);

        console.log(`Updated default template profile ${defaultProfile.id} with ${allSections.length} sections`);

        res.json({
          success: true,
          message: `Successfully extracted ${allSections.length} sections and updated default template profile`,
          template_profile_id: defaultProfile.id,
          sections_count: allSections.length,
          section_titles: allSections.map(s => s.section_title)
        });
      } else {
        res.status(400).json({ error: 'No template profile found for this document' });
      }
    }
  } catch (error: any) {
    console.error('Error re-extracting sections:', error);
    res.status(500).json({ error: 'Failed to re-extract sections', details: error.message });
  }
});

// ============ TEMPLATE-BASED GENERATION ============

// Generate offer letter using specific template profile
router.post('/generate-with-template', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({ error: 'AI service not configured. Set OPENAI_API_KEY environment variable.' });
      return;
    }

    const { resume_id, template_profile_id, ...config } = req.body as RAGGenerateRequest & { template_profile_id?: number };

    if (!resume_id) {
      res.status(400).json({ error: 'resume_id is required' });
      return;
    }

    // Get resume extraction
    const resume = db.prepare('SELECT * FROM resume_extractions WHERE id = ? AND isActive = 1').get(resume_id) as ResumeExtraction | undefined;
    if (!resume) {
      res.status(404).json({ error: 'Resume not found' });
      return;
    }

    // Get template profile
    let templateProfile: TemplateProfile | null = null;

    if (template_profile_id) {
      templateProfile = db.prepare('SELECT * FROM rag_template_profiles WHERE id = ? AND isActive = 1').get(template_profile_id) as TemplateProfile | undefined || null;
    }

    if (!templateProfile) {
      // Find best matching template based on designation/experience/employment type/location
      // STRICT: Uses only uploaded HR documents
      templateProfile = findBestTemplateProfile(
        resume.designation || 'Software Engineer',
        resume.experience_years || 0,
        (config as any).employment_type || undefined,
        (config as any).working_location || undefined
      );
    }

    if (!templateProfile) {
      res.status(400).json({
        error: 'No template profiles available. Please upload some offer letter samples first to create templates.',
        suggestions: ['Upload at least 2-3 sample offer letters to create template profiles']
      });
      return;
    }

    // Generate offer letter using the template
    const result = await generateOfferLetterWithTemplate(resume, templateProfile, config);

    res.json(result);
  } catch (error: any) {
    console.error('Error generating offer letter with template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate offer letter',
      details: error.message
    });
  }
});

// Auto-match template and generate (one-click with template)
router.post('/auto-generate-with-template', authenticateToken, uploadResume.single('resume'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No resume file uploaded' });
      return;
    }

    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({ error: 'AI service not configured.' });
      return;
    }

    // Check for template profiles
    const profileCount = db.prepare(`
      SELECT COUNT(*) as count FROM rag_template_profiles WHERE isActive = 1
    `).get() as { count: number };

    if (profileCount.count === 0) {
      if (req.file.path) fs.unlinkSync(req.file.path);
      res.status(400).json({
        error: 'No template profiles available. Please upload offer letter samples first.',
        suggestions: ['Upload at least 2-3 sample offer letters to learn templates']
      });
      return;
    }

    const userId = req.user!.userId;
    const filePath = req.file.path;
    const filename = req.file.filename;
    const originalName = req.file.originalname;

    // Extract and parse resume
    console.log('Auto-generate: Extracting resume...');
    const pdfBuffer = fs.readFileSync(filePath);
    const extractedText = await extractTextFromPDF(pdfBuffer);
    const profile = await extractResumeProfile(extractedText);

    // Save resume extraction
    const result = db.prepare(`
      INSERT INTO resume_extractions (
        filename, original_name, file_path, extracted_text,
        candidate_name, candidate_email, candidate_phone, candidate_address,
        designation, skills, experience_years, experience_details,
        education, expected_salary, current_salary, notice_period,
        full_extraction, status, uploaded_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'extracted', ?)
    `).run(
      filename, originalName, filePath, extractedText,
      profile.candidate_name, profile.candidate_email, profile.candidate_phone,
      profile.candidate_address, profile.designation,
      profile.skills ? JSON.stringify(profile.skills) : null,
      profile.experience_years,
      profile.experience_details ? JSON.stringify(profile.experience_details) : null,
      profile.education ? JSON.stringify(profile.education) : null,
      profile.expected_salary, profile.current_salary, profile.notice_period,
      JSON.stringify(profile), userId
    );

    const resumeId = result.lastInsertRowid as number;

    // Find best matching template based on designation/experience/employment type
    // STRICT: Uses only uploaded HR documents
    const templateProfile = findBestTemplateProfile(
      profile.designation || 'Software Engineer',
      profile.experience_years || 0,
      profile.employment_type || undefined,
      undefined // Location can be provided in config if needed
    );

    if (!templateProfile) {
      res.status(400).json({ error: 'No matching template found' });
      return;
    }

    // Build resume data object
    const resumeData: ResumeExtraction = {
      id: resumeId,
      filename, original_name: originalName, file_path: filePath,
      extracted_text: extractedText,
      candidate_name: profile.candidate_name,
      candidate_email: profile.candidate_email,
      candidate_phone: profile.candidate_phone,
      candidate_address: profile.candidate_address,
      designation: profile.designation,
      skills: profile.skills ? JSON.stringify(profile.skills) : null,
      experience_years: profile.experience_years,
      experience_details: profile.experience_details ? JSON.stringify(profile.experience_details) : null,
      education: profile.education ? JSON.stringify(profile.education) : null,
      expected_salary: profile.expected_salary,
      current_salary: profile.current_salary,
      notice_period: profile.notice_period,
      full_extraction: JSON.stringify(profile),
      offer_letter_id: null,
      status: 'extracted',
      uploaded_by: userId,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Get company defaults
    const companyDefaults = getCompanyDefaults();

    // Generate with template
    const generateConfig: RAGGenerateRequest = {
      resume_id: resumeId,
      template_type: 'long',
      hr_manager_name: companyDefaults.hr_manager_name || 'HR Manager',
      hr_manager_title: companyDefaults.hr_manager_title || 'Manager-Human Resource',
      working_location: companyDefaults.working_location || 'Office',
      offer_valid_days: 7,
    };

    const offerResult = await generateOfferLetterWithTemplate(resumeData, templateProfile, generateConfig);

    res.json({
      success: true,
      resume: {
        id: resumeId,
        candidate_name: profile.candidate_name,
        designation: profile.designation,
        experience_years: profile.experience_years,
        skills: profile.skills,
      },
      template_used: {
        id: templateProfile.id,
        name: templateProfile.profile_name,
        tone: templateProfile.tone_style,
      },
      offer_letter: offerResult,
      company_defaults: companyDefaults,
    });
  } catch (error: any) {
    console.error('Error in auto-generate with template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate offer letter',
      details: error.message
    });
  }
});

// Preview template with sample data
router.post('/template-profiles/:id/preview', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { designation, experience_years, annual_ctc } = req.body;

    const profile = db.prepare('SELECT * FROM rag_template_profiles WHERE id = ? AND isActive = 1').get(id) as TemplateProfile | undefined;

    if (!profile) {
      res.status(404).json({ error: 'Template profile not found' });
      return;
    }

    // Create sample resume data
    const sampleResume: ResumeExtraction = {
      id: 0,
      filename: 'sample',
      original_name: 'sample.pdf',
      file_path: '',
      extracted_text: '',
      candidate_name: 'John Doe',
      candidate_email: 'john.doe@example.com',
      candidate_phone: '+91 9876543210',
      candidate_address: '123 Sample Street, Mumbai, Maharashtra 400001',
      designation: designation || 'Software Engineer',
      skills: JSON.stringify(['JavaScript', 'React', 'Node.js']),
      experience_years: experience_years || 3,
      experience_details: null,
      education: null,
      expected_salary: annual_ctc || 800000,
      current_salary: (annual_ctc || 800000) * 0.8,
      notice_period: '30 days',
      full_extraction: null,
      offer_letter_id: null,
      status: 'extracted',
      uploaded_by: req.user!.userId,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const config: RAGGenerateRequest = {
      resume_id: 0,
      template_type: 'long',
      working_location: 'Noida',
      hr_manager_name: 'HR Manager',
      hr_manager_title: 'Manager-Human Resource',
      offer_valid_days: 7,
    };

    const result = await generateOfferLetterWithTemplate(sampleResume, profile, config);

    res.json({
      success: true,
      preview: result,
      template: {
        id: profile.id,
        name: profile.profile_name,
        tone: profile.tone_style,
      },
    });
  } catch (error: any) {
    console.error('Error generating template preview:', error);
    res.status(500).json({ error: 'Failed to generate preview', details: error.message });
  }
});

export default router;
