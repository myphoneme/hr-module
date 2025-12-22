import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import type {
  AutomationWorkflowLog,
  AutomationWorkflowLogWithUser,
  PendingAction,
  AutomationStatus,
  WorkflowStep
} from '../types';

const router = Router();
router.use(authenticateToken);

// Automation configuration
const AUTOMATION_CONFIG = {
  AUTO_REJECT_THRESHOLD: 40,      // Score < 40% = auto reject
  HR_REVIEW_THRESHOLD: 70,        // Score 40-70% = needs HR review
  AUTO_SHORTLIST_THRESHOLD: 70,   // Score >= 70% = auto shortlist
  INTERVIEW_PASS_SCORE: 3.5,      // Out of 5
  SYNC_INTERVAL_MINUTES: 15
};

// Get automation status/dashboard
router.get('/status', (_req: Request, res: Response): void => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Total candidates
    const totalCandidates = db.prepare(`
      SELECT COUNT(*) as count FROM candidates WHERE isActive = 1
    `).get() as { count: number };

    // Automated candidates
    const automatedCandidates = db.prepare(`
      SELECT COUNT(*) as count FROM candidates WHERE automation_status = 'automated' AND isActive = 1
    `).get() as { count: number };

    // Pending HR actions
    const pendingActions = db.prepare(`
      SELECT COUNT(*) as count FROM automation_workflow_logs
      WHERE requires_hr_action = 1
      AND id IN (
        SELECT MAX(id) FROM automation_workflow_logs GROUP BY candidate_id
      )
    `).get() as { count: number };

    // Today's applications
    const todayApplications = db.prepare(`
      SELECT COUNT(*) as count FROM email_applications
      WHERE date(createdAt) = date('now')
    `).get() as { count: number };

    // Today's shortlisted
    const todayShortlisted = db.prepare(`
      SELECT COUNT(*) as count FROM candidates
      WHERE date(auto_shortlisted_at) = date('now')
    `).get() as { count: number };

    // Today's rejected
    const todayRejected = db.prepare(`
      SELECT COUNT(*) as count FROM candidates
      WHERE date(auto_rejected_at) = date('now')
    `).get() as { count: number };

    // Pending interviews
    const pendingInterviews = db.prepare(`
      SELECT COUNT(*) as count FROM interviews
      WHERE status IN ('scheduled', 'confirmed')
      AND scheduled_date >= date('now')
    `).get() as { count: number };

    // Pending offers
    const pendingOffers = db.prepare(`
      SELECT COUNT(*) as count FROM candidates
      WHERE status = 'selected'
      AND offer_letter_id IS NULL
    `).get() as { count: number };

    const status: AutomationStatus = {
      total_candidates: totalCandidates.count,
      automated_candidates: automatedCandidates.count,
      pending_hr_actions: pendingActions.count,
      today_applications: todayApplications.count,
      today_shortlisted: todayShortlisted.count,
      today_rejected: todayRejected.count,
      pending_interviews: pendingInterviews.count,
      pending_offers: pendingOffers.count
    };

    res.json({
      status,
      config: AUTOMATION_CONFIG
    });
  } catch (error) {
    console.error('Error fetching automation status:', error);
    res.status(500).json({ error: 'Failed to fetch automation status' });
  }
});

// Get pending HR actions
router.get('/pending-actions', (req: Request, res: Response): void => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const actions = db.prepare(`
      SELECT awl.*,
             c.first_name || ' ' || COALESCE(c.last_name, '') as candidate_name,
             c.email as candidate_email,
             v.title as vacancy_title
      FROM automation_workflow_logs awl
      JOIN candidates c ON awl.candidate_id = c.id
      LEFT JOIN vacancies v ON c.vacancy_id = v.id
      WHERE awl.requires_hr_action = 1
      AND awl.id IN (
        SELECT MAX(id) FROM automation_workflow_logs
        WHERE requires_hr_action = 1
        GROUP BY candidate_id
      )
      ORDER BY awl.createdAt DESC
      LIMIT ? OFFSET ?
    `).all(Number(limit), Number(offset)) as PendingAction[];

    res.json(actions);
  } catch (error) {
    console.error('Error fetching pending actions:', error);
    res.status(500).json({ error: 'Failed to fetch pending actions' });
  }
});

// Get candidate workflow history
router.get('/candidates/:id/workflow', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const workflow = db.prepare(`
      SELECT awl.*,
             c.first_name || ' ' || COALESCE(c.last_name, '') as candidate_name,
             u.name as action_user_name
      FROM automation_workflow_logs awl
      JOIN candidates c ON awl.candidate_id = c.id
      LEFT JOIN users u ON awl.action_user_id = u.id
      WHERE awl.candidate_id = ?
      ORDER BY awl.createdAt ASC
    `).all(id) as AutomationWorkflowLogWithUser[];

    // Get current candidate status
    const candidate = db.prepare(`
      SELECT c.*, v.title as vacancy_title
      FROM candidates c
      LEFT JOIN vacancies v ON c.vacancy_id = v.id
      WHERE c.id = ?
    `).get(id) as any;

    if (!candidate) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    res.json({
      candidate: {
        id: candidate.id,
        name: `${candidate.first_name} ${candidate.last_name || ''}`.trim(),
        email: candidate.email,
        status: candidate.status,
        automation_status: candidate.automation_status,
        vacancy_title: candidate.vacancy_title
      },
      workflow: workflow.map(w => ({
        ...w,
        is_automated: Boolean(w.is_automated),
        requires_hr_action: Boolean(w.requires_hr_action),
        details: w.details ? JSON.parse(w.details) : null
      })),
      current_step: workflow.length > 0 ? workflow[workflow.length - 1].workflow_step : null
    });
  } catch (error) {
    console.error('Error fetching workflow:', error);
    res.status(500).json({ error: 'Failed to fetch workflow' });
  }
});

// Manually advance workflow
router.post('/candidates/:id/advance', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const { target_step, action_taken, details } = req.body as {
      target_step: WorkflowStep;
      action_taken?: string;
      details?: any;
    };
    const userId = req.user!.userId;

    if (!target_step) {
      res.status(400).json({ error: 'target_step is required' });
      return;
    }

    // Get candidate
    const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(id) as any;

    if (!candidate) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    // Get current workflow step
    const currentStep = db.prepare(`
      SELECT workflow_step FROM automation_workflow_logs
      WHERE candidate_id = ?
      ORDER BY createdAt DESC
      LIMIT 1
    `).get(id) as { workflow_step: WorkflowStep } | undefined;

    // Log workflow action
    db.prepare(`
      INSERT INTO automation_workflow_logs
      (candidate_id, workflow_step, previous_step, action_taken, action_by, action_user_id, details, is_automated, requires_hr_action)
      VALUES (?, ?, ?, ?, 'hr', ?, ?, 0, 0)
    `).run(
      id,
      target_step,
      currentStep?.workflow_step || null,
      action_taken || `Manually advanced to ${target_step}`,
      userId,
      details ? JSON.stringify(details) : null
    );

    // Update candidate status based on workflow step
    const statusMap: Record<WorkflowStep, string> = {
      new_application: 'new',
      ai_screening: 'screening',
      hr_review_required: 'screening',
      shortlisted: 'shortlisted',
      rejected: 'rejected',
      schedule_interview: 'shortlisted',
      interview_scheduled: 'interview_scheduled',
      interview_completed: 'interviewed',
      selected: 'selected',
      ctc_discussion: 'selected',
      ctc_finalized: 'selected',
      generate_offer_letter: 'selected',
      offer_sent: 'offer_sent',
      offer_accepted: 'offer_accepted',
      offer_rejected: 'offer_rejected',
      joined: 'joined'
    };

    if (statusMap[target_step]) {
      db.prepare(`
        UPDATE candidates SET status = ?, updatedAt = datetime('now') WHERE id = ?
      `).run(statusMap[target_step], id);
    }

    res.json({
      message: `Workflow advanced to ${target_step}`,
      candidate_id: id,
      new_step: target_step
    });
  } catch (error) {
    console.error('Error advancing workflow:', error);
    res.status(500).json({ error: 'Failed to advance workflow' });
  }
});

// Pause automation for a candidate
router.post('/candidates/:id/pause', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user!.userId;

    const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(id) as any;

    if (!candidate) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    // Update automation status
    db.prepare(`
      UPDATE candidates SET automation_status = 'paused', updatedAt = datetime('now') WHERE id = ?
    `).run(id);

    // Log workflow action
    db.prepare(`
      INSERT INTO automation_workflow_logs
      (candidate_id, workflow_step, action_taken, action_by, action_user_id, details, is_automated)
      VALUES (?, 'paused', 'Automation paused', 'hr', ?, ?, 0)
    `).run(id, userId, reason ? JSON.stringify({ reason }) : null);

    res.json({
      message: 'Automation paused for candidate',
      candidate_id: id
    });
  } catch (error) {
    console.error('Error pausing automation:', error);
    res.status(500).json({ error: 'Failed to pause automation' });
  }
});

// Resume automation for a candidate
router.post('/candidates/:id/resume', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(id) as any;

    if (!candidate) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    // Update automation status
    db.prepare(`
      UPDATE candidates SET automation_status = 'automated', updatedAt = datetime('now') WHERE id = ?
    `).run(id);

    // Log workflow action
    db.prepare(`
      INSERT INTO automation_workflow_logs
      (candidate_id, workflow_step, action_taken, action_by, action_user_id, is_automated)
      VALUES (?, 'resumed', 'Automation resumed', 'hr', ?, 0)
    `).run(id, userId);

    res.json({
      message: 'Automation resumed for candidate',
      candidate_id: id
    });
  } catch (error) {
    console.error('Error resuming automation:', error);
    res.status(500).json({ error: 'Failed to resume automation' });
  }
});

// Trigger AI evaluation for a candidate
router.post('/evaluate-candidate/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const candidate = db.prepare(`
      SELECT c.*, v.requirements, v.skills_required, v.title as vacancy_title
      FROM candidates c
      LEFT JOIN vacancies v ON c.vacancy_id = v.id
      WHERE c.id = ?
    `).get(id) as any;

    if (!candidate) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    if (!candidate.resume_extracted_text) {
      res.status(400).json({ error: 'No resume text available for evaluation' });
      return;
    }

    // Perform AI screening
    const screeningResult = await performAIEvaluation(candidate);

    // Update candidate with screening results
    db.prepare(`
      UPDATE candidates
      SET screening_score = ?, screening_notes = ?, updatedAt = datetime('now')
      WHERE id = ?
    `).run(
      screeningResult.score,
      JSON.stringify(screeningResult),
      id
    );

    // Determine action based on score
    let workflowStep: WorkflowStep;
    let newStatus: string;
    let requiresHRAction = false;
    let hrPrompt: string | null = null;

    if (screeningResult.score < AUTOMATION_CONFIG.AUTO_REJECT_THRESHOLD) {
      workflowStep = 'rejected';
      newStatus = 'rejected';
      db.prepare(`
        UPDATE candidates
        SET auto_rejected_at = datetime('now'), auto_rejection_reason = ?
        WHERE id = ?
      `).run(screeningResult.analysis, id);
    } else if (screeningResult.score < AUTOMATION_CONFIG.HR_REVIEW_THRESHOLD) {
      workflowStep = 'hr_review_required';
      newStatus = 'screening';
      requiresHRAction = true;
      hrPrompt = `AI scored this candidate ${screeningResult.score}%. Please review and decide: shortlist or reject.`;
    } else {
      workflowStep = 'shortlisted';
      newStatus = 'shortlisted';
      db.prepare(`
        UPDATE candidates
        SET auto_shortlisted_at = datetime('now')
        WHERE id = ?
      `).run(id);
    }

    // Update candidate status
    db.prepare(`
      UPDATE candidates SET status = ?, automation_status = 'automated', updatedAt = datetime('now') WHERE id = ?
    `).run(newStatus, id);

    // Log workflow
    db.prepare(`
      INSERT INTO automation_workflow_logs
      (candidate_id, workflow_step, previous_step, action_taken, action_by, action_user_id, details, is_automated, requires_hr_action, hr_prompt)
      VALUES (?, ?, 'ai_screening', ?, 'system', ?, ?, 1, ?, ?)
    `).run(
      id,
      workflowStep,
      `AI evaluation completed with score ${screeningResult.score}%`,
      userId,
      JSON.stringify(screeningResult),
      requiresHRAction ? 1 : 0,
      hrPrompt
    );

    res.json({
      candidate_id: id,
      screening_result: screeningResult,
      workflow_step: workflowStep,
      new_status: newStatus,
      requires_hr_action: requiresHRAction,
      hr_prompt: hrPrompt
    });
  } catch (error: any) {
    console.error('Error evaluating candidate:', error);
    res.status(500).json({ error: error.message || 'Failed to evaluate candidate' });
  }
});

// Process interview feedback and determine next step
router.post('/process-interview/:interviewId', (req: Request, res: Response): void => {
  try {
    const { interviewId } = req.params;
    const { score, notes } = req.body;
    const userId = req.user!.userId;

    if (score === undefined || score === null) {
      res.status(400).json({ error: 'score is required' });
      return;
    }

    // Get interview and candidate
    const interview = db.prepare(`
      SELECT i.*, c.id as candidate_id, c.first_name, c.last_name
      FROM interviews i
      JOIN candidates c ON i.candidate_id = c.id
      WHERE i.id = ?
    `).get(interviewId) as any;

    if (!interview) {
      res.status(404).json({ error: 'Interview not found' });
      return;
    }

    // Update interview with score
    db.prepare(`
      UPDATE interviews
      SET rating = ?, notes = ?, status = 'completed', updatedAt = datetime('now')
      WHERE id = ?
    `).run(score, notes || null, interviewId);

    // Update candidate with final interview score
    db.prepare(`
      UPDATE candidates
      SET final_interview_score = ?, updatedAt = datetime('now')
      WHERE id = ?
    `).run(score, interview.candidate_id);

    // Determine outcome based on score
    let workflowStep: WorkflowStep;
    let newStatus: string;
    let requiresHRAction = false;
    let hrPrompt: string | null = null;

    if (score < AUTOMATION_CONFIG.INTERVIEW_PASS_SCORE) {
      workflowStep = 'rejected';
      newStatus = 'rejected';
      db.prepare(`
        UPDATE candidates
        SET auto_rejected_at = datetime('now'),
            auto_rejection_reason = 'Interview score below threshold (${score} < ${AUTOMATION_CONFIG.INTERVIEW_PASS_SCORE})'
        WHERE id = ?
      `).run(interview.candidate_id);
    } else {
      workflowStep = 'selected';
      newStatus = 'selected';
      requiresHRAction = true;
      hrPrompt = `Candidate passed interview with score ${score}/5. Please initiate CTC discussion.`;
    }

    // Update candidate status
    db.prepare(`
      UPDATE candidates SET status = ?, updatedAt = datetime('now') WHERE id = ?
    `).run(newStatus, interview.candidate_id);

    // Log workflow
    db.prepare(`
      INSERT INTO automation_workflow_logs
      (candidate_id, workflow_step, previous_step, action_taken, action_by, action_user_id, details, is_automated, requires_hr_action, hr_prompt)
      VALUES (?, ?, 'interview_completed', ?, 'system', ?, ?, 1, ?, ?)
    `).run(
      interview.candidate_id,
      workflowStep,
      `Interview completed with score ${score}/5`,
      userId,
      JSON.stringify({ interview_id: interviewId, score, notes }),
      requiresHRAction ? 1 : 0,
      hrPrompt
    );

    res.json({
      candidate_id: interview.candidate_id,
      interview_id: interviewId,
      score,
      workflow_step: workflowStep,
      new_status: newStatus,
      requires_hr_action: requiresHRAction,
      hr_prompt: hrPrompt
    });
  } catch (error: any) {
    console.error('Error processing interview:', error);
    res.status(500).json({ error: error.message || 'Failed to process interview' });
  }
});

// Mark pending action as completed
router.post('/complete-action/:logId', (req: Request, res: Response): void => {
  try {
    const { logId } = req.params;
    const { resolution, notes } = req.body;
    const userId = req.user!.userId;

    const log = db.prepare('SELECT * FROM automation_workflow_logs WHERE id = ?').get(logId) as AutomationWorkflowLog | undefined;

    if (!log) {
      res.status(404).json({ error: 'Workflow log not found' });
      return;
    }

    // Update the log
    db.prepare(`
      UPDATE automation_workflow_logs
      SET requires_hr_action = 0, details = ?
      WHERE id = ?
    `).run(
      JSON.stringify({
        ...(log.details ? JSON.parse(log.details) : {}),
        resolution,
        notes,
        completed_by: userId,
        completed_at: new Date().toISOString()
      }),
      logId
    );

    res.json({
      message: 'Action completed',
      log_id: logId
    });
  } catch (error) {
    console.error('Error completing action:', error);
    res.status(500).json({ error: 'Failed to complete action' });
  }
});

// Get automation configuration
router.get('/config', requireAdmin, (_req: Request, res: Response): void => {
  res.json(AUTOMATION_CONFIG);
});

// Helper: Perform AI evaluation
async function performAIEvaluation(candidate: any): Promise<{
  score: number;
  analysis: string;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
}> {
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    // Return default evaluation if no AI
    return {
      score: 50,
      analysis: 'AI evaluation not available - manual review required',
      strengths: [],
      weaknesses: [],
      recommendation: 'review'
    };
  }

  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: openaiApiKey });

    const prompt = `Evaluate this candidate for the position and provide a detailed assessment.

POSITION: ${candidate.vacancy_title || 'Open Position'}
REQUIREMENTS: ${candidate.requirements || 'Not specified'}
SKILLS REQUIRED: ${candidate.skills_required || 'Not specified'}

CANDIDATE RESUME:
${candidate.resume_extracted_text?.substring(0, 8000) || 'No resume text available'}

CURRENT INFO:
- Experience: ${candidate.experience_years || 'Not specified'} years
- Current Company: ${candidate.current_company || 'Not specified'}
- Current Designation: ${candidate.current_designation || 'Not specified'}
- Skills: ${candidate.skills || 'Not specified'}

Provide a JSON response with:
1. score (0-100): Overall match score
2. analysis: Brief analysis (2-3 sentences)
3. strengths: Array of key strengths (max 5)
4. weaknesses: Array of concerns or gaps (max 5)
5. recommendation: "shortlist", "review", or "reject"

Response format:
{
  "score": number,
  "analysis": "string",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "recommendation": "shortlist" | "review" | "reject"
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0]?.message?.content || '{}');

    return {
      score: result.score || 50,
      analysis: result.analysis || 'Analysis not available',
      strengths: result.strengths || [],
      weaknesses: result.weaknesses || [],
      recommendation: result.recommendation || 'review'
    };
  } catch (error) {
    console.error('AI evaluation error:', error);
    return {
      score: 50,
      analysis: 'AI evaluation failed - manual review required',
      strengths: [],
      weaknesses: [],
      recommendation: 'review'
    };
  }
}

export default router;
