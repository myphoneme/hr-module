import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticateToken } from '../middleware/auth';
import type {
  CTCDiscussion,
  CTCDiscussionWithDetails,
  CreateCTCDiscussionInput,
  UpdateCTCDiscussionInput,
  CTCValidationResult,
  SalaryComponent
} from '../types';

const router = Router();
router.use(authenticateToken);

// List CTC discussions
router.get('/', (req: Request, res: Response): void => {
  try {
    const { status, candidate_id, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT cd.*,
             c.first_name || ' ' || COALESCE(c.last_name, '') as candidate_name,
             c.email as candidate_email,
             v.title as vacancy_title,
             creator.name as creator_name,
             finalizer.name as finalizer_name
      FROM ctc_discussions cd
      JOIN candidates c ON cd.candidate_id = c.id
      LEFT JOIN vacancies v ON c.vacancy_id = v.id
      JOIN users creator ON cd.created_by = creator.id
      LEFT JOIN users finalizer ON cd.finalized_by = finalizer.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (status) {
      query += ' AND cd.status = ?';
      params.push(status);
    }

    if (candidate_id) {
      query += ' AND cd.candidate_id = ?';
      params.push(candidate_id);
    }

    query += ' ORDER BY cd.createdAt DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const discussions = db.prepare(query).all(...params) as CTCDiscussionWithDetails[];

    res.json(discussions.map(d => ({
      ...d,
      salary_breakdown: d.salary_breakdown ? JSON.parse(d.salary_breakdown) : null,
      company_benchmark: d.company_benchmark ? JSON.parse(d.company_benchmark) : null
    })));
  } catch (error) {
    console.error('Error fetching discussions:', error);
    res.status(500).json({ error: 'Failed to fetch discussions' });
  }
});

// Get single discussion
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const discussion = db.prepare(`
      SELECT cd.*,
             c.first_name || ' ' || COALESCE(c.last_name, '') as candidate_name,
             c.email as candidate_email,
             c.expected_salary as candidate_expected_salary,
             c.current_salary as candidate_current_salary,
             v.title as vacancy_title,
             v.salary_min,
             v.salary_max,
             creator.name as creator_name,
             finalizer.name as finalizer_name
      FROM ctc_discussions cd
      JOIN candidates c ON cd.candidate_id = c.id
      LEFT JOIN vacancies v ON c.vacancy_id = v.id
      JOIN users creator ON cd.created_by = creator.id
      LEFT JOIN users finalizer ON cd.finalized_by = finalizer.id
      WHERE cd.id = ?
    `).get(id) as (CTCDiscussionWithDetails & {
      candidate_expected_salary: number | null;
      candidate_current_salary: number | null;
      salary_min: number | null;
      salary_max: number | null;
    }) | undefined;

    if (!discussion) {
      res.status(404).json({ error: 'Discussion not found' });
      return;
    }

    res.json({
      ...discussion,
      salary_breakdown: discussion.salary_breakdown ? JSON.parse(discussion.salary_breakdown) : null,
      company_benchmark: discussion.company_benchmark ? JSON.parse(discussion.company_benchmark) : null
    });
  } catch (error) {
    console.error('Error fetching discussion:', error);
    res.status(500).json({ error: 'Failed to fetch discussion' });
  }
});

// Start CTC discussion for a candidate
router.post('/', (req: Request, res: Response): void => {
  try {
    const {
      candidate_id,
      expected_ctc,
      offered_ctc,
      fixed_pay,
      variable_pay,
      joining_bonus,
      joining_date,
      hr_notes
    } = req.body as CreateCTCDiscussionInput;
    const userId = req.user!.userId;

    if (!candidate_id) {
      res.status(400).json({ error: 'candidate_id is required' });
      return;
    }

    // Verify candidate exists and is in selected status
    const candidate = db.prepare(`
      SELECT c.*, v.title as vacancy_title, v.salary_min, v.salary_max
      FROM candidates c
      LEFT JOIN vacancies v ON c.vacancy_id = v.id
      WHERE c.id = ?
    `).get(candidate_id) as any;

    if (!candidate) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    // Check if discussion already exists
    const existing = db.prepare(`
      SELECT id FROM ctc_discussions WHERE candidate_id = ? AND status != 'cancelled'
    `).get(candidate_id) as { id: number } | undefined;

    if (existing) {
      res.status(400).json({
        error: 'CTC discussion already exists for this candidate',
        existing_id: existing.id
      });
      return;
    }

    // Use candidate's expected salary if not provided
    const expectedCTC = expected_ctc || candidate.expected_salary;

    const result = db.prepare(`
      INSERT INTO ctc_discussions
      (candidate_id, expected_ctc, offered_ctc, fixed_pay, variable_pay, joining_bonus, joining_date, hr_notes, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(
      candidate_id,
      expectedCTC || null,
      offered_ctc || null,
      fixed_pay || null,
      variable_pay || null,
      joining_bonus || null,
      joining_date || null,
      hr_notes || null,
      userId
    );

    // Update candidate with ctc_discussion_id
    db.prepare(`
      UPDATE candidates SET ctc_discussion_id = ?, status = 'selected', updatedAt = datetime('now') WHERE id = ?
    `).run(result.lastInsertRowid, candidate_id);

    // Log workflow
    db.prepare(`
      INSERT INTO automation_workflow_logs
      (candidate_id, workflow_step, action_taken, action_by, action_user_id, details)
      VALUES (?, 'ctc_discussion', 'CTC discussion started', 'hr', ?, ?)
    `).run(candidate_id, userId, JSON.stringify({ ctc_discussion_id: result.lastInsertRowid }));

    const discussion = db.prepare(`
      SELECT cd.*,
             c.first_name || ' ' || COALESCE(c.last_name, '') as candidate_name,
             c.email as candidate_email,
             v.title as vacancy_title,
             creator.name as creator_name
      FROM ctc_discussions cd
      JOIN candidates c ON cd.candidate_id = c.id
      LEFT JOIN vacancies v ON c.vacancy_id = v.id
      JOIN users creator ON cd.created_by = creator.id
      WHERE cd.id = ?
    `).get(result.lastInsertRowid) as CTCDiscussionWithDetails;

    res.status(201).json(discussion);
  } catch (error) {
    console.error('Error creating discussion:', error);
    res.status(500).json({ error: 'Failed to create discussion' });
  }
});

// Update CTC discussion
router.put('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const updates = req.body as UpdateCTCDiscussionInput;

    const existing = db.prepare('SELECT * FROM ctc_discussions WHERE id = ?').get(id) as CTCDiscussion | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Discussion not found' });
      return;
    }

    if (existing.status === 'finalized') {
      res.status(400).json({ error: 'Cannot update a finalized discussion' });
      return;
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.expected_ctc !== undefined) {
      fields.push('expected_ctc = ?');
      values.push(updates.expected_ctc);
    }
    if (updates.offered_ctc !== undefined) {
      fields.push('offered_ctc = ?');
      values.push(updates.offered_ctc);
    }
    if (updates.fixed_pay !== undefined) {
      fields.push('fixed_pay = ?');
      values.push(updates.fixed_pay);
    }
    if (updates.variable_pay !== undefined) {
      fields.push('variable_pay = ?');
      values.push(updates.variable_pay);
    }
    if (updates.joining_bonus !== undefined) {
      fields.push('joining_bonus = ?');
      values.push(updates.joining_bonus);
    }
    if (updates.joining_date !== undefined) {
      fields.push('joining_date = ?');
      values.push(updates.joining_date);
    }
    if (updates.salary_breakdown !== undefined) {
      fields.push('salary_breakdown = ?');
      values.push(updates.salary_breakdown);
    }
    if (updates.hr_notes !== undefined) {
      fields.push('hr_notes = ?');
      values.push(updates.hr_notes);
    }
    if (updates.candidate_response !== undefined) {
      fields.push('candidate_response = ?');
      values.push(updates.candidate_response);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }

    if (fields.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    fields.push("updatedAt = datetime('now')");
    values.push(id);

    db.prepare(`
      UPDATE ctc_discussions SET ${fields.join(', ')} WHERE id = ?
    `).run(...values);

    const discussion = db.prepare(`
      SELECT cd.*,
             c.first_name || ' ' || COALESCE(c.last_name, '') as candidate_name,
             c.email as candidate_email,
             v.title as vacancy_title,
             creator.name as creator_name,
             finalizer.name as finalizer_name
      FROM ctc_discussions cd
      JOIN candidates c ON cd.candidate_id = c.id
      LEFT JOIN vacancies v ON c.vacancy_id = v.id
      JOIN users creator ON cd.created_by = creator.id
      LEFT JOIN users finalizer ON cd.finalized_by = finalizer.id
      WHERE cd.id = ?
    `).get(id) as CTCDiscussionWithDetails;

    res.json({
      ...discussion,
      salary_breakdown: discussion.salary_breakdown ? JSON.parse(discussion.salary_breakdown) : null,
      company_benchmark: discussion.company_benchmark ? JSON.parse(discussion.company_benchmark) : null
    });
  } catch (error) {
    console.error('Error updating discussion:', error);
    res.status(500).json({ error: 'Failed to update discussion' });
  }
});

// Compare with company salary benchmarks
router.post('/:id/compare-benchmark', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const discussion = db.prepare(`
      SELECT cd.*, c.vacancy_id
      FROM ctc_discussions cd
      JOIN candidates c ON cd.candidate_id = c.id
      WHERE cd.id = ?
    `).get(id) as (CTCDiscussion & { vacancy_id: number | null }) | undefined;

    if (!discussion) {
      res.status(404).json({ error: 'Discussion not found' });
      return;
    }

    // Get vacancy details
    let benchmark: any = null;
    let benchmarkSource = 'default';

    if (discussion.vacancy_id) {
      const vacancy = db.prepare(`
        SELECT * FROM vacancies WHERE id = ?
      `).get(discussion.vacancy_id) as any;

      if (vacancy && (vacancy.salary_min || vacancy.salary_max)) {
        benchmark = {
          min: vacancy.salary_min,
          max: vacancy.salary_max,
          title: vacancy.title,
          source: 'vacancy'
        };
        benchmarkSource = 'vacancy';
      }
    }

    // Check RAG salary benchmarks
    const candidate = db.prepare(`
      SELECT current_designation FROM candidates WHERE id = ?
    `).get(discussion.candidate_id) as { current_designation: string | null } | undefined;

    if (candidate?.current_designation) {
      const ragBenchmark = db.prepare(`
        SELECT * FROM rag_salary_benchmarks
        WHERE LOWER(designation) LIKE LOWER(?)
        ORDER BY sample_count DESC
        LIMIT 1
      `).get(`%${candidate.current_designation}%`) as any;

      if (ragBenchmark) {
        benchmark = {
          ...benchmark,
          rag_min: ragBenchmark.annual_ctc_min,
          rag_max: ragBenchmark.annual_ctc_max,
          rag_avg: ragBenchmark.annual_ctc_avg,
          designation_match: ragBenchmark.designation,
          source: benchmarkSource === 'vacancy' ? 'both' : 'rag'
        };
      }
    }

    // Default benchmark based on offered_ctc
    if (!benchmark && discussion.offered_ctc) {
      benchmark = {
        suggested_range: {
          min: discussion.offered_ctc * 0.9,
          max: discussion.offered_ctc * 1.1
        },
        source: 'calculated'
      };
    }

    // Update discussion with benchmark
    db.prepare(`
      UPDATE ctc_discussions SET company_benchmark = ?, updatedAt = datetime('now') WHERE id = ?
    `).run(JSON.stringify(benchmark), id);

    // Analysis
    let analysis: string[] = [];
    if (discussion.expected_ctc && discussion.offered_ctc) {
      const diff = ((discussion.offered_ctc - discussion.expected_ctc) / discussion.expected_ctc) * 100;
      if (diff >= 0) {
        analysis.push(`Offered CTC is ${diff.toFixed(1)}% above candidate's expectation`);
      } else {
        analysis.push(`Offered CTC is ${Math.abs(diff).toFixed(1)}% below candidate's expectation`);
      }
    }

    if (benchmark?.min && discussion.offered_ctc) {
      if (discussion.offered_ctc < benchmark.min) {
        analysis.push('Warning: Offered CTC is below the minimum benchmark');
      } else if (discussion.offered_ctc > benchmark.max) {
        analysis.push('Note: Offered CTC is above the maximum benchmark');
      } else {
        analysis.push('Offered CTC is within the benchmark range');
      }
    }

    res.json({
      benchmark,
      analysis,
      expected_ctc: discussion.expected_ctc,
      offered_ctc: discussion.offered_ctc
    });
  } catch (error: any) {
    console.error('Error comparing benchmark:', error);
    res.status(500).json({ error: error.message || 'Failed to compare benchmark' });
  }
});

// Generate salary breakdown
router.post('/:id/generate-breakdown', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { annual_ctc } = req.body;

    const discussion = db.prepare('SELECT * FROM ctc_discussions WHERE id = ?').get(id) as CTCDiscussion | undefined;

    if (!discussion) {
      res.status(404).json({ error: 'Discussion not found' });
      return;
    }

    const ctc = annual_ctc || discussion.offered_ctc;
    if (!ctc) {
      res.status(400).json({ error: 'annual_ctc or offered_ctc is required' });
      return;
    }

    // Generate breakdown using standard percentages
    const basicPercentage = 0.40;
    const hraPercentage = 0.20;
    const conveyancePercentage = 0.05;
    const medicalPercentage = 0.05;
    const specialAllowancePercentage = 0.18;
    const pfPercentage = 0.12;

    const breakdown: SalaryComponent[] = [
      {
        component: 'Basic Salary',
        annual: Math.round(ctc * basicPercentage),
        perMonth: Math.round((ctc * basicPercentage) / 12)
      },
      {
        component: 'House Rent Allowance (HRA)',
        annual: Math.round(ctc * hraPercentage),
        perMonth: Math.round((ctc * hraPercentage) / 12)
      },
      {
        component: 'Conveyance Allowance',
        annual: Math.round(ctc * conveyancePercentage),
        perMonth: Math.round((ctc * conveyancePercentage) / 12)
      },
      {
        component: 'Medical Allowance',
        annual: Math.round(ctc * medicalPercentage),
        perMonth: Math.round((ctc * medicalPercentage) / 12)
      },
      {
        component: 'Special Allowance',
        annual: Math.round(ctc * specialAllowancePercentage),
        perMonth: Math.round((ctc * specialAllowancePercentage) / 12)
      },
      {
        component: 'Employer PF Contribution',
        annual: Math.round(ctc * pfPercentage),
        perMonth: Math.round((ctc * pfPercentage) / 12)
      }
    ];

    // Update discussion
    db.prepare(`
      UPDATE ctc_discussions
      SET salary_breakdown = ?, offered_ctc = ?, status = 'in_progress', updatedAt = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(breakdown), ctc, id);

    res.json({
      annual_ctc: ctc,
      breakdown,
      totals: {
        annual: breakdown.reduce((sum, c) => sum + c.annual, 0),
        perMonth: breakdown.reduce((sum, c) => sum + c.perMonth, 0)
      }
    });
  } catch (error: any) {
    console.error('Error generating breakdown:', error);
    res.status(500).json({ error: error.message || 'Failed to generate breakdown' });
  }
});

// Validate CTC details completeness
router.get('/:id/validate', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const discussion = db.prepare('SELECT * FROM ctc_discussions WHERE id = ?').get(id) as CTCDiscussion | undefined;

    if (!discussion) {
      res.status(404).json({ error: 'Discussion not found' });
      return;
    }

    const missingFields: string[] = [];
    const warnings: string[] = [];

    if (!discussion.offered_ctc) missingFields.push('offered_ctc');
    if (!discussion.fixed_pay && !discussion.salary_breakdown) {
      missingFields.push('fixed_pay or salary_breakdown');
    }
    if (!discussion.joining_date) missingFields.push('joining_date');

    if (discussion.expected_ctc && discussion.offered_ctc) {
      const diff = discussion.offered_ctc - discussion.expected_ctc;
      if (diff < 0) {
        warnings.push(`Offered CTC is ${Math.abs(diff).toLocaleString()} below expectation`);
      }
    }

    if (!discussion.variable_pay) {
      warnings.push('Variable pay not specified');
    }

    const result: CTCValidationResult = {
      isComplete: missingFields.length === 0,
      missingFields,
      warnings
    };

    res.json(result);
  } catch (error) {
    console.error('Error validating CTC:', error);
    res.status(500).json({ error: 'Failed to validate CTC' });
  }
});

// Finalize CTC discussion and move to offer letter
router.post('/:id/finalize', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { candidate_accepted = false } = req.body;
    const userId = req.user!.userId;

    const discussion = db.prepare(`
      SELECT cd.*, c.first_name, c.last_name, c.email, v.title as vacancy_title
      FROM ctc_discussions cd
      JOIN candidates c ON cd.candidate_id = c.id
      LEFT JOIN vacancies v ON c.vacancy_id = v.id
      WHERE cd.id = ?
    `).get(id) as (CTCDiscussion & {
      first_name: string;
      last_name: string;
      email: string;
      vacancy_title: string | null;
    }) | undefined;

    if (!discussion) {
      res.status(404).json({ error: 'Discussion not found' });
      return;
    }

    if (discussion.status === 'finalized') {
      res.status(400).json({ error: 'Discussion already finalized' });
      return;
    }

    // Validate completeness
    if (!discussion.offered_ctc || !discussion.joining_date) {
      res.status(400).json({
        error: 'Cannot finalize: Missing required fields',
        missing: [
          !discussion.offered_ctc && 'offered_ctc',
          !discussion.joining_date && 'joining_date'
        ].filter(Boolean)
      });
      return;
    }

    // Update discussion
    db.prepare(`
      UPDATE ctc_discussions
      SET status = 'finalized', candidate_response = ?, finalized_by = ?, finalized_at = datetime('now'), updatedAt = datetime('now')
      WHERE id = ?
    `).run(candidate_accepted ? 'accepted' : 'pending', userId, id);

    // Log workflow
    db.prepare(`
      INSERT INTO automation_workflow_logs
      (candidate_id, workflow_step, action_taken, action_by, action_user_id, details)
      VALUES (?, 'ctc_finalized', 'CTC discussion finalized', 'hr', ?, ?)
    `).run(
      discussion.candidate_id,
      userId,
      JSON.stringify({
        ctc_discussion_id: id,
        offered_ctc: discussion.offered_ctc,
        candidate_accepted
      })
    );

    // If candidate accepted, create offer letter prompt
    if (candidate_accepted) {
      // Create automation log for offer letter generation
      db.prepare(`
        INSERT INTO automation_workflow_logs
        (candidate_id, workflow_step, action_taken, action_by, requires_hr_action, hr_prompt)
        VALUES (?, 'generate_offer_letter', 'Ready for offer letter generation', 'system', 1, ?)
      `).run(
        discussion.candidate_id,
        'CTC has been accepted. Please generate the offer letter for this candidate.'
      );

      res.json({
        message: 'CTC finalized. Ready for offer letter generation.',
        discussion_id: id,
        candidate_id: discussion.candidate_id,
        next_step: 'generate_offer_letter',
        offer_letter_data: {
          candidate_name: `${discussion.first_name} ${discussion.last_name}`.trim(),
          email: discussion.email,
          designation: discussion.vacancy_title || 'Position',
          annual_ctc: discussion.offered_ctc,
          joining_date: discussion.joining_date,
          salary_breakdown: discussion.salary_breakdown ? JSON.parse(discussion.salary_breakdown) : null,
          joining_bonus: discussion.joining_bonus
        }
      });
    } else {
      res.json({
        message: 'CTC finalized. Awaiting candidate response.',
        discussion_id: id,
        candidate_id: discussion.candidate_id
      });
    }
  } catch (error: any) {
    console.error('Error finalizing CTC:', error);
    res.status(500).json({ error: error.message || 'Failed to finalize CTC' });
  }
});

export default router;
