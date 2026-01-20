import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import {
  getGmailAuthUrl,
  exchangeCodeForTokens,
  getGmailClient,
  isGoogleOAuthConfigured
} from '../utils/googleAuth';
import { clientBaseUrl } from '../config';
import type {
  GmailConnection,
  GmailConnectionWithUser,
  GmailSyncHistory,
  EmailApplication,
  EmailApplicationWithDetails,
  HRAction
} from '../types';
import path from 'path';
import fs from 'fs';

const router = Router();
router.use(authenticateToken);

// Check if Google OAuth is configured
router.get('/status', (_req: Request, res: Response): void => {
  try {
    res.json({
      configured: isGoogleOAuthConfigured(),
      message: isGoogleOAuthConfigured()
        ? 'Google OAuth is configured'
        : 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check OAuth status' });
  }
});

// Get Google OAuth URL for Gmail
router.get('/auth-url', (_req: Request, res: Response): void => {
  try {
    if (!isGoogleOAuthConfigured()) {
      res.status(400).json({ error: 'Google OAuth is not configured' });
      return;
    }

    const authUrl = getGmailAuthUrl();
    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

// Handle OAuth callback
router.post('/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.body;
    const userId = req.user!.userId;

    if (!code) {
      res.status(400).json({ error: 'Authorization code is required' });
      return;
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, 'gmail');

    // Check if connection already exists for this email
    const existing = db.prepare(`
      SELECT id FROM gmail_connections WHERE email = ? AND user_id = ?
    `).get(tokens.email, userId) as { id: number } | undefined;

    let connectionId: number;

    if (existing) {
      // Update existing connection
      db.prepare(`
        UPDATE gmail_connections
        SET access_token = ?, refresh_token = ?, token_expiry = ?, is_active = 1, updatedAt = datetime('now')
        WHERE id = ?
      `).run(
        tokens.access_token,
        tokens.refresh_token,
        new Date(tokens.expiry_date).toISOString(),
        existing.id
      );
      connectionId = existing.id;
    } else {
      // Create new connection
      const result = db.prepare(`
        INSERT INTO gmail_connections (user_id, email, access_token, refresh_token, token_expiry)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        userId,
        tokens.email,
        tokens.access_token,
        tokens.refresh_token,
        new Date(tokens.expiry_date).toISOString()
      );
      connectionId = result.lastInsertRowid as number;
    }

    const connection = db.prepare('SELECT * FROM gmail_connections WHERE id = ?').get(connectionId);

    res.status(201).json({
      message: 'Gmail connected successfully',
      connection
    });
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    console.error('Full error details:', JSON.stringify(error.response?.data || error, null, 2));
    const errorMessage = error.response?.data?.error_description
      || error.response?.data?.error
      || error.message
      || 'Failed to connect Gmail';
    res.status(500).json({ error: errorMessage, details: error.response?.data });
  }
});

// Handle OAuth callback via GET (browser redirect)
router.get('/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    const code = req.query.code as string | undefined;
    const userId = req.user!.userId;

    if (!code) {
      res.status(400).send('Authorization code is required');
      return;
    }

    const tokens = await exchangeCodeForTokens(code, 'gmail');

    const existing = db.prepare(`
      SELECT id FROM gmail_connections WHERE email = ? AND user_id = ?
    `).get(tokens.email, userId) as { id: number } | undefined;

    let connectionId: number;

    if (existing) {
      db.prepare(`
        UPDATE gmail_connections
        SET access_token = ?, refresh_token = ?, token_expiry = ?, is_active = 1, updatedAt = datetime('now')
        WHERE id = ?
      `).run(
        tokens.access_token,
        tokens.refresh_token,
        new Date(tokens.expiry_date).toISOString(),
        existing.id
      );
      connectionId = existing.id;
    } else {
      const result = db.prepare(`
        INSERT INTO gmail_connections (user_id, email, access_token, refresh_token, token_expiry)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        userId,
        tokens.email,
        tokens.access_token,
        tokens.refresh_token,
        new Date(tokens.expiry_date).toISOString()
      );
      connectionId = result.lastInsertRowid as number;
    }

    const connection = db.prepare('SELECT * FROM gmail_connections WHERE id = ?').get(connectionId);

    const redirectBase = clientBaseUrl.endsWith('/') ? clientBaseUrl : `${clientBaseUrl}/`;
    res.redirect(`${redirectBase}?gmail=connected`);
  } catch (error: any) {
    console.error('OAuth callback (GET) error:', error);
    const redirectBase = clientBaseUrl.endsWith('/') ? clientBaseUrl : `${clientBaseUrl}/`;
    res.redirect(`${redirectBase}?gmail=error`);
  }
});

// List connected Gmail accounts
router.get('/connections', (req: Request, res: Response): void => {
  try {
    const userId = req.user!.userId;
    const isAdmin = req.user!.role === 'admin';

    let connections: GmailConnectionWithUser[];

    if (isAdmin) {
      connections = db.prepare(`
        SELECT gc.*, u.name as user_name, u.email as user_email
        FROM gmail_connections gc
        JOIN users u ON gc.user_id = u.id
        WHERE gc.is_active = 1
        ORDER BY gc.createdAt DESC
      `).all() as GmailConnectionWithUser[];
    } else {
      connections = db.prepare(`
        SELECT gc.*, u.name as user_name, u.email as user_email
        FROM gmail_connections gc
        JOIN users u ON gc.user_id = u.id
        WHERE gc.user_id = ? AND gc.is_active = 1
        ORDER BY gc.createdAt DESC
      `).all(userId) as GmailConnectionWithUser[];
    }

    // Remove sensitive data
    const safeConnections = connections.map(c => ({
      ...c,
      access_token: undefined,
      refresh_token: undefined,
      is_active: Boolean(c.is_active)
    }));

    res.json(safeConnections);
  } catch (error) {
    console.error('Error fetching connections:', error);
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
});

// Disconnect Gmail account
router.delete('/connections/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const isAdmin = req.user!.role === 'admin';

    // Check ownership
    const connection = db.prepare(`
      SELECT * FROM gmail_connections WHERE id = ?
    `).get(id) as GmailConnection | undefined;

    if (!connection) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    if (!isAdmin && connection.user_id !== userId) {
      res.status(403).json({ error: 'Not authorized to disconnect this account' });
      return;
    }

    // Soft delete
    db.prepare(`
      UPDATE gmail_connections SET is_active = 0, updatedAt = datetime('now') WHERE id = ?
    `).run(id);

    res.json({ message: 'Gmail disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting Gmail:', error);
    res.status(500).json({ error: 'Failed to disconnect Gmail' });
  }
});

// Trigger email sync
router.post('/sync', async (req: Request, res: Response): Promise<void> => {
  try {
    const { connection_id, sync_type = 'incremental' } = req.body;
    const userId = req.user!.userId;

    if (!connection_id) {
      res.status(400).json({ error: 'connection_id is required' });
      return;
    }

    // Verify connection ownership
    const connection = db.prepare(`
      SELECT * FROM gmail_connections WHERE id = ? AND is_active = 1
    `).get(connection_id) as GmailConnection | undefined;

    if (!connection) {
      res.status(404).json({ error: 'Gmail connection not found' });
      return;
    }

    // Create sync history record
    const syncResult = db.prepare(`
      INSERT INTO gmail_sync_history (connection_id, sync_type, started_at)
      VALUES (?, ?, datetime('now'))
    `).run(connection_id, sync_type);

    const syncId = syncResult.lastInsertRowid as number;

    // Start async sync process
    syncEmails(connection_id, syncId, sync_type as 'full' | 'incremental')
      .catch(error => {
        console.error('Sync error:', error);
        db.prepare(`
          UPDATE gmail_sync_history
          SET status = 'failed', completed_at = datetime('now'), errors = ?
          WHERE id = ?
        `).run(error.message, syncId);
      });

    res.json({
      message: 'Sync started',
      sync_id: syncId
    });
  } catch (error: any) {
    console.error('Error starting sync:', error);
    res.status(500).json({ error: error.message || 'Failed to start sync' });
  }
});

// Get sync history
router.get('/sync-history', (req: Request, res: Response): void => {
  try {
    const { connection_id } = req.query;

    let query = `
      SELECT gsh.*, gc.email as connection_email
      FROM gmail_sync_history gsh
      JOIN gmail_connections gc ON gsh.connection_id = gc.id
    `;

    const params: any[] = [];

    if (connection_id) {
      query += ' WHERE gsh.connection_id = ?';
      params.push(connection_id);
    }

    query += ' ORDER BY gsh.started_at DESC LIMIT 50';

    const history = db.prepare(query).all(...params) as (GmailSyncHistory & { connection_email: string })[];

    res.json(history);
  } catch (error) {
    console.error('Error fetching sync history:', error);
    res.status(500).json({ error: 'Failed to fetch sync history' });
  }
});

// List email applications
router.get('/applications', (req: Request, res: Response): void => {
  try {
    const { status, hr_action, vacancy_id, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT ea.*,
             v.title as vacancy_title,
             COALESCE(c.first_name || ' ' || c.last_name, ea.sender_name) as candidate_name
      FROM email_applications ea
      LEFT JOIN vacancies v ON ea.vacancy_id = v.id
      LEFT JOIN candidates c ON ea.candidate_id = c.id
      WHERE ea.isActive = 1
    `;

    const params: any[] = [];

    if (status) {
      query += ' AND ea.status = ?';
      params.push(status);
    }

    if (hr_action) {
      query += ' AND ea.hr_action = ?';
      params.push(hr_action);
    }

    if (vacancy_id) {
      query += ' AND ea.vacancy_id = ?';
      params.push(vacancy_id);
    }

    query += ' ORDER BY ea.received_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const applications = db.prepare(query).all(...params) as EmailApplicationWithDetails[];

    res.json(applications.map(app => ({
      ...app,
      isActive: Boolean(app.isActive)
    })));
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Get single application
router.get('/applications/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const application = db.prepare(`
      SELECT ea.*,
             v.title as vacancy_title,
             v.department as vacancy_department,
             v.requirements as vacancy_requirements,
             COALESCE(c.first_name || ' ' || c.last_name, ea.sender_name) as candidate_name
      FROM email_applications ea
      LEFT JOIN vacancies v ON ea.vacancy_id = v.id
      LEFT JOIN candidates c ON ea.candidate_id = c.id
      WHERE ea.id = ?
    `).get(id) as EmailApplicationWithDetails | undefined;

    if (!application) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }

    res.json({
      ...application,
      isActive: Boolean(application.isActive)
    });
  } catch (error) {
    console.error('Error fetching application:', error);
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

// Process application (match to vacancy)
router.post('/applications/:id/process', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { vacancy_id } = req.body;

    if (!vacancy_id) {
      res.status(400).json({ error: 'vacancy_id is required' });
      return;
    }

    const application = db.prepare(`
      SELECT * FROM email_applications WHERE id = ?
    `).get(id) as EmailApplication | undefined;

    if (!application) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }

    const vacancy = db.prepare(`
      SELECT * FROM vacancies WHERE id = ? AND isActive = 1
    `).get(vacancy_id) as any;

    if (!vacancy) {
      res.status(404).json({ error: 'Vacancy not found' });
      return;
    }

    // Update application with vacancy
    db.prepare(`
      UPDATE email_applications
      SET vacancy_id = ?, status = 'processing', updatedAt = datetime('now')
      WHERE id = ?
    `).run(vacancy_id, id);

    // Perform AI screening if resume text is available
    if (application.resume_extracted_text) {
      try {
        const screeningResult = await performAIScreening(
          application.resume_extracted_text,
          vacancy
        );

        db.prepare(`
          UPDATE email_applications
          SET ai_match_score = ?, ai_match_analysis = ?, ai_recommendation = ?,
              missing_criteria = ?, hr_action = 'pending', status = 'processed',
              processed_at = datetime('now'), updatedAt = datetime('now')
          WHERE id = ?
        `).run(
          screeningResult.score,
          screeningResult.analysis,
          screeningResult.recommendation,
          screeningResult.missingCriteria,
          id
        );
      } catch (error) {
        console.error('AI screening error:', error);
        // Continue without AI screening
        db.prepare(`
          UPDATE email_applications
          SET hr_action = 'pending', status = 'processed',
              processed_at = datetime('now'), updatedAt = datetime('now')
          WHERE id = ?
        `).run(id);
      }
    } else {
      db.prepare(`
        UPDATE email_applications
        SET hr_action = 'pending', status = 'processed',
            processed_at = datetime('now'), updatedAt = datetime('now')
        WHERE id = ?
      `).run(id);
    }

    const updatedApplication = db.prepare(`
      SELECT * FROM email_applications WHERE id = ?
    `).get(id);

    res.json(updatedApplication);
  } catch (error: any) {
    console.error('Error processing application:', error);
    res.status(500).json({ error: error.message || 'Failed to process application' });
  }
});

// HR action on application
router.post('/applications/:id/action', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body as { action: HRAction; notes?: string };
    const userId = req.user!.userId;

    if (!action || !['approved', 'rejected', 'needs_info'].includes(action)) {
      res.status(400).json({ error: 'Valid action is required (approved, rejected, needs_info)' });
      return;
    }

    const application = db.prepare(`
      SELECT * FROM email_applications WHERE id = ?
    `).get(id) as EmailApplication | undefined;

    if (!application) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }

    // Update HR action
    db.prepare(`
      UPDATE email_applications
      SET hr_action = ?, hr_notes = ?, updatedAt = datetime('now')
      WHERE id = ?
    `).run(action, notes || null, id);

    // If approved, create candidate
    if (action === 'approved' && !application.candidate_id) {
      const candidateResult = await createCandidateFromApplication(application, userId);

      db.prepare(`
        UPDATE email_applications
        SET candidate_id = ?, updatedAt = datetime('now')
        WHERE id = ?
      `).run(candidateResult.id, id);

      // Log workflow
      db.prepare(`
        INSERT INTO automation_workflow_logs
        (candidate_id, workflow_step, action_taken, action_by, action_user_id, details)
        VALUES (?, 'shortlisted', 'Candidate shortlisted from email application', 'hr', ?, ?)
      `).run(candidateResult.id, userId, JSON.stringify({ application_id: id }));
    }

    const updatedApplication = db.prepare(`
      SELECT ea.*,
             v.title as vacancy_title,
             COALESCE(c.first_name || ' ' || c.last_name, ea.sender_name) as candidate_name
      FROM email_applications ea
      LEFT JOIN vacancies v ON ea.vacancy_id = v.id
      LEFT JOIN candidates c ON ea.candidate_id = c.id
      WHERE ea.id = ?
    `).get(id);

    res.json(updatedApplication);
  } catch (error: any) {
    console.error('Error updating HR action:', error);
    res.status(500).json({ error: error.message || 'Failed to update HR action' });
  }
});

// Helper function: Sync emails from Gmail
async function syncEmails(connectionId: number, syncId: number, syncType: 'full' | 'incremental'): Promise<void> {
  const gmail = await getGmailClient(connectionId);

  let emailsFetched = 0;
  let resumesExtracted = 0;
  let candidatesCreated = 0;
  const errors: string[] = [];

  try {
    // Build search query
    const query = 'has:attachment (filename:pdf OR filename:doc OR filename:docx) (job OR apply OR resume OR career OR application OR cv)';

    // Get message list
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: syncType === 'full' ? 100 : 50
    });

    const messages = listResponse.data.messages || [];

    for (const message of messages) {
      try {
        // Check if already processed
        const existing = db.prepare(`
          SELECT id FROM email_applications WHERE gmail_message_id = ?
        `).get(message.id) as { id: number } | undefined;

        if (existing) {
          continue;
        }

        // Get full message
        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'full'
        });

        const headers = fullMessage.data.payload?.headers || [];
        const from = headers.find(h => h.name?.toLowerCase() === 'from')?.value || '';
        const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value || '';
        const date = headers.find(h => h.name?.toLowerCase() === 'date')?.value || '';

        // Parse sender
        const emailMatch = from.match(/<(.+?)>/) || from.match(/([^\s]+@[^\s]+)/);
        const senderEmail = emailMatch ? emailMatch[1] : from;
        const senderName = from.replace(/<.+?>/, '').trim() || null;

        // Get body text
        let bodyText = '';
        const payload = fullMessage.data.payload;
        if (payload) {
          bodyText = extractBodyText(payload);
        }

        // Look for resume attachments
        let resumeFilename: string | null = null;
        let resumePath: string | null = null;
        let resumeExtractedText: string | null = null;

        const parts = payload?.parts || [];
        for (const part of parts) {
          if (part.filename && (
            part.filename.endsWith('.pdf') ||
            part.filename.endsWith('.doc') ||
            part.filename.endsWith('.docx')
          )) {
            // Download attachment
            const attachment = await gmail.users.messages.attachments.get({
              userId: 'me',
              messageId: message.id!,
              id: part.body?.attachmentId!
            });

            if (attachment.data.data) {
              const buffer = Buffer.from(attachment.data.data, 'base64');

              // Save to uploads folder
              const uploadsDir = path.join(process.cwd(), 'uploads', 'resumes');
              if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
              }

              const filename = `${Date.now()}-${part.filename}`;
              const filePath = path.join(uploadsDir, filename);
              fs.writeFileSync(filePath, buffer);

              resumeFilename = part.filename;
              resumePath = `uploads/resumes/${filename}`;
              resumesExtracted++;

              // Note: Resume text extraction would be done here with OpenAI or PDF parser
              // For now, we'll leave it for the AI screening step
              break;
            }
          }
        }

        // Create email application record
        db.prepare(`
          INSERT INTO email_applications
          (gmail_connection_id, gmail_message_id, gmail_thread_id, sender_email, sender_name,
           subject, body_text, received_at, resume_filename, resume_path, resume_extracted_text, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
        `).run(
          connectionId,
          message.id,
          message.threadId || null,
          senderEmail,
          senderName,
          subject,
          bodyText.substring(0, 10000), // Limit body text
          new Date(date).toISOString(),
          resumeFilename,
          resumePath,
          resumeExtractedText
        );

        emailsFetched++;
      } catch (messageError: any) {
        console.error(`Error processing message ${message.id}:`, messageError);
        errors.push(`Message ${message.id}: ${messageError.message}`);
      }
    }

    // Update sync history
    db.prepare(`
      UPDATE gmail_sync_history
      SET status = 'completed', completed_at = datetime('now'),
          emails_fetched = ?, resumes_extracted = ?, candidates_created = ?,
          errors = ?
      WHERE id = ?
    `).run(
      emailsFetched,
      resumesExtracted,
      candidatesCreated,
      errors.length > 0 ? JSON.stringify(errors) : null,
      syncId
    );

    // Update last sync time
    db.prepare(`
      UPDATE gmail_connections SET last_sync_at = datetime('now') WHERE id = ?
    `).run(connectionId);

  } catch (error: any) {
    console.error('Sync error:', error);
    db.prepare(`
      UPDATE gmail_sync_history
      SET status = 'failed', completed_at = datetime('now'),
          emails_fetched = ?, resumes_extracted = ?,
          errors = ?
      WHERE id = ?
    `).run(emailsFetched, resumesExtracted, JSON.stringify([error.message, ...errors]), syncId);

    throw error;
  }
}

// Helper function: Extract body text from message payload
function extractBodyText(payload: any): string {
  let text = '';

  if (payload.body?.data) {
    text = Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        text += Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.parts) {
        text += extractBodyText(part);
      }
    }
  }

  return text;
}

// Helper function: Perform AI screening
async function performAIScreening(resumeText: string, vacancy: any): Promise<{
  score: number;
  analysis: string;
  recommendation: 'shortlist' | 'review' | 'reject';
  missingCriteria: string | null;
}> {
  // Check if OpenAI is configured
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    return {
      score: 50,
      analysis: 'AI screening not available - OpenAI API key not configured',
      recommendation: 'review',
      missingCriteria: null
    };
  }

  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: openaiApiKey });

    const prompt = `Analyze this resume against the job requirements and provide a screening score.

JOB DETAILS:
Title: ${vacancy.title}
Department: ${vacancy.department || 'Not specified'}
Requirements: ${vacancy.requirements || 'Not specified'}
Skills Required: ${vacancy.skills_required || 'Not specified'}
Experience: ${vacancy.experience_min || 0} - ${vacancy.experience_max || 'N/A'} years

RESUME:
${resumeText.substring(0, 8000)}

Provide a JSON response with:
1. score (0-100): Overall match score
2. analysis: Brief analysis of the match (2-3 sentences)
3. recommendation: "shortlist" (score >= 70), "review" (score 40-69), or "reject" (score < 40)
4. missingCriteria: Array of missing requirements, or null if all met

Response format:
{
  "score": number,
  "analysis": "string",
  "recommendation": "shortlist" | "review" | "reject",
  "missingCriteria": ["string"] | null
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
      recommendation: result.recommendation || 'review',
      missingCriteria: result.missingCriteria ? JSON.stringify(result.missingCriteria) : null
    };
  } catch (error) {
    console.error('AI screening error:', error);
    return {
      score: 50,
      analysis: 'AI screening failed',
      recommendation: 'review',
      missingCriteria: null
    };
  }
}

// Helper function: Create candidate from email application
async function createCandidateFromApplication(application: EmailApplication, userId: number): Promise<{ id: number }> {
  // Parse sender name
  const nameParts = (application.sender_name || application.sender_email.split('@')[0]).split(' ');
  const firstName = nameParts[0] || 'Unknown';
  const lastName = nameParts.slice(1).join(' ') || '';

  const result = db.prepare(`
    INSERT INTO candidates
    (vacancy_id, first_name, last_name, email, resume_path, resume_extracted_text,
     source, status, email_application_id, automation_status, auto_shortlisted_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, 'direct', 'shortlisted', ?, 'automated', datetime('now'), ?)
  `).run(
    application.vacancy_id,
    firstName,
    lastName,
    application.sender_email,
    application.resume_path,
    application.resume_extracted_text,
    application.id,
    userId
  );

  return { id: result.lastInsertRowid as number };
}

export default router;
