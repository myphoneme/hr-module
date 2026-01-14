import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { getGmailClient } from '../utils/googleAuth.js';
import OpenAI from 'openai';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'recruitment');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'resume-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and Word documents are allowed'));
    }
  }
});

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// =====================================================
// VACANCY ROUTES
// =====================================================

// Get all vacancies
router.get('/vacancies', authenticateToken, (req, res) => {
  try {
    const { status, department } = req.query;
    let query = `
      SELECT v.*, u.name as created_by_name, hm.name as hiring_manager_name,
        (SELECT COUNT(*) FROM candidates c WHERE c.vacancy_id = v.id AND c.isActive = 1) as candidate_count
      FROM vacancies v
      LEFT JOIN users u ON v.created_by = u.id
      LEFT JOIN users hm ON v.hiring_manager_id = hm.id
      WHERE v.isActive = 1
    `;
    const params: any[] = [];

    if (status) {
      query += ' AND v.status = ?';
      params.push(status);
    }
    if (department) {
      query += ' AND v.department = ?';
      params.push(department);
    }

    query += ' ORDER BY v.createdAt DESC';

    const vacancies = db.prepare(query).all(...params);
    res.json(vacancies);
  } catch (error) {
    console.error('Error fetching vacancies:', error);
    res.status(500).json({ error: 'Failed to fetch vacancies' });
  }
});

// Get single vacancy
router.get('/vacancies/:id', authenticateToken, (req, res) => {
  try {
    const vacancy = db.prepare(`
      SELECT v.*, u.name as created_by_name, hm.name as hiring_manager_name
      FROM vacancies v
      LEFT JOIN users u ON v.created_by = u.id
      LEFT JOIN users hm ON v.hiring_manager_id = hm.id
      WHERE v.id = ? AND v.isActive = 1
    `).get(req.params.id);

    if (!vacancy) {
      return res.status(404).json({ error: 'Vacancy not found' });
    }

    // Get candidates for this vacancy
    const candidates = db.prepare(`
      SELECT * FROM candidates
      WHERE vacancy_id = ? AND isActive = 1
      ORDER BY createdAt DESC
    `).all(req.params.id);

    res.json({ ...vacancy, candidates });
  } catch (error) {
    console.error('Error fetching vacancy:', error);
    res.status(500).json({ error: 'Failed to fetch vacancy' });
  }
});

// Create vacancy
router.post('/vacancies', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const {
      title, department, location, employment_type, experience_min, experience_max,
      salary_min, salary_max, openings_count, job_description, requirements,
      responsibilities, benefits, skills_required, qualifications, status,
      priority, posted_date, closing_date, hiring_manager_id
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = db.prepare(`
      INSERT INTO vacancies (
        title, department, location, employment_type, experience_min, experience_max,
        salary_min, salary_max, openings_count, job_description, requirements,
        responsibilities, benefits, skills_required, qualifications, status,
        priority, posted_date, closing_date, hiring_manager_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title, department, location, employment_type || 'full_time',
      experience_min || 0, experience_max, salary_min, salary_max,
      openings_count || 1, job_description, requirements, responsibilities,
      benefits, skills_required, qualifications, status || 'draft',
      priority || 'medium', posted_date, closing_date, hiring_manager_id, userId
    );

    const newVacancy = db.prepare('SELECT * FROM vacancies WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newVacancy);
  } catch (error) {
    console.error('Error creating vacancy:', error);
    res.status(500).json({ error: 'Failed to create vacancy' });
  }
});

// Update vacancy
router.put('/vacancies/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const vacancy = db.prepare('SELECT * FROM vacancies WHERE id = ? AND isActive = 1').get(id);
    if (!vacancy) {
      return res.status(404).json({ error: 'Vacancy not found' });
    }

    // Valid columns in the vacancies table (exclude virtual/derived fields)
    const validColumns = [
      'title', 'department', 'location', 'employment_type',
      'experience_min', 'experience_max', 'salary_min', 'salary_max',
      'openings_count', 'job_description', 'requirements', 'responsibilities',
      'benefits', 'skills_required', 'qualifications', 'status', 'priority',
      'posted_date', 'closing_date', 'hiring_manager_id', 'isActive',
      'jd_status', 'ai_generated_jd'
    ];

    const fields = Object.keys(updates).filter(k =>
      validColumns.includes(k) && k !== 'id' && k !== 'createdAt'
    );

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => updates[f]);
    values.push(id);

    db.prepare(`UPDATE vacancies SET ${setClause}, updatedAt = datetime('now') WHERE id = ?`).run(...values);

    const updatedVacancy = db.prepare('SELECT * FROM vacancies WHERE id = ?').get(id);
    res.json(updatedVacancy);
  } catch (error) {
    console.error('Error updating vacancy:', error);
    res.status(500).json({ error: 'Failed to update vacancy' });
  }
});

// Delete vacancy
router.delete('/vacancies/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("UPDATE vacancies SET isActive = 0, updatedAt = datetime('now') WHERE id = ?").run(id);
    res.json({ message: 'Vacancy deleted successfully' });
  } catch (error) {
    console.error('Error deleting vacancy:', error);
    res.status(500).json({ error: 'Failed to delete vacancy' });
  }
});

// Generate JD using AI
router.post('/vacancies/generate-jd', authenticateToken, async (req, res) => {
  try {
    const { title, department, experience_min, experience_max, skills_required } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Job title is required' });
    }

    // Get reference documents for RAG
    const referenceDoc = db.prepare(`
      SELECT extracted_text FROM rag_documents
      WHERE status = 'completed' AND isActive = 1
      ORDER BY createdAt DESC
      LIMIT 1
    `).get() as { extracted_text: string } | undefined;

    const systemPrompt = `You are an HR assistant for Phoneme Solutions Pvt. Ltd. Generate a professional job description.
${referenceDoc ? `Use this reference for company style and tone:\n${referenceDoc.extracted_text.substring(0, 2000)}` : ''}

Generate a complete job description with the following sections:
1. Job Summary (2-3 sentences)
2. Key Responsibilities (5-8 bullet points)
3. Requirements (5-7 bullet points)
4. Qualifications (education, certifications)
5. Benefits (what the company offers)

Format the output as JSON with these keys:
- job_description: string (job summary)
- responsibilities: string (bullet points separated by newlines)
- requirements: string (bullet points separated by newlines)
- qualifications: string
- benefits: string`;

    const userPrompt = `Generate a job description for:
- Position: ${title}
- Department: ${department || 'Not specified'}
- Experience: ${experience_min || 0} - ${experience_max || 'No limit'} years
- Key Skills: ${skills_required || 'Not specified'}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const generatedJD = JSON.parse(completion.choices[0].message.content || '{}');
    res.json(generatedJD);
  } catch (error) {
    console.error('Error generating JD:', error);
    res.status(500).json({ error: 'Failed to generate job description' });
  }
});

// Chat-based vacancy creation
router.post('/vacancies/chat-process', authenticateToken, async (req, res) => {
  try {
    const { message, conversationHistory, extractedData } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Merge existing extracted data
    const currentData = extractedData || {};

    // Step 1: Extract vacancy details from the HR message
    const extractionPrompt = `You are an HR assistant helping to create a job vacancy. Extract any job vacancy details mentioned in the HR's message.

Previously extracted data:
${JSON.stringify(currentData, null, 2)}

HR's new message: "${message}"

Extract and return a JSON object with these fields (use null if not mentioned):
{
  "title": "job title/role (e.g., 'React Developer', 'Software Engineer')",
  "experience_min": number or null,
  "experience_max": number or null,
  "location": "city or location string",
  "salary_min": number in INR (e.g., 1200000 for 12 LPA) or null,
  "salary_max": number in INR or null,
  "employment_type": "full_time" | "part_time" | "contract" | "internship" | null,
  "openings_count": number or null,
  "department": "inferred department based on role" or null,
  "skills_mentioned": ["skill1", "skill2", ...] - EXTRACT ALL skills/technologies/tools mentioned (e.g., React, Node.js, AWS, SQL, etc.),
  "additional_notes": "any other details mentioned that are NOT skills"
}

Important rules:
- Convert LPA to annual INR (e.g., "12 LPA" = 1200000)
- Convert "lakhs" to INR (e.g., "12 lakhs" = 1200000)
- Convert experience terms: "fresher" = 0-1, "junior" = 1-3, "mid-level" = 3-5, "senior" = 5-10
- Infer department from role (e.g., "React Developer" → "Engineering")
- Keep null for fields not explicitly or implicitly mentioned
- CRITICALLY IMPORTANT: Extract ALL skills, technologies, frameworks, tools, programming languages mentioned by the user into skills_mentioned array
- Examples of skills to capture: React, Node.js, JavaScript, TypeScript, Python, AWS, Docker, SQL, MongoDB, Git, REST API, GraphQL, etc.`;

    const extractionResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: extractionPrompt },
        { role: 'user', content: message }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const newExtraction = JSON.parse(extractionResponse.choices[0].message.content || '{}');

    // Merge new extraction with existing data (new values override only if not null)
    const mergedData: Record<string, any> = { ...currentData };
    for (const [key, value] of Object.entries(newExtraction)) {
      if (value !== null && value !== undefined && key !== 'additional_notes' && key !== 'skills_mentioned') {
        mergedData[key] = value;
      }
    }
    // Merge additional_notes
    if (newExtraction.additional_notes) {
      mergedData.additional_notes = [
        mergedData.additional_notes,
        newExtraction.additional_notes
      ].filter(Boolean).join('. ');
    }
    // Merge skills_mentioned arrays (combine and deduplicate)
    if (newExtraction.skills_mentioned && Array.isArray(newExtraction.skills_mentioned)) {
      const existingSkills = mergedData.skills_mentioned || [];
      const allSkills = [...existingSkills, ...newExtraction.skills_mentioned];
      // Deduplicate (case-insensitive)
      const uniqueSkills = [...new Set(allSkills.map((s: string) => s.toLowerCase()))]
        .map(s => allSkills.find((orig: string) => orig.toLowerCase() === s));
      mergedData.skills_mentioned = uniqueSkills;
    }

    // Step 2: Check mandatory fields
    const mandatoryFields = [
      { key: 'title', label: 'Role', question: 'What role are you looking to fill?' },
      { key: 'experience_min', label: 'Experience', question: "What's the experience level you're looking for? (e.g., 2-5 years, fresher, senior)" },
      { key: 'location', label: 'Location', question: 'Where will this position be based?' },
      { key: 'salary_min', label: 'Salary', question: "What's the salary range for this role? (e.g., 10-15 LPA)" },
      { key: 'employment_type', label: 'Employment Type', question: 'Is this a full-time, part-time, or contract position?' },
    ];

    const missingFields: string[] = [];
    let nextQuestion = '';

    for (const field of mandatoryFields) {
      if (mergedData[field.key] === null || mergedData[field.key] === undefined) {
        missingFields.push(field.label);
        if (!nextQuestion) {
          nextQuestion = field.question;
        }
      }
    }

    // Step 3: Generate response
    let responseText = '';
    let generatedJD = null;
    const isComplete = missingFields.length === 0;

    if (isComplete) {
      // All mandatory fields collected - generate JD
      const referenceDoc = db.prepare(`
        SELECT extracted_text FROM rag_documents
        WHERE status = 'completed' AND isActive = 1
        ORDER BY createdAt DESC
        LIMIT 1
      `).get() as { extracted_text: string } | undefined;

      // Prepare skills list from user-mentioned skills
      const userMentionedSkills = mergedData.skills_mentioned || [];
      const skillsContext = userMentionedSkills.length > 0
        ? `\n\n**MANDATORY SKILLS FROM HR (MUST INCLUDE ALL):**\n${userMentionedSkills.map((s: string) => `- ${s}`).join('\n')}`
        : '';

      const jdPrompt = `You are an expert HR professional creating a comprehensive job description. Generate a complete, professional job description.

${referenceDoc ? `Company reference for tone and style:\n${referenceDoc.extracted_text.substring(0, 2000)}\n\n` : ''}
Job Details:
- Role: ${mergedData.title}
- Department: ${mergedData.department || 'Not specified'}
- Experience: ${mergedData.experience_min || 0} - ${mergedData.experience_max || mergedData.experience_min + 2} years
- Location: ${mergedData.location}
- Salary: ₹${((mergedData.salary_min || 0) / 100000).toFixed(1)}L - ₹${((mergedData.salary_max || mergedData.salary_min * 1.3) / 100000).toFixed(1)}L per annum
- Employment Type: ${mergedData.employment_type?.replace('_', ' ') || 'Full Time'}
- Openings: ${mergedData.openings_count || 1}
${mergedData.additional_notes ? `- Additional Notes: ${mergedData.additional_notes}` : ''}${skillsContext}

Generate a JSON response with:
{
  "job_summary": "2-3 sentence overview of the role",
  "responsibilities": ["responsibility 1", "responsibility 2", ...] (5-7 items),
  "skills_required": ["skill 1", "skill 2", ...] (8-12 items - see rules below),
  "qualifications": "education and certification requirements",
  "requirements": ["requirement 1", "requirement 2", ...] (5-7 items),
  "benefits": ["benefit 1", "benefit 2", ...] (4-6 items)
}

**CRITICAL RULES FOR SKILLS:**
1. You MUST include ALL skills mentioned by HR in the skills_required list - these are non-negotiable requirements from the hiring manager
2. After including ALL HR-specified skills, ADD relevant complementary skills that are industry-standard for a ${mergedData.title} role
3. For a ${mergedData.title} with ${mergedData.experience_min || 0}-${mergedData.experience_max || mergedData.experience_min + 2} years experience, include:
   - All HR-mentioned skills (MANDATORY)
   - Core technical skills for the role (e.g., version control, testing, debugging)
   - Soft skills relevant to the experience level
   - Any commonly paired technologies (e.g., React usually needs JavaScript, HTML, CSS)
4. Skills should be ordered: Primary skills first (from HR), then complementary technical skills, then soft skills
5. Total skills should be 8-12 items to be comprehensive

Use industry-standard language for the ${mergedData.title} role. Be specific and professional.`;

      const jdResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: jdPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const jdContent = JSON.parse(jdResponse.choices[0].message.content || '{}');

      // Ensure user-mentioned skills are included in the final skills list
      let finalSkills: string[] = [];
      const aiSkills = Array.isArray(jdContent.skills_required) ? jdContent.skills_required : [];

      // Add user-mentioned skills first (they are mandatory)
      if (userMentionedSkills.length > 0) {
        finalSkills = [...userMentionedSkills];
        // Add AI-generated skills that aren't duplicates
        for (const aiSkill of aiSkills) {
          const isDuplicate = finalSkills.some(
            (s: string) => s.toLowerCase() === aiSkill.toLowerCase() ||
              s.toLowerCase().includes(aiSkill.toLowerCase()) ||
              aiSkill.toLowerCase().includes(s.toLowerCase())
          );
          if (!isDuplicate) {
            finalSkills.push(aiSkill);
          }
        }
      } else {
        finalSkills = aiSkills;
      }

      generatedJD = {
        title: mergedData.title,
        department: mergedData.department,
        location: mergedData.location,
        employment_type: mergedData.employment_type,
        experience_min: mergedData.experience_min,
        experience_max: mergedData.experience_max || mergedData.experience_min + 2,
        salary_min: mergedData.salary_min,
        salary_max: mergedData.salary_max || Math.round(mergedData.salary_min * 1.3),
        openings_count: mergedData.openings_count || 1,
        job_description: jdContent.job_summary,
        responsibilities: Array.isArray(jdContent.responsibilities)
          ? jdContent.responsibilities.join('\n• ')
          : jdContent.responsibilities,
        skills_required: finalSkills.join(', '),
        qualifications: jdContent.qualifications,
        requirements: Array.isArray(jdContent.requirements)
          ? jdContent.requirements.join('\n• ')
          : jdContent.requirements,
        benefits: Array.isArray(jdContent.benefits)
          ? jdContent.benefits.join('\n• ')
          : jdContent.benefits,
      };

      responseText = `I've captured all the details for the ${mergedData.title} position. Here's your job description - you can review it, make edits, or publish it directly.`;
    } else {
      // Still missing fields - acknowledge what we got and ask for missing
      const capturedFields = mandatoryFields
        .filter(f => mergedData[f.key] !== null && mergedData[f.key] !== undefined)
        .map(f => {
          const value = mergedData[f.key];
          if (f.key === 'salary_min') {
            const salaryMax = mergedData.salary_max;
            return `${f.label}: ₹${(value / 100000).toFixed(1)}L${salaryMax ? ` - ₹${(salaryMax / 100000).toFixed(1)}L` : ''}`;
          }
          if (f.key === 'experience_min') {
            const expMax = mergedData.experience_max;
            return `${f.label}: ${value}${expMax ? `-${expMax}` : '+'} years`;
          }
          if (f.key === 'employment_type') {
            return `${f.label}: ${value.replace('_', ' ')}`;
          }
          return `${f.label}: ${value}`;
        });

      // Add captured skills to the response
      const skillsList = mergedData.skills_mentioned || [];
      if (skillsList.length > 0) {
        capturedFields.push(`Skills: ${skillsList.join(', ')}`);
      }

      if (capturedFields.length > 0 && conversationHistory && conversationHistory.length <= 2) {
        responseText = `Got it! I've noted:\n${capturedFields.map(f => `• ${f}`).join('\n')}\n\n${nextQuestion}`;
      } else if (capturedFields.length > 0) {
        responseText = nextQuestion;
      } else {
        responseText = nextQuestion;
      }
    }

    res.json({
      response: responseText,
      extractedData: mergedData,
      missingFields,
      isComplete,
      generatedJD,
    });

  } catch (error) {
    console.error('Error processing vacancy chat:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Analyze resumes against JD and extract structured data
router.post('/vacancies/:id/screen-resumes', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { candidate_ids } = req.body;

    // Get vacancy with JD
    const vacancy = db.prepare(`
      SELECT * FROM vacancies WHERE id = ? AND isActive = 1
    `).get(id) as any;

    if (!vacancy) {
      return res.status(404).json({ error: 'Vacancy not found' });
    }

    // Get candidates to screen
    let candidatesQuery = `
      SELECT c.*, c.resume_extracted_text
      FROM candidates c
      WHERE c.vacancy_id = ? AND c.isActive = 1
    `;
    const queryParams: any[] = [id];

    if (candidate_ids && candidate_ids.length > 0) {
      candidatesQuery += ` AND c.id IN (${candidate_ids.map(() => '?').join(',')})`;
      queryParams.push(...candidate_ids);
    }

    const candidates = db.prepare(candidatesQuery).all(...queryParams) as any[];

    if (candidates.length === 0) {
      return res.json({ screenedCandidates: [], message: 'No candidates to screen' });
    }

    // Extract skills from JD for technology-wise matching
    const jdSkills = vacancy.skills_required?.split(',').map((s: string) => s.trim().toLowerCase()) || [];
    const jdText = `${vacancy.title || ''} ${vacancy.job_description || ''} ${vacancy.requirements || ''} ${vacancy.skills_required || ''}`;

    // Common technology categories to extract
    const techCategories = [
      'Cisco', 'Tejas', 'Aruba', 'SD-WAN', 'NetApp', 'RedHat', 'Windows', 'VMware',
      'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Linux', 'Python', 'Java',
      'React', 'Angular', 'Node.js', 'SQL', 'MongoDB', 'Networking', 'Security'
    ];

    // Filter tech categories relevant to this JD
    const relevantTech = techCategories.filter(tech =>
      jdText.toLowerCase().includes(tech.toLowerCase())
    );

    // If no specific tech found in JD, use generic ones
    const techToExtract = relevantTech.length > 0 ? relevantTech :
      ['Cisco', 'Networking', 'Linux', 'Windows', 'Cloud', 'Security'];

    const screenedCandidates = [];

    for (const candidate of candidates) {
      const resumeText = candidate.resume_extracted_text || '';
      const candidateSkills = candidate.skills || '';
      const fullText = `${resumeText} ${candidateSkills}`.toLowerCase();

      // Use AI to extract structured data from resume
      const extractionPrompt = `Analyze this resume/candidate profile and extract the following information in JSON format.

Candidate Profile:
- Name: ${candidate.first_name || ''} ${candidate.last_name || ''}
- Current Company: ${candidate.current_company || 'Not provided'}
- Current Designation: ${candidate.current_designation || 'Not provided'}
- Total Experience: ${candidate.experience_years || 'Not provided'} years
- Current Salary: ${candidate.current_salary || 'Not provided'}
- Expected Salary: ${candidate.expected_salary || 'Not provided'}
- Notice Period: ${candidate.notice_period || 'Not provided'}
- Location: ${candidate.city || candidate.address || 'Not provided'}
- Skills: ${candidate.skills || 'Not provided'}

Resume Text (if available):
${resumeText.substring(0, 3000)}

Job Requirements:
${vacancy.title} - ${vacancy.skills_required || ''}

Extract and return JSON with these exact fields:
{
  "candidate_name": "Full name",
  "total_experience_years": number or "No",
  "current_ctc": "amount in LPA or No",
  "expected_ctc": "amount in LPA or No",
  "notice_period": "period or No",
  "current_location": "city or No",
  "technology_experience": {
    ${techToExtract.map(t => `"${t}": "years as number or No"`).join(',\n    ')}
  },
  "skills_matched": ["list of skills matching JD"],
  "overall_match_score": number 0-100
}

Rules:
- Use "No" for any missing or unavailable information
- Experience values must be numeric (years) or "No"
- Extract technology experience from resume content only
- Do not assume or guess - only extract what's explicitly mentioned
- CTC should be in LPA format (e.g., "12 LPA" or "No")`;

      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are an HR assistant that extracts candidate information from resumes. Be accurate and never assume data that is not present.' },
            { role: 'user', content: extractionPrompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        });

        const extracted = JSON.parse(completion.choices[0].message.content || '{}');

        screenedCandidates.push({
          id: candidate.id,
          candidate_name: extracted.candidate_name || `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() || 'No',
          total_experience_years: extracted.total_experience_years ?? candidate.experience_years ?? 'No',
          current_ctc: extracted.current_ctc || (candidate.current_salary ? `${(candidate.current_salary / 100000).toFixed(1)} LPA` : 'No'),
          expected_ctc: extracted.expected_ctc || (candidate.expected_salary ? `${(candidate.expected_salary / 100000).toFixed(1)} LPA` : 'No'),
          notice_period: extracted.notice_period || candidate.notice_period || 'No',
          current_location: extracted.current_location || candidate.city || 'No',
          technology_experience: extracted.technology_experience || {},
          skills_matched: extracted.skills_matched || [],
          overall_match_score: extracted.overall_match_score || 0,
          status: candidate.status,
          email: candidate.email,
        });

        // Update candidate with screening data
        db.prepare(`
          UPDATE candidates
          SET screening_score = ?,
              screening_notes = ?,
              updatedAt = datetime('now')
          WHERE id = ?
        `).run(
          extracted.overall_match_score || 0,
          JSON.stringify({
            technology_experience: extracted.technology_experience,
            skills_matched: extracted.skills_matched,
            screened_at: new Date().toISOString()
          }),
          candidate.id
        );

      } catch (aiError) {
        console.error(`Error screening candidate ${candidate.id}:`, aiError);
        // Add candidate with basic info if AI fails
        screenedCandidates.push({
          id: candidate.id,
          candidate_name: `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() || 'No',
          total_experience_years: candidate.experience_years ?? 'No',
          current_ctc: candidate.current_salary ? `${(candidate.current_salary / 100000).toFixed(1)} LPA` : 'No',
          expected_ctc: candidate.expected_salary ? `${(candidate.expected_salary / 100000).toFixed(1)} LPA` : 'No',
          notice_period: candidate.notice_period || 'No',
          current_location: candidate.city || 'No',
          technology_experience: {},
          skills_matched: [],
          overall_match_score: 0,
          status: candidate.status,
          email: candidate.email,
          error: 'Failed to extract detailed information'
        });
      }
    }

    res.json({
      vacancy_title: vacancy.title,
      technologies_analyzed: techToExtract,
      total_candidates: screenedCandidates.length,
      screenedCandidates,
    });

  } catch (error) {
    console.error('Error screening resumes:', error);
    res.status(500).json({ error: 'Failed to screen resumes' });
  }
});

// =====================================================
// CANDIDATE ROUTES
// =====================================================

// Get all candidates
router.get('/candidates', authenticateToken, (req, res) => {
  try {
    const { vacancy_id, status } = req.query;
    let query = `
      SELECT c.*, v.title as vacancy_title, u.name as created_by_name
      FROM candidates c
      LEFT JOIN vacancies v ON c.vacancy_id = v.id
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.isActive = 1
    `;
    const params: any[] = [];

    if (vacancy_id) {
      query += ' AND c.vacancy_id = ?';
      params.push(vacancy_id);
    }
    if (status) {
      query += ' AND c.status = ?';
      params.push(status);
    }

    query += ' ORDER BY c.createdAt DESC';

    const candidates = db.prepare(query).all(...params);
    res.json(candidates);
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
});

// Get single candidate with full details
router.get('/candidates/:id', authenticateToken, (req, res) => {
  try {
    const candidate = db.prepare(`
      SELECT c.*, v.title as vacancy_title, u.name as created_by_name
      FROM candidates c
      LEFT JOIN vacancies v ON c.vacancy_id = v.id
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.id = ? AND c.isActive = 1
    `).get(req.params.id);

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Get interviews
    const interviews = db.prepare(`
      SELECT i.*, u.name as interviewer_name
      FROM interviews i
      LEFT JOIN users u ON i.interviewer_id = u.id
      WHERE i.candidate_id = ? AND i.isActive = 1
      ORDER BY i.scheduled_date DESC
    `).all(req.params.id);

    // Get evaluations
    const evaluations = db.prepare(`
      SELECT e.*, u.name as evaluator_name
      FROM candidate_evaluations e
      LEFT JOIN users u ON e.evaluated_by = u.id
      WHERE e.candidate_id = ?
      ORDER BY e.createdAt DESC
    `).all(req.params.id);

    res.json({ ...candidate, interviews, evaluations });
  } catch (error) {
    console.error('Error fetching candidate:', error);
    res.status(500).json({ error: 'Failed to fetch candidate' });
  }
});

// Create candidate (with resume upload)
router.post('/candidates', authenticateToken, upload.single('resume'), async (req, res) => {
  try {
    const userId = req.user!.userId;
    const {
      vacancy_id, first_name, last_name, email, phone, address, city, state, pincode,
      current_company, current_designation, current_salary, expected_salary,
      experience_years, notice_period, skills, education, source, referral_name
    } = req.body;

    if (!first_name || !email) {
      return res.status(400).json({ error: 'First name and email are required' });
    }

    let resume_path = null;
    let resume_extracted_text = null;

    // If resume was uploaded, extract text
    // Variables to hold extracted data from resume
    let extractedExperience = experience_years;
    let extractedSkills = skills;
    let extractedCurrentCompany = current_company;
    let extractedDesignation = current_designation;
    let extractedCity = city;

    if (req.file) {
      resume_path = req.file.filename;

      // Extract text and structured data from resume using AI
      try {
        const filePath = req.file.path;
        const fileBuffer = fs.readFileSync(filePath);
        const base64File = fileBuffer.toString('base64');

        // First, extract the text
        const textCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Extract all text and information from this resume. Return the full extracted text.`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:application/pdf;base64,${base64File}`
                  }
                }
              ]
            }
          ],
          max_tokens: 4000,
        });

        resume_extracted_text = textCompletion.choices[0].message.content;

        // Now extract structured data including experience
        if (resume_extracted_text) {
          const structuredCompletion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'user',
                content: `Extract structured information from this resume text. Return a JSON object.

RESUME TEXT:
${resume_extracted_text.substring(0, 6000)}

Return ONLY a JSON object with these fields:
{
  "total_experience": number (total years of work experience as decimal, e.g., 1.5 for 1 year 6 months),
  "skills": "comma-separated list of technical skills",
  "current_company": "current or most recent employer",
  "current_designation": "current or most recent job title",
  "location": "current city/location"
}

CRITICAL FOR total_experience:
- Count all jobs EXCEPT internships (include trainee positions)
- Look for job dates like "Jan 2023 - Present", "2022-2024"
- For "Present" or current job, use today: ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
- Count total months, then divide by 12:
  * 13 months = 1.08 years
  * 14 months = 1.17 years
  * 15 months = 1.25 years
- DO NOT count internships
- DO count trainee positions
- For freshers with only internship, return 0`
              }
            ],
            response_format: { type: 'json_object' },
            max_tokens: 1000,
          });

          const extractedData = JSON.parse(structuredCompletion.choices[0].message.content || '{}');
          console.log('=== AI EXTRACTED DATA ===');
          console.log('Total Experience from AI:', extractedData.total_experience);
          console.log('Full extracted data:', JSON.stringify(extractedData, null, 2));

          // Use extracted data - ALWAYS use AI extraction for experience
          if (extractedData.total_experience !== undefined && extractedData.total_experience !== null) {
            extractedExperience = extractedData.total_experience;
            console.log('Using AI extracted experience:', extractedExperience);
          }
          if (!skills && extractedData.skills) {
            extractedSkills = extractedData.skills;
          }
          if (!current_company && extractedData.current_company) {
            extractedCurrentCompany = extractedData.current_company;
          }
          if (!current_designation && extractedData.current_designation) {
            extractedDesignation = extractedData.current_designation;
          }
          if (!city && extractedData.location) {
            extractedCity = extractedData.location;
          }
        }
      } catch (extractError) {
        console.error('Error extracting resume data:', extractError);
      }
    }

    const result = db.prepare(`
      INSERT INTO candidates (
        vacancy_id, first_name, last_name, email, phone, address, city, state, pincode,
        current_company, current_designation, current_salary, expected_salary,
        experience_years, notice_period, skills, education, resume_path,
        resume_extracted_text, source, referral_name, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      vacancy_id || null, first_name, last_name, email, phone, address, extractedCity || city, state, pincode,
      extractedCurrentCompany || current_company, extractedDesignation || current_designation, current_salary, expected_salary,
      extractedExperience || experience_years, notice_period, extractedSkills || skills, education, resume_path,
      resume_extracted_text, source || 'direct', referral_name, userId
    );

    const candidateId = result.lastInsertRowid as number;
    const newCandidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(candidateId) as any;

    // ========== AUTO-SCREEN CANDIDATE IMMEDIATELY ==========
    if (vacancy_id) {
      try {
        const candidateWithVacancy = db.prepare(`
          SELECT c.*, v.title as vacancy_title, v.requirements, v.skills_required,
            v.experience_min, v.experience_max, v.location as vacancy_location
          FROM candidates c
          LEFT JOIN vacancies v ON c.vacancy_id = v.id
          WHERE c.id = ?
        `).get(candidateId) as any;

        const screeningPrompt = `You are an HR screening assistant. Quick evaluation - return JSON with:
{
  "screening_score": number (0-100),
  "recommendation": "shortlist" | "maybe" | "reject",
  "brief_reason": string
}`;

        const screeningUserPrompt = `Quick screen:
Candidate: ${first_name} ${last_name || ''}, ${experience_years || 0} yrs exp
Skills: ${skills || 'N/A'}
Required: ${candidateWithVacancy?.skills_required || 'N/A'}, ${candidateWithVacancy?.experience_min || 0}-${candidateWithVacancy?.experience_max || 'any'} yrs`;

        const screeningCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: screeningPrompt },
            { role: 'user', content: screeningUserPrompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        });

        const screening = JSON.parse(screeningCompletion.choices[0].message.content || '{}');

        // Auto-decision thresholds
        const AUTO_SHORTLIST = 70;
        const AUTO_REJECT = 40;

        let newStatus = 'screening';
        let autoDecision = null;

        if (screening.screening_score >= AUTO_SHORTLIST) {
          newStatus = 'shortlisted';
          autoDecision = 'shortlisted';
        } else if (screening.screening_score < AUTO_REJECT) {
          newStatus = 'rejected';
          autoDecision = 'rejected';
        }

        // Update candidate with screening results
        db.prepare(`
          UPDATE candidates
          SET screening_score = ?, screening_notes = ?, status = ?, updatedAt = datetime('now')
          WHERE id = ?
        `).run(screening.screening_score, JSON.stringify(screening), newStatus, candidateId);

        // Log workflow action
        db.prepare(`
          INSERT INTO recruitment_workflow_log (candidate_id, action, action_type, details, performed_by, is_automated)
          VALUES (?, ?, ?, ?, ?, 1)
        `).run(
          candidateId,
          `Auto-screened: Score ${screening.screening_score} → ${autoDecision || 'manual review'}`,
          'auto_screen',
          JSON.stringify(screening),
          userId
        );

        // Return candidate with screening results
        const screenedCandidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(candidateId) as Record<string, any>;
        return res.status(201).json({
          ...screenedCandidate,
          auto_screening: {
            score: screening.screening_score,
            decision: autoDecision,
            reason: screening.brief_reason
          }
        });
      } catch (screenError) {
        console.error('Auto-screening error:', screenError);
        // Continue without screening if it fails
      }
    }

    res.status(201).json(newCandidate);
  } catch (error) {
    console.error('Error creating candidate:', error);
    res.status(500).json({ error: 'Failed to create candidate' });
  }
});

// Update candidate status
router.put('/candidates/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const candidate = db.prepare('SELECT * FROM candidates WHERE id = ? AND isActive = 1').get(id);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'createdAt');
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => updates[f]);
    values.push(id);

    db.prepare(`UPDATE candidates SET ${setClause}, updatedAt = datetime('now') WHERE id = ?`).run(...values);

    const updatedCandidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(id);
    res.json(updatedCandidate);
  } catch (error) {
    console.error('Error updating candidate:', error);
    res.status(500).json({ error: 'Failed to update candidate' });
  }
});

// Delete candidate
router.delete('/candidates/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(id);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Soft delete by setting isActive = 0
    db.prepare("UPDATE candidates SET isActive = 0, updatedAt = datetime('now') WHERE id = ?").run(id);

    res.json({ message: 'Candidate deleted successfully' });
  } catch (error) {
    console.error('Error deleting candidate:', error);
    res.status(500).json({ error: 'Failed to delete candidate' });
  }
});

// Screen candidate using AI
router.post('/candidates/:id/screen', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const candidate = db.prepare(`
      SELECT c.*, v.title as vacancy_title, v.requirements, v.skills_required
      FROM candidates c
      LEFT JOIN vacancies v ON c.vacancy_id = v.id
      WHERE c.id = ? AND c.isActive = 1
    `).get(id) as any;

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const systemPrompt = `You are an HR screening assistant. Evaluate the candidate's profile against the job requirements.
Return a JSON response with:
- screening_score: number (0-100)
- match_analysis: string (brief analysis of profile vs requirements match)
- strengths: array of strings
- concerns: array of strings
- recommendation: string ('shortlist', 'maybe', 'reject')
- notes: string`;

    const userPrompt = `Evaluate this candidate:
Name: ${candidate.first_name} ${candidate.last_name || ''}
Experience: ${candidate.experience_years || 'Not specified'} years
Current Role: ${candidate.current_designation || 'Not specified'} at ${candidate.current_company || 'Not specified'}
Skills: ${candidate.skills || 'Not specified'}
Education: ${candidate.education || 'Not specified'}

Job Position: ${candidate.vacancy_title || 'General'}
Job Requirements: ${candidate.requirements || 'Not specified'}
Required Skills: ${candidate.skills_required || 'Not specified'}

${candidate.resume_extracted_text ? `Resume Content:\n${candidate.resume_extracted_text.substring(0, 3000)}` : ''}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const screening = JSON.parse(completion.choices[0].message.content || '{}');

    // Update candidate with screening results
    db.prepare(`
      UPDATE candidates
      SET screening_score = ?, screening_notes = ?, status = 'screening', updatedAt = datetime('now')
      WHERE id = ?
    `).run(screening.screening_score, JSON.stringify(screening), id);

    res.json(screening);
  } catch (error) {
    console.error('Error screening candidate:', error);
    res.status(500).json({ error: 'Failed to screen candidate' });
  }
});

// Re-extract experience from resume text (for fixing incorrect experience)
router.post('/candidates/:id/re-extract-experience', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const candidate = db.prepare(`
      SELECT * FROM candidates WHERE id = ? AND isActive = 1
    `).get(id) as any;

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    if (!candidate.resume_extracted_text) {
      return res.status(400).json({ error: 'No resume text available for this candidate' });
    }

    // Extract experience from resume text using AI
    const extractionPrompt = `Analyze this resume text and extract the TOTAL YEARS of work experience.

RESUME TEXT:
${candidate.resume_extracted_text.substring(0, 6000)}

INSTRUCTIONS:
1. Look at ALL employment/work entries with their dates
2. Calculate duration from start date to end date for each job
3. For "Present" or current jobs, calculate up to today's date (${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})
4. Sum up ALL employment periods
5. MUST convert months to years by DIVIDING BY 12:
   * 1 month = 0.08, 2 months = 0.17, 3 months = 0.25
   * 4 months = 0.33, 5 months = 0.42, 6 months = 0.5
   * 7 months = 0.58, 8 months = 0.67, 9 months = 0.75
   * 10 months = 0.83, 11 months = 0.92

IMPORTANT:
- "1 year 3 months" = 1 + (3/12) = 1.25 years (NOT 1.3)
- "1 year 6 months" = 1 + (6/12) = 1.5 years
- "2 years 9 months" = 2 + (9/12) = 2.75 years
- Calculate from actual job dates if available
- Do NOT just return the first number you see

Return ONLY a JSON object:
{
  "total_experience_years": number (e.g., 1.25 for 1 year 3 months),
  "experience_calculation": "Brief explanation of how you calculated this"
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: extractionPrompt }],
      response_format: { type: 'json_object' },
      max_tokens: 500,
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    console.log('Re-extracted experience for candidate', id, ':', result);

    const newExperience = result.total_experience_years;

    if (newExperience !== undefined && newExperience !== null) {
      // Update candidate with new experience
      db.prepare(`
        UPDATE candidates
        SET experience_years = ?, updatedAt = datetime('now')
        WHERE id = ?
      `).run(newExperience, id);

      const updatedCandidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(id);

      res.json({
        success: true,
        old_experience: candidate.experience_years,
        new_experience: newExperience,
        calculation: result.experience_calculation,
        candidate: updatedCandidate
      });
    } else {
      res.status(400).json({ error: 'Could not extract experience from resume' });
    }
  } catch (error) {
    console.error('Error re-extracting experience:', error);
    res.status(500).json({ error: 'Failed to re-extract experience' });
  }
});

// =====================================================
// INTERVIEW ROUTES
// =====================================================

// Get interviews
router.get('/interviews', authenticateToken, (req, res) => {
  try {
    const { candidate_id, interviewer_id, status, date } = req.query;
    let query = `
      SELECT i.*, c.first_name, c.last_name, c.email as candidate_email,
        v.title as vacancy_title, u.name as interviewer_name
      FROM interviews i
      LEFT JOIN candidates c ON i.candidate_id = c.id
      LEFT JOIN vacancies v ON i.vacancy_id = v.id
      LEFT JOIN users u ON i.interviewer_id = u.id
      WHERE i.isActive = 1
    `;
    const params: any[] = [];

    if (candidate_id) {
      query += ' AND i.candidate_id = ?';
      params.push(candidate_id);
    }
    if (interviewer_id) {
      query += ' AND i.interviewer_id = ?';
      params.push(interviewer_id);
    }
    if (status) {
      query += ' AND i.status = ?';
      params.push(status);
    }
    if (date) {
      query += ' AND i.scheduled_date = ?';
      params.push(date);
    }

    query += ' ORDER BY i.scheduled_date DESC, i.scheduled_time DESC';

    const interviews = db.prepare(query).all(...params);
    res.json(interviews);
  } catch (error) {
    console.error('Error fetching interviews:', error);
    res.status(500).json({ error: 'Failed to fetch interviews' });
  }
});

// Schedule interview
router.post('/interviews', authenticateToken, (req, res) => {
  try {
    const userId = req.user!.userId;
    const {
      candidate_id, vacancy_id, round_number, interview_type, scheduled_date,
      scheduled_time, duration_minutes, interviewer_id, location, meeting_link
    } = req.body;

    if (!candidate_id || !scheduled_date || !scheduled_time || !interviewer_id) {
      return res.status(400).json({ error: 'Candidate, date, time, and interviewer are required' });
    }

    const result = db.prepare(`
      INSERT INTO interviews (
        candidate_id, vacancy_id, round_number, interview_type, scheduled_date,
        scheduled_time, duration_minutes, interviewer_id, location, meeting_link, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      candidate_id, vacancy_id, round_number || 1, interview_type || 'technical',
      scheduled_date, scheduled_time, duration_minutes || 60, interviewer_id,
      location, meeting_link, userId
    );

    // Note: Candidate status stays as 'shortlisted' - interview scheduling tracked separately

    const newInterview = db.prepare(`
      SELECT i.*, c.first_name, c.last_name, u.name as interviewer_name
      FROM interviews i
      LEFT JOIN candidates c ON i.candidate_id = c.id
      LEFT JOIN users u ON i.interviewer_id = u.id
      WHERE i.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(newInterview);
  } catch (error) {
    console.error('Error scheduling interview:', error);
    res.status(500).json({ error: 'Failed to schedule interview' });
  }
});

// Update interview (e.g., set time, reschedule)
router.patch('/interviews/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const {
      scheduled_date, scheduled_time, interviewer_id, interview_type,
      duration_minutes, location, meeting_link, status, notes
    } = req.body;

    const interview = db.prepare(`
      SELECT * FROM interviews WHERE id = ? AND isActive = 1
    `).get(id) as any;

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (scheduled_date !== undefined) {
      updates.push('scheduled_date = ?');
      values.push(scheduled_date);
    }
    if (scheduled_time !== undefined) {
      updates.push('scheduled_time = ?');
      values.push(scheduled_time);
      // Clear TIME_PENDING note if time is being set
      if (interview.notes?.includes('TIME_PENDING')) {
        updates.push('notes = ?');
        values.push('Interview time confirmed by HR');
      }
    }
    if (interviewer_id !== undefined) {
      updates.push('interviewer_id = ?');
      values.push(interviewer_id);
    }
    if (interview_type !== undefined) {
      updates.push('interview_type = ?');
      values.push(interview_type);
    }
    if (duration_minutes !== undefined) {
      updates.push('duration_minutes = ?');
      values.push(duration_minutes);
    }
    if (location !== undefined) {
      updates.push('location = ?');
      values.push(location);
    }
    if (meeting_link !== undefined) {
      updates.push('meeting_link = ?');
      values.push(meeting_link);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (notes !== undefined && !interview.notes?.includes('TIME_PENDING')) {
      updates.push('notes = ?');
      values.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push("updatedAt = datetime('now')");
    values.push(id);

    db.prepare(`
      UPDATE interviews SET ${updates.join(', ')} WHERE id = ?
    `).run(...values);

    const updatedInterview = db.prepare(`
      SELECT i.*, c.first_name, c.last_name, u.name as interviewer_name
      FROM interviews i
      LEFT JOIN candidates c ON i.candidate_id = c.id
      LEFT JOIN users u ON i.interviewer_id = u.id
      WHERE i.id = ?
    `).get(id);

    res.json(updatedInterview);
  } catch (error) {
    console.error('Error updating interview:', error);
    res.status(500).json({ error: 'Failed to update interview' });
  }
});

// Delete interview
router.delete('/interviews/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    const interview = db.prepare(`
      SELECT * FROM interviews WHERE id = ? AND isActive = 1
    `).get(id) as any;

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // Soft delete - set isActive to 0
    db.prepare(`
      UPDATE interviews SET isActive = 0, updatedAt = datetime('now') WHERE id = ?
    `).run(id);

    // Update candidate status back to shortlisted if they have no other active interviews
    const otherInterviews = db.prepare(`
      SELECT COUNT(*) as count FROM interviews
      WHERE candidate_id = ? AND id != ? AND isActive = 1
    `).get(interview.candidate_id, id) as { count: number };

    if (otherInterviews.count === 0) {
      db.prepare(`
        UPDATE candidates SET status = 'shortlisted', updatedAt = datetime('now')
        WHERE id = ? AND status = 'interview_scheduled'
      `).run(interview.candidate_id);
    }

    res.json({ message: 'Interview deleted successfully' });
  } catch (error) {
    console.error('Error deleting interview:', error);
    res.status(500).json({ error: 'Failed to delete interview' });
  }
});

// Generate interview questions using AI
router.post('/interviews/:id/generate-questions', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { question_count = 10 } = req.body;

    const interview = db.prepare(`
      SELECT i.*, c.first_name, c.last_name, c.skills, c.experience_years, c.resume_extracted_text,
        v.title as vacancy_title, v.requirements, v.skills_required
      FROM interviews i
      LEFT JOIN candidates c ON i.candidate_id = c.id
      LEFT JOIN vacancies v ON i.vacancy_id = v.id
      WHERE i.id = ? AND i.isActive = 1
    `).get(id) as any;

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    const systemPrompt = `You are an expert interviewer. Generate ${question_count} interview questions.
Mix of technical, behavioral, and situational questions appropriate for the role.
Return a JSON array with objects containing:
- question: string
- type: 'technical' | 'behavioral' | 'situational' | 'hr'
- difficulty: 'easy' | 'medium' | 'hard'
- expected_answer: string (brief expected answer or key points)
- time_minutes: number (suggested time)`;

    const userPrompt = `Generate interview questions for:
Position: ${interview.vacancy_title || 'Software Role'}
Interview Type: ${interview.interview_type}
Candidate Experience: ${interview.experience_years || 'Unknown'} years
Candidate Skills: ${interview.skills || 'Not specified'}
Required Skills: ${interview.skills_required || 'Not specified'}
Job Requirements: ${interview.requirements || 'Not specified'}

${interview.resume_extracted_text ? `Candidate Background:\n${interview.resume_extracted_text.substring(0, 2000)}` : ''}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    const questions = result.questions || result;

    // Save questions to interview
    db.prepare(`
      UPDATE interviews SET questions_generated = ?, updatedAt = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(questions), id);

    res.json({ questions });
  } catch (error) {
    console.error('Error generating questions:', error);
    res.status(500).json({ error: 'Failed to generate questions' });
  }
});

// Submit interview feedback with simple scoring (1-5)
router.post('/interviews/:id/feedback', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const { score, notes, ai_decision } = req.body;

    const interview = db.prepare('SELECT * FROM interviews WHERE id = ? AND isActive = 1').get(id) as any;
    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // AI Decision: score >= 3 = selected, score < 3 = rejected
    const candidateStatus = ai_decision || (score >= 3 ? 'selected' : 'rejected');

    // Map to interview/evaluation recommendation (for CHECK constraints)
    const interviewRecommendation = candidateStatus === 'selected' ? 'strong_hire' : 'strong_no_hire';

    // Update interview status to completed with score
    db.prepare(`
      UPDATE interviews
      SET status = 'completed', rating = ?, recommendation = ?, feedback = ?, updatedAt = datetime('now')
      WHERE id = ?
    `).run(score, interviewRecommendation, notes || '', id);

    // Create evaluation record (uses interviewRecommendation for CHECK constraint)
    db.prepare(`
      INSERT INTO candidate_evaluations (
        candidate_id, interview_id, evaluated_by, evaluation_type,
        overall_score, recommendation, detailed_feedback
      ) VALUES (?, ?, ?, 'interview', ?, ?, ?)
    `).run(interview.candidate_id, id, userId, score, interviewRecommendation, notes || '');

    // Update candidate status based on AI decision (selected or rejected)
    db.prepare(`
      UPDATE candidates SET status = ?, updatedAt = datetime('now')
      WHERE id = ?
    `).run(candidateStatus, interview.candidate_id);

    res.json({
      message: 'Interview completed successfully',
      decision: candidateStatus,
      score: score
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// =====================================================
// EVALUATION ROUTES
// =====================================================

// Get evaluations for a candidate
router.get('/evaluations', authenticateToken, (req, res) => {
  try {
    const { candidate_id } = req.query;
    let query = `
      SELECT e.*, u.name as evaluator_name, c.first_name, c.last_name
      FROM candidate_evaluations e
      LEFT JOIN users u ON e.evaluated_by = u.id
      LEFT JOIN candidates c ON e.candidate_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (candidate_id) {
      query += ' AND e.candidate_id = ?';
      params.push(candidate_id);
    }

    query += ' ORDER BY e.createdAt DESC';

    const evaluations = db.prepare(query).all(...params);
    res.json(evaluations);
  } catch (error) {
    console.error('Error fetching evaluations:', error);
    res.status(500).json({ error: 'Failed to fetch evaluations' });
  }
});

// Mark candidate as selected/rejected
router.post('/candidates/:id/decision', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { decision, rejection_reason, salary_offered, designation_offered, joining_date } = req.body;

    if (!decision || !['selected', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: 'Valid decision (selected/rejected) is required' });
    }

    const candidate = db.prepare('SELECT * FROM candidates WHERE id = ? AND isActive = 1').get(id);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    if (decision === 'selected') {
      db.prepare(`
        UPDATE candidates
        SET status = 'selected', updatedAt = datetime('now')
        WHERE id = ?
      `).run(id);
    } else {
      db.prepare(`
        UPDATE candidates
        SET status = 'rejected', rejection_reason = ?, updatedAt = datetime('now')
        WHERE id = ?
      `).run(rejection_reason, id);
    }

    res.json({ message: `Candidate ${decision} successfully` });
  } catch (error) {
    console.error('Error updating candidate decision:', error);
    res.status(500).json({ error: 'Failed to update decision' });
  }
});

// =====================================================
// CTC & OFFER LETTER GENERATION
// =====================================================

// Generate CTC breakdown
router.post('/candidates/:id/generate-ctc', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { annual_ctc } = req.body;

    if (!annual_ctc) {
      return res.status(400).json({ error: 'Annual CTC is required' });
    }

    const candidate = db.prepare('SELECT * FROM candidates WHERE id = ? AND isActive = 1').get(id) as any;
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Get salary structure from reference documents
    const salaryRef = db.prepare(`
      SELECT setting_value FROM rag_company_defaults WHERE setting_key = 'salary_structure'
    `).get() as { setting_value: string } | undefined;

    // Standard salary breakdown (as per reference offer letters)
    const monthlyCTC = annual_ctc / 12;

    // Standard breakdown percentages
    const breakdown = [
      { component: 'Basic', perMonth: Math.round(monthlyCTC * 0.40), annual: Math.round(annual_ctc * 0.40) },
      { component: 'HRA', perMonth: Math.round(monthlyCTC * 0.20), annual: Math.round(annual_ctc * 0.20) },
      { component: 'Conveyance Allowance', perMonth: Math.round(monthlyCTC * 0.05), annual: Math.round(annual_ctc * 0.05) },
      { component: 'Medical Allowance', perMonth: Math.round(monthlyCTC * 0.05), annual: Math.round(annual_ctc * 0.05) },
      { component: 'Special Allowance', perMonth: Math.round(monthlyCTC * 0.18), annual: Math.round(annual_ctc * 0.18) },
      { component: 'Employer PF Contribution', perMonth: Math.round(monthlyCTC * 0.12), annual: Math.round(annual_ctc * 0.12) },
    ];

    // Adjust to match exact CTC
    const totalCalculated = breakdown.reduce((sum, item) => sum + item.annual, 0);
    const diff = annual_ctc - totalCalculated;
    if (diff !== 0) {
      breakdown[4].annual += diff; // Add difference to Special Allowance
      breakdown[4].perMonth = Math.round(breakdown[4].annual / 12);
    }

    res.json({
      annual_ctc,
      monthly_ctc: monthlyCTC,
      breakdown,
      candidate: {
        name: `${candidate.first_name} ${candidate.last_name || ''}`,
        email: candidate.email,
      }
    });
  } catch (error) {
    console.error('Error generating CTC:', error);
    res.status(500).json({ error: 'Failed to generate CTC breakdown' });
  }
});

// =====================================================
// AUTOMATED WORKFLOW SYSTEM
// =====================================================

// Screening thresholds (configurable)
const SCREENING_THRESHOLDS = {
  AUTO_SHORTLIST: 70,    // Score >= 70 -> auto shortlist for interview
  AUTO_REJECT: 40,       // Score < 40 -> auto reject
  INTERVIEW_PASS: 3.5,   // Interview score >= 3.5/5 -> selected
  INTERVIEW_FAIL: 2.5,   // Interview score < 2.5/5 -> rejected
};

// Auto-screen candidate based on JD criteria (Experience, Skills, Location)
router.post('/candidates/:id/auto-screen', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const candidate = db.prepare(`
      SELECT c.*, v.title as vacancy_title, v.requirements, v.skills_required,
        v.experience_min, v.experience_max, v.location as vacancy_location,
        v.job_description
      FROM candidates c
      LEFT JOIN vacancies v ON c.vacancy_id = v.id
      WHERE c.id = ? AND c.isActive = 1
    `).get(id) as any;

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const systemPrompt = `You are an HR screening assistant. Evaluate the candidate's profile against the job requirements.

CRITERIA TO CHECK:
1. Experience Match: Compare candidate's years of experience with required range
2. Skills Match: Check if candidate has required skills
3. Location Match: Check if candidate's location matches job location (if specified)

SCORING RULES:
- Experience: 30 points max (full points if within range, partial if close)
- Skills: 50 points max (based on skill match percentage)
- Location: 20 points max (full points if match or remote, partial if nearby)

Return a JSON response with:
{
  "screening_score": number (0-100),
  "experience_match": { "score": number, "reasoning": string, "candidate_exp": number, "required_range": string },
  "skills_match": { "score": number, "reasoning": string, "matched_skills": string[], "missing_skills": string[] },
  "location_match": { "score": number, "reasoning": string },
  "overall_analysis": string,
  "recommendation": "shortlist" | "maybe" | "reject",
  "auto_decision": boolean,
  "decision_reason": string
}`;

    const userPrompt = `Evaluate this candidate for automatic screening:

CANDIDATE PROFILE:
- Name: ${candidate.first_name} ${candidate.last_name || ''}
- Experience: ${candidate.experience_years || 0} years
- Current Role: ${candidate.current_designation || 'Not specified'} at ${candidate.current_company || 'Not specified'}
- Skills: ${candidate.skills || 'Not specified'}
- Location: ${candidate.city || ''} ${candidate.state || ''}
- Education: ${candidate.education || 'Not specified'}

JOB REQUIREMENTS:
- Position: ${candidate.vacancy_title || 'General'}
- Required Experience: ${candidate.experience_min || 0} - ${candidate.experience_max || 'No limit'} years
- Required Skills: ${candidate.skills_required || 'Not specified'}
- Job Location: ${candidate.vacancy_location || 'Not specified'}
- Requirements: ${candidate.requirements || 'Not specified'}

${candidate.resume_extracted_text ? `RESUME CONTENT:\n${candidate.resume_extracted_text.substring(0, 4000)}` : ''}

Based on the criteria, provide scoring and automatic decision:
- Score >= ${SCREENING_THRESHOLDS.AUTO_SHORTLIST}: Auto-shortlist for interview
- Score < ${SCREENING_THRESHOLDS.AUTO_REJECT}: Auto-reject
- Score in between: Needs manual review`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const screening = JSON.parse(completion.choices[0].message.content || '{}');

    // Determine automatic decision
    let newStatus = 'screening';
    let autoDecision = null;

    if (screening.screening_score >= SCREENING_THRESHOLDS.AUTO_SHORTLIST) {
      newStatus = 'shortlisted';
      autoDecision = 'shortlisted';
    } else if (screening.screening_score < SCREENING_THRESHOLDS.AUTO_REJECT) {
      newStatus = 'rejected';
      autoDecision = 'rejected';
    }

    // Update candidate with screening results and status
    db.prepare(`
      UPDATE candidates
      SET screening_score = ?, screening_notes = ?, status = ?,
          match_score_breakdown = ?, updatedAt = datetime('now')
      WHERE id = ?
    `).run(
      screening.screening_score,
      JSON.stringify(screening),
      newStatus,
      JSON.stringify({
        experience: screening.experience_match,
        skills: screening.skills_match,
        location: screening.location_match,
      }),
      id
    );

    // Log the workflow action
    db.prepare(`
      INSERT INTO recruitment_workflow_log (candidate_id, action, action_type, details, performed_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      id,
      `Auto-screening completed with score ${screening.screening_score}`,
      'auto_screen',
      JSON.stringify(screening),
      req.user!.userId
    );

    res.json({
      ...screening,
      new_status: newStatus,
      auto_decision: autoDecision,
      thresholds: SCREENING_THRESHOLDS,
    });
  } catch (error) {
    console.error('Error auto-screening candidate:', error);
    res.status(500).json({ error: 'Failed to auto-screen candidate' });
  }
});

// Batch auto-screen all new candidates for a vacancy
router.post('/vacancies/:id/auto-screen-candidates', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get all new candidates for this vacancy
    const candidates = db.prepare(`
      SELECT c.id FROM candidates c
      WHERE c.vacancy_id = ? AND c.isActive = 1 AND c.status = 'new'
    `).all(id) as { id: number }[];

    const results = {
      total: candidates.length,
      shortlisted: 0,
      rejected: 0,
      manual_review: 0,
      errors: 0,
    };

    // Screen each candidate
    for (const candidate of candidates) {
      try {
        // Call the auto-screen endpoint internally
        const candidateData = db.prepare(`
          SELECT c.*, v.title as vacancy_title, v.requirements, v.skills_required,
            v.experience_min, v.experience_max, v.location as vacancy_location
          FROM candidates c
          LEFT JOIN vacancies v ON c.vacancy_id = v.id
          WHERE c.id = ?
        `).get(candidate.id) as any;

        const systemPrompt = `You are an HR screening assistant. Quick evaluation - return JSON with:
{
  "screening_score": number (0-100),
  "recommendation": "shortlist" | "maybe" | "reject",
  "brief_reason": string
}`;

        const userPrompt = `Quick screen:
Candidate: ${candidateData.first_name} ${candidateData.last_name || ''}, ${candidateData.experience_years || 0} yrs exp
Skills: ${candidateData.skills || 'N/A'}
Required: ${candidateData.skills_required || 'N/A'}, ${candidateData.experience_min || 0}-${candidateData.experience_max || 'any'} yrs`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        });

        const screening = JSON.parse(completion.choices[0].message.content || '{}');

        let newStatus = 'screening';
        if (screening.screening_score >= SCREENING_THRESHOLDS.AUTO_SHORTLIST) {
          newStatus = 'shortlisted';
          results.shortlisted++;
        } else if (screening.screening_score < SCREENING_THRESHOLDS.AUTO_REJECT) {
          newStatus = 'rejected';
          results.rejected++;
        } else {
          results.manual_review++;
        }

        db.prepare(`
          UPDATE candidates SET screening_score = ?, screening_notes = ?, status = ?, updatedAt = datetime('now')
          WHERE id = ?
        `).run(screening.screening_score, JSON.stringify(screening), newStatus, candidate.id);

      } catch (err) {
        console.error(`Error screening candidate ${candidate.id}:`, err);
        results.errors++;
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Error batch screening:', error);
    res.status(500).json({ error: 'Failed to batch screen candidates' });
  }
});

// Submit interview score and auto-determine selection (score out of 5)
router.post('/interviews/:id/submit-score', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const {
      technical_skills,      // 1-5
      communication,         // 1-5
      problem_solving,       // 1-5
      cultural_fit,          // 1-5
      overall_performance,   // 1-5
      feedback,
      notes
    } = req.body;

    // Validate scores
    const scores = [technical_skills, communication, problem_solving, cultural_fit, overall_performance];
    for (const score of scores) {
      if (score === undefined || score < 1 || score > 5) {
        return res.status(400).json({ error: 'All scores must be between 1 and 5' });
      }
    }

    const interview = db.prepare(`
      SELECT i.*, c.first_name, c.last_name, c.resume_extracted_text, c.vacancy_id
      FROM interviews i
      LEFT JOIN candidates c ON i.candidate_id = c.id
      WHERE i.id = ? AND i.isActive = 1
    `).get(id) as any;

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // Calculate average score
    const avgScore = (technical_skills + communication + problem_solving + cultural_fit + overall_performance) / 5;

    // Determine automatic decision based on score
    let decision: 'selected' | 'rejected' | 'pending' = 'pending';
    let decisionReason = '';

    if (avgScore >= SCREENING_THRESHOLDS.INTERVIEW_PASS) {
      decision = 'selected';
      decisionReason = `Average score ${avgScore.toFixed(2)}/5 meets selection threshold (${SCREENING_THRESHOLDS.INTERVIEW_PASS})`;
    } else if (avgScore < SCREENING_THRESHOLDS.INTERVIEW_FAIL) {
      decision = 'rejected';
      decisionReason = `Average score ${avgScore.toFixed(2)}/5 below minimum threshold (${SCREENING_THRESHOLDS.INTERVIEW_FAIL})`;
    } else {
      decisionReason = `Average score ${avgScore.toFixed(2)}/5 requires manual review`;
    }

    // Update interview with scores
    db.prepare(`
      UPDATE interviews
      SET status = 'completed', rating = ?, feedback = ?, notes = ?,
          technical_skills_score = ?, communication_score = ?,
          problem_solving_score = ?, cultural_fit_score = ?,
          overall_performance_score = ?, updatedAt = datetime('now')
      WHERE id = ?
    `).run(avgScore, feedback, notes, technical_skills, communication, problem_solving, cultural_fit, overall_performance, id);

    // Create AI interview score record
    db.prepare(`
      INSERT INTO ai_interview_scores (
        candidate_id, interview_id, hr_feedback_raw,
        technical_skills_score, communication_score, problem_solving_score,
        cultural_fit_score, overall_performance_score, final_ai_score,
        ai_recommendation, selection_threshold_met
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      interview.candidate_id, id, feedback || '',
      technical_skills, communication, problem_solving, cultural_fit, overall_performance,
      avgScore, decision, decision === 'selected' ? 1 : 0
    );

    // Update candidate status based on decision
    let offerLetterGenerated = false;
    let offerLetterId: number | null = null;

    if (decision !== 'pending') {
      db.prepare(`
        UPDATE candidates SET status = ?, updatedAt = datetime('now')
        WHERE id = ?
      `).run(decision, interview.candidate_id);

      // ========== IF SELECTED, AUTO-GENERATE OFFER LETTER ==========
      if (decision === 'selected') {
        try {
          // Get full candidate details
          const candidateFull = db.prepare(`
            SELECT c.*, v.title as vacancy_title, v.department, v.location as work_location
            FROM candidates c
            LEFT JOIN vacancies v ON c.vacancy_id = v.id
            WHERE c.id = ?
          `).get(interview.candidate_id) as any;

          // Use expected salary or default
          const annualCTC = candidateFull?.expected_salary || 600000; // Default 6 LPA

          // Get RAG reference documents
          const ragDocs = db.prepare(`
            SELECT extracted_text FROM rag_documents
            WHERE status = 'completed' AND isActive = 1
            ORDER BY createdAt DESC LIMIT 3
          `).all() as { extracted_text: string }[];

          const ragContext = ragDocs.map(d => d.extracted_text || '').join('\n\n---\n\n').substring(0, 5000);

          // Get company defaults
          const companyDefaults = db.prepare(`
            SELECT setting_key, setting_value FROM rag_company_defaults WHERE isActive = 1
          `).all() as { setting_key: string; setting_value: string }[];

          const defaults: Record<string, string> = {};
          companyDefaults.forEach(d => { defaults[d.setting_key] = d.setting_value; });

          // Calculate salary breakdown
          const monthlyCTC = annualCTC / 12;
          const salaryBreakdown = [
            { component: 'Basic Salary', perMonth: Math.round(monthlyCTC * 0.40), annual: Math.round(annualCTC * 0.40) },
            { component: 'HRA', perMonth: Math.round(monthlyCTC * 0.20), annual: Math.round(annualCTC * 0.20) },
            { component: 'Special Allowance', perMonth: Math.round(monthlyCTC * 0.25), annual: Math.round(annualCTC * 0.25) },
            { component: 'Conveyance Allowance', perMonth: Math.round(monthlyCTC * 0.05), annual: Math.round(annualCTC * 0.05) },
            { component: 'Medical Allowance', perMonth: Math.round(monthlyCTC * 0.03), annual: Math.round(annualCTC * 0.03) },
            { component: 'PF (Employer)', perMonth: Math.round(monthlyCTC * 0.07), annual: Math.round(annualCTC * 0.07) },
          ];

          // Adjust to match exact CTC
          const totalCalc = salaryBreakdown.reduce((s, i) => s + i.annual, 0);
          if (totalCalc !== annualCTC) {
            salaryBreakdown[2].annual += (annualCTC - totalCalc);
            salaryBreakdown[2].perMonth = Math.round(salaryBreakdown[2].annual / 12);
          }

          // Generate offer letter content using AI
          const offerPrompt = `Generate a professional offer letter for ${candidateFull?.first_name} ${candidateFull?.last_name || ''} for the position of ${candidateFull?.vacancy_title || 'Software Engineer'} at ${defaults.company_name || 'Phoneme Solutions Pvt. Ltd.'}.

Annual CTC: ₹${annualCTC.toLocaleString()}
Location: ${candidateFull?.work_location || defaults.company_location || 'Noida'}

${ragContext ? `Reference format from previous letters:\n${ragContext.substring(0, 2000)}` : ''}

Return JSON with:
{
  "letter_content": string (full professional offer letter),
  "subject_line": string
}`;

          const offerCompletion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are an HR assistant generating professional offer letters. Keep it concise and professional.' },
              { role: 'user', content: offerPrompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
          });

          const offerContent = JSON.parse(offerCompletion.choices[0].message.content || '{}');

          // Create offer letter record
          const offerResult = db.prepare(`
            INSERT INTO offer_letters (
              candidate_name, candidate_address, designation, department, joining_date, probation_period,
              annual_ctc, salary_breakdown, letter_content, working_location, hr_manager_name, hr_manager_title,
              offer_valid_till, letter_date, status, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
          `).run(
            `${candidateFull?.first_name} ${candidateFull?.last_name || ''}`,
            candidateFull?.address || 'To be updated',
            candidateFull?.vacancy_title || 'Software Engineer',
            candidateFull?.department || 'Engineering',
            new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 15 days from now
            '6 months',
            annualCTC,
            JSON.stringify(salaryBreakdown),
            offerContent.letter_content || 'Offer letter content to be generated',
            candidateFull?.work_location || defaults.company_location || 'Noida',
            defaults.hr_manager_name || 'HR Manager',
            defaults.hr_manager_title || 'Manager-Human Resource',
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Valid for 7 days
            new Date().toISOString().split('T')[0],
            userId
          );

          offerLetterId = offerResult.lastInsertRowid as number;

          // Update candidate with offer letter reference
          db.prepare(`
            UPDATE candidates SET status = 'offer_generated', workflow_stage = 'offer_generated',
              offer_letter_id = ?, updatedAt = datetime('now')
            WHERE id = ?
          `).run(offerLetterId, interview.candidate_id);

          offerLetterGenerated = true;

          // Log offer letter generation
          db.prepare(`
            INSERT INTO recruitment_workflow_log (candidate_id, action, action_type, details, performed_by, is_automated)
            VALUES (?, ?, ?, ?, ?, 1)
          `).run(
            interview.candidate_id,
            `Offer letter auto-generated (ID: ${offerLetterId})`,
            'offer_generated',
            JSON.stringify({ offer_letter_id: offerLetterId, annual_ctc: annualCTC }),
            userId
          );

        } catch (offerError) {
          console.error('Auto offer letter generation error:', offerError);
          // Update status to selected even if offer generation fails
          db.prepare(`
            UPDATE candidates SET workflow_stage = 'offer_pending', updatedAt = datetime('now')
            WHERE id = ?
          `).run(interview.candidate_id);
        }
      }

      // Log workflow action
      db.prepare(`
        INSERT INTO recruitment_workflow_log (candidate_id, action, action_type, details, performed_by, is_automated)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(
        interview.candidate_id,
        `Auto-${decision} based on interview score ${avgScore.toFixed(2)}/5`,
        'auto_decision',
        JSON.stringify({ avgScore, scores: { technical_skills, communication, problem_solving, cultural_fit, overall_performance }, decision, decisionReason }),
        userId
      );
    }

    res.json({
      interview_id: id,
      candidate_id: interview.candidate_id,
      candidate_name: `${interview.first_name} ${interview.last_name || ''}`,
      scores: {
        technical_skills,
        communication,
        problem_solving,
        cultural_fit,
        overall_performance,
      },
      average_score: avgScore,
      decision,
      decision_reason: decisionReason,
      thresholds: {
        pass: SCREENING_THRESHOLDS.INTERVIEW_PASS,
        fail: SCREENING_THRESHOLDS.INTERVIEW_FAIL,
      },
      offer_letter_ready: decision === 'selected',
      offer_letter_generated: offerLetterGenerated,
      offer_letter_id: offerLetterId,
    });
  } catch (error) {
    console.error('Error submitting interview score:', error);
    res.status(500).json({ error: 'Failed to submit interview score' });
  }
});

// Auto-generate offer letter for selected candidate using RAG
router.post('/candidates/:id/auto-generate-offer', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { annual_ctc, designation, joining_date, probation_months = 6 } = req.body;

    const candidate = db.prepare(`
      SELECT c.*, v.title as vacancy_title, v.department, v.location as work_location
      FROM candidates c
      LEFT JOIN vacancies v ON c.vacancy_id = v.id
      WHERE c.id = ? AND c.isActive = 1 AND c.status = 'selected'
    `).get(id) as any;

    if (!candidate) {
      return res.status(404).json({ error: 'Selected candidate not found' });
    }

    // Get RAG reference documents (trained offer letters)
    const ragDocs = db.prepare(`
      SELECT extracted_text FROM rag_documents
      WHERE status = 'completed' AND isActive = 1 AND document_type IN ('offer_letter', 'salary_structure')
      ORDER BY createdAt DESC LIMIT 3
    `).all() as { extracted_text: string }[];

    const ragContext = ragDocs.map(d => d.extracted_text).join('\n\n---\n\n');

    // Get company defaults
    const companyDefaults = db.prepare(`
      SELECT setting_key, setting_value FROM rag_company_defaults WHERE isActive = 1
    `).all() as { setting_key: string; setting_value: string }[];

    const defaults: Record<string, string> = {};
    companyDefaults.forEach(d => { defaults[d.setting_key] = d.setting_value; });

    // Calculate salary breakdown
    const monthlyCTC = annual_ctc / 12;
    const salaryBreakdown = [
      { component: 'Basic Salary', perMonth: Math.round(monthlyCTC * 0.40), annual: Math.round(annual_ctc * 0.40) },
      { component: 'HRA', perMonth: Math.round(monthlyCTC * 0.20), annual: Math.round(annual_ctc * 0.20) },
      { component: 'Special Allowance', perMonth: Math.round(monthlyCTC * 0.25), annual: Math.round(annual_ctc * 0.25) },
      { component: 'Conveyance Allowance', perMonth: Math.round(monthlyCTC * 0.05), annual: Math.round(annual_ctc * 0.05) },
      { component: 'Medical Allowance', perMonth: Math.round(monthlyCTC * 0.03), annual: Math.round(annual_ctc * 0.03) },
      { component: 'PF (Employer)', perMonth: Math.round(monthlyCTC * 0.07), annual: Math.round(annual_ctc * 0.07) },
    ];

    // Adjust to match exact CTC
    const totalCalc = salaryBreakdown.reduce((s, i) => s + i.annual, 0);
    if (totalCalc !== annual_ctc) {
      salaryBreakdown[2].annual += (annual_ctc - totalCalc);
      salaryBreakdown[2].perMonth = Math.round(salaryBreakdown[2].annual / 12);
    }

    // Generate offer letter content using AI with RAG context
    const systemPrompt = `You are an HR assistant generating offer letters for Phoneme Solutions Pvt. Ltd.
Use the reference offer letters to match the company's tone and format.

REFERENCE DOCUMENTS:
${ragContext.substring(0, 6000)}

Generate a professional offer letter with:
1. Welcome paragraph
2. Position details (designation, department, reporting)
3. Compensation details
4. Benefits overview
5. Terms and conditions
6. Joining instructions
7. Closing paragraph

Return JSON with:
{
  "letter_content": string (the full letter with placeholders replaced),
  "subject_line": string,
  "key_terms": string[]
}`;

    const userPrompt = `Generate offer letter for:
- Candidate: ${candidate.first_name} ${candidate.last_name || ''}
- Position: ${designation || candidate.vacancy_title || 'Not specified'}
- Department: ${candidate.department || 'Engineering'}
- Location: ${candidate.work_location || defaults.company_location || 'Noida'}
- Annual CTC: ₹${annual_ctc.toLocaleString()}
- Joining Date: ${joining_date || 'To be confirmed'}
- Probation Period: ${probation_months} months

Company: ${defaults.company_name || 'Phoneme Solutions Pvt. Ltd.'}
Company Address: ${defaults.company_address || 'C-124 A, Sector 2, Noida – 201301'}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const offerContent = JSON.parse(completion.choices[0].message.content || '{}');

    // Create offer letter record
    const offerResult = db.prepare(`
      INSERT INTO offer_letters (
        candidate_name, designation, department, joining_date, probation_period,
        annual_ctc, salary_breakdown, letter_content, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
    `).run(
      `${candidate.first_name} ${candidate.last_name || ''}`,
      designation || candidate.vacancy_title,
      candidate.department || 'Engineering',
      joining_date,
      `${probation_months} months`,
      annual_ctc,
      JSON.stringify(salaryBreakdown),
      offerContent.letter_content,
      req.user!.userId
    );

    // Update candidate status
    db.prepare(`
      UPDATE candidates SET status = 'offer_generated', workflow_stage = 'offer_generated', updatedAt = datetime('now')
      WHERE id = ?
    `).run(id);

    // Log workflow
    db.prepare(`
      INSERT INTO recruitment_workflow_log (candidate_id, action, action_type, details, performed_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      id,
      'Offer letter auto-generated using RAG',
      'offer_generated',
      JSON.stringify({ offer_letter_id: offerResult.lastInsertRowid, annual_ctc }),
      req.user!.userId
    );

    res.json({
      success: true,
      offer_letter_id: offerResult.lastInsertRowid,
      candidate_name: `${candidate.first_name} ${candidate.last_name || ''}`,
      designation: designation || candidate.vacancy_title,
      annual_ctc,
      salary_breakdown: salaryBreakdown,
      letter_content: offerContent.letter_content,
      subject_line: offerContent.subject_line,
    });
  } catch (error) {
    console.error('Error auto-generating offer:', error);
    res.status(500).json({ error: 'Failed to auto-generate offer letter' });
  }
});

// Get workflow status for a candidate
router.get('/candidates/:id/workflow-status', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    const candidate = db.prepare(`
      SELECT c.*, v.title as vacancy_title
      FROM candidates c
      LEFT JOIN vacancies v ON c.vacancy_id = v.id
      WHERE c.id = ? AND c.isActive = 1
    `).get(id) as any;

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Get workflow logs
    const logs = db.prepare(`
      SELECT * FROM recruitment_workflow_log
      WHERE candidate_id = ?
      ORDER BY createdAt DESC
    `).all(id);

    // Get interviews
    const interviews = db.prepare(`
      SELECT * FROM interviews
      WHERE candidate_id = ? AND isActive = 1
      ORDER BY scheduled_date DESC
    `).all(id);

    // Get AI scores
    const aiScores = db.prepare(`
      SELECT * FROM ai_interview_scores
      WHERE candidate_id = ?
      ORDER BY scored_at DESC
    `).all(id);

    // Determine current stage
    let currentStage = 'new';
    const statusToStage: Record<string, string> = {
      'new': 'sourced',
      'screening': 'screening',
      'shortlisted': 'shortlisted',
      'rejected': 'rejected',
      'interview_scheduled': 'interview',
      'interviewed': 'scoring',
      'selected': 'selected',
      'offer_generated': 'offer',
      'offer_sent': 'offer_sent',
      'joined': 'joined',
    };
    currentStage = statusToStage[candidate.status] || candidate.status;

    res.json({
      candidate: {
        id: candidate.id,
        name: `${candidate.first_name} ${candidate.last_name || ''}`,
        status: candidate.status,
        vacancy_title: candidate.vacancy_title,
        screening_score: candidate.screening_score,
      },
      current_stage: currentStage,
      workflow_logs: logs,
      interviews,
      ai_scores: aiScores,
      stages: [
        { name: 'Sourced', key: 'sourced', completed: true },
        { name: 'AI Screening', key: 'screening', completed: ['screening', 'shortlisted', 'rejected', 'interview_scheduled', 'interviewed', 'selected', 'offer_generated', 'offer_sent', 'joined'].includes(candidate.status) },
        { name: 'Shortlisted', key: 'shortlisted', completed: ['shortlisted', 'interview_scheduled', 'interviewed', 'selected', 'offer_generated', 'offer_sent', 'joined'].includes(candidate.status) },
        { name: 'Interview', key: 'interview', completed: ['interviewed', 'selected', 'offer_generated', 'offer_sent', 'joined'].includes(candidate.status) },
        { name: 'AI Scoring', key: 'scoring', completed: ['selected', 'offer_generated', 'offer_sent', 'joined'].includes(candidate.status) },
        { name: 'Selected', key: 'selected', completed: ['selected', 'offer_generated', 'offer_sent', 'joined'].includes(candidate.status) },
        { name: 'Offer Letter', key: 'offer', completed: ['offer_generated', 'offer_sent', 'joined'].includes(candidate.status) },
        { name: 'Joined', key: 'joined', completed: candidate.status === 'joined' },
      ],
    });
  } catch (error) {
    console.error('Error fetching workflow status:', error);
    res.status(500).json({ error: 'Failed to fetch workflow status' });
  }
});

// Get automation settings
router.get('/automation/settings', authenticateToken, (req, res) => {
  try {
    res.json({
      thresholds: SCREENING_THRESHOLDS,
      features: {
        auto_screen: true,
        auto_decision: true,
        auto_offer: true,
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// =====================================================
// DASHBOARD STATS
// =====================================================

router.get('/stats', authenticateToken, (req, res) => {
  try {
    const stats = {
      vacancies: {
        total: (db.prepare('SELECT COUNT(*) as count FROM vacancies WHERE isActive = 1').get() as any).count,
        open: (db.prepare("SELECT COUNT(*) as count FROM vacancies WHERE isActive = 1 AND status = 'open'").get() as any).count,
        filled: (db.prepare("SELECT COUNT(*) as count FROM vacancies WHERE isActive = 1 AND status = 'filled'").get() as any).count,
      },
      candidates: {
        total: (db.prepare('SELECT COUNT(*) as count FROM candidates WHERE isActive = 1').get() as any).count,
        new: (db.prepare("SELECT COUNT(*) as count FROM candidates WHERE isActive = 1 AND status = 'new'").get() as any).count,
        shortlisted: (db.prepare("SELECT COUNT(*) as count FROM candidates WHERE isActive = 1 AND status = 'shortlisted'").get() as any).count,
        interviewing: (db.prepare("SELECT COUNT(*) as count FROM candidates WHERE isActive = 1 AND status IN ('interview_scheduled', 'interviewed')").get() as any).count,
        selected: (db.prepare("SELECT COUNT(*) as count FROM candidates WHERE isActive = 1 AND status = 'selected'").get() as any).count,
        offer_sent: (db.prepare("SELECT COUNT(*) as count FROM candidates WHERE isActive = 1 AND status = 'offer_sent'").get() as any).count,
        joined: (db.prepare("SELECT COUNT(*) as count FROM candidates WHERE isActive = 1 AND status = 'joined'").get() as any).count,
      },
      interviews: {
        scheduled: (db.prepare("SELECT COUNT(*) as count FROM interviews WHERE isActive = 1 AND status = 'scheduled'").get() as any).count,
        today: (db.prepare("SELECT COUNT(*) as count FROM interviews WHERE isActive = 1 AND scheduled_date = date('now')").get() as any).count,
        upcoming: (db.prepare("SELECT COUNT(*) as count FROM interviews WHERE isActive = 1 AND scheduled_date > date('now') AND status = 'scheduled'").get() as any).count,
      },
      hr_documents: (db.prepare('SELECT COUNT(*) as count FROM rag_documents WHERE isActive = 1 AND status = \'completed\'').get() as any).count,
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// =====================================================
// RESUME SCREENING - BULK UPLOAD WITH AI EXTRACTION
// =====================================================

// Configure multer for multiple resume uploads
const resumeScreeningUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads', 'resume-screening');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'screen-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and Word documents are allowed'));
    }
  }
});

// Screen multiple resumes against a JD
router.post('/screen-resumes', authenticateToken, resumeScreeningUpload.array('resumes', 20), async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { vacancy_id } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!vacancy_id) {
      return res.status(400).json({ error: 'vacancy_id is required' });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No resume files uploaded' });
    }

    // Get vacancy/JD details
    const vacancy = db.prepare(`
      SELECT * FROM vacancies WHERE id = ? AND isActive = 1
    `).get(vacancy_id) as any;

    if (!vacancy) {
      return res.status(404).json({ error: 'Vacancy not found' });
    }

    const screeningResults: any[] = [];

    // Process each resume
    for (const file of files) {
      try {
        const filePath = file.path;
        const fileBuffer = fs.readFileSync(filePath);
        const fileExt = path.extname(file.originalname).toLowerCase();

        // Step 1: Extract text from PDF or DOCX
        let resumeText = '';

        if (fileExt === '.pdf') {
          // Extract text from PDF using pdf-parse v2
          const pdfParser = new PDFParse({ data: fileBuffer });
          const textResult = await pdfParser.getText();
          resumeText = textResult.text;
          await pdfParser.destroy();
        } else if (fileExt === '.docx') {
          // Extract text from DOCX using mammoth
          const result = await mammoth.extractRawText({ buffer: fileBuffer });
          resumeText = result.value;
        } else if (fileExt === '.doc') {
          // For .doc files, try mammoth (may not work for all .doc files)
          try {
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            resumeText = result.value;
          } catch {
            throw new Error('Unable to parse .doc file. Please convert to .docx or .pdf');
          }
        }

        if (!resumeText || resumeText.trim().length < 50) {
          throw new Error('Could not extract text from resume. File may be image-based or corrupted.');
        }

        // Get JD required skills for skill-wise experience extraction
        const jdRequiredSkills = (vacancy.skills_required || '').split(',').map((s: string) => s.trim()).filter(Boolean);

        // Step 2: Extract structured data AND match against JD using AI (combined for smarter results)
        const extractionAndMatchingPrompt = `You are an expert HR recruiter screening resumes. Analyze this resume against the job requirements and provide detailed extraction and matching.

=== JOB REQUIREMENTS ===
Job Title: ${vacancy.title}
Required Experience: ${vacancy.experience_min || 0} - ${vacancy.experience_max || 10} years
Location: ${vacancy.location || 'Any'}
Required Skills: ${jdRequiredSkills.join(', ')}
Job Description: ${(vacancy.job_description || '').substring(0, 1000)}

=== RESUME TEXT ===
${resumeText.substring(0, 10000)}

=== YOUR TASK ===
Extract candidate info and INTELLIGENTLY match against the job requirements.

Return a JSON object:
{
  "candidate_name": "Full name",
  "email": "Email address",
  "phone": "Phone number",
  "current_role": "Current/Latest job title",
  "current_company": "Current/Latest employer",
  "location": "Current city/location",
  "notice_period": "Notice period if mentioned",
  "current_salary": number or null (annual INR),
  "expected_salary": number or null (annual INR),

  "total_experience": number (total years, calculate carefully from work history),
  "relevant_experience": number (years relevant to this specific job),

  "skills": ["ALL technical skills mentioned in resume - extract everything"],

  "skill_experience": {
    // For ALL skills from resume AND required skills, provide years of experience
    // Example: {"React": 3, "Node.js": 2, "Python": "No", "Java": 5}
    // Use number for years, "No" if skill not present in resume
    // Extract experience for EVERY skill mentioned in resume
  },

  "work_history": [
    // Extract ALL companies worked at (current + previous)
    {
      "company": "Company name",
      "role": "Job title/designation",
      "duration": "Jan 2020 - Present or 2 years",
      "years": number (years worked),
      "projects": ["Project 1 name", "Project 2 name"] // Projects worked on at this company
    }
  ],

  "projects": [
    // Any standalone projects or if projects not linked to specific company
    {
      "name": "Project name",
      "description": "Brief description",
      "technologies": ["Tech1", "Tech2"]
    }
  ],

  "education_details": [
    // ALL education - college AND school
    {
      "degree": "B.Tech in Computer Science / 12th Standard / 10th Standard",
      "institution": "College or School name",
      "year": "2020 or 2018-2020",
      "type": "college" | "school" | "certification"
    }
  ],

  "education": "Highest qualification summary",

  "matching_analysis": {
    "skills_match_score": number 0-100 (how well candidate's skills match requirements),
    "experience_match_score": number 0-100 (how well experience matches),
    "overall_fit_score": number 0-100 (overall job fit considering everything),
    "matched_skills": ["list of required skills the candidate HAS"],
    "missing_skills": ["list of required skills the candidate LACKS"],
    "strengths": ["2-3 key strengths for this role"],
    "concerns": ["any concerns or gaps"],
    "recommendation": "SHORTLIST" | "HOLD" | "REJECT",
    "recommendation_reason": "Brief explanation of recommendation"
  }
}

=== SCORING GUIDELINES ===
**Skills Match (most important):**
- Consider skill synonyms: React = ReactJS = React.js, Node = NodeJS = Node.js, etc.
- Consider related skills: If needs React and has React Native, partial credit
- Consider skill levels: Expert > Proficient > Familiar
- Score: 90-100 if has 80%+ required skills, 70-89 if has 60%+ skills, 50-69 if has 40%+ skills, <50 otherwise

**Experience Match:**
- Within range = 100
- Slightly below (within 1 year) = 80-90
- Moderately below (1-2 years) = 60-80
- Above range is usually fine = 85-95
- Way below (>2 years) = 40-60

**Overall Fit:**
- Consider: skills relevance, experience level, career progression, role alignment
- A React developer applying for React position = high fit
- A Java developer applying for React position with some React = medium fit
- Give benefit of doubt to candidates with transferable skills

**Recommendation:**
- SHORTLIST: Overall fit >= 70% AND has core required skills
- HOLD: Overall fit 50-69% OR missing some important skills but has potential
- REJECT: Overall fit < 50% OR missing critical required skills

TODAY'S DATE: ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;

        let extractedData: any = null;

        // Use GPT-4 for intelligent extraction and matching
        const extractionCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: extractionAndMatchingPrompt
            }
          ],
          response_format: { type: 'json_object' },
          max_tokens: 4000,
        });

        const extractionContent = extractionCompletion.choices[0].message.content || '{}';
        extractedData = JSON.parse(extractionContent);

        // Get AI's matching analysis
        const aiAnalysis = extractedData.matching_analysis || {};

        console.log('=== AI SCREENING ANALYSIS ===');
        console.log('Candidate:', extractedData.candidate_name);
        console.log('Total Experience:', extractedData.total_experience, 'years');
        console.log('Relevant Experience:', extractedData.relevant_experience, 'years');
        console.log('Skills Match Score:', aiAnalysis.skills_match_score);
        console.log('Experience Match Score:', aiAnalysis.experience_match_score);
        console.log('Overall Fit Score:', aiAnalysis.overall_fit_score);
        console.log('Matched Skills:', aiAnalysis.matched_skills);
        console.log('Missing Skills:', aiAnalysis.missing_skills);
        console.log('AI Recommendation:', aiAnalysis.recommendation);
        console.log('Reason:', aiAnalysis.recommendation_reason);

        // Use AI's overall fit score as the match score
        const matchScore = aiAnalysis.overall_fit_score || 50;

        // Use AI's analysis for strong matches and gaps
        const strongMatches: string[] = aiAnalysis.strengths || [];
        if (aiAnalysis.matched_skills && aiAnalysis.matched_skills.length > 0) {
          strongMatches.unshift(`${aiAnalysis.matched_skills.length} required skills matched: ${aiAnalysis.matched_skills.slice(0, 4).join(', ')}${aiAnalysis.matched_skills.length > 4 ? '...' : ''}`);
        }

        const gaps: string[] = aiAnalysis.concerns || [];
        if (aiAnalysis.missing_skills && aiAnalysis.missing_skills.length > 0) {
          gaps.unshift(`Missing skills: ${aiAnalysis.missing_skills.slice(0, 4).join(', ')}${aiAnalysis.missing_skills.length > 4 ? '...' : ''}`);
        }

        // Classify candidate - Use AI recommendation with score as backup
        let classification: 'shortlisted' | 'hold' | 'rejected';
        let rejectionReason: string | undefined;

        // First, use AI's recommendation if available
        const aiRecommendation = (aiAnalysis.recommendation || '').toUpperCase();
        if (aiRecommendation === 'SHORTLIST') {
          classification = 'shortlisted';
        } else if (aiRecommendation === 'HOLD') {
          classification = 'hold';
        } else if (aiRecommendation === 'REJECT') {
          classification = 'rejected';
          rejectionReason = aiAnalysis.recommendation_reason || 'Does not meet job requirements';
        } else {
          // Fallback to score-based classification
          if (matchScore >= 70) {
            classification = 'shortlisted';
          } else if (matchScore >= 50) {
            classification = 'hold';
          } else {
            classification = 'rejected';
            rejectionReason = gaps.length > 0 ? gaps[0] : 'Overall match score below threshold';
          }
        }

        // Generate HR-friendly summary using AI's analysis
        const candidateExp = extractedData.total_experience || 0;
        const summary = aiAnalysis.recommendation_reason ||
          `${extractedData.candidate_name || 'Candidate'} is a ${candidateExp}-year experienced ${extractedData.current_role || 'professional'} from ${extractedData.current_company || 'N/A'}. ` +
          `${strongMatches.length > 0 ? 'Strengths: ' + strongMatches.slice(0, 2).join('; ') + '. ' : ''}` +
          `${gaps.length > 0 ? 'Concerns: ' + gaps.slice(0, 2).join('; ') + '.' : ''}`;

        console.log(`=== FINAL RESULT: ${extractedData.candidate_name} ===`);
        console.log(`Score: ${matchScore}%, Classification: ${classification.toUpperCase()}`);

        screeningResults.push({
          file_name: file.originalname,
          file_path: file.filename,
          resume: {
            candidate_name: extractedData.candidate_name,
            email: extractedData.email,
            phone: extractedData.phone,
            skills: extractedData.skills || [],
            total_experience: candidateExp,
            relevant_experience: extractedData.relevant_experience || candidateExp,
            education: extractedData.education,
            current_role: extractedData.current_role,
            current_company: extractedData.current_company,
            location: extractedData.location,
            notice_period: extractedData.notice_period,
            current_salary: extractedData.current_salary,
            expected_salary: extractedData.expected_salary,
            skill_experience: extractedData.skill_experience || {},
            // New fields for detailed view
            work_history: extractedData.work_history || [],
            projects: extractedData.projects || [],
            education_details: extractedData.education_details || [],
          },
          match_score: matchScore,
          classification,
          strong_matches: strongMatches,
          gaps,
          summary,
          rejection_reason: rejectionReason,
          resume_text: resumeText,
          ai_analysis: aiAnalysis, // Include full AI analysis for reference
        });

      } catch (fileError: any) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
        screeningResults.push({
          file_name: file.originalname,
          error: `Failed to process: ${fileError.message}`,
          classification: 'rejected',
          rejection_reason: 'Failed to extract resume data',
        });
      }
    }

    res.json({
      success: true,
      vacancy: {
        id: vacancy.id,
        title: vacancy.title,
        department: vacancy.department,
        location: vacancy.location,
        experience_range: `${vacancy.experience_min || 0}-${vacancy.experience_max || 'any'} years`,
        skills_required: vacancy.skills_required,
      },
      results: screeningResults,
      summary: {
        total: screeningResults.length,
        shortlisted: screeningResults.filter(r => r.classification === 'shortlisted').length,
        hold: screeningResults.filter(r => r.classification === 'hold').length,
        rejected: screeningResults.filter(r => r.classification === 'rejected').length,
      }
    });

  } catch (error: any) {
    console.error('Error screening resumes:', error);
    res.status(500).json({ error: 'Failed to screen resumes', details: error.message });
  }
});

// Add screened candidates to database
router.post('/screen-resumes/confirm', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { vacancy_id, candidates } = req.body;

    if (!vacancy_id || !candidates || !Array.isArray(candidates)) {
      return res.status(400).json({ error: 'vacancy_id and candidates array required' });
    }

    const addedCandidates: any[] = [];
    const skippedCandidates: any[] = [];

    for (const candidate of candidates) {
      // Skip rejected candidates
      if (candidate.classification === 'rejected') {
        skippedCandidates.push({
          name: candidate.resume?.candidate_name,
          reason: 'Rejected during screening'
        });
        continue;
      }

      const resume = candidate.resume || {};

      // Check for duplicate email
      const existing = db.prepare('SELECT id FROM candidates WHERE email = ? AND isActive = 1').get(resume.email);
      if (existing) {
        skippedCandidates.push({
          name: resume.candidate_name,
          reason: 'Duplicate email'
        });
        continue;
      }

      // Determine status based on classification
      const status = candidate.classification === 'shortlisted' ? 'shortlisted' : 'screening';

      // Parse name into first and last
      const nameParts = (resume.candidate_name || 'Unknown').split(' ');
      const firstName = nameParts[0] || 'Unknown';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Insert candidate with skill experience data
      const result = db.prepare(`
        INSERT INTO candidates (
          vacancy_id, first_name, last_name, email, phone,
          current_company, current_designation, current_salary, expected_salary,
          experience_years, notice_period, skills, education,
          resume_path, resume_extracted_text, source, status,
          screening_score, screening_notes, skill_experience_data, screening_date, city, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        vacancy_id,
        firstName,
        lastName,
        resume.email || `unknown-${Date.now()}@temp.com`,
        resume.phone || null,
        resume.current_company || null,
        resume.current_role || null,
        resume.current_salary || null,
        resume.expected_salary || null,
        resume.total_experience || 0,
        resume.notice_period || null,
        Array.isArray(resume.skills) ? resume.skills.join(', ') : resume.skills || null,
        resume.education || null,
        candidate.file_path || null,
        candidate.resume_text || null,
        'other', // source - 'resume_screening' is not in allowed values, using 'other'
        status,
        candidate.match_score || 0,
        JSON.stringify({
          summary: candidate.summary,
          strong_matches: candidate.strong_matches,
          gaps: candidate.gaps,
          classification: candidate.classification
        }),
        JSON.stringify(resume.skill_experience || {}), // Skill-wise experience data
        new Date().toISOString().split('T')[0], // Screening date
        resume.location || null, // Store location in city field
        userId
      );

      const candidateId = result.lastInsertRowid as number;
      const newCandidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(candidateId) as any;
      // Include selectedForEmail flag from the request
      addedCandidates.push({
        ...newCandidate,
        selectedForEmail: candidate.selectedForEmail || false
      });
    }

    res.json({
      success: true,
      added: addedCandidates.length,
      skipped: skippedCandidates.length,
      addedCandidates,
      skippedCandidates
    });

  } catch (error: any) {
    console.error('Error adding screened candidates:', error);
    res.status(500).json({ error: 'Failed to add candidates', details: error.message });
  }
});

// =====================================================
// INTEREST EMAIL WORKFLOW
// =====================================================

// Helper function to build interest email body
function buildInterestEmailBody(candidate: any, formUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; }
    .button { display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: white !important; padding: 14px 32px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
    .button:hover { opacity: 0.9; }
    .info-box { background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .info-box ul { margin: 10px 0; padding-left: 20px; }
    .info-box li { margin: 8px 0; }
    .footer { padding: 20px; font-size: 12px; color: #666; text-align: center; background: #f9fafb; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Phoneme Solutions Pvt. Ltd.</h1>
    </div>
    <div class="content">
      <p>Dear <strong>${candidate.first_name} ${candidate.last_name || ''}</strong>,</p>

      <p>We have reviewed your profile for the <strong>${candidate.vacancy_title || 'open'}</strong> position at <strong>Phoneme Solutions Pvt. Ltd.</strong> and we are interested in taking your application forward.</p>

      <p><strong>Are you interested in this opportunity?</strong></p>

      <p>If <strong>YES</strong>, please fill out the short form below to confirm your interest and provide some details we need to schedule an interview.</p>

      <p style="text-align: center;">
        <a href="${formUrl}" class="button">Yes, I'm Interested - Fill Form</a>
      </p>

      <div class="info-box">
        <p><strong>The form will ask about:</strong></p>
        <ul>
          <li>Confirmation of your interest (Yes/No)</li>
          <li>Current CTC (in LPA)</li>
          <li>Expected CTC (in LPA)</li>
          <li>Notice Period</li>
          <li>Interview Availability</li>
        </ul>
      </div>

      <p style="color: #666; font-style: italic;">If you are <strong>not interested</strong> in this role, you can let us know by clicking the button above and selecting "No, Thanks" on the form.</p>

      <p>We look forward to hearing from you!</p>

      <p>Best regards,<br>
      <strong>HR Team</strong><br>
      Phoneme Solutions Pvt. Ltd.</p>
    </div>
    <div class="footer">
      <p>This email was sent regarding your application for ${candidate.vacancy_title || 'a position'} at Phoneme Solutions.</p>
      <p>If you did not apply for this position or are not interested, please ignore this email.</p>
    </div>
  </div>
</body>
</html>`;
}

// Send interest email to candidate (Authenticated)
router.post('/candidates/:id/send-interest-email', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { gmail_connection_id } = req.body;
    const userId = req.user!.userId;

    if (!gmail_connection_id) {
      return res.status(400).json({ error: 'gmail_connection_id is required' });
    }

    // Get candidate with vacancy details
    const candidate = db.prepare(`
      SELECT c.*, v.title as vacancy_title, v.location as vacancy_location, v.department as vacancy_department
      FROM candidates c
      LEFT JOIN vacancies v ON c.vacancy_id = v.id
      WHERE c.id = ? AND c.isActive = 1
    `).get(id) as any;

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    if (!candidate.email) {
      return res.status(400).json({ error: 'Candidate does not have an email address' });
    }

    // Check if email already sent
    if (candidate.interest_email_sent_date) {
      return res.status(400).json({
        error: 'Interest email already sent',
        sent_date: candidate.interest_email_sent_date
      });
    }

    // Generate unique form token
    const formToken = crypto.randomUUID();

    // Get Gmail connection
    const gmailConnection = db.prepare(`
      SELECT * FROM gmail_connections WHERE id = ? AND is_active = 1
    `).get(gmail_connection_id) as any;

    if (!gmailConnection) {
      return res.status(400).json({ error: 'Gmail connection not found or inactive' });
    }

    // Build secure localhost link for candidate response page
    const formUrl = `http://localhost:5173/candidate-response/${formToken}`;

    // Build email body
    const emailBody = buildInterestEmailBody(candidate, formUrl);

    // Send to actual candidate email (HR sends from their Gmail account)
    const recipientEmail = candidate.email;
    const recipientName = `${candidate.first_name} ${candidate.last_name || ''}`.trim();

    // Send email via Gmail API (from HR's connected Gmail account)
    console.log('Getting Gmail client for connection:', gmail_connection_id);
    const gmail = await getGmailClient(gmail_connection_id);
    console.log('Gmail client obtained successfully');

    const emailLines = [
      `To: ${recipientName} <${recipientEmail}>`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: Interest Confirmation - ${candidate.vacancy_title || 'Position'} at Phoneme Solutions`,
      '',
      emailBody
    ];

    const email = emailLines.join('\r\n');
    const encodedEmail = Buffer.from(email).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    console.log('Sending email to:', recipientEmail);
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedEmail }
    });
    console.log('Email sent successfully');

    // Update candidate with form token and sent date
    db.prepare(`
      UPDATE candidates
      SET form_token = ?,
          interest_email_sent_date = datetime('now'),
          is_interested = 'pending',
          updatedAt = datetime('now')
      WHERE id = ?
    `).run(formToken, id);

    // Log workflow action
    db.prepare(`
      INSERT INTO recruitment_workflow_log
      (candidate_id, action, action_type, details, performed_by, is_automated)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(
      id,
      'Interest email sent',
      'status_change',
      JSON.stringify({
        form_token: formToken,
        sent_to: recipientEmail,
        sent_from: gmailConnection.email
      }),
      userId
    );

    res.json({
      success: true,
      message: 'Interest email sent successfully',
      form_token: formToken,
      sent_at: new Date().toISOString(),
      sent_to: recipientEmail,
      sent_from: gmailConnection.email,
      note: `Email sent to ${recipientEmail} from ${gmailConnection.email}`
    });

  } catch (error: any) {
    console.error('Error sending interest email:', error);
    console.error('Error details:', error.response?.data || error.message);
    const errorMessage = error.response?.data?.error?.message
      || error.message
      || 'Failed to send interest email';
    res.status(500).json({ error: errorMessage, details: error.response?.data });
  }
});

// Batch send interest emails to multiple shortlisted candidates (Authenticated)
router.post('/candidates/batch-send-interest-emails', authenticateToken, async (req, res) => {
  try {
    const { candidate_ids, gmail_connection_id } = req.body;
    const userId = req.user!.userId;

    if (!gmail_connection_id) {
      return res.status(400).json({ error: 'gmail_connection_id is required' });
    }

    if (!candidate_ids || !Array.isArray(candidate_ids) || candidate_ids.length === 0) {
      return res.status(400).json({ error: 'candidate_ids array is required and must not be empty' });
    }

    // Get Gmail connection
    const gmailConnection = db.prepare(`
      SELECT * FROM gmail_connections WHERE id = ? AND is_active = 1
    `).get(gmail_connection_id) as any;

    if (!gmailConnection) {
      return res.status(400).json({ error: 'Gmail connection not found or inactive' });
    }

    // Get Gmail client once for all emails
    const gmail = await getGmailClient(gmail_connection_id);

    const results: Array<{
      candidate_id: number;
      email: string;
      status: 'sent' | 'skipped' | 'failed';
      message?: string;
    }> = [];

    for (const candidateId of candidate_ids) {
      try {
        // Get candidate with vacancy details
        const candidate = db.prepare(`
          SELECT c.*, v.title as vacancy_title, v.location as vacancy_location, v.department as vacancy_department
          FROM candidates c
          LEFT JOIN vacancies v ON c.vacancy_id = v.id
          WHERE c.id = ? AND c.isActive = 1
        `).get(candidateId) as any;

        if (!candidate) {
          results.push({
            candidate_id: candidateId,
            email: '',
            status: 'skipped',
            message: 'Candidate not found'
          });
          continue;
        }

        if (!candidate.email) {
          results.push({
            candidate_id: candidateId,
            email: '',
            status: 'skipped',
            message: 'No email address'
          });
          continue;
        }

        // Skip if email already sent
        if (candidate.interest_email_sent_date) {
          results.push({
            candidate_id: candidateId,
            email: candidate.email,
            status: 'skipped',
            message: 'Email already sent'
          });
          continue;
        }

        // Generate unique form token
        const formToken = crypto.randomUUID();

        // Build secure localhost link for candidate response page
        const formUrl = `http://localhost:5173/candidate-response/${formToken}`;

        // Build email body
        const emailBody = buildInterestEmailBody(candidate, formUrl);

        // Send to actual candidate email
        const recipientEmail = candidate.email;
        const recipientName = `${candidate.first_name} ${candidate.last_name || ''}`.trim();

        const emailLines = [
          `To: ${recipientName} <${recipientEmail}>`,
          'Content-Type: text/html; charset=utf-8',
          'MIME-Version: 1.0',
          `Subject: Interest Confirmation - ${candidate.vacancy_title || 'Position'} at Phoneme Solutions`,
          '',
          emailBody
        ];

        const email = emailLines.join('\r\n');
        const encodedEmail = Buffer.from(email).toString('base64')
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw: encodedEmail }
        });

        // Update candidate with form token and sent date
        db.prepare(`
          UPDATE candidates
          SET form_token = ?,
              interest_email_sent_date = datetime('now'),
              is_interested = 'pending',
              updatedAt = datetime('now')
          WHERE id = ?
        `).run(formToken, candidateId);

        // Log workflow action
        db.prepare(`
          INSERT INTO recruitment_workflow_log
          (candidate_id, action, action_type, details, performed_by, is_automated)
          VALUES (?, ?, ?, ?, ?, 1)
        `).run(
          candidateId,
          'Interest email sent (batch)',
          'status_change',
          JSON.stringify({
            form_token: formToken,
            sent_to: recipientEmail,
            sent_from: gmailConnection.email,
            batch_send: true
          }),
          userId
        );

        results.push({
          candidate_id: candidateId,
          email: recipientEmail,
          status: 'sent',
          message: 'Email sent successfully'
        });

      } catch (emailError: any) {
        console.error(`Error sending email to candidate ${candidateId}:`, emailError);
        results.push({
          candidate_id: candidateId,
          email: '',
          status: 'failed',
          message: emailError.message || 'Failed to send email'
        });
      }
    }

    const sentCount = results.filter(r => r.status === 'sent').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    res.json({
      success: true,
      message: `Batch email sending complete: ${sentCount} sent, ${skippedCount} skipped, ${failedCount} failed`,
      sent_count: sentCount,
      skipped_count: skippedCount,
      failed_count: failedCount,
      details: results
    });

  } catch (error: any) {
    console.error('Error in batch send interest emails:', error);
    res.status(500).json({
      error: error.message || 'Failed to send batch emails',
      details: error.response?.data
    });
  }
});

// Google Form Webhook - PUBLIC ENDPOINT (No Authentication)
// This endpoint receives form submissions from Google Apps Script
router.post('/webhooks/form-response', async (req, res) => {
  try {
    const {
      token,                    // Unique form token
      email,                    // Candidate email
      is_interested,            // yes/no
      current_ctc,              // Number in LPA
      expected_ctc,             // Number in LPA
      notice_period,            // String like "30 days", "Immediate"
      interview_availability,   // "tomorrow" or "preferred_date"
      preferred_date,           // ISO date string if preferred_date selected
      preferred_time            // Time string if preferred_date selected
    } = req.body;

    console.log('Received form response:', { token, email, is_interested });

    // Find candidate by token or email
    let candidate: any = null;

    if (token) {
      candidate = db.prepare(`
        SELECT * FROM candidates WHERE form_token = ? AND isActive = 1
      `).get(token);
    }

    // Fallback: find by email if token not provided or not found
    if (!candidate && email) {
      candidate = db.prepare(`
        SELECT * FROM candidates
        WHERE email = ? AND isActive = 1 AND is_interested = 'pending'
        ORDER BY updatedAt DESC LIMIT 1
      `).get(email);
    }

    if (!candidate) {
      console.error('Candidate not found. Token:', token, 'Email:', email);
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Check if already responded
    if (candidate.form_response_date) {
      return res.status(400).json({
        error: 'Response already submitted',
        response_date: candidate.form_response_date
      });
    }

    // Convert CTC to internal format (stored in annual amount, not LPA)
    // If CTC is in LPA, multiply by 100000 to get annual amount
    const currentSalary = current_ctc ? parseFloat(current_ctc) * 100000 : candidate.current_salary;
    const expectedSalary = expected_ctc ? parseFloat(expected_ctc) * 100000 : candidate.expected_salary;

    // Build preferred interview datetime
    let preferredInterviewDate = null;
    if (interview_availability === 'preferred_date' && preferred_date) {
      preferredInterviewDate = preferred_time
        ? `${preferred_date}T${preferred_time}`
        : preferred_date;
    }

    // Normalize is_interested value
    const normalizedInterest = is_interested?.toLowerCase() === 'yes' ? 'yes' : 'no';

    // Update candidate with form response
    db.prepare(`
      UPDATE candidates
      SET is_interested = ?,
          current_salary = ?,
          expected_salary = ?,
          notice_period = ?,
          interview_availability = ?,
          preferred_interview_date = ?,
          form_response_date = datetime('now'),
          status = CASE WHEN ? = 'yes' THEN 'interview_scheduled' ELSE status END,
          updatedAt = datetime('now')
      WHERE id = ?
    `).run(
      normalizedInterest,
      currentSalary,
      expectedSalary,
      notice_period || candidate.notice_period,
      interview_availability || 'tomorrow',
      preferredInterviewDate,
      normalizedInterest,
      candidate.id
    );

    // Auto-create interview if candidate is interested
    let interviewCreated = false;
    let interviewDate = '';
    let interviewTime = '';

    if (normalizedInterest === 'yes') {
      // Get a default interviewer (first admin or any active user)
      const defaultInterviewer = db.prepare(`
        SELECT id FROM users WHERE isActive = 1 ORDER BY role = 'admin' DESC, id ASC LIMIT 1
      `).get() as { id: number } | undefined;

      if (defaultInterviewer) {
        // Calculate interview date
        if (interview_availability === 'preferred_date' && preferred_date) {
          interviewDate = preferred_date;
          interviewTime = preferred_time || '10:00';
        } else {
          // "tomorrow" - use next business day
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          // Skip weekends
          while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
            tomorrow.setDate(tomorrow.getDate() + 1);
          }
          interviewDate = tomorrow.toISOString().split('T')[0];
          interviewTime = ''; // HR will set the time
        }

        // Create interview entry (always use 'scheduled' status)
        db.prepare(`
          INSERT INTO interviews (
            candidate_id, vacancy_id, interviewer_id, interview_type,
            scheduled_date, scheduled_time, duration_minutes,
            status, round_number, created_by, notes
          ) VALUES (?, ?, ?, 'hr', ?, ?, 60, 'scheduled', 1, ?, ?)
        `).run(
          candidate.id,
          candidate.vacancy_id,
          defaultInterviewer.id,
          interviewDate,
          interviewTime || '00:00',
          defaultInterviewer.id,
          interviewTime
            ? 'Auto-scheduled based on candidate availability'
            : 'TIME_PENDING - Candidate available tomorrow - HR to set time'
        );

        interviewCreated = true;
      }
    }

    // Log workflow action
    db.prepare(`
      INSERT INTO recruitment_workflow_log
      (candidate_id, action, action_type, details, performed_by, is_automated)
      VALUES (?, ?, ?, ?, NULL, 1)
    `).run(
      candidate.id,
      `Form response received: ${normalizedInterest === 'yes' ? 'Interested' : 'Not Interested'}${interviewCreated ? ' - Interview auto-scheduled' : ''}`,
      'status_change',
      JSON.stringify({
        is_interested: normalizedInterest,
        current_ctc,
        expected_ctc,
        notice_period,
        interview_availability,
        preferred_date: preferredInterviewDate,
        interview_created: interviewCreated,
        interview_date: interviewDate,
        interview_time: interviewTime
      })
    );

    console.log('Form response processed for candidate:', candidate.id, 'Interview created:', interviewCreated);

    // Return success (Google Apps Script expects 200 OK)
    res.json({
      success: true,
      message: 'Response recorded successfully',
      candidate_id: candidate.id,
      interview_created: interviewCreated
    });

  } catch (error: any) {
    console.error('Error processing form response:', error);
    res.status(500).json({ error: 'Failed to process response', details: error.message });
  }
});

// Manual update of interest details by HR (Authenticated)
router.patch('/candidates/:id/interest-details', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const {
      is_interested,
      current_salary,
      expected_salary,
      notice_period,
      interview_availability,
      preferred_interview_date
    } = req.body;

    const candidate = db.prepare(`
      SELECT * FROM candidates WHERE id = ? AND isActive = 1
    `).get(id) as any;

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (is_interested !== undefined) {
      updates.push('is_interested = ?');
      values.push(is_interested);
    }
    if (current_salary !== undefined) {
      updates.push('current_salary = ?');
      values.push(current_salary);
    }
    if (expected_salary !== undefined) {
      updates.push('expected_salary = ?');
      values.push(expected_salary);
    }
    if (notice_period !== undefined) {
      updates.push('notice_period = ?');
      values.push(notice_period);
    }
    if (interview_availability !== undefined) {
      updates.push('interview_availability = ?');
      values.push(interview_availability);
    }
    if (preferred_interview_date !== undefined) {
      updates.push('preferred_interview_date = ?');
      values.push(preferred_interview_date);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push("updatedAt = datetime('now')");
    values.push(id);

    db.prepare(`
      UPDATE candidates SET ${updates.join(', ')} WHERE id = ?
    `).run(...values);

    // Log manual update
    db.prepare(`
      INSERT INTO recruitment_workflow_log
      (candidate_id, action, action_type, details, performed_by, is_automated)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(
      id,
      'Interest details manually updated by HR',
      'manual_override',
      JSON.stringify(req.body),
      userId
    );

    const updatedCandidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(id);
    res.json(updatedCandidate);

  } catch (error: any) {
    console.error('Error updating interest details:', error);
    res.status(500).json({ error: 'Failed to update interest details', details: error.message });
  }
});

// =====================================================
// CANDIDATE RESPONSE PAGE ENDPOINTS (PUBLIC - No Auth)
// =====================================================

// Get candidate info by token (for response page)
router.get('/candidate-response/:token', (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const candidate = db.prepare(`
      SELECT
        c.id,
        c.first_name,
        c.last_name,
        c.email,
        c.form_token,
        c.is_interested,
        c.form_response_date,
        c.interest_email_sent_date,
        v.title as vacancy_title,
        v.department,
        v.location
      FROM candidates c
      LEFT JOIN vacancies v ON c.vacancy_id = v.id
      WHERE c.form_token = ? AND c.isActive = 1
    `).get(token) as any;

    if (!candidate) {
      return res.status(404).json({ error: 'Invalid or expired link' });
    }

    // Check if already responded
    if (candidate.form_response_date) {
      return res.status(200).json({
        already_submitted: true,
        message: 'You have already submitted your response. Thank you!',
        submitted_at: candidate.form_response_date
      });
    }

    res.json({
      candidate: {
        first_name: candidate.first_name,
        last_name: candidate.last_name,
        email: candidate.email,
        vacancy_title: candidate.vacancy_title,
        department: candidate.department,
        location: candidate.location
      }
    });

  } catch (error: any) {
    console.error('Error fetching candidate for response:', error);
    res.status(500).json({ error: 'Failed to load page' });
  }
});

// Submit candidate response (public)
router.post('/candidate-response/:token', (req, res) => {
  try {
    const { token } = req.params;
    const {
      is_interested,
      current_ctc,
      expected_ctc,
      notice_period,
      interview_availability,
      preferred_interview_date,
      preferred_interview_time
    } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Validate required fields
    if (!is_interested) {
      return res.status(400).json({ error: 'Please indicate if you are interested' });
    }

    const candidate = db.prepare(`
      SELECT * FROM candidates WHERE form_token = ? AND isActive = 1
    `).get(token) as any;

    if (!candidate) {
      return res.status(404).json({ error: 'Invalid or expired link' });
    }

    // Check if already responded
    if (candidate.form_response_date) {
      return res.status(400).json({
        error: 'You have already submitted your response',
        submitted_at: candidate.form_response_date
      });
    }

    // Convert CTC from LPA to annual amount (stored in paisa/full amount)
    const currentSalary = current_ctc ? parseFloat(current_ctc) * 100000 : null;
    const expectedSalary = expected_ctc ? parseFloat(expected_ctc) * 100000 : null;

    // Build preferred interview datetime
    let preferredDate = null;
    if (interview_availability === 'preferred_date' && preferred_interview_date) {
      preferredDate = preferred_interview_time
        ? `${preferred_interview_date}T${preferred_interview_time}`
        : preferred_interview_date;
    }

    // Update candidate with response
    db.prepare(`
      UPDATE candidates
      SET is_interested = ?,
          current_salary = COALESCE(?, current_salary),
          expected_salary = COALESCE(?, expected_salary),
          notice_period = COALESCE(?, notice_period),
          interview_availability = ?,
          preferred_interview_date = ?,
          form_response_date = datetime('now'),
          status = CASE WHEN ? = 'yes' THEN 'interview_scheduled' ELSE status END,
          updatedAt = datetime('now')
      WHERE id = ?
    `).run(
      is_interested,
      currentSalary,
      expectedSalary,
      notice_period,
      interview_availability || 'tomorrow',
      preferredDate,
      is_interested,
      candidate.id
    );

    // Auto-create interview if candidate is interested
    let interviewCreated = false;
    let interviewDate = '';
    let interviewTime = '';

    if (is_interested === 'yes') {
      // Get a default interviewer (first admin or any active user)
      const defaultInterviewer = db.prepare(`
        SELECT id FROM users WHERE isActive = 1 ORDER BY role = 'admin' DESC, id ASC LIMIT 1
      `).get() as { id: number } | undefined;

      if (defaultInterviewer) {
        // Calculate interview date
        if (interview_availability === 'preferred_date' && preferred_interview_date) {
          interviewDate = preferred_interview_date;
          interviewTime = preferred_interview_time || '10:00';
        } else {
          // "tomorrow" - use next business day
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          // Skip weekends
          while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
            tomorrow.setDate(tomorrow.getDate() + 1);
          }
          interviewDate = tomorrow.toISOString().split('T')[0];
          interviewTime = ''; // HR will set the time
        }

        // Create interview entry (always use 'scheduled' status)
        db.prepare(`
          INSERT INTO interviews (
            candidate_id, vacancy_id, interviewer_id, interview_type,
            scheduled_date, scheduled_time, duration_minutes,
            status, round_number, created_by, notes
          ) VALUES (?, ?, ?, 'hr', ?, ?, 60, 'scheduled', 1, ?, ?)
        `).run(
          candidate.id,
          candidate.vacancy_id,
          defaultInterviewer.id,
          interviewDate,
          interviewTime || '00:00',
          defaultInterviewer.id,
          interviewTime
            ? 'Auto-scheduled based on candidate availability'
            : 'TIME_PENDING - Candidate available tomorrow - HR to set time'
        );

        interviewCreated = true;
      }
    }

    // Log the response
    db.prepare(`
      INSERT INTO recruitment_workflow_log
      (candidate_id, action, action_type, details, performed_by, is_automated)
      VALUES (?, ?, ?, ?, NULL, 1)
    `).run(
      candidate.id,
      `Candidate responded: ${is_interested === 'yes' ? 'Interested' : 'Not Interested'}${interviewCreated ? ' - Interview auto-scheduled' : ''}`,
      'status_change',
      JSON.stringify({
        is_interested,
        current_ctc,
        expected_ctc,
        notice_period,
        interview_availability,
        preferred_interview_date: preferredDate,
        interview_created: interviewCreated,
        interview_date: interviewDate,
        interview_time: interviewTime
      })
    );

    console.log('Candidate response submitted:', candidate.id, is_interested, 'Interview created:', interviewCreated);

    res.json({
      success: true,
      message: is_interested === 'yes'
        ? interviewTime
          ? `Thank you! Your interview has been scheduled for ${interviewDate} at ${interviewTime}. Our HR team will send you the details shortly.`
          : 'Thank you! Your response has been recorded. Our HR team will contact you soon to confirm the interview time.'
        : 'Thank you for letting us know. We wish you all the best in your future endeavors.'
    });

  } catch (error: any) {
    console.error('Error submitting candidate response:', error);
    res.status(500).json({ error: 'Failed to submit response' });
  }
});

// =====================================================
// HEAD PERSON REVIEW ROUTES
// =====================================================

// Send candidates for head person review (sends email to multiple head persons)
router.post('/send-head-review', authenticateToken, async (req, res) => {
  try {
    const { vacancy_id, candidate_ids, reviewer_emails, gmail_connection_id } = req.body;
    const userId = (req as any).user?.id;

    console.log('Head review request:', { vacancy_id, candidate_ids, reviewer_emails: reviewer_emails?.length, gmail_connection_id, userId });

    if (!vacancy_id || !candidate_ids?.length || !reviewer_emails?.length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get vacancy details
    const vacancy = db.prepare(`
      SELECT v.*, d.name as department_name
      FROM vacancies v
      LEFT JOIN (SELECT 'Engineering' as name) d ON 1=1
      WHERE v.id = ? AND v.isActive = 1
    `).get(vacancy_id) as any;

    if (!vacancy) {
      return res.status(404).json({ error: 'Vacancy not found' });
    }

    // Get candidates details
    const candidateIdList = candidate_ids.join(',');
    const candidates = db.prepare(`
      SELECT id, first_name, last_name, email, phone, skills, experience_years,
             current_salary, expected_salary, notice_period, current_company, city,
             is_interested, interview_availability
      FROM candidates
      WHERE id IN (${candidateIdList}) AND isActive = 1
    `).all() as any[];

    if (candidates.length === 0) {
      return res.status(404).json({ error: 'No candidates found' });
    }

    // Get Gmail connection
    let gmailClient = null;
    let senderEmail = '';
    if (gmail_connection_id) {
      try {
        const gmailConnection = db.prepare('SELECT * FROM gmail_connections WHERE id = ? AND is_active = 1')
          .get(gmail_connection_id) as any;
        if (gmailConnection && gmailConnection.refresh_token) {
          gmailClient = await getGmailClient(gmail_connection_id); // Pass ID, not object
          senderEmail = gmailConnection.email;
        }
      } catch (gmailError: any) {
        console.error('Gmail connection error:', gmailError.message);
        // Continue without Gmail - will just create review links
      }
    }

    const results: { email: string; success: boolean; token?: string; error?: string }[] = [];

    for (const reviewerEmail of reviewer_emails) {
      try {
        // Generate unique token for each reviewer
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Valid for 7 days

        // Save token to database
        db.prepare(`
          INSERT INTO head_review_tokens (token, vacancy_id, reviewer_email, reviewer_name, candidate_ids, sent_by, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          token,
          vacancy_id,
          reviewerEmail.email || reviewerEmail,
          reviewerEmail.name || '',
          JSON.stringify(candidate_ids),
          userId || 1, // Default to user 1 if no userId
          expiresAt.toISOString()
        );

        // Build review link
        const reviewLink = `http://localhost:5173/head-review/${token}`;

        // Build candidates summary for email
        let candidatesSummary = candidates.map((c, i) => `
          ${i + 1}. ${c.first_name} ${c.last_name}
             - Experience: ${c.experience_years || 'N/A'} years
             - Current CTC: ${c.current_salary ? (c.current_salary / 100000).toFixed(1) + ' LPA' : 'N/A'}
             - Expected CTC: ${c.expected_salary ? (c.expected_salary / 100000).toFixed(1) + ' LPA' : 'N/A'}
             - Notice Period: ${c.notice_period || 'N/A'}
             - Interest: ${c.is_interested === 'yes' ? 'Interested' : c.is_interested === 'no' ? 'Not Interested' : 'Pending'}
        `).join('\n');

        // Email content
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0;">Phoneme Solutions Pvt. Ltd.</h1>
              <p style="color: #e0e7ff; margin: 5px 0 0;">Candidate Review Request</p>
            </div>
            <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
              <p style="color: #334155;">Dear ${reviewerEmail.name || 'Hiring Manager'},</p>
              <p style="color: #334155;">
                We have shortlisted <strong>${candidates.length} candidate(s)</strong> for the
                <strong>${vacancy.title}</strong> position. Please review their profiles and provide your availability for interviews.
              </p>

              <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h3 style="color: #1e293b; margin-top: 0;">Candidates Summary:</h3>
                <pre style="font-family: Arial, sans-serif; font-size: 13px; color: #475569; white-space: pre-wrap;">${candidatesSummary}</pre>
              </div>

              <div style="text-align: center; margin: 25px 0;">
                <a href="${reviewLink}"
                   style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
                          color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                  Review Candidates & Set Availability
                </a>
              </div>

              <p style="color: #64748b; font-size: 13px;">
                This link will expire in 7 days. You can select or deselect candidates for interview and
                provide your availability time.
              </p>

              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                This is an automated email from Phoneme HR System.
              </p>
            </div>
          </div>
        `;

        if (gmailClient) {
          // Send via Gmail
          const rawMessage = Buffer.from(
            `From: ${senderEmail}\r\n` +
            `To: ${reviewerEmail.email || reviewerEmail}\r\n` +
            `Subject: Candidate Review Required - ${vacancy.title}\r\n` +
            `MIME-Version: 1.0\r\n` +
            `Content-Type: text/html; charset=utf-8\r\n\r\n` +
            emailHtml
          ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

          await gmailClient.users.messages.send({
            userId: 'me',
            requestBody: { raw: rawMessage }
          });

          results.push({ email: reviewerEmail.email || reviewerEmail, success: true, token });
        } else {
          // No Gmail client - just save token and return link
          results.push({
            email: reviewerEmail.email || reviewerEmail,
            success: true,
            token,
            error: 'Email not sent - no Gmail connection. Review link created.'
          });
        }

      } catch (emailError: any) {
        console.error('Error sending to reviewer:', reviewerEmail, emailError);
        results.push({
          email: reviewerEmail.email || reviewerEmail,
          success: false,
          error: emailError.message
        });
      }
    }

    // Log the action
    db.prepare(`
      INSERT INTO recruitment_workflow_log
      (candidate_id, action, action_type, details, performed_by, is_automated)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(
      candidate_ids[0],
      `Sent ${candidates.length} candidates for head review to ${reviewer_emails.length} reviewer(s)`,
      'status_change',
      JSON.stringify({ reviewer_emails, candidate_ids, results }),
      userId || 1
    );

    res.json({
      success: true,
      message: `Review request sent to ${results.filter(r => r.success).length} reviewer(s)`,
      results
    });

  } catch (error: any) {
    console.error('Error sending head review:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to send review request', details: error.message });
  }
});

// Get head review page data (public - no auth)
router.get('/head-review/:token', (req, res) => {
  try {
    const { token } = req.params;

    // Find the review token
    const reviewToken = db.prepare(`
      SELECT hrt.*, v.title as vacancy_title, v.department, v.skills_required
      FROM head_review_tokens hrt
      JOIN vacancies v ON hrt.vacancy_id = v.id
      WHERE hrt.token = ?
    `).get(token) as any;

    if (!reviewToken) {
      return res.status(404).json({ error: 'Invalid or expired review link' });
    }

    // Check if expired
    if (new Date(reviewToken.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This review link has expired' });
    }

    // Check if already responded
    if (reviewToken.is_responded) {
      return res.json({
        already_submitted: true,
        message: 'Thank you! Your review has already been submitted.'
      });
    }

    // Get candidates
    const candidateIds = JSON.parse(reviewToken.candidate_ids);
    const candidates = db.prepare(`
      SELECT id, first_name, last_name, email, phone, skills, experience_years,
             current_salary, expected_salary, notice_period, current_company, city,
             is_interested, interview_availability, status
      FROM candidates
      WHERE id IN (${candidateIds.join(',')}) AND isActive = 1
    `).all();

    res.json({
      reviewInfo: {
        vacancy_title: reviewToken.vacancy_title,
        department: reviewToken.department,
        skills_required: reviewToken.skills_required,
        reviewer_email: reviewToken.reviewer_email,
        reviewer_name: reviewToken.reviewer_name,
        candidates
      }
    });

  } catch (error: any) {
    console.error('Error fetching head review:', error);
    res.status(500).json({ error: 'Failed to load review page' });
  }
});

// Submit head review response (public - no auth)
router.post('/head-review/:token', (req, res) => {
  try {
    const { token } = req.params;
    const { selectedCandidates, remarks, sameTimeForAll, commonInterviewDate, commonInterviewTime } = req.body;

    // Find the review token
    const reviewToken = db.prepare(`
      SELECT * FROM head_review_tokens WHERE token = ?
    `).get(token) as any;

    if (!reviewToken) {
      return res.status(404).json({ error: 'Invalid or expired review link' });
    }

    // Check if expired
    if (new Date(reviewToken.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This review link has expired' });
    }

    // Check if already responded
    if (reviewToken.is_responded) {
      return res.status(400).json({ error: 'You have already submitted your review' });
    }

    if (!selectedCandidates || selectedCandidates.length === 0) {
      return res.status(400).json({ error: 'Please select at least one candidate' });
    }

    // Get a default interviewer for creating interviews
    const defaultInterviewer = db.prepare(`
      SELECT id FROM users WHERE isActive = 1 ORDER BY role = 'admin' DESC, id ASC LIMIT 1
    `).get() as { id: number } | undefined;

    // Update candidates and create interviews based on selections
    for (const selection of selectedCandidates) {
      const { candidateId, interviewDateTime } = selection;

      // Parse interview date/time - use common time if sameTimeForAll, otherwise use individual time
      let interviewDate = '';
      let interviewTime = '';

      if (sameTimeForAll && commonInterviewDate) {
        interviewDate = commonInterviewDate;
        interviewTime = commonInterviewTime || '10:00';
      } else if (interviewDateTime) {
        const parts = interviewDateTime.split('T');
        interviewDate = parts[0] || '';
        interviewTime = parts[1] || '10:00';
      }

      // Update candidate status to shortlisted (head-approved)
      db.prepare(`
        UPDATE candidates
        SET status = 'interview_scheduled',
            head_review_approved = 1,
            head_review_date = datetime('now'),
            head_review_remarks = ?,
            updatedAt = datetime('now')
        WHERE id = ?
      `).run(remarks || '', candidateId);

      // Create interview if date is provided (even without a default interviewer)
      if (interviewDate) {
        const interviewerId = defaultInterviewer?.id || 1; // Fallback to ID 1 if no interviewer

        // Check if interview already exists
        const existingInterview = db.prepare(`
          SELECT id FROM interviews WHERE candidate_id = ? AND status != 'cancelled'
        `).get(candidateId);

        if (existingInterview) {
          // Update existing interview
          db.prepare(`
            UPDATE interviews
            SET scheduled_date = ?, scheduled_time = ?, notes = ?, updatedAt = datetime('now')
            WHERE id = ?
          `).run(interviewDate, interviewTime, `Updated by head reviewer: ${reviewToken.reviewer_email}`, (existingInterview as any).id);
        } else {
          // Create new interview
          db.prepare(`
            INSERT INTO interviews (
              candidate_id, vacancy_id, interviewer_id, interview_type,
              scheduled_date, scheduled_time, duration_minutes,
              status, round_number, created_by, notes
            ) VALUES (?, ?, ?, 'technical', ?, ?, 60, 'scheduled', 1, ?, ?)
          `).run(
            candidateId,
            reviewToken.vacancy_id,
            interviewerId,
            interviewDate,
            interviewTime,
            interviewerId,
            `Scheduled by head reviewer: ${reviewToken.reviewer_email}`
          );
        }
      }

      // Log the approval
      db.prepare(`
        INSERT INTO recruitment_workflow_log
        (candidate_id, action, action_type, details, performed_by, is_automated)
        VALUES (?, ?, ?, ?, NULL, 0)
      `).run(
        candidateId,
        `Approved by head reviewer: ${reviewToken.reviewer_email}`,
        'status_change',
        JSON.stringify({
          reviewer_email: reviewToken.reviewer_email,
          interview_datetime: interviewDateTime,
          remarks
        })
      );
    }

    // Mark candidates not selected as rejected/hold
    const allCandidateIds = JSON.parse(reviewToken.candidate_ids);
    const selectedIds = selectedCandidates.map((s: any) => s.candidateId);
    const rejectedIds = allCandidateIds.filter((id: number) => !selectedIds.includes(id));

    for (const rejectedId of rejectedIds) {
      db.prepare(`
        UPDATE candidates
        SET head_review_approved = 0,
            head_review_date = datetime('now'),
            head_review_remarks = ?,
            updatedAt = datetime('now')
        WHERE id = ?
      `).run(`Not selected by reviewer: ${reviewToken.reviewer_email}. ${remarks || ''}`, rejectedId);

      db.prepare(`
        INSERT INTO recruitment_workflow_log
        (candidate_id, action, action_type, details, performed_by, is_automated)
        VALUES (?, ?, ?, ?, NULL, 0)
      `).run(
        rejectedId,
        `Not selected by head reviewer: ${reviewToken.reviewer_email}`,
        'status_change',
        JSON.stringify({ reviewer_email: reviewToken.reviewer_email, remarks })
      );
    }

    // Mark token as responded
    db.prepare(`
      UPDATE head_review_tokens
      SET is_responded = 1,
          response_date = datetime('now'),
          response_data = ?
      WHERE id = ?
    `).run(
      JSON.stringify({ selectedCandidates, remarks, sameTimeForAll, commonInterviewDate, commonInterviewTime }),
      reviewToken.id
    );

    res.json({
      success: true,
      message: `Thank you! You have selected ${selectedCandidates.length} candidate(s) for interview. The HR team has been notified.`
    });

  } catch (error: any) {
    console.error('Error submitting head review:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// ========== SEND INTERVIEW INVITATION EMAIL ==========
router.post('/interviews/:id/send-invite', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      gmail_connection_id,
      additional_interviewers,  // Array of { name: string, email: string }
      custom_message,
      is_online,
      location_or_link
    } = req.body;
    const userId = req.user!.userId;

    if (!gmail_connection_id) {
      return res.status(400).json({ error: 'gmail_connection_id is required' });
    }

    // Get the interview with candidate and vacancy details
    const interview = db.prepare(`
      SELECT i.*,
             c.first_name, c.last_name, c.email as candidate_email, c.phone as candidate_phone,
             v.title as vacancy_title, v.department
      FROM interviews i
      JOIN candidates c ON i.candidate_id = c.id
      LEFT JOIN vacancies v ON i.vacancy_id = v.id
      WHERE i.id = ? AND i.isActive = 1
    `).get(id) as any;

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // Get interviewer details
    const interviewer = db.prepare(`
      SELECT id, name, email FROM users WHERE id = ?
    `).get(interview.interviewer_id) as any;

    // Get Gmail connection
    const gmailConnection = db.prepare(`
      SELECT * FROM gmail_connections WHERE id = ? AND is_active = 1
    `).get(gmail_connection_id) as any;

    if (!gmailConnection) {
      return res.status(400).json({ error: 'Gmail connection not found or inactive' });
    }

    // Format interview type for display
    const interviewTypeLabels: Record<string, string> = {
      hr: 'HR Round',
      technical: 'Technical Round',
      managerial: 'Managerial Round',
      final: 'Final Round'
    };
    const roundName = interviewTypeLabels[interview.interview_type] || interview.interview_type;

    // Format date
    const interviewDate = new Date(interview.scheduled_date);
    const formattedDate = interviewDate.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Format time
    const formattedTime = interview.scheduled_time || 'TBD';

    // Determine location/meeting info - use provided values or fall back to interview record
    const useOnline = is_online !== undefined ? is_online : Boolean(interview.meeting_link);
    const locationValue = location_or_link || (useOnline ? interview.meeting_link : interview.location) || '';

    const locationInfo = useOnline
      ? `<strong>Meeting Link:</strong> <a href="${locationValue}" target="_blank" style="display: inline-block; background: #2563eb; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; margin-top: 8px;">🔗 Join Meeting</a><br><span style="font-size: 12px; color: #6b7280; word-break: break-all;">${locationValue}</span>`
      : `<strong>Venue:</strong> ${locationValue || 'Our Office'}`;

    // Build interviewer list for display - ONLY from manually added interviewers
    const additionalNames = (additional_interviewers || [])
      .filter((i: any) => i.name && i.name.trim())
      .map((i: any) => i.name.trim());
    const interviewersList = additionalNames.length > 0 ? additionalNames.join(', ') : 'TBD';

    // Build CC list - ONLY from manually added interviewers (not system interviewer)
    const ccEmails: string[] = [];
    if (additional_interviewers && additional_interviewers.length > 0) {
      additional_interviewers.forEach((i: any) => {
        if (i.email && i.email.trim()) {
          ccEmails.push(`${i.name || ''} <${i.email.trim()}>`);
        }
      });
    }

    // Build email body
    const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
    .details-box { background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .detail-row { margin: 10px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
    .highlight { color: #2563eb; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">Interview Invitation</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">${interview.vacancy_title || 'Position'}</p>
    </div>
    <div class="content">
      <p>Dear <strong>${interview.first_name} ${interview.last_name || ''}</strong>,</p>

      <p>We are pleased to invite you for an interview for the position of <span class="highlight">${interview.vacancy_title || 'the open position'}</span> at Phoneme Solutions.</p>

      <div class="details-box">
        <h3 style="margin-top: 0; color: #374151;">Interview Details</h3>
        <div class="detail-row"><strong>Round:</strong> ${roundName} (Round ${interview.round_number})</div>
        <div class="detail-row"><strong>Date:</strong> ${formattedDate}</div>
        <div class="detail-row"><strong>Time:</strong> ${formattedTime}</div>
        <div class="detail-row"><strong>Duration:</strong> ${interview.duration_minutes || 60} minutes</div>
        <div class="detail-row">${locationInfo}</div>
        <div class="detail-row"><strong>Interviewer(s):</strong> ${interviewersList}</div>
      </div>

      ${custom_message ? `<p><strong>Additional Information:</strong></p><p>${custom_message}</p>` : ''}

      <p><strong>Please confirm your attendance</strong> by replying to this email at your earliest convenience.</p>

      <p>If you have any questions or need to reschedule, please don't hesitate to contact us.</p>

      <p>We look forward to meeting you!</p>

      <p>Best regards,<br>
      <strong>HR Team</strong><br>
      Phoneme Solutions</p>
    </div>
    <div class="footer">
      <p style="margin: 0; color: #6b7280; font-size: 12px;">
        This is an automated email from Phoneme Solutions Recruitment System
      </p>
    </div>
  </div>
</body>
</html>`;

    // Send email via Gmail API
    const gmail = await getGmailClient(gmail_connection_id);

    // Build email headers with CC for interviewers
    const emailLines = [
      `To: ${interview.first_name} ${interview.last_name || ''} <${interview.candidate_email}>`,
    ];

    // Add CC if there are interviewers to notify
    if (ccEmails.length > 0) {
      emailLines.push(`Cc: ${ccEmails.join(', ')}`);
    }

    emailLines.push(
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: Interview Invitation - ${roundName} for ${interview.vacancy_title || 'Position'} at Phoneme Solutions`,
      '',
      emailBody
    );

    const email = emailLines.join('\r\n');
    const encodedEmail = Buffer.from(email).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedEmail }
    });

    // Update interview with location/meeting link if provided
    if (location_or_link) {
      if (useOnline) {
        db.prepare(`UPDATE interviews SET meeting_link = ?, updatedAt = datetime('now') WHERE id = ?`).run(location_or_link, id);
      } else {
        db.prepare(`UPDATE interviews SET location = ?, updatedAt = datetime('now') WHERE id = ?`).run(location_or_link, id);
      }
    }

    // Update interview status to confirmed if it was scheduled
    if (interview.status === 'scheduled') {
      db.prepare(`
        UPDATE interviews
        SET status = 'confirmed',
            updatedAt = datetime('now')
        WHERE id = ?
      `).run(id);
    }

    // Log workflow action
    const ccEmailAddresses = ccEmails.map(cc => cc.match(/<(.+)>/)?.[1] || cc);
    db.prepare(`
      INSERT INTO recruitment_workflow_log
      (candidate_id, action, action_type, details, performed_by, is_automated)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(
      interview.candidate_id,
      `Interview invitation sent for ${roundName}`,
      'status_change',
      JSON.stringify({
        interview_id: id,
        round: roundName,
        date: interview.scheduled_date,
        time: interview.scheduled_time,
        location: useOnline ? location_or_link : interview.location,
        meeting_link: useOnline ? location_or_link : null,
        interviewers: interviewersList,
        sent_to: interview.candidate_email,
        cc_sent_to: ccEmailAddresses,
        sent_from: gmailConnection.email
      }),
      userId
    );

    res.json({
      success: true,
      message: 'Interview invitation sent successfully',
      sent_to: interview.candidate_email,
      sent_from: gmailConnection.email,
      cc_sent_to: ccEmailAddresses,
      interview_details: {
        round: roundName,
        date: formattedDate,
        time: formattedTime,
        location: useOnline ? 'Online' : locationValue
      }
    });

  } catch (error: any) {
    console.error('Error sending interview invitation:', error);
    const errorMessage = error.response?.data?.error?.message
      || error.message
      || 'Failed to send interview invitation';
    res.status(500).json({ error: errorMessage, details: error.response?.data });
  }
});

// Batch send interview invitations (Authenticated)
router.post('/interviews/batch-send-invites', authenticateToken, async (req, res) => {
  try {
    const { interview_ids, gmail_connection_id, additional_interviewers, custom_message } = req.body;
    const userId = req.user!.userId;

    if (!gmail_connection_id) {
      return res.status(400).json({ error: 'gmail_connection_id is required' });
    }

    if (!interview_ids || !Array.isArray(interview_ids) || interview_ids.length === 0) {
      return res.status(400).json({ error: 'interview_ids array is required and must not be empty' });
    }

    // Get Gmail connection
    const gmailConnection = db.prepare(`
      SELECT * FROM gmail_connections WHERE id = ? AND is_active = 1
    `).get(gmail_connection_id) as any;

    if (!gmailConnection) {
      return res.status(400).json({ error: 'Gmail connection not found or inactive' });
    }

    const gmail = await getGmailClient(gmail_connection_id);

    const results: { success: any[], failed: any[] } = { success: [], failed: [] };

    for (const interviewId of interview_ids) {
      try {
        // Get the interview with candidate and vacancy details
        const interview = db.prepare(`
          SELECT i.*,
                 c.first_name, c.last_name, c.email as candidate_email,
                 v.title as vacancy_title
          FROM interviews i
          JOIN candidates c ON i.candidate_id = c.id
          LEFT JOIN vacancies v ON i.vacancy_id = v.id
          WHERE i.id = ? AND i.isActive = 1
        `).get(interviewId) as any;

        if (!interview) {
          results.failed.push({ id: interviewId, error: 'Interview not found' });
          continue;
        }

        // Get interviewer details
        const interviewer = db.prepare(`
          SELECT name FROM users WHERE id = ?
        `).get(interview.interviewer_id) as any;

        // Format interview type
        const interviewTypeLabels: Record<string, string> = {
          hr: 'HR Round',
          technical: 'Technical Round',
          managerial: 'Managerial Round',
          final: 'Final Round'
        };
        const roundName = interviewTypeLabels[interview.interview_type] || interview.interview_type;

        // Format date
        const interviewDate = new Date(interview.scheduled_date);
        const formattedDate = interviewDate.toLocaleDateString('en-IN', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        // Determine if online or offline
        const isOnline = interview.meeting_link && interview.meeting_link.trim() !== '';
        const locationInfo = isOnline
          ? `<strong>Meeting Link:</strong> <a href="${interview.meeting_link}">${interview.meeting_link}</a>`
          : `<strong>Venue:</strong> ${interview.location || 'Our Office'}`;

        // Build interviewer list
        let interviewersList = interviewer ? interviewer.name : 'TBD';
        if (additional_interviewers && additional_interviewers.length > 0) {
          interviewersList += ', ' + additional_interviewers.join(', ');
        }

        // Build email body
        const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
    .details-box { background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">Interview Invitation</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">${interview.vacancy_title || 'Position'}</p>
    </div>
    <div class="content">
      <p>Dear <strong>${interview.first_name} ${interview.last_name || ''}</strong>,</p>

      <p>We are pleased to invite you for an interview for the position of <strong>${interview.vacancy_title || 'the open position'}</strong> at Phoneme Solutions.</p>

      <div class="details-box">
        <h3 style="margin-top: 0;">Interview Details</h3>
        <p><strong>Round:</strong> ${roundName} (Round ${interview.round_number})</p>
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Time:</strong> ${interview.scheduled_time || 'TBD'}</p>
        <p><strong>Duration:</strong> ${interview.duration_minutes || 60} minutes</p>
        <p>${locationInfo}</p>
        <p><strong>Interviewer(s):</strong> ${interviewersList}</p>
      </div>

      ${custom_message ? `<p><strong>Additional Information:</strong></p><p>${custom_message}</p>` : ''}

      <p>Please confirm your attendance by replying to this email.</p>

      <p>Best regards,<br><strong>HR Team</strong><br>Phoneme Solutions</p>
    </div>
    <div class="footer">
      <p style="margin: 0; color: #6b7280; font-size: 12px;">Phoneme Solutions Recruitment System</p>
    </div>
  </div>
</body>
</html>`;

        // Send email
        const emailLines = [
          `To: ${interview.first_name} ${interview.last_name || ''} <${interview.candidate_email}>`,
          'Content-Type: text/html; charset=utf-8',
          'MIME-Version: 1.0',
          `Subject: Interview Invitation - ${roundName} for ${interview.vacancy_title || 'Position'}`,
          '',
          emailBody
        ];

        const email = emailLines.join('\r\n');
        const encodedEmail = Buffer.from(email).toString('base64')
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw: encodedEmail }
        });

        // Update interview status
        if (interview.status === 'scheduled') {
          db.prepare(`
            UPDATE interviews SET status = 'confirmed', updatedAt = datetime('now') WHERE id = ?
          `).run(interviewId);
        }

        // Log workflow action
        db.prepare(`
          INSERT INTO recruitment_workflow_log
          (candidate_id, action, action_type, details, performed_by, is_automated)
          VALUES (?, ?, ?, ?, ?, 0)
        `).run(
          interview.candidate_id,
          `Interview invitation sent for ${roundName}`,
          'status_change',
          JSON.stringify({ interview_id: interviewId, sent_to: interview.candidate_email }),
          userId
        );

        results.success.push({
          id: interviewId,
          candidate: `${interview.first_name} ${interview.last_name || ''}`,
          email: interview.candidate_email
        });

      } catch (err: any) {
        results.failed.push({
          id: interviewId,
          error: err.message || 'Failed to send'
        });
      }
    }

    res.json({
      success: true,
      message: `Sent ${results.success.length} invitation(s), ${results.failed.length} failed`,
      results
    });

  } catch (error: any) {
    console.error('Error batch sending interview invitations:', error);
    res.status(500).json({ error: 'Failed to send interview invitations' });
  }
});

export default router;
