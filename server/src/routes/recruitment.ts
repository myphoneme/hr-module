import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import OpenAI from 'openai';
import pdfParse from 'pdf-parse';
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
      model: 'gpt-4o',
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
  "additional_notes": "any other details mentioned"
}

Important rules:
- Convert LPA to annual INR (e.g., "12 LPA" = 1200000)
- Convert "lakhs" to INR (e.g., "12 lakhs" = 1200000)
- Convert experience terms: "fresher" = 0-1, "junior" = 1-3, "mid-level" = 3-5, "senior" = 5-10
- Infer department from role (e.g., "React Developer" → "Engineering")
- Keep null for fields not explicitly or implicitly mentioned`;

    const extractionResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
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
      if (value !== null && value !== undefined && key !== 'additional_notes') {
        mergedData[key] = value;
      }
    }
    if (newExtraction.additional_notes) {
      mergedData.additional_notes = [
        mergedData.additional_notes,
        newExtraction.additional_notes
      ].filter(Boolean).join('. ');
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

      const jdPrompt = `You are an HR professional creating a job description. Generate a complete, professional job description.

${referenceDoc ? `Company reference for tone and style:\n${referenceDoc.extracted_text.substring(0, 2000)}\n\n` : ''}
Job Details:
- Role: ${mergedData.title}
- Department: ${mergedData.department || 'Not specified'}
- Experience: ${mergedData.experience_min || 0} - ${mergedData.experience_max || mergedData.experience_min + 2} years
- Location: ${mergedData.location}
- Salary: ₹${((mergedData.salary_min || 0) / 100000).toFixed(1)}L - ₹${((mergedData.salary_max || mergedData.salary_min * 1.3) / 100000).toFixed(1)}L per annum
- Employment Type: ${mergedData.employment_type?.replace('_', ' ') || 'Full Time'}
- Openings: ${mergedData.openings_count || 1}
${mergedData.additional_notes ? `- Additional Notes: ${mergedData.additional_notes}` : ''}

Generate a JSON response with:
{
  "job_summary": "2-3 sentence overview of the role",
  "responsibilities": ["responsibility 1", "responsibility 2", ...] (5-7 items),
  "skills_required": ["skill 1", "skill 2", ...] (5-8 items),
  "qualifications": "education and certification requirements",
  "requirements": ["requirement 1", "requirement 2", ...] (5-7 items),
  "benefits": ["benefit 1", "benefit 2", ...] (4-6 items)
}

Use industry-standard language for the ${mergedData.title} role. Be specific and professional.`;

      const jdResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: jdPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const jdContent = JSON.parse(jdResponse.choices[0].message.content || '{}');

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
        skills_required: Array.isArray(jdContent.skills_required)
          ? jdContent.skills_required.join(', ')
          : jdContent.skills_required,
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
          model: 'gpt-4o',
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
    if (req.file) {
      resume_path = req.file.filename;

      // Extract text from resume using AI
      try {
        const filePath = req.file.path;
        const fileBuffer = fs.readFileSync(filePath);
        const base64File = fileBuffer.toString('base64');

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
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

        resume_extracted_text = completion.choices[0].message.content;
      } catch (extractError) {
        console.error('Error extracting resume text:', extractError);
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
      vacancy_id || null, first_name, last_name, email, phone, address, city, state, pincode,
      current_company, current_designation, current_salary, expected_salary,
      experience_years, notice_period, skills, education, resume_path,
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
        const screenedCandidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(candidateId);
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
      model: 'gpt-4o',
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
      model: 'gpt-4o',
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
      model: 'gpt-4o',
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
      model: 'gpt-4o',
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
          // Extract text from PDF using pdf-parse
          const pdfData = await pdfParse(fileBuffer);
          resumeText = pdfData.text;
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

        // Step 2: Extract structured data from resume text using AI
        const extractionPrompt = `You are an expert HR assistant. Extract candidate information from this resume text.

RESUME TEXT:
${resumeText.substring(0, 8000)}

Return a JSON object with EXACTLY these fields (use null if not found, don't make up data):
{
  "candidate_name": "Full name of candidate",
  "email": "Email address",
  "phone": "Phone number with country code if available",
  "skills": ["Array", "of", "skills"],
  "total_experience": number (total years of experience, 0 if fresher),
  "relevant_experience": number (years relevant to current role),
  "education": "Highest qualification with institution",
  "current_role": "Current job title",
  "current_company": "Current employer name",
  "location": "Current city/location",
  "notice_period": "Notice period if mentioned",
  "current_salary": number or null (annual in INR if mentioned),
  "expected_salary": number or null (annual in INR if mentioned)
}

Be accurate - only extract what is clearly stated in the resume.`;

        let extractedData: any = null;

        // Use GPT-4 for text-based extraction (not vision API)
        const extractionCompletion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: extractionPrompt
            }
          ],
          response_format: { type: 'json_object' },
          max_tokens: 2000,
        });

        const extractionContent = extractionCompletion.choices[0].message.content || '{}';
        extractedData = JSON.parse(extractionContent);

        // Step 2: Match against JD and calculate score
        const jdSkills = (vacancy.skills_required || '').split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
        const candidateSkills = (extractedData.skills || []).map((s: string) => s.toLowerCase());
        const expMin = vacancy.experience_min || 0;
        const expMax = vacancy.experience_max || 99;
        const jdLocation = (vacancy.location || '').toLowerCase();
        const candidateExp = extractedData.total_experience || 0;
        const candidateLocation = (extractedData.location || '').toLowerCase();

        // Calculate skill match (40% weight)
        const matchingSkills = candidateSkills.filter((s: string) =>
          jdSkills.some((js: string) => js.includes(s) || s.includes(js))
        );
        const skillScore = jdSkills.length > 0 ? (matchingSkills.length / jdSkills.length) * 100 : 50;

        // Calculate experience match (35% weight)
        let expScore = 0;
        if (candidateExp >= expMin && candidateExp <= expMax) {
          expScore = 100;
        } else if (candidateExp < expMin) {
          expScore = Math.max(0, 100 - (expMin - candidateExp) * 20);
        } else {
          expScore = Math.max(60, 100 - (candidateExp - expMax) * 10);
        }

        // Calculate location match (15% weight)
        const locationScore = jdLocation && candidateLocation.includes(jdLocation) ? 100 :
                              jdLocation ? 50 : 75;

        // Calculate role relevance (10% weight)
        const roleScore = (vacancy.title || '').toLowerCase().includes((extractedData.current_role || '').toLowerCase()) ||
                          (extractedData.current_role || '').toLowerCase().includes((vacancy.title || '').toLowerCase()) ? 100 : 60;

        // Final weighted score
        const matchScore = Math.round(
          skillScore * 0.40 +
          expScore * 0.35 +
          locationScore * 0.15 +
          roleScore * 0.10
        );

        // Identify strong matches
        const strongMatches: string[] = [];
        if (skillScore >= 70) strongMatches.push(`${matchingSkills.length}/${jdSkills.length} required skills matched`);
        if (expScore === 100) strongMatches.push(`Experience (${candidateExp} yrs) within range`);
        if (locationScore === 100) strongMatches.push('Location match');
        if (roleScore === 100) strongMatches.push('Role relevance high');

        // Identify gaps
        const gaps: string[] = [];
        const missingSkills = jdSkills.filter((s: string) => !candidateSkills.some((cs: string) => cs.includes(s) || s.includes(cs)));
        if (missingSkills.length > 0) gaps.push(`Missing skills: ${missingSkills.slice(0, 3).join(', ')}${missingSkills.length > 3 ? '...' : ''}`);
        if (candidateExp < expMin) gaps.push(`Experience below minimum (${candidateExp} < ${expMin} yrs)`);
        if (candidateExp > expMax) gaps.push(`Experience above range (${candidateExp} > ${expMax} yrs)`);
        if (locationScore < 100 && jdLocation) gaps.push(`Location mismatch (${extractedData.location} vs ${vacancy.location})`);

        // Classify candidate
        let classification: 'shortlisted' | 'hold' | 'rejected';
        let rejectionReason: string | undefined;

        if (matchScore >= 70) {
          classification = 'shortlisted';
        } else if (matchScore >= 50) {
          classification = 'hold';
        } else {
          classification = 'rejected';
          rejectionReason = gaps.length > 0 ? gaps[0] : 'Overall match score below threshold';
        }

        // Generate HR-friendly summary
        const summary = `${extractedData.candidate_name || 'Candidate'} is a ${candidateExp}-year experienced ${extractedData.current_role || 'professional'} from ${extractedData.current_company || 'N/A'}. ` +
          `${strongMatches.length > 0 ? 'Strengths: ' + strongMatches.join('; ') + '. ' : ''}` +
          `${gaps.length > 0 ? 'Areas of concern: ' + gaps.join('; ') + '.' : ''}`;

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
          },
          match_score: matchScore,
          classification,
          strong_matches: strongMatches,
          gaps,
          summary,
          rejection_reason: rejectionReason,
          resume_text: resumeText,
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

      // Insert candidate
      const result = db.prepare(`
        INSERT INTO candidates (
          vacancy_id, first_name, last_name, email, phone,
          current_company, current_designation, current_salary, expected_salary,
          experience_years, notice_period, skills, education,
          resume_path, resume_extracted_text, source, status,
          screening_score, screening_notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        'resume_screening',
        status,
        candidate.match_score || 0,
        JSON.stringify({
          summary: candidate.summary,
          strong_matches: candidate.strong_matches,
          gaps: candidate.gaps,
          classification: candidate.classification
        }),
        userId
      );

      const candidateId = result.lastInsertRowid as number;
      const newCandidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(candidateId);
      addedCandidates.push(newCandidate);
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

export default router;
