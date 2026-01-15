import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { getGmailClient } from '../utils/googleAuth';
import type {
  EmailDraft,
  EmailDraftWithDetails,
  CreateEmailDraftInput,
  UpdateEmailDraftInput,
  EmailType
} from '../types';

const router = Router();
router.use(authenticateToken);

// List email drafts
router.get('/', (req: Request, res: Response): void => {
  try {
    const { status, email_type, candidate_id, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT ed.*,
             c.first_name || ' ' || COALESCE(c.last_name, '') as candidate_name,
             c.email as candidate_email,
             u.name as creator_name,
             approver.name as approver_name
      FROM email_drafts ed
      JOIN candidates c ON ed.candidate_id = c.id
      JOIN users u ON ed.created_by = u.id
      LEFT JOIN users approver ON ed.approved_by = approver.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (status) {
      query += ' AND ed.status = ?';
      params.push(status);
    }

    if (email_type) {
      query += ' AND ed.email_type = ?';
      params.push(email_type);
    }

    if (candidate_id) {
      query += ' AND ed.candidate_id = ?';
      params.push(candidate_id);
    }

    query += ' ORDER BY ed.createdAt DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const drafts = db.prepare(query).all(...params) as EmailDraftWithDetails[];

    res.json(drafts);
  } catch (error) {
    console.error('Error fetching drafts:', error);
    res.status(500).json({ error: 'Failed to fetch drafts' });
  }
});

// Get pending drafts count
router.get('/pending-count', (req: Request, res: Response): void => {
  try {
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM email_drafts WHERE status = 'draft'
    `).get() as { count: number };

    res.json({ count: result.count });
  } catch (error) {
    console.error('Error fetching pending count:', error);
    res.status(500).json({ error: 'Failed to fetch pending count' });
  }
});

// Get single draft
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const draft = db.prepare(`
      SELECT ed.*,
             c.first_name || ' ' || COALESCE(c.last_name, '') as candidate_name,
             c.email as candidate_email,
             u.name as creator_name,
             approver.name as approver_name
      FROM email_drafts ed
      JOIN candidates c ON ed.candidate_id = c.id
      JOIN users u ON ed.created_by = u.id
      LEFT JOIN users approver ON ed.approved_by = approver.id
      WHERE ed.id = ?
    `).get(id) as EmailDraftWithDetails | undefined;

    if (!draft) {
      res.status(404).json({ error: 'Draft not found' });
      return;
    }

    res.json(draft);
  } catch (error) {
    console.error('Error fetching draft:', error);
    res.status(500).json({ error: 'Failed to fetch draft' });
  }
});

// Create email draft
router.post('/', (req: Request, res: Response): void => {
  try {
    const {
      candidate_id,
      email_type,
      recipient_email,
      recipient_name,
      subject,
      body_html,
      body_text,
      attachments,
      calendar_event_data
    } = req.body as CreateEmailDraftInput;
    const userId = req.user!.userId;

    if (!candidate_id || !email_type || !recipient_email || !subject || !body_html) {
      res.status(400).json({
        error: 'candidate_id, email_type, recipient_email, subject, and body_html are required'
      });
      return;
    }

    // Verify candidate exists
    const candidate = db.prepare('SELECT id FROM candidates WHERE id = ?').get(candidate_id);
    if (!candidate) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    const result = db.prepare(`
      INSERT INTO email_drafts
      (candidate_id, email_type, recipient_email, recipient_name, subject, body_html, body_text, attachments, calendar_event_data, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      candidate_id,
      email_type,
      recipient_email,
      recipient_name || null,
      subject,
      body_html,
      body_text || null,
      attachments || null,
      calendar_event_data || null,
      userId
    );

    const draft = db.prepare(`
      SELECT ed.*,
             c.first_name || ' ' || COALESCE(c.last_name, '') as candidate_name,
             c.email as candidate_email,
             u.name as creator_name
      FROM email_drafts ed
      JOIN candidates c ON ed.candidate_id = c.id
      JOIN users u ON ed.created_by = u.id
      WHERE ed.id = ?
    `).get(result.lastInsertRowid) as EmailDraftWithDetails;

    res.status(201).json(draft);
  } catch (error) {
    console.error('Error creating draft:', error);
    res.status(500).json({ error: 'Failed to create draft' });
  }
});

// Update email draft
router.put('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const updates = req.body as UpdateEmailDraftInput;

    const existing = db.prepare('SELECT * FROM email_drafts WHERE id = ?').get(id) as EmailDraft | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Draft not found' });
      return;
    }

    if (existing.status !== 'draft') {
      res.status(400).json({ error: 'Cannot edit a draft that has been approved or sent' });
      return;
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.subject !== undefined) {
      fields.push('subject = ?');
      values.push(updates.subject);
    }
    if (updates.body_html !== undefined) {
      fields.push('body_html = ?');
      values.push(updates.body_html);
    }
    if (updates.body_text !== undefined) {
      fields.push('body_text = ?');
      values.push(updates.body_text);
    }

    if (fields.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    fields.push("updatedAt = datetime('now')");
    values.push(id);

    db.prepare(`
      UPDATE email_drafts SET ${fields.join(', ')} WHERE id = ?
    `).run(...values);

    const draft = db.prepare(`
      SELECT ed.*,
             c.first_name || ' ' || COALESCE(c.last_name, '') as candidate_name,
             c.email as candidate_email,
             u.name as creator_name,
             approver.name as approver_name
      FROM email_drafts ed
      JOIN candidates c ON ed.candidate_id = c.id
      JOIN users u ON ed.created_by = u.id
      LEFT JOIN users approver ON ed.approved_by = approver.id
      WHERE ed.id = ?
    `).get(id) as EmailDraftWithDetails;

    res.json(draft);
  } catch (error) {
    console.error('Error updating draft:', error);
    res.status(500).json({ error: 'Failed to update draft' });
  }
});

// Approve and send email draft
router.post('/:id/approve', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { gmail_connection_id } = req.body;
    const userId = req.user!.userId;

    const draft = db.prepare('SELECT * FROM email_drafts WHERE id = ?').get(id) as EmailDraft | undefined;

    if (!draft) {
      res.status(404).json({ error: 'Draft not found' });
      return;
    }

    if (draft.status !== 'draft') {
      res.status(400).json({ error: 'Draft has already been processed' });
      return;
    }

    // Update status to approved
    db.prepare(`
      UPDATE email_drafts
      SET status = 'approved', approved_by = ?, approved_at = datetime('now'), updatedAt = datetime('now')
      WHERE id = ?
    `).run(userId, id);

    // Try to send email if gmail_connection_id provided
    if (gmail_connection_id) {
      try {
        await sendEmail(gmail_connection_id, draft);

        db.prepare(`
          UPDATE email_drafts
          SET status = 'sent', sent_at = datetime('now'), updatedAt = datetime('now')
          WHERE id = ?
        `).run(id);

        // Log workflow action
        db.prepare(`
          INSERT INTO automation_workflow_logs
          (candidate_id, workflow_step, action_taken, action_by, action_user_id, details)
          VALUES (?, ?, ?, 'hr', ?, ?)
        `).run(
          draft.candidate_id,
          draft.email_type === 'interview_invite' ? 'interview_scheduled' :
          draft.email_type === 'offer' ? 'offer_sent' :
          draft.email_type === 'rejection' ? 'rejected' : 'email_sent',
          `${draft.email_type} email sent`,
          userId,
          JSON.stringify({ email_draft_id: id })
        );

        // Update candidate status based on email type
        if (draft.email_type === 'offer') {
          db.prepare(`
            UPDATE candidates SET status = 'offer_sent', updatedAt = datetime('now') WHERE id = ?
          `).run(draft.candidate_id);
        } else if (draft.email_type === 'rejection') {
          db.prepare(`
            UPDATE candidates SET status = 'rejected', updatedAt = datetime('now') WHERE id = ?
          `).run(draft.candidate_id);
        } else if (draft.email_type === 'interview_invite') {
          db.prepare(`
            UPDATE candidates SET status = 'interview_scheduled', updatedAt = datetime('now') WHERE id = ?
          `).run(draft.candidate_id);
        }

      } catch (sendError: any) {
        console.error('Error sending email:', sendError);
        db.prepare(`
          UPDATE email_drafts
          SET status = 'failed', error_message = ?, updatedAt = datetime('now')
          WHERE id = ?
        `).run(sendError.message, id);

        res.status(500).json({
          error: 'Draft approved but email sending failed',
          details: sendError.message
        });
        return;
      }
    }

    const updatedDraft = db.prepare(`
      SELECT ed.*,
             c.first_name || ' ' || COALESCE(c.last_name, '') as candidate_name,
             c.email as candidate_email,
             u.name as creator_name,
             approver.name as approver_name
      FROM email_drafts ed
      JOIN candidates c ON ed.candidate_id = c.id
      JOIN users u ON ed.created_by = u.id
      LEFT JOIN users approver ON ed.approved_by = approver.id
      WHERE ed.id = ?
    `).get(id) as EmailDraftWithDetails;

    res.json({
      message: gmail_connection_id ? 'Draft approved and email sent' : 'Draft approved',
      draft: updatedDraft
    });
  } catch (error: any) {
    console.error('Error approving draft:', error);
    res.status(500).json({ error: error.message || 'Failed to approve draft' });
  }
});

// Reject email draft
router.post('/:id/reject', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user!.userId;

    const draft = db.prepare('SELECT * FROM email_drafts WHERE id = ?').get(id) as EmailDraft | undefined;

    if (!draft) {
      res.status(404).json({ error: 'Draft not found' });
      return;
    }

    if (draft.status !== 'draft') {
      res.status(400).json({ error: 'Draft has already been processed' });
      return;
    }

    // Delete or mark as rejected
    db.prepare(`
      DELETE FROM email_drafts WHERE id = ?
    `).run(id);

    res.json({ message: 'Draft rejected and deleted' });
  } catch (error) {
    console.error('Error rejecting draft:', error);
    res.status(500).json({ error: 'Failed to reject draft' });
  }
});

// Generate draft from template
router.post('/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      template_id,
      candidate_id,
      interview_id,
      variables
    } = req.body;
    const userId = req.user!.userId;

    if (!candidate_id) {
      res.status(400).json({ error: 'candidate_id is required' });
      return;
    }

    // Get candidate details
    const candidate = db.prepare(`
      SELECT c.*, v.title as vacancy_title, v.department as vacancy_department
      FROM candidates c
      LEFT JOIN vacancies v ON c.vacancy_id = v.id
      WHERE c.id = ?
    `).get(candidate_id) as any;

    if (!candidate) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    // Get template
    let template: any;
    if (template_id) {
      template = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(template_id);
    }

    if (!template) {
      res.status(400).json({ error: 'template_id is required or template not found' });
      return;
    }

    // Build variables
    const templateVars: Record<string, string> = {
      candidate_name: `${candidate.first_name} ${candidate.last_name || ''}`.trim(),
      candidate_first_name: candidate.first_name,
      candidate_email: candidate.email,
      vacancy_title: candidate.vacancy_title || 'Position',
      vacancy_department: candidate.vacancy_department || 'Department',
      company_name: 'Phoneme Solutions', // Could be from settings
      hr_manager_name: 'HR Team',
      hr_manager_title: 'Human Resources',
      ...variables
    };

    // Get interview details if interview_id provided
    if (interview_id) {
      const interview = db.prepare(`
        SELECT i.*, u.name as interviewer_name
        FROM interviews i
        JOIN users u ON i.interviewer_id = u.id
        WHERE i.id = ?
      `).get(interview_id) as any;

      if (interview) {
        templateVars.interview_date = formatDate(interview.scheduled_date);
        templateVars.interview_time = interview.scheduled_time;
        templateVars.interview_duration = String(interview.duration_minutes || 60);
        templateVars.interview_type = interview.interview_type;
        templateVars.interviewer_name = interview.interviewer_name;
        templateVars.meeting_link = interview.meeting_link || '';
        templateVars.location = interview.location || '';
      }
    }

    // Replace variables in template
    let subject = template.subject_template;
    let body = template.body_template;

    for (const [key, value] of Object.entries(templateVars)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, value);
      body = body.replace(regex, value);
    }

    // Handle conditional blocks
    body = body.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match: string, variable: string, content: string) => {
      return templateVars[variable] ? content : '';
    });

    // Create draft
    const result = db.prepare(`
      INSERT INTO email_drafts
      (candidate_id, email_type, recipient_email, recipient_name, subject, body_html, body_text, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      candidate_id,
      template.email_type,
      candidate.email,
      templateVars.candidate_name,
      subject,
      body,
      body.replace(/<[^>]*>/g, ''), // Strip HTML for plain text
      userId
    );

    // If interview_id provided, link the draft
    if (interview_id) {
      db.prepare(`
        UPDATE interviews SET email_draft_id = ? WHERE id = ?
      `).run(result.lastInsertRowid, interview_id);
    }

    const draft = db.prepare(`
      SELECT ed.*,
             c.first_name || ' ' || COALESCE(c.last_name, '') as candidate_name,
             c.email as candidate_email,
             u.name as creator_name
      FROM email_drafts ed
      JOIN candidates c ON ed.candidate_id = c.id
      JOIN users u ON ed.created_by = u.id
      WHERE ed.id = ?
    `).get(result.lastInsertRowid) as EmailDraftWithDetails;

    res.status(201).json(draft);
  } catch (error: any) {
    console.error('Error generating draft:', error);
    res.status(500).json({ error: error.message || 'Failed to generate draft' });
  }
});

// Helper: Send email via Gmail API
async function sendEmail(connectionId: number, draft: EmailDraft): Promise<void> {
  const gmail = await getGmailClient(connectionId);

  // Build email message
  const emailLines = [
    `To: ${draft.recipient_name ? `${draft.recipient_name} <${draft.recipient_email}>` : draft.recipient_email}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${draft.subject}`,
    '',
    draft.body_html
  ];

  const email = emailLines.join('\r\n');
  const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedEmail
    }
  });
}

// Helper: Format date
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export default router;
