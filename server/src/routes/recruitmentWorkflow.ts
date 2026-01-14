import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import OpenAI from 'openai';

const router = Router();
router.use(authenticateToken);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// =============================================
// TYPES
// =============================================

interface JDTemplate {
  id: number;
  name: string;
  department: string | null;
  template_content: string;
  skills_keywords: string | null;
  experience_level: string | null;
  is_default: number;
  created_by: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

interface NaukriConfig {
  id: number;
  api_key_encrypted: string | null;
  api_secret_encrypted: string | null;
  account_id: string | null;
  subscription_type: string;
  daily_search_limit: number;
  searches_today: number;
  is_active: number;
  created_by: number;
}

interface NaukriSearch {
  id: number;
  vacancy_id: number;
  search_query: string;
  search_params: string;
  total_results: number;
  candidates_imported: number;
  status: string;
  error_message: string | null;
  searched_by: number;
  createdAt: string;
}

interface AIInterviewScore {
  id: number;
  candidate_id: number;
  interview_id: number;
  hr_feedback_raw: string;
  technical_skills_score: number | null;
  technical_skills_reasoning: string | null;
  communication_score: number | null;
  communication_reasoning: string | null;
  problem_solving_score: number | null;
  problem_solving_reasoning: string | null;
  cultural_fit_score: number | null;
  cultural_fit_reasoning: string | null;
  overall_performance_score: number | null;
  overall_performance_reasoning: string | null;
  final_ai_score: number | null;
  ai_recommendation: string | null;
  selection_threshold_met: number;
  detailed_analysis: string | null;
}

interface SelectionThreshold {
  id: number;
  vacancy_id: number | null;
  department: string | null;
  min_screening_score: number;
  min_interview_score: number;
  auto_shortlist_threshold: number;
  auto_reject_threshold: number;
  is_default: number;
  created_by: number;
}

interface WorkflowStage {
  id: number;
  candidate_id: number;
  vacancy_id: number | null;
  current_stage: string;
  previous_stage: string | null;
  stage_started_at: string;
  stage_completed_at: string | null;
  stage_notes: string | null;
  updated_by: number | null;
}

// =============================================
// JD TEMPLATES ROUTES
// =============================================

// Get all JD templates
router.get('/jd-templates', (req: Request, res: Response): void => {
  try {
    const { department, experience_level, active_only } = req.query;

    let query = `
      SELECT jt.*, u.name as created_by_name
      FROM jd_templates jt
      LEFT JOIN users u ON jt.created_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (active_only !== 'false') {
      query += ' AND jt.isActive = 1';
    }

    if (department) {
      query += ' AND jt.department = ?';
      params.push(department);
    }

    if (experience_level) {
      query += ' AND jt.experience_level = ?';
      params.push(experience_level);
    }

    query += ' ORDER BY jt.is_default DESC, jt.createdAt DESC';

    const templates = db.prepare(query).all(...params);
    res.json(templates);
  } catch (error: any) {
    console.error('Error fetching JD templates:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch JD templates' });
  }
});

// Get single JD template
router.get('/jd-templates/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const template = db.prepare(`
      SELECT jt.*, u.name as created_by_name
      FROM jd_templates jt
      LEFT JOIN users u ON jt.created_by = u.id
      WHERE jt.id = ?
    `).get(id);

    if (!template) {
      res.status(404).json({ error: 'JD template not found' });
      return;
    }

    res.json(template);
  } catch (error: any) {
    console.error('Error fetching JD template:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch JD template' });
  }
});

// Create JD template
router.post('/jd-templates', requireAdmin, (req: Request, res: Response): void => {
  try {
    const { name, department, template_content, skills_keywords, experience_level, is_default } = req.body;
    const userId = req.user!.userId;

    if (!name || !template_content) {
      res.status(400).json({ error: 'Name and template_content are required' });
      return;
    }

    // If setting as default, unset other defaults
    if (is_default) {
      db.prepare('UPDATE jd_templates SET is_default = 0 WHERE department = ?').run(department || null);
    }

    const result = db.prepare(`
      INSERT INTO jd_templates (name, department, template_content, skills_keywords, experience_level, is_default, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, department || null, template_content, skills_keywords || null, experience_level || null, is_default ? 1 : 0, userId);

    const newTemplate = db.prepare('SELECT * FROM jd_templates WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newTemplate);
  } catch (error: any) {
    console.error('Error creating JD template:', error);
    res.status(500).json({ error: error.message || 'Failed to create JD template' });
  }
});

// Update JD template
router.put('/jd-templates/:id', requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const { name, department, template_content, skills_keywords, experience_level, is_default, isActive } = req.body;

    const existing = db.prepare('SELECT * FROM jd_templates WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'JD template not found' });
      return;
    }

    // If setting as default, unset other defaults
    if (is_default) {
      db.prepare('UPDATE jd_templates SET is_default = 0 WHERE department = ?').run(department || null);
    }

    db.prepare(`
      UPDATE jd_templates
      SET name = COALESCE(?, name),
          department = ?,
          template_content = COALESCE(?, template_content),
          skills_keywords = ?,
          experience_level = ?,
          is_default = COALESCE(?, is_default),
          isActive = COALESCE(?, isActive),
          updatedAt = datetime('now')
      WHERE id = ?
    `).run(
      name, department || null, template_content,
      skills_keywords || null, experience_level || null,
      is_default !== undefined ? (is_default ? 1 : 0) : null,
      isActive !== undefined ? (isActive ? 1 : 0) : null,
      id
    );

    const updated = db.prepare('SELECT * FROM jd_templates WHERE id = ?').get(id);
    res.json(updated);
  } catch (error: any) {
    console.error('Error updating JD template:', error);
    res.status(500).json({ error: error.message || 'Failed to update JD template' });
  }
});

// Delete JD template (soft delete)
router.delete('/jd-templates/:id', requireAdmin, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    db.prepare('UPDATE jd_templates SET isActive = 0, updatedAt = datetime(\'now\') WHERE id = ?').run(id);
    res.json({ message: 'JD template deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting JD template:', error);
    res.status(500).json({ error: error.message || 'Failed to delete JD template' });
  }
});

// =============================================
// ENHANCED JD GENERATION
// =============================================

// Generate JD using AI with templates
router.post('/vacancies/:id/generate-jd', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { template_id } = req.body;

    // Get vacancy details
    const vacancy = db.prepare('SELECT * FROM vacancies WHERE id = ?').get(id) as any;
    if (!vacancy) {
      res.status(404).json({ error: 'Vacancy not found' });
      return;
    }

    // Get template if specified
    let templateContent = '';
    if (template_id) {
      const template = db.prepare('SELECT * FROM jd_templates WHERE id = ? AND isActive = 1').get(template_id) as JDTemplate;
      if (template) {
        templateContent = template.template_content;
      }
    } else {
      // Get default template for department
      const defaultTemplate = db.prepare(`
        SELECT * FROM jd_templates
        WHERE (department = ? OR department IS NULL)
        AND isActive = 1
        ORDER BY department DESC, is_default DESC
        LIMIT 1
      `).get(vacancy.department) as JDTemplate;
      if (defaultTemplate) {
        templateContent = defaultTemplate.template_content;
      }
    }

    // Get company info from RAG learned patterns
    let companyContext = '';
    const companyDefaults = db.prepare(`
      SELECT setting_key, setting_value FROM rag_company_defaults
    `).all() as Array<{ setting_key: string; setting_value: string }>;

    if (companyDefaults.length > 0) {
      companyContext = companyDefaults.map(d => `${d.setting_key}: ${d.setting_value}`).join('\n');
    }

    const prompt = `You are an expert HR professional creating a job description.

COMPANY CONTEXT:
${companyContext || 'Standard professional company'}

${templateContent ? `REFERENCE TEMPLATE (for style and tone):\n${templateContent}\n` : ''}

POSITION DETAILS:
- Title: ${vacancy.title}
- Department: ${vacancy.department || 'Not specified'}
- Location: ${vacancy.location || 'Not specified'}
- Experience Required: ${vacancy.experience_min || 0} - ${vacancy.experience_max || 'Open'} years
- Employment Type: ${vacancy.employment_type || 'full_time'}
- Key Skills: ${vacancy.skills_required || 'Not specified'}

Generate a professional, comprehensive job description with the following sections:

1. JOB SUMMARY (2-3 impactful sentences about the role)
2. KEY RESPONSIBILITIES (6-8 action-oriented bullet points)
3. REQUIREMENTS (5-7 must-have qualifications)
4. PREFERRED QUALIFICATIONS (3-4 nice-to-have skills)
5. WHAT WE OFFER (4-5 benefits and perks)

Return as JSON with this structure:
{
  "job_summary": "string",
  "responsibilities": ["bullet1", "bullet2", ...],
  "requirements": ["req1", "req2", ...],
  "preferred_qualifications": ["qual1", "qual2", ...],
  "what_we_offer": ["benefit1", "benefit2", ...],
  "skills_extracted": ["skill1", "skill2", ...],
  "full_jd_text": "Complete formatted JD as a single text block"
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const generatedJD = JSON.parse(response.choices[0]?.message?.content || '{}');

    // Update vacancy with AI generated JD
    db.prepare(`
      UPDATE vacancies
      SET ai_generated_jd = ?,
          jd_status = 'ai_generated',
          jd_template_id = ?,
          job_description = COALESCE(?, job_description),
          responsibilities = COALESCE(?, responsibilities),
          requirements = COALESCE(?, requirements),
          benefits = COALESCE(?, benefits),
          skills_required = COALESCE(?, skills_required),
          updatedAt = datetime('now')
      WHERE id = ?
    `).run(
      JSON.stringify(generatedJD),
      template_id || null,
      generatedJD.full_jd_text || generatedJD.job_summary,
      JSON.stringify(generatedJD.responsibilities),
      JSON.stringify(generatedJD.requirements),
      JSON.stringify(generatedJD.what_we_offer),
      generatedJD.skills_extracted?.join(', ') || vacancy.skills_required,
      id
    );

    const updatedVacancy = db.prepare('SELECT * FROM vacancies WHERE id = ?').get(id);

    res.json({
      vacancy: updatedVacancy,
      generated_jd: generatedJD,
      message: 'JD generated successfully. Please review and approve.'
    });
  } catch (error: any) {
    console.error('Error generating JD:', error);
    res.status(500).json({ error: error.message || 'Failed to generate JD' });
  }
});

// Approve JD
router.post('/vacancies/:id/approve-jd', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const { edited_jd } = req.body;

    const vacancy = db.prepare('SELECT * FROM vacancies WHERE id = ?').get(id) as any;
    if (!vacancy) {
      res.status(404).json({ error: 'Vacancy not found' });
      return;
    }

    // If HR made edits, save them
    if (edited_jd) {
      db.prepare(`
        UPDATE vacancies
        SET job_description = ?,
            responsibilities = ?,
            requirements = ?,
            benefits = ?,
            jd_status = 'approved',
            updatedAt = datetime('now')
        WHERE id = ?
      `).run(
        edited_jd.job_description || vacancy.job_description,
        edited_jd.responsibilities ? JSON.stringify(edited_jd.responsibilities) : vacancy.responsibilities,
        edited_jd.requirements ? JSON.stringify(edited_jd.requirements) : vacancy.requirements,
        edited_jd.benefits ? JSON.stringify(edited_jd.benefits) : vacancy.benefits,
        id
      );
    } else {
      db.prepare(`
        UPDATE vacancies SET jd_status = 'approved', updatedAt = datetime('now') WHERE id = ?
      `).run(id);
    }

    const updated = db.prepare('SELECT * FROM vacancies WHERE id = ?').get(id);
    res.json({ vacancy: updated, message: 'JD approved successfully' });
  } catch (error: any) {
    console.error('Error approving JD:', error);
    res.status(500).json({ error: error.message || 'Failed to approve JD' });
  }
});

// =============================================
// NAUKRI INTEGRATION (Mocked until credentials available)
// =============================================

// Get Naukri config
router.get('/naukri/config', requireAdmin, (req: Request, res: Response): void => {
  try {
    const config = db.prepare('SELECT * FROM naukri_api_config ORDER BY id DESC LIMIT 1').get() as NaukriConfig | undefined;

    if (!config) {
      res.json({
        configured: false,
        message: 'Naukri API not configured. Please add your API credentials.'
      });
      return;
    }

    // Don't send encrypted keys to client
    res.json({
      configured: true,
      account_id: config.account_id,
      subscription_type: config.subscription_type,
      daily_search_limit: config.daily_search_limit,
      searches_today: config.searches_today,
      is_active: Boolean(config.is_active),
      has_api_key: !!config.api_key_encrypted,
      has_api_secret: !!config.api_secret_encrypted
    });
  } catch (error: any) {
    console.error('Error fetching Naukri config:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch Naukri config' });
  }
});

// Save Naukri config
router.post('/naukri/config', requireAdmin, (req: Request, res: Response): void => {
  try {
    const { api_key, api_secret, account_id, subscription_type, daily_search_limit } = req.body;
    const userId = req.user!.userId;

    // In production, encrypt the API keys before storing
    // For now, we'll store them as-is (marked as encrypted for future)
    const result = db.prepare(`
      INSERT INTO naukri_api_config (api_key_encrypted, api_secret_encrypted, account_id, subscription_type, daily_search_limit, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      api_key || null,
      api_secret || null,
      account_id || null,
      subscription_type || 'basic',
      daily_search_limit || 100,
      userId
    );

    res.status(201).json({
      message: 'Naukri API configured successfully',
      id: result.lastInsertRowid
    });
  } catch (error: any) {
    console.error('Error saving Naukri config:', error);
    res.status(500).json({ error: error.message || 'Failed to save Naukri config' });
  }
});

// Search Naukri for resumes using Python Scraper API
router.post('/naukri/search/:vacancyId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { vacancyId } = req.params;
    const userId = req.user!.userId;

    // Get vacancy
    const vacancy = db.prepare('SELECT * FROM vacancies WHERE id = ?').get(vacancyId) as any;
    if (!vacancy) {
      res.status(404).json({ error: 'Vacancy not found' });
      return;
    }

    // Build search params from JD
    const keywords = vacancy.title || '';
    const location = vacancy.location || '';

    // Create search record
    const searchResult = db.prepare(`
      INSERT INTO naukri_searches (vacancy_id, search_query, search_params, status, searched_by)
      VALUES (?, ?, ?, 'processing', ?)
    `).run(
      vacancyId,
      keywords,
      JSON.stringify({ keywords, location }),
      userId
    );

    const searchId = searchResult.lastInsertRowid;

    // Call Python scraper API
    const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000';

    try {
      const response = await fetch(`${PYTHON_API_URL}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords, location }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to scrape Naukri');
      }

      const data = await response.json();

      // Helper function to parse experience string properly
      const parseExperience = (expStr: string | undefined): number => {
        if (!expStr) return 0;

        const str = expStr.toLowerCase();
        let years = 0;
        let months = 0;

        // Match patterns like "X years" or "X yrs" or "X year"
        const yearMatch = str.match(/(\d+\.?\d*)\s*(years?|yrs?)/i);
        if (yearMatch) {
          years = parseFloat(yearMatch[1]) || 0;
        }

        // Match patterns like "X months" or "X mos" or "X month"
        const monthMatch = str.match(/(\d+\.?\d*)\s*(months?|mos?)/i);
        if (monthMatch) {
          months = parseFloat(monthMatch[1]) || 0;
        }

        // If no pattern matched, try to parse as a plain number (assume years)
        if (years === 0 && months === 0) {
          const plainNum = parseFloat(str.replace(/[^0-9.]/g, ''));
          if (!isNaN(plainNum)) {
            // If the number is >= 12, assume it's months
            if (plainNum >= 12) {
              months = plainNum;
            } else {
              years = plainNum;
            }
          }
        }

        // Convert to years (round to 1 decimal)
        const totalYears = years + (months / 12);
        return Math.round(totalYears * 10) / 10;
      };

      // Transform candidates to match our format
      const candidates = (data.candidates || []).map((c: any, index: number) => ({
        profile_id: `naukri_${Date.now()}_${index}`,
        name: c.name || 'Unknown',
        first_name: c.name?.split(' ')[0] || 'Unknown',
        last_name: c.name?.split(' ').slice(1).join(' ') || '',
        email: c.email || `candidate_${Date.now()}_${index}@imported.naukri`,
        phone: c.phone || null,
        current_designation: c.title || c.designation || null,
        current_company: c.company || null,
        experience_years: parseExperience(c.experience),
        location: c.location || null,
        skills: c.skills || [],
        current_salary: null,
        expected_salary: null,
      }));

      // Update search record
      db.prepare(`
        UPDATE naukri_searches
        SET status = 'completed', total_results = ?
        WHERE id = ?
      `).run(candidates.length, searchId);

      res.json({
        search_id: searchId,
        vacancy_id: vacancyId,
        total_results: candidates.length,
        candidates,
      });
    } catch (fetchError: any) {
      console.error('Python API error:', fetchError);

      // Update search record with error
      db.prepare(`
        UPDATE naukri_searches
        SET status = 'failed', error_message = ?
        WHERE id = ?
      `).run('Python API unavailable. Please start the Python scraper.', searchId);

      res.status(503).json({
        error: 'Naukri scraper not running',
        message: 'Please start the Python scraper: cd python && uvicorn app.main:app --reload --port 8000',
        search_id: searchId,
      });
    }
  } catch (error: any) {
    console.error('Error searching Naukri:', error);
    res.status(500).json({ error: error.message || 'Failed to search Naukri' });
  }
});

// Import candidates from Naukri search - FULLY AUTOMATED
// Flow: Import → Auto-Screen → Auto-Shortlist/Reject → Auto-Schedule Interview
router.post('/naukri/import-candidates', async (req: Request, res: Response): Promise<void> => {
  try {
    const { search_id, vacancy_id, candidates, auto_screen = false } = req.body;
    const userId = req.user!.userId;

    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      res.status(400).json({ error: 'No candidates to import' });
      return;
    }

    // Get vacancy details for screening
    const vacancy = db.prepare(`
      SELECT * FROM vacancies WHERE id = ? AND isActive = 1
    `).get(vacancy_id) as any;

    const imported: number[] = [];
    const duplicates: string[] = [];
    const shortlisted: { id: number; name: string; score: number }[] = [];
    const rejected: { id: number; name: string; score: number; reason: string }[] = [];

    // Get required skills from vacancy
    const requiredSkills = vacancy?.skills_required
      ? vacancy.skills_required.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];

    const screeningDate = new Date().toISOString().split('T')[0];

    for (const candidate of candidates) {
      // Check for duplicates by email
      const existing = db.prepare('SELECT id FROM candidates WHERE email = ?').get(candidate.email);

      if (existing) {
        duplicates.push(candidate.email);
        continue;
      }

      const firstName = candidate.first_name || candidate.name?.split(' ')[0] || 'Unknown';
      const lastName = candidate.last_name || candidate.name?.split(' ').slice(1).join(' ') || '';
      const candidateSkills = candidate.skills?.join(', ') || '';
      const experienceYears = candidate.experience_years || 0;

      // Extract skill-wise experience using AI if auto_screen is enabled
      let skillExperienceData: Record<string, number | string> = {};

      if (auto_screen && requiredSkills.length > 0) {
        try {
          const prompt = `Analyze this candidate's profile and estimate years of experience for each required skill.

CANDIDATE PROFILE:
- Name: ${firstName} ${lastName}
- Total Experience: ${experienceYears} years
- Current Role: ${candidate.current_designation || 'Not specified'}
- Current Company: ${candidate.current_company || 'Not specified'}
- Skills Listed: ${candidateSkills || 'Not specified'}

REQUIRED SKILLS TO EVALUATE:
${requiredSkills.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}

For each required skill, estimate the years of experience (0 if no experience, or a number up to total experience).
Base your estimates on:
- The candidate's total experience
- Their current role and company
- Their listed skills

Return ONLY a JSON object with skill names as keys and years as values (numbers only).
Example format:
{
  "Cisco": 3,
  "Python": 5,
  "AWS": 2
}`;

          const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.3,
          });

          const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');

          // Normalize skill names and values
          for (const skill of requiredSkills) {
            const matchedKey = Object.keys(parsed).find(
              k => k.toLowerCase().includes(skill.toLowerCase()) || skill.toLowerCase().includes(k.toLowerCase())
            );
            skillExperienceData[skill] = matchedKey ? (parsed[matchedKey] || 0) : 0;
          }
        } catch (aiError) {
          console.error('AI skill extraction failed:', aiError);
          // Fallback: set all skills to 0
          for (const skill of requiredSkills) {
            skillExperienceData[skill] = 0;
          }
        }
      }

      // Insert candidate
      const result = db.prepare(`
        INSERT INTO candidates (
          vacancy_id, first_name, last_name, email, phone,
          current_company, current_designation, current_salary, expected_salary,
          experience_years, skills, source, naukri_profile_id, naukri_search_id,
          skill_experience_data, screening_date,
          status, workflow_stage, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'job_portal', ?, ?, ?, ?, 'new', 'new', ?)
      `).run(
        vacancy_id,
        firstName,
        lastName,
        candidate.email,
        candidate.phone || null,
        candidate.current_company || null,
        candidate.current_designation || null,
        candidate.current_salary || null,
        candidate.expected_salary || null,
        experienceYears,
        candidateSkills,
        candidate.profile_id || null,
        search_id || null,
        Object.keys(skillExperienceData).length > 0 ? JSON.stringify(skillExperienceData) : null,
        screeningDate,
        userId
      );

      const candidateId = result.lastInsertRowid as number;
      imported.push(candidateId);

      // ========== AUTO-SCREENING ==========
      let screeningScore = 0;
      let screeningReason = '';

      if (auto_screen && vacancy) {
        // Calculate screening score based on JD criteria
        // Experience match (40 points)
        const expMin = vacancy.experience_min || 0;
        const expMax = vacancy.experience_max || 99;
        if (experienceYears >= expMin && experienceYears <= expMax) {
          screeningScore += 40;
        } else if (experienceYears >= expMin - 1 && experienceYears <= expMax + 1) {
          screeningScore += 25;
        }

        // Skills match based on extracted experience (50 points)
        if (Object.keys(skillExperienceData).length > 0) {
          let skillsWithExp = 0;
          for (const skill of requiredSkills) {
            const exp = skillExperienceData[skill];
            if (typeof exp === 'number' && exp > 0) {
              skillsWithExp++;
            }
          }
          const skillMatchPercent = requiredSkills.length > 0 ? (skillsWithExp / requiredSkills.length) * 50 : 25;
          screeningScore += Math.round(skillMatchPercent);
        } else {
          // Fallback to text matching
          const candidateSkillsList = candidateSkills.toLowerCase().split(',').map((s: string) => s.trim());
          let matchedSkills = 0;
          for (const skill of requiredSkills) {
            if (skill && candidateSkillsList.some((cs: string) => cs.includes(skill.toLowerCase()) || skill.toLowerCase().includes(cs))) {
              matchedSkills++;
            }
          }
          const skillMatchPercent = requiredSkills.length > 0 ? (matchedSkills / requiredSkills.length) * 50 : 25;
          screeningScore += Math.round(skillMatchPercent);
        }

        // Location match (10 points)
        screeningScore += 10;

        // Auto-decision thresholds
        const AUTO_SHORTLIST_THRESHOLD = 70;
        const AUTO_REJECT_THRESHOLD = 40;

        let newStatus = 'screening';
        let workflowStage = 'screened';

        if (screeningScore >= AUTO_SHORTLIST_THRESHOLD) {
          newStatus = 'shortlisted';
          workflowStage = 'shortlisted';
          screeningReason = `Auto-shortlisted: Score ${screeningScore}%`;
          shortlisted.push({ id: candidateId, name: `${firstName} ${lastName}`, score: screeningScore });
        } else if (screeningScore < AUTO_REJECT_THRESHOLD) {
          newStatus = 'rejected';
          workflowStage = 'rejected';
          screeningReason = `Auto-rejected: Score ${screeningScore}%`;
          rejected.push({ id: candidateId, name: `${firstName} ${lastName}`, score: screeningScore, reason: screeningReason });
        } else {
          screeningReason = `Score ${screeningScore}% - Manual review needed`;
        }

        // Update candidate with screening results
        db.prepare(`
          UPDATE candidates
          SET screening_score = ?, screening_notes = ?, status = ?, workflow_stage = ?, updatedAt = datetime('now')
          WHERE id = ?
        `).run(screeningScore, screeningReason, newStatus, workflowStage, candidateId);

        // Create workflow stage entry
        db.prepare(`
          INSERT INTO recruitment_workflow_stages (candidate_id, vacancy_id, current_stage, updated_by)
          VALUES (?, ?, ?, ?)
        `).run(candidateId, vacancy_id, workflowStage, userId);
      }
    }

    // Update search record
    if (search_id) {
      db.prepare(`
        UPDATE naukri_searches SET candidates_imported = candidates_imported + ?, status = 'completed' WHERE id = ?
      `).run(imported.length, search_id);
    }

    res.json({
      message: `Imported ${imported.length} candidates${auto_screen ? ' with AI Screening' : ''}`,
      imported_count: imported.length,
      duplicate_count: duplicates.length,
      imported_ids: imported,
      duplicates,
      required_skills: requiredSkills,
      automation_results: {
        shortlisted,
        rejected,
        interviews_scheduled: [],
        summary: {
          total_processed: imported.length,
          auto_shortlisted: shortlisted.length,
          auto_rejected: rejected.length,
          pending_review: imported.length - shortlisted.length - rejected.length,
          interviews_auto_scheduled: 0
        }
      }
    });
  } catch (error: any) {
    console.error('Error importing candidates:', error);
    res.status(500).json({ error: error.message || 'Failed to import candidates' });
  }
});

// Update candidate screening fields (CTC, notes)
router.patch('/candidates/:id/screening-fields', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const { current_salary, expected_salary, notes } = req.body;

    const candidate = db.prepare('SELECT id FROM candidates WHERE id = ?').get(id);
    if (!candidate) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (current_salary !== undefined) {
      updates.push('current_salary = ?');
      values.push(current_salary);
    }
    if (expected_salary !== undefined) {
      updates.push('expected_salary = ?');
      values.push(expected_salary);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }
    if (req.body.notice_period !== undefined) {
      updates.push('notice_period = ?');
      values.push(req.body.notice_period);
    }

    if (updates.length > 0) {
      updates.push("updatedAt = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE candidates SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare('SELECT * FROM candidates WHERE id = ?').get(id);
    res.json(updated);
  } catch (error: any) {
    console.error('Error updating candidate:', error);
    res.status(500).json({ error: error.message || 'Failed to update candidate' });
  }
});

// Get search history
router.get('/naukri/search-history', (req: Request, res: Response): void => {
  try {
    const { vacancy_id, limit = 50 } = req.query;

    let query = `
      SELECT ns.*, v.title as vacancy_title, u.name as searched_by_name
      FROM naukri_searches ns
      LEFT JOIN vacancies v ON ns.vacancy_id = v.id
      LEFT JOIN users u ON ns.searched_by = u.id
    `;
    const params: any[] = [];

    if (vacancy_id) {
      query += ' WHERE ns.vacancy_id = ?';
      params.push(vacancy_id);
    }

    query += ` ORDER BY ns.createdAt DESC LIMIT ?`;
    params.push(Number(limit));

    const searches = db.prepare(query).all(...params);
    res.json(searches);
  } catch (error: any) {
    console.error('Error fetching search history:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch search history' });
  }
});

// =============================================
// AI INTERVIEW SCORING
// =============================================

// Submit HR feedback and get AI score
router.post('/interviews/:id/ai-score', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { hr_feedback, strengths, weaknesses, technical_notes, communication_notes } = req.body;

    if (!hr_feedback) {
      res.status(400).json({ error: 'HR feedback is required' });
      return;
    }

    // Get interview details
    const interview = db.prepare(`
      SELECT i.*, c.first_name, c.last_name, c.experience_years, c.current_designation,
             v.title as vacancy_title, v.department, v.skills_required
      FROM interviews i
      JOIN candidates c ON i.candidate_id = c.id
      LEFT JOIN vacancies v ON i.vacancy_id = v.id
      WHERE i.id = ?
    `).get(id) as any;

    if (!interview) {
      res.status(404).json({ error: 'Interview not found' });
      return;
    }

    // Get selection thresholds
    const threshold = db.prepare(`
      SELECT * FROM selection_thresholds
      WHERE (vacancy_id = ? OR vacancy_id IS NULL)
      ORDER BY vacancy_id DESC, is_default DESC
      LIMIT 1
    `).get(interview.vacancy_id) as SelectionThreshold | undefined;

    const minInterviewScore = threshold?.min_interview_score || 3.5;

    // AI scoring prompt
    const prompt = `You are an expert HR evaluator analyzing interview feedback.

CANDIDATE INFORMATION:
- Name: ${interview.first_name} ${interview.last_name}
- Experience: ${interview.experience_years || 'Not specified'} years
- Current Role: ${interview.current_designation || 'Not specified'}
- Applied For: ${interview.vacancy_title || 'Not specified'}

INTERVIEW DETAILS:
- Type: ${interview.interview_type}
- Round: ${interview.round_number}

HR'S RAW FEEDBACK:
${hr_feedback}

${strengths ? `STRENGTHS NOTED:\n${strengths}` : ''}
${weaknesses ? `WEAKNESSES NOTED:\n${weaknesses}` : ''}
${technical_notes ? `TECHNICAL NOTES:\n${technical_notes}` : ''}
${communication_notes ? `COMMUNICATION NOTES:\n${communication_notes}` : ''}

SELECTION THRESHOLD: ${minInterviewScore}/5

Evaluate the candidate on these 5 criteria (score 1-5 with one decimal):

1. TECHNICAL SKILLS - Knowledge depth, practical application, learning ability
2. COMMUNICATION - Clarity, articulation, listening skills, professionalism
3. PROBLEM SOLVING - Analytical thinking, approach methodology, creativity
4. CULTURAL FIT - Team compatibility, value alignment, adaptability
5. OVERALL PERFORMANCE - Interview presence, enthusiasm, potential

Return JSON:
{
  "scores": {
    "technical_skills": { "score": number, "reasoning": "explanation" },
    "communication": { "score": number, "reasoning": "explanation" },
    "problem_solving": { "score": number, "reasoning": "explanation" },
    "cultural_fit": { "score": number, "reasoning": "explanation" },
    "overall_performance": { "score": number, "reasoning": "explanation" }
  },
  "final_score": number (weighted average),
  "recommendation": "strong_hire" | "hire" | "borderline" | "no_hire" | "strong_no_hire",
  "meets_threshold": boolean,
  "detailed_analysis": "comprehensive summary",
  "key_strengths": ["str1", "str2", "str3"],
  "areas_for_development": ["area1", "area2"],
  "risk_factors": ["risk1"] or []
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const aiResult = JSON.parse(response.choices[0]?.message?.content || '{}');

    // Save AI score
    const result = db.prepare(`
      INSERT INTO ai_interview_scores (
        candidate_id, interview_id, hr_feedback_raw,
        technical_skills_score, technical_skills_reasoning,
        communication_score, communication_reasoning,
        problem_solving_score, problem_solving_reasoning,
        cultural_fit_score, cultural_fit_reasoning,
        overall_performance_score, overall_performance_reasoning,
        final_ai_score, ai_recommendation, selection_threshold_met,
        detailed_analysis, key_strengths, areas_for_development, risk_factors
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      interview.candidate_id,
      id,
      hr_feedback,
      aiResult.scores?.technical_skills?.score,
      aiResult.scores?.technical_skills?.reasoning,
      aiResult.scores?.communication?.score,
      aiResult.scores?.communication?.reasoning,
      aiResult.scores?.problem_solving?.score,
      aiResult.scores?.problem_solving?.reasoning,
      aiResult.scores?.cultural_fit?.score,
      aiResult.scores?.cultural_fit?.reasoning,
      aiResult.scores?.overall_performance?.score,
      aiResult.scores?.overall_performance?.reasoning,
      aiResult.final_score,
      aiResult.recommendation,
      aiResult.meets_threshold ? 1 : 0,
      aiResult.detailed_analysis,
      JSON.stringify(aiResult.key_strengths || []),
      JSON.stringify(aiResult.areas_for_development || []),
      JSON.stringify(aiResult.risk_factors || [])
    );

    // Update interview status
    db.prepare(`
      UPDATE interviews
      SET status = 'completed', rating = ?, recommendation = ?, feedback = ?, updatedAt = datetime('now')
      WHERE id = ?
    `).run(
      Math.round(aiResult.final_score),
      aiResult.recommendation,
      hr_feedback,
      id
    );

    // Update candidate's final interview score and workflow stage
    db.prepare(`
      UPDATE candidates
      SET final_interview_score = ?, workflow_stage = 'interview_scored', updatedAt = datetime('now')
      WHERE id = ?
    `).run(aiResult.final_score, interview.candidate_id);

    // Log workflow stage change
    db.prepare(`
      INSERT INTO workflow_stage_history (candidate_id, vacancy_id, from_stage, to_stage, is_automated, metadata)
      VALUES (?, ?, 'interview_completed', 'interview_scored', 1, ?)
    `).run(
      interview.candidate_id,
      interview.vacancy_id,
      JSON.stringify({ ai_score: aiResult.final_score, recommendation: aiResult.recommendation })
    );

    const savedScore = db.prepare('SELECT * FROM ai_interview_scores WHERE id = ?').get(result.lastInsertRowid);

    res.json({
      ai_score: savedScore,
      meets_threshold: aiResult.meets_threshold,
      threshold: minInterviewScore,
      recommendation: aiResult.recommendation,
      message: aiResult.meets_threshold
        ? 'Candidate meets selection threshold'
        : 'Candidate below selection threshold'
    });
  } catch (error: any) {
    console.error('Error generating AI score:', error);
    res.status(500).json({ error: error.message || 'Failed to generate AI score' });
  }
});

// Get AI scores for a candidate
router.get('/candidates/:id/interview-scores', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const scores = db.prepare(`
      SELECT ais.*, i.interview_type, i.round_number, i.scheduled_date
      FROM ai_interview_scores ais
      JOIN interviews i ON ais.interview_id = i.id
      WHERE ais.candidate_id = ?
      ORDER BY ais.scored_at DESC
    `).all(id);

    res.json(scores);
  } catch (error: any) {
    console.error('Error fetching interview scores:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch interview scores' });
  }
});

// =============================================
// SELECTION THRESHOLDS
// =============================================

// Get selection thresholds
router.get('/selection-thresholds', (req: Request, res: Response): void => {
  try {
    const { vacancy_id } = req.query;

    let query = `
      SELECT st.*, v.title as vacancy_title, u.name as created_by_name
      FROM selection_thresholds st
      LEFT JOIN vacancies v ON st.vacancy_id = v.id
      LEFT JOIN users u ON st.created_by = u.id
    `;
    const params: any[] = [];

    if (vacancy_id) {
      query += ' WHERE st.vacancy_id = ? OR st.is_default = 1';
      params.push(vacancy_id);
    }

    query += ' ORDER BY st.vacancy_id DESC, st.is_default DESC';

    const thresholds = db.prepare(query).all(...params);
    res.json(thresholds);
  } catch (error: any) {
    console.error('Error fetching selection thresholds:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch selection thresholds' });
  }
});

// Create/Update selection threshold
router.post('/selection-thresholds', requireAdmin, (req: Request, res: Response): void => {
  try {
    const {
      vacancy_id, department, min_screening_score, min_interview_score,
      auto_shortlist_threshold, auto_reject_threshold, is_default
    } = req.body;
    const userId = req.user!.userId;

    // Check if exists for this vacancy
    const existing = vacancy_id
      ? db.prepare('SELECT * FROM selection_thresholds WHERE vacancy_id = ?').get(vacancy_id)
      : null;

    if (existing) {
      // Update
      db.prepare(`
        UPDATE selection_thresholds
        SET min_screening_score = ?, min_interview_score = ?,
            auto_shortlist_threshold = ?, auto_reject_threshold = ?,
            updatedAt = datetime('now')
        WHERE vacancy_id = ?
      `).run(
        min_screening_score || 60,
        min_interview_score || 3.5,
        auto_shortlist_threshold || 75,
        auto_reject_threshold || 40,
        vacancy_id
      );
      res.json({ message: 'Threshold updated', updated: true });
    } else {
      // Create
      const result = db.prepare(`
        INSERT INTO selection_thresholds (vacancy_id, department, min_screening_score, min_interview_score, auto_shortlist_threshold, auto_reject_threshold, is_default, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        vacancy_id || null,
        department || null,
        min_screening_score || 60,
        min_interview_score || 3.5,
        auto_shortlist_threshold || 75,
        auto_reject_threshold || 40,
        is_default ? 1 : 0,
        userId
      );

      const newThreshold = db.prepare('SELECT * FROM selection_thresholds WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json(newThreshold);
    }
  } catch (error: any) {
    console.error('Error saving selection threshold:', error);
    res.status(500).json({ error: error.message || 'Failed to save selection threshold' });
  }
});

// =============================================
// WORKFLOW PIPELINE
// =============================================

// Get pipeline data (candidates grouped by stage)
router.get('/workflow/pipeline', (req: Request, res: Response): void => {
  try {
    const { vacancy_id } = req.query;

    let whereClause = '';
    const params: any[] = [];

    if (vacancy_id) {
      whereClause = 'WHERE c.vacancy_id = ?';
      params.push(vacancy_id);
    }

    // Get counts by stage
    const stageCounts = db.prepare(`
      SELECT
        COALESCE(c.workflow_stage, 'new') as stage,
        COUNT(*) as count
      FROM candidates c
      ${whereClause}
      GROUP BY c.workflow_stage
    `).all(...params) as Array<{ stage: string; count: number }>;

    // Get candidates for each stage
    const stages = [
      'new', 'screening', 'screened', 'shortlisted', 'rejected',
      'interview_scheduled', 'interview_completed', 'interview_scored',
      'selected', 'ctc_discussion', 'ctc_finalized',
      'offer_generated', 'offer_sent', 'offer_accepted', 'offer_rejected',
      'joined', 'withdrawn'
    ];

    const pipeline: Record<string, any[]> = {};

    for (const stage of stages) {
      const stageParams = vacancy_id ? [vacancy_id, stage] : [stage];
      const candidates = db.prepare(`
        SELECT c.id, c.first_name, c.last_name, c.email, c.screening_score,
               c.final_interview_score, c.workflow_stage, c.updatedAt,
               v.title as vacancy_title
        FROM candidates c
        LEFT JOIN vacancies v ON c.vacancy_id = v.id
        ${vacancy_id ? 'WHERE c.vacancy_id = ? AND' : 'WHERE'} COALESCE(c.workflow_stage, 'new') = ?
        ORDER BY c.updatedAt DESC
        LIMIT 50
      `).all(...stageParams);

      pipeline[stage] = candidates;
    }

    res.json({
      stage_counts: stageCounts,
      pipeline,
      stages
    });
  } catch (error: any) {
    console.error('Error fetching pipeline:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch pipeline' });
  }
});

// Get candidate timeline
router.get('/workflow/:candidateId/timeline', (req: Request, res: Response): void => {
  try {
    const { candidateId } = req.params;

    const history = db.prepare(`
      SELECT wsh.*, u.name as changed_by_name
      FROM workflow_stage_history wsh
      LEFT JOIN users u ON wsh.changed_by = u.id
      WHERE wsh.candidate_id = ?
      ORDER BY wsh.createdAt DESC
    `).all(candidateId);

    const currentStage = db.prepare(`
      SELECT * FROM recruitment_workflow_stages WHERE candidate_id = ? ORDER BY id DESC LIMIT 1
    `).get(candidateId);

    res.json({
      current_stage: currentStage,
      history
    });
  } catch (error: any) {
    console.error('Error fetching timeline:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch timeline' });
  }
});

// Advance candidate to next stage
router.post('/workflow/:candidateId/advance', (req: Request, res: Response): void => {
  try {
    const { candidateId } = req.params;
    const { to_stage, reason, is_automated } = req.body;
    const userId = req.user!.userId;

    if (!to_stage) {
      res.status(400).json({ error: 'Target stage is required' });
      return;
    }

    // Get current stage
    const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(candidateId) as any;
    if (!candidate) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    const fromStage = candidate.workflow_stage || 'new';

    // Update candidate
    db.prepare(`
      UPDATE candidates SET workflow_stage = ?, updatedAt = datetime('now') WHERE id = ?
    `).run(to_stage, candidateId);

    // Update workflow stage record
    db.prepare(`
      UPDATE recruitment_workflow_stages
      SET previous_stage = current_stage, current_stage = ?, stage_completed_at = datetime('now'),
          stage_notes = ?, updated_by = ?, updatedAt = datetime('now')
      WHERE candidate_id = ? AND stage_completed_at IS NULL
    `).run(to_stage, reason || null, userId, candidateId);

    // Create new stage record
    db.prepare(`
      INSERT INTO recruitment_workflow_stages (candidate_id, vacancy_id, current_stage, previous_stage, updated_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(candidateId, candidate.vacancy_id, to_stage, fromStage, userId);

    // Log history
    db.prepare(`
      INSERT INTO workflow_stage_history (candidate_id, vacancy_id, from_stage, to_stage, changed_by, change_reason, is_automated)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(candidateId, candidate.vacancy_id, fromStage, to_stage, userId, reason || null, is_automated ? 1 : 0);

    res.json({
      message: `Candidate moved from ${fromStage} to ${to_stage}`,
      from_stage: fromStage,
      to_stage
    });
  } catch (error: any) {
    console.error('Error advancing workflow:', error);
    res.status(500).json({ error: error.message || 'Failed to advance workflow' });
  }
});

// Get workflow stats
router.get('/workflow/stats', (req: Request, res: Response): void => {
  try {
    const { vacancy_id, days = 30 } = req.query;

    let whereClause = 'WHERE c.createdAt >= datetime(\'now\', ?)';
    const params: any[] = [`-${days} days`];

    if (vacancy_id) {
      whereClause += ' AND c.vacancy_id = ?';
      params.push(vacancy_id);
    }

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_candidates,
        SUM(CASE WHEN workflow_stage = 'new' THEN 1 ELSE 0 END) as new_count,
        SUM(CASE WHEN workflow_stage IN ('screened', 'shortlisted') THEN 1 ELSE 0 END) as screened_count,
        SUM(CASE WHEN workflow_stage LIKE 'interview%' THEN 1 ELSE 0 END) as interviewing_count,
        SUM(CASE WHEN workflow_stage = 'selected' THEN 1 ELSE 0 END) as selected_count,
        SUM(CASE WHEN workflow_stage LIKE 'offer%' THEN 1 ELSE 0 END) as offer_count,
        SUM(CASE WHEN workflow_stage = 'joined' THEN 1 ELSE 0 END) as joined_count,
        SUM(CASE WHEN workflow_stage = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
        AVG(CASE WHEN screening_score IS NOT NULL THEN screening_score END) as avg_screening_score,
        AVG(CASE WHEN final_interview_score IS NOT NULL THEN final_interview_score END) as avg_interview_score
      FROM candidates c
      ${whereClause}
    `).get(...params);

    res.json(stats);
  } catch (error: any) {
    console.error('Error fetching workflow stats:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch workflow stats' });
  }
});

// =============================================
// AUTOMATED WORKFLOW - RESUME PARSING & SKILL EXTRACTION
// =============================================

interface ParsedSkillExperience {
  skill: string;
  years: number;
  proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  matched: boolean;
}

interface ParsedResume {
  candidate_name: string;
  total_experience_years: number;
  current_company: string | null;
  current_designation: string | null;
  project_history: Array<{
    name: string;
    duration: string;
    technologies: string[];
    description: string;
  }>;
  skill_experience: ParsedSkillExperience[];
  education: string[];
  certifications: string[];
}

interface ScreeningResult {
  candidate_id: number;
  candidate_name: string;
  total_experience: number;
  skill_matches: Array<{
    skill: string;
    required: boolean;
    candidate_years: number | null;
    jd_requirement: string;
    match_status: 'match' | 'partial' | 'no_match';
  }>;
  overall_match_percentage: number;
  recommendation: 'shortlist' | 'review' | 'reject';
  screening_notes: string;
}

// Parse resume and extract skill-wise experience
router.post('/candidates/:id/parse-resume', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Get candidate details
    const candidate = db.prepare(`
      SELECT c.*, v.title as vacancy_title, v.skills_required, v.experience_min, v.experience_max,
             v.job_description
      FROM candidates c
      LEFT JOIN vacancies v ON c.vacancy_id = v.id
      WHERE c.id = ?
    `).get(id) as any;

    if (!candidate) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    // Get JD skills for matching
    const jdSkills = (candidate.skills_required || '').split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);

    // Create AI prompt for resume parsing
    const prompt = `You are an expert HR analyst. Parse the following candidate information and extract detailed skill experience.

CANDIDATE INFORMATION:
Name: ${candidate.first_name} ${candidate.last_name}
Email: ${candidate.email}
Current Company: ${candidate.current_company || 'Not specified'}
Current Designation: ${candidate.current_designation || 'Not specified'}
Total Experience: ${candidate.experience_years || 0} years
Skills Listed: ${candidate.skills || 'Not specified'}

JOB DESCRIPTION SKILLS TO MATCH:
${jdSkills.join(', ') || 'Not specified'}

Based on the candidate's profile, experience, and listed skills, estimate years of experience for each skill.

Return JSON:
{
  "candidate_name": "${candidate.first_name} ${candidate.last_name}",
  "total_experience_years": number,
  "current_company": "string or null",
  "current_designation": "string or null",
  "project_history": [
    {
      "name": "Project name (inferred from experience)",
      "duration": "Estimated duration",
      "technologies": ["tech1", "tech2"],
      "description": "Brief description"
    }
  ],
  "skill_experience": [
    {
      "skill": "skill name",
      "years": number (estimated years of experience),
      "proficiency": "beginner|intermediate|advanced|expert",
      "matched": boolean (true if skill is in JD requirements)
    }
  ],
  "education": ["degree1", "degree2"],
  "certifications": []
}

IMPORTANT:
- For each skill in JD requirements, include an entry even if 0 years
- Estimate years based on total experience and typical skill progression
- Mark matched=true if the skill appears in JD requirements (case-insensitive match)`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const parsedResume: ParsedResume = JSON.parse(response.choices[0]?.message?.content || '{}');

    // Save parsed resume data
    db.prepare(`
      UPDATE candidates
      SET parsed_resume_data = ?, resume_parsed_at = datetime('now'), updatedAt = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(parsedResume), id);

    res.json({
      candidate_id: id,
      parsed_resume: parsedResume,
      jd_skills: jdSkills,
      message: 'Resume parsed successfully'
    });
  } catch (error: any) {
    console.error('Error parsing resume:', error);
    res.status(500).json({ error: error.message || 'Failed to parse resume' });
  }
});

// Batch parse resumes for a vacancy (without evaluation)
router.post('/vacancies/:id/parse-resumes', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { candidate_ids } = req.body;

    // Get vacancy
    const vacancy = db.prepare('SELECT * FROM vacancies WHERE id = ?').get(id) as any;
    if (!vacancy) {
      res.status(404).json({ error: 'Vacancy not found' });
      return;
    }

    // Check vacancy status
    if (vacancy.status === 'filled' || vacancy.status === 'closed') {
      res.status(400).json({ error: `Vacancy is ${vacancy.status}. Cannot process more resumes.` });
      return;
    }

    // Get candidates - either specific IDs or all new ones for this vacancy
    let candidateQuery = `
      SELECT c.* FROM candidates c
      WHERE c.vacancy_id = ? AND c.parsed_resume_data IS NULL
    `;
    const params: any[] = [id];

    if (candidate_ids && Array.isArray(candidate_ids) && candidate_ids.length > 0) {
      candidateQuery += ` AND c.id IN (${candidate_ids.map(() => '?').join(',')})`;
      params.push(...candidate_ids);
    }

    const candidates = db.prepare(candidateQuery).all(...params) as any[];

    if (candidates.length === 0) {
      res.json({
        message: 'No unparsed candidates found',
        parsed_count: 0,
        candidates: []
      });
      return;
    }

    const jdSkills = (vacancy.skills_required || '').split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
    const parsedResults: any[] = [];

    for (const candidate of candidates) {
      try {
        const prompt = `Parse this candidate's profile and extract skill-wise experience.

CANDIDATE:
Name: ${candidate.first_name} ${candidate.last_name}
Experience: ${candidate.experience_years || 0} years
Current Role: ${candidate.current_designation || 'Not specified'}
Company: ${candidate.current_company || 'Not specified'}
Skills: ${candidate.skills || 'Not specified'}

JD REQUIRED SKILLS: ${jdSkills.join(', ') || 'General'}

Return JSON with skill_experience array where each skill has estimated years and matched=true if in JD.
{
  "candidate_name": "string",
  "total_experience_years": number,
  "project_history": [{"name": "string", "duration": "string", "technologies": ["string"], "description": "string"}],
  "skill_experience": [{"skill": "string", "years": number, "proficiency": "string", "matched": boolean}],
  "education": [],
  "certifications": []
}`;

        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        });

        const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');

        db.prepare(`
          UPDATE candidates
          SET parsed_resume_data = ?, resume_parsed_at = datetime('now'), updatedAt = datetime('now')
          WHERE id = ?
        `).run(JSON.stringify(parsed), candidate.id);

        parsedResults.push({
          candidate_id: candidate.id,
          candidate_name: `${candidate.first_name} ${candidate.last_name}`,
          parsed: true,
          skill_count: parsed.skill_experience?.length || 0
        });
      } catch (err: any) {
        parsedResults.push({
          candidate_id: candidate.id,
          candidate_name: `${candidate.first_name} ${candidate.last_name}`,
          parsed: false,
          error: err.message
        });
      }
    }

    res.json({
      message: `Parsed ${parsedResults.filter(r => r.parsed).length} of ${candidates.length} resumes`,
      parsed_count: parsedResults.filter(r => r.parsed).length,
      candidates: parsedResults
    });
  } catch (error: any) {
    console.error('Error batch parsing resumes:', error);
    res.status(500).json({ error: error.message || 'Failed to parse resumes' });
  }
});

// =============================================
// AUTO-SCREENING WITH TICK/CROSS TABLE
// =============================================

// Run auto-screening for vacancy candidates (generates tick/cross table)
router.post('/vacancies/:id/auto-screen', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { candidate_ids, screening_threshold = 60 } = req.body;
    const userId = req.user!.userId;

    // Get vacancy with JD
    const vacancy = db.prepare('SELECT * FROM vacancies WHERE id = ?').get(id) as any;
    if (!vacancy) {
      res.status(404).json({ error: 'Vacancy not found' });
      return;
    }

    // Check vacancy status
    if (vacancy.status === 'filled' || vacancy.status === 'closed') {
      res.status(400).json({ error: `Vacancy is ${vacancy.status}. Cannot screen more candidates.` });
      return;
    }

    // Get candidates with parsed resumes
    let candidateQuery = `
      SELECT c.* FROM candidates c
      WHERE c.vacancy_id = ? AND c.parsed_resume_data IS NOT NULL
    `;
    const params: any[] = [id];

    if (candidate_ids && Array.isArray(candidate_ids) && candidate_ids.length > 0) {
      candidateQuery += ` AND c.id IN (${candidate_ids.map(() => '?').join(',')})`;
      params.push(...candidate_ids);
    }

    const candidates = db.prepare(candidateQuery).all(...params) as any[];

    if (candidates.length === 0) {
      res.json({
        message: 'No candidates with parsed resumes found. Please parse resumes first.',
        screening_results: [],
        summary: { total: 0, shortlisted: 0, review: 0, rejected: 0 }
      });
      return;
    }

    // Parse JD skills
    const jdSkills = (vacancy.skills_required || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const expMin = vacancy.experience_min || 0;
    const expMax = vacancy.experience_max || 99;

    const screeningResults: ScreeningResult[] = [];

    for (const candidate of candidates) {
      const parsedData = JSON.parse(candidate.parsed_resume_data || '{}');
      const skillExperience = parsedData.skill_experience || [];

      // Build skill matches array with tick/cross
      const skillMatches: ScreeningResult['skill_matches'] = [];
      let matchedSkillsCount = 0;

      for (const jdSkill of jdSkills) {
        const candidateSkill = skillExperience.find((s: any) =>
          s.skill.toLowerCase().includes(jdSkill.toLowerCase()) ||
          jdSkill.toLowerCase().includes(s.skill.toLowerCase())
        );

        const hasSkill = !!candidateSkill;
        const candidateYears = candidateSkill?.years || 0;

        skillMatches.push({
          skill: jdSkill,
          required: true,
          candidate_years: hasSkill ? candidateYears : null,
          jd_requirement: `Required`,
          match_status: hasSkill ? (candidateYears >= 1 ? 'match' : 'partial') : 'no_match'
        });

        if (hasSkill) matchedSkillsCount++;
      }

      // Calculate overall match percentage
      const skillMatchPercent = jdSkills.length > 0 ? (matchedSkillsCount / jdSkills.length) * 100 : 50;
      const totalExp = parsedData.total_experience_years || candidate.experience_years || 0;
      const expInRange = totalExp >= expMin && totalExp <= expMax;
      const expMatchPercent = expInRange ? 100 : (totalExp >= expMin - 1 && totalExp <= expMax + 1) ? 70 : 30;

      const overallMatch = Math.round((skillMatchPercent * 0.7) + (expMatchPercent * 0.3));

      // Determine recommendation
      let recommendation: 'shortlist' | 'review' | 'reject';
      if (overallMatch >= screening_threshold) {
        recommendation = 'shortlist';
      } else if (overallMatch >= screening_threshold - 20) {
        recommendation = 'review';
      } else {
        recommendation = 'reject';
      }

      const result: ScreeningResult = {
        candidate_id: candidate.id,
        candidate_name: `${candidate.first_name} ${candidate.last_name}`,
        total_experience: totalExp,
        skill_matches: skillMatches,
        overall_match_percentage: overallMatch,
        recommendation,
        screening_notes: `Experience: ${totalExp} years (${expInRange ? 'in range' : 'out of range'}). Skills matched: ${matchedSkillsCount}/${jdSkills.length}`
      };

      screeningResults.push(result);

      // Update candidate with screening results
      db.prepare(`
        UPDATE candidates
        SET screening_score = ?,
            screening_notes = ?,
            screening_skill_data = ?,
            status = CASE WHEN ? = 'shortlist' THEN 'shortlisted' WHEN ? = 'reject' THEN 'rejected' ELSE 'screening' END,
            workflow_stage = CASE WHEN ? = 'shortlist' THEN 'shortlisted' WHEN ? = 'reject' THEN 'rejected' ELSE 'screened' END,
            updatedAt = datetime('now')
        WHERE id = ?
      `).run(
        overallMatch,
        result.screening_notes,
        JSON.stringify(skillMatches),
        recommendation, recommendation, recommendation, recommendation,
        candidate.id
      );

      // Log the screening action
      db.prepare(`
        INSERT INTO recruitment_workflow_log (candidate_id, action, action_type, details, performed_by, is_automated)
        VALUES (?, ?, 'auto_screen', ?, ?, 1)
      `).run(
        candidate.id,
        `Auto-screened: ${recommendation} (${overallMatch}%)`,
        JSON.stringify(result),
        userId
      );
    }

    const summary = {
      total: screeningResults.length,
      shortlisted: screeningResults.filter(r => r.recommendation === 'shortlist').length,
      review: screeningResults.filter(r => r.recommendation === 'review').length,
      rejected: screeningResults.filter(r => r.recommendation === 'reject').length
    };

    res.json({
      message: `Screened ${screeningResults.length} candidates`,
      vacancy_id: id,
      jd_skills: jdSkills,
      experience_range: { min: expMin, max: expMax },
      screening_threshold,
      screening_results: screeningResults,
      summary
    });
  } catch (error: any) {
    console.error('Error auto-screening:', error);
    res.status(500).json({ error: error.message || 'Failed to auto-screen candidates' });
  }
});

// Get screening table data for a vacancy
router.get('/vacancies/:id/screening-table', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    // Get vacancy
    const vacancy = db.prepare('SELECT * FROM vacancies WHERE id = ?').get(id) as any;
    if (!vacancy) {
      res.status(404).json({ error: 'Vacancy not found' });
      return;
    }

    // Get all candidates with screening data
    const candidates = db.prepare(`
      SELECT c.id, c.first_name, c.last_name, c.email, c.experience_years,
             c.screening_score, c.screening_notes, c.screening_skill_data,
             c.parsed_resume_data, c.status, c.workflow_stage
      FROM candidates c
      WHERE c.vacancy_id = ?
      ORDER BY c.screening_score DESC NULLS LAST
    `).all(id) as any[];

    const jdSkills = (vacancy.skills_required || '').split(',').map((s: string) => s.trim()).filter(Boolean);

    // Format table data
    const tableData = candidates.map(c => {
      const skillData = JSON.parse(c.screening_skill_data || '[]');
      const parsedResume = JSON.parse(c.parsed_resume_data || '{}');

      // Build skill columns
      const skillColumns: Record<string, { years: number | null; status: 'tick' | 'cross' | 'partial' }> = {};
      for (const skill of jdSkills) {
        const match = skillData.find((s: any) => s.skill.toLowerCase() === skill.toLowerCase());
        skillColumns[skill] = {
          years: match?.candidate_years || null,
          status: match?.match_status === 'match' ? 'tick' : match?.match_status === 'partial' ? 'partial' : 'cross'
        };
      }

      return {
        id: c.id,
        name: `${c.first_name} ${c.last_name}`,
        email: c.email,
        total_experience: parsedResume.total_experience_years || c.experience_years || 0,
        screening_score: c.screening_score,
        status: c.status,
        workflow_stage: c.workflow_stage,
        skill_columns: skillColumns,
        screening_notes: c.screening_notes
      };
    });

    res.json({
      vacancy_id: id,
      vacancy_title: vacancy.title,
      jd_skills: jdSkills,
      experience_range: { min: vacancy.experience_min, max: vacancy.experience_max },
      candidates: tableData,
      summary: {
        total: candidates.length,
        screened: candidates.filter(c => c.screening_score !== null).length,
        shortlisted: candidates.filter(c => c.status === 'shortlisted').length,
        rejected: candidates.filter(c => c.status === 'rejected').length,
        pending: candidates.filter(c => c.screening_score === null).length
      }
    });
  } catch (error: any) {
    console.error('Error fetching screening table:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch screening table' });
  }
});

// =============================================
// INTERVIEW SCHEDULING AUTOMATION
// =============================================

// Auto-schedule interviews for shortlisted candidates
router.post('/vacancies/:id/auto-schedule-interviews', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { interview_type = 'technical', start_date, interviewer_id, duration_minutes = 60 } = req.body;
    const userId = req.user!.userId;

    // Get vacancy
    const vacancy = db.prepare('SELECT * FROM vacancies WHERE id = ?').get(id) as any;
    if (!vacancy) {
      res.status(404).json({ error: 'Vacancy not found' });
      return;
    }

    // Get shortlisted candidates without scheduled interviews
    const candidates = db.prepare(`
      SELECT c.* FROM candidates c
      WHERE c.vacancy_id = ?
        AND c.status = 'shortlisted'
        AND NOT EXISTS (
          SELECT 1 FROM interviews i WHERE i.candidate_id = c.id AND i.status != 'cancelled'
        )
    `).all(id) as any[];

    if (candidates.length === 0) {
      res.json({
        message: 'No shortlisted candidates without interviews',
        scheduled_count: 0,
        interviews: []
      });
      return;
    }

    const scheduledInterviews: any[] = [];
    let currentSlot = new Date(start_date || Date.now() + 24 * 60 * 60 * 1000); // Default: tomorrow

    // Ensure we start at a reasonable hour (9 AM)
    currentSlot.setHours(9, 0, 0, 0);

    for (const candidate of candidates) {
      // Skip weekends
      while (currentSlot.getDay() === 0 || currentSlot.getDay() === 6) {
        currentSlot.setDate(currentSlot.getDate() + 1);
      }

      // If past 6 PM, move to next day
      if (currentSlot.getHours() >= 18) {
        currentSlot.setDate(currentSlot.getDate() + 1);
        currentSlot.setHours(9, 0, 0, 0);
      }

      const scheduledDate = currentSlot.toISOString();

      // Create interview
      const result = db.prepare(`
        INSERT INTO interviews (
          candidate_id, vacancy_id, interviewer_id, interview_type,
          scheduled_date, duration_minutes, status, round_number, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, 'scheduled', 1, ?)
      `).run(
        candidate.id,
        id,
        interviewer_id || userId,
        interview_type,
        scheduledDate,
        duration_minutes,
        userId
      );

      // Update candidate status
      db.prepare(`
        UPDATE candidates
        SET status = 'interview_scheduled',
            workflow_stage = 'interview_scheduled',
            updatedAt = datetime('now')
        WHERE id = ?
      `).run(candidate.id);

      scheduledInterviews.push({
        interview_id: result.lastInsertRowid,
        candidate_id: candidate.id,
        candidate_name: `${candidate.first_name} ${candidate.last_name}`,
        scheduled_date: scheduledDate,
        interview_type
      });

      // Move to next slot (add duration + 30 min buffer)
      currentSlot.setMinutes(currentSlot.getMinutes() + duration_minutes + 30);
    }

    res.json({
      message: `Scheduled ${scheduledInterviews.length} interviews`,
      scheduled_count: scheduledInterviews.length,
      interviews: scheduledInterviews
    });
  } catch (error: any) {
    console.error('Error auto-scheduling interviews:', error);
    res.status(500).json({ error: error.message || 'Failed to schedule interviews' });
  }
});

// Submit interview score (simple 1-5 scale)
router.post('/interviews/:id/submit-score', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { technical_score, communication_score, overall_score, notes, recommendation } = req.body;
    const userId = req.user!.userId;

    // Get interview
    const interview = db.prepare(`
      SELECT i.*, c.first_name, c.last_name, c.vacancy_id
      FROM interviews i
      JOIN candidates c ON i.candidate_id = c.id
      WHERE i.id = ?
    `).get(id) as any;

    if (!interview) {
      res.status(404).json({ error: 'Interview not found' });
      return;
    }

    // Calculate average score
    const avgScore = ((technical_score || 0) + (communication_score || 0) + (overall_score || 0)) / 3;
    const roundedScore = Math.round(avgScore * 10) / 10;

    // Determine selection status based on score (threshold: 3.5)
    const selectionThreshold = 3.5;
    const isSelected = roundedScore >= selectionThreshold;

    // Update interview
    db.prepare(`
      UPDATE interviews
      SET technical_score = ?,
          communication_score = ?,
          rating = ?,
          feedback = ?,
          recommendation = ?,
          status = 'completed',
          updatedAt = datetime('now')
      WHERE id = ?
    `).run(
      technical_score,
      communication_score,
      Math.round(roundedScore),
      notes,
      recommendation || (isSelected ? 'hire' : 'no_hire'),
      id
    );

    // Update candidate
    const newStatus = isSelected ? 'selected' : 'rejected';
    const newStage = isSelected ? 'selected' : 'rejected';

    db.prepare(`
      UPDATE candidates
      SET final_interview_score = ?,
          status = ?,
          workflow_stage = ?,
          updatedAt = datetime('now')
      WHERE id = ?
    `).run(roundedScore, newStatus, newStage, interview.candidate_id);

    // Log workflow change
    db.prepare(`
      INSERT INTO workflow_stage_history (candidate_id, vacancy_id, from_stage, to_stage, changed_by, is_automated, metadata)
      VALUES (?, ?, 'interview_completed', ?, ?, 1, ?)
    `).run(
      interview.candidate_id,
      interview.vacancy_id,
      newStage,
      userId,
      JSON.stringify({ score: roundedScore, recommendation: recommendation || (isSelected ? 'hire' : 'no_hire') })
    );

    res.json({
      message: isSelected ? 'Candidate selected!' : 'Candidate not selected',
      interview_id: id,
      candidate_id: interview.candidate_id,
      candidate_name: `${interview.first_name} ${interview.last_name}`,
      average_score: roundedScore,
      threshold: selectionThreshold,
      is_selected: isSelected,
      new_status: newStatus
    });
  } catch (error: any) {
    console.error('Error submitting score:', error);
    res.status(500).json({ error: error.message || 'Failed to submit score' });
  }
});

// =============================================
// OFFER MANAGEMENT & VACANCY COMPLETION
// =============================================

// Generate offer for selected candidate
router.post('/candidates/:id/generate-offer', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { annual_ctc, joining_date, designation, department } = req.body;
    const userId = req.user!.userId;

    // Get candidate with vacancy details
    const candidate = db.prepare(`
      SELECT c.*, v.title as vacancy_title, v.department as vacancy_department,
             v.salary_min, v.salary_max, v.location
      FROM candidates c
      LEFT JOIN vacancies v ON c.vacancy_id = v.id
      WHERE c.id = ?
    `).get(id) as any;

    if (!candidate) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    if (candidate.status !== 'selected' && candidate.workflow_stage !== 'selected') {
      res.status(400).json({ error: 'Candidate must be selected before generating offer' });
      return;
    }

    // Generate offer details
    const offerData = {
      candidate_id: id,
      candidate_name: `${candidate.first_name} ${candidate.last_name}`,
      designation: designation || candidate.vacancy_title,
      department: department || candidate.vacancy_department,
      annual_ctc: annual_ctc,
      joining_date: joining_date,
      location: candidate.location,
      generated_at: new Date().toISOString()
    };

    // Update candidate with offer
    db.prepare(`
      UPDATE candidates
      SET offer_ctc = ?,
          offer_generated_at = datetime('now'),
          status = 'offer_generated',
          workflow_stage = 'offer_generated',
          updatedAt = datetime('now')
      WHERE id = ?
    `).run(annual_ctc, id);

    // Log workflow
    db.prepare(`
      INSERT INTO workflow_stage_history (candidate_id, vacancy_id, from_stage, to_stage, changed_by, metadata)
      VALUES (?, ?, 'selected', 'offer_generated', ?, ?)
    `).run(id, candidate.vacancy_id, userId, JSON.stringify(offerData));

    res.json({
      message: 'Offer generated successfully',
      offer: offerData
    });
  } catch (error: any) {
    console.error('Error generating offer:', error);
    res.status(500).json({ error: error.message || 'Failed to generate offer' });
  }
});

// Update offer status (accepted/rejected)
router.post('/candidates/:id/offer-response', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const { response, joining_date, reason } = req.body; // response: 'accepted' | 'rejected'
    const userId = req.user!.userId;

    if (!['accepted', 'rejected'].includes(response)) {
      res.status(400).json({ error: 'Response must be "accepted" or "rejected"' });
      return;
    }

    const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(id) as any;
    if (!candidate) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    const newStatus = response === 'accepted' ? 'offer_accepted' : 'offer_rejected';
    const newStage = newStatus;

    db.prepare(`
      UPDATE candidates
      SET status = ?,
          workflow_stage = ?,
          ${response === 'accepted' && joining_date ? 'expected_joining_date = ?,' : ''}
          updatedAt = datetime('now')
      WHERE id = ?
    `).run(
      ...(response === 'accepted' && joining_date ? [newStatus, newStage, joining_date, id] : [newStatus, newStage, id])
    );

    // Log workflow
    db.prepare(`
      INSERT INTO workflow_stage_history (candidate_id, vacancy_id, from_stage, to_stage, changed_by, change_reason)
      VALUES (?, ?, 'offer_generated', ?, ?, ?)
    `).run(id, candidate.vacancy_id, newStage, userId, reason || null);

    // If accepted, check if vacancy should be filled
    if (response === 'accepted' && candidate.vacancy_id) {
      checkAndUpdateVacancyStatus(candidate.vacancy_id);
    }

    res.json({
      message: `Offer ${response}`,
      candidate_id: id,
      new_status: newStatus
    });
  } catch (error: any) {
    console.error('Error updating offer response:', error);
    res.status(500).json({ error: error.message || 'Failed to update offer response' });
  }
});

// Mark candidate as joined
router.post('/candidates/:id/mark-joined', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const { actual_joining_date } = req.body;
    const userId = req.user!.userId;

    const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(id) as any;
    if (!candidate) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    db.prepare(`
      UPDATE candidates
      SET status = 'joined',
          workflow_stage = 'joined',
          actual_joining_date = ?,
          updatedAt = datetime('now')
      WHERE id = ?
    `).run(actual_joining_date || new Date().toISOString().split('T')[0], id);

    // Log workflow
    db.prepare(`
      INSERT INTO workflow_stage_history (candidate_id, vacancy_id, from_stage, to_stage, changed_by)
      VALUES (?, ?, ?, 'joined', ?)
    `).run(id, candidate.vacancy_id, candidate.workflow_stage, userId);

    // Update vacancy filled count
    if (candidate.vacancy_id) {
      checkAndUpdateVacancyStatus(candidate.vacancy_id);
    }

    res.json({
      message: 'Candidate marked as joined',
      candidate_id: id
    });
  } catch (error: any) {
    console.error('Error marking joined:', error);
    res.status(500).json({ error: error.message || 'Failed to mark as joined' });
  }
});

// Get vacancy completion status
router.get('/vacancies/:id/completion-status', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const vacancy = db.prepare('SELECT * FROM vacancies WHERE id = ?').get(id) as any;
    if (!vacancy) {
      res.status(404).json({ error: 'Vacancy not found' });
      return;
    }

    // Get candidate counts by stage
    const counts = db.prepare(`
      SELECT
        COUNT(*) as total_candidates,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_count,
        SUM(CASE WHEN status IN ('screening', 'shortlisted') THEN 1 ELSE 0 END) as screening_count,
        SUM(CASE WHEN status LIKE 'interview%' THEN 1 ELSE 0 END) as interview_count,
        SUM(CASE WHEN status = 'selected' THEN 1 ELSE 0 END) as selected_count,
        SUM(CASE WHEN status = 'offer_generated' THEN 1 ELSE 0 END) as offer_generated_count,
        SUM(CASE WHEN status = 'offer_accepted' THEN 1 ELSE 0 END) as offer_accepted_count,
        SUM(CASE WHEN status = 'offer_rejected' THEN 1 ELSE 0 END) as offer_rejected_count,
        SUM(CASE WHEN status = 'joined' THEN 1 ELSE 0 END) as joined_count,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count
      FROM candidates
      WHERE vacancy_id = ?
    `).get(id) as any;

    const openings = vacancy.openings || 1;
    const filled = counts.joined_count || 0;
    const acceptedOffers = counts.offer_accepted_count || 0;
    const pendingJoins = acceptedOffers - filled;

    res.json({
      vacancy_id: id,
      vacancy_title: vacancy.title,
      vacancy_status: vacancy.status,
      openings: openings,
      filled: filled,
      pending_joins: pendingJoins,
      progress_percentage: Math.round((filled / openings) * 100),
      is_complete: filled >= openings,
      candidate_counts: counts,
      pipeline: {
        total: counts.total_candidates,
        in_screening: counts.new_count + counts.screening_count,
        in_interviews: counts.interview_count,
        selected: counts.selected_count,
        offers_pending: counts.offer_generated_count,
        offers_accepted: counts.offer_accepted_count,
        joined: counts.joined_count,
        dropped: counts.rejected_count + counts.offer_rejected_count
      }
    });
  } catch (error: any) {
    console.error('Error fetching completion status:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch completion status' });
  }
});

// Helper function to check and update vacancy status
function checkAndUpdateVacancyStatus(vacancyId: number): void {
  const vacancy = db.prepare('SELECT * FROM vacancies WHERE id = ?').get(vacancyId) as any;
  if (!vacancy) return;

  const joinedCount = db.prepare(`
    SELECT COUNT(*) as count FROM candidates
    WHERE vacancy_id = ? AND status = 'joined'
  `).get(vacancyId) as { count: number };

  const openings = vacancy.openings || 1;

  if (joinedCount.count >= openings) {
    // Mark vacancy as filled
    db.prepare(`
      UPDATE vacancies
      SET status = 'filled',
          filled_date = datetime('now'),
          updatedAt = datetime('now')
      WHERE id = ?
    `).run(vacancyId);
  }
}

// =============================================
// SCREENING COMMUNICATION TRACKING
// =============================================

// Add screening communication
router.post('/candidates/:id/screening-communication', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const { communication_type, notes, outcome } = req.body;
    const userId = req.user!.userId;

    const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(id) as any;
    if (!candidate) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    db.prepare(`
      INSERT INTO recruitment_workflow_log (candidate_id, action, action_type, details, performed_by, is_automated)
      VALUES (?, ?, 'screening_communication', ?, ?, 0)
    `).run(
      id,
      `${communication_type}: ${notes?.substring(0, 100) || 'No notes'}`,
      JSON.stringify({ type: communication_type, notes, outcome }),
      userId
    );

    res.json({ message: 'Communication logged', candidate_id: id });
  } catch (error: any) {
    console.error('Error logging communication:', error);
    res.status(500).json({ error: error.message || 'Failed to log communication' });
  }
});

// Get candidate communication history
router.get('/candidates/:id/communications', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const communications = db.prepare(`
      SELECT rwl.*, u.name as performed_by_name
      FROM recruitment_workflow_log rwl
      LEFT JOIN users u ON rwl.performed_by = u.id
      WHERE rwl.candidate_id = ? AND rwl.action_type = 'screening_communication'
      ORDER BY rwl.createdAt DESC
    `).all(id);

    res.json(communications);
  } catch (error: any) {
    console.error('Error fetching communications:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch communications' });
  }
});

export default router;
