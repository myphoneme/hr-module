import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import {
  getCalendarAuthUrl,
  exchangeCodeForTokens,
  getCalendarClient,
  isGoogleOAuthConfigured
} from '../utils/googleAuth';
import type {
  CalendarConnection,
  CalendarConnectionWithUser,
  InterviewerAvailability,
  InterviewerAvailabilityWithUser,
  TimeSlot,
  SlotSuggestion
} from '../types';

const router = Router();
router.use(authenticateToken);

// Get Google OAuth URL for Calendar
router.get('/auth-url', (_req: Request, res: Response): void => {
  try {
    if (!isGoogleOAuthConfigured()) {
      res.status(400).json({ error: 'Google OAuth is not configured' });
      return;
    }

    const authUrl = getCalendarAuthUrl();
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
    const tokens = await exchangeCodeForTokens(code, 'calendar');

    // Check if connection already exists for this email
    const existing = db.prepare(`
      SELECT id FROM calendar_connections WHERE email = ? AND user_id = ?
    `).get(tokens.email, userId) as { id: number } | undefined;

    let connectionId: number;

    if (existing) {
      // Update existing connection
      db.prepare(`
        UPDATE calendar_connections
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
        INSERT INTO calendar_connections (user_id, email, calendar_id, access_token, refresh_token, token_expiry)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        tokens.email,
        'primary', // Default to primary calendar
        tokens.access_token,
        tokens.refresh_token,
        new Date(tokens.expiry_date).toISOString()
      );
      connectionId = result.lastInsertRowid as number;
    }

    const connection = db.prepare('SELECT * FROM calendar_connections WHERE id = ?').get(connectionId);

    res.status(201).json({
      message: 'Calendar connected successfully',
      connection
    });
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: error.message || 'Failed to connect Calendar' });
  }
});

// List connected Calendar accounts
router.get('/connections', (req: Request, res: Response): void => {
  try {
    const userId = req.user!.userId;
    const isAdmin = req.user!.role === 'admin';

    let connections: CalendarConnectionWithUser[];

    if (isAdmin) {
      connections = db.prepare(`
        SELECT cc.*, u.name as user_name, u.email as user_email
        FROM calendar_connections cc
        JOIN users u ON cc.user_id = u.id
        WHERE cc.is_active = 1
        ORDER BY cc.createdAt DESC
      `).all() as CalendarConnectionWithUser[];
    } else {
      connections = db.prepare(`
        SELECT cc.*, u.name as user_name, u.email as user_email
        FROM calendar_connections cc
        JOIN users u ON cc.user_id = u.id
        WHERE cc.user_id = ? AND cc.is_active = 1
        ORDER BY cc.createdAt DESC
      `).all(userId) as CalendarConnectionWithUser[];
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

// Disconnect Calendar account
router.delete('/connections/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const isAdmin = req.user!.role === 'admin';

    // Check ownership
    const connection = db.prepare(`
      SELECT * FROM calendar_connections WHERE id = ?
    `).get(id) as CalendarConnection | undefined;

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
      UPDATE calendar_connections SET is_active = 0, updatedAt = datetime('now') WHERE id = ?
    `).run(id);

    res.json({ message: 'Calendar disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting Calendar:', error);
    res.status(500).json({ error: 'Failed to disconnect Calendar' });
  }
});

// Sync interviewer availability from Google Calendar
router.post('/sync-availability', async (req: Request, res: Response): Promise<void> => {
  try {
    const { connection_id, interviewer_id, days_ahead = 14 } = req.body;
    const userId = req.user!.userId;

    if (!connection_id) {
      res.status(400).json({ error: 'connection_id is required' });
      return;
    }

    const interviewerId = interviewer_id || userId;

    // Verify connection
    const connection = db.prepare(`
      SELECT * FROM calendar_connections WHERE id = ? AND is_active = 1
    `).get(connection_id) as CalendarConnection | undefined;

    if (!connection) {
      res.status(404).json({ error: 'Calendar connection not found' });
      return;
    }

    const calendar = await getCalendarClient(connection_id);

    // Get busy times for the next N days
    const timeMin = new Date();
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + days_ahead);

    const freeBusyResponse = await calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: connection.calendar_id || 'primary' }]
      }
    });

    const busyTimes = freeBusyResponse.data.calendars?.[connection.calendar_id || 'primary']?.busy || [];

    // Clear existing availability for this interviewer
    db.prepare(`
      DELETE FROM interviewer_availability
      WHERE interviewer_id = ? AND slot_date >= date('now')
    `).run(interviewerId);

    // Generate available slots (9 AM to 6 PM, 1-hour slots)
    const slotsCreated: InterviewerAvailability[] = [];
    const currentDate = new Date();

    for (let day = 0; day < days_ahead; day++) {
      const date = new Date(currentDate);
      date.setDate(date.getDate() + day);

      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      const dateStr = date.toISOString().split('T')[0];

      // Generate slots from 9 AM to 6 PM
      for (let hour = 9; hour < 18; hour++) {
        const slotStart = new Date(date);
        slotStart.setHours(hour, 0, 0, 0);

        const slotEnd = new Date(date);
        slotEnd.setHours(hour + 1, 0, 0, 0);

        // Check if slot overlaps with any busy time
        const isBlocked = busyTimes.some(busy => {
          const busyStart = new Date(busy.start!);
          const busyEnd = new Date(busy.end!);
          return slotStart < busyEnd && slotEnd > busyStart;
        });

        const startTime = `${hour.toString().padStart(2, '0')}:00`;
        const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;

        const result = db.prepare(`
          INSERT INTO interviewer_availability
          (calendar_connection_id, interviewer_id, slot_date, start_time, end_time, is_blocked, synced_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
          connection_id,
          interviewerId,
          dateStr,
          startTime,
          endTime,
          isBlocked ? 1 : 0
        );

        slotsCreated.push({
          id: result.lastInsertRowid as number,
          calendar_connection_id: connection_id,
          interviewer_id: interviewerId,
          slot_date: dateStr,
          start_time: startTime,
          end_time: endTime,
          calendar_event_id: null,
          is_blocked: isBlocked,
          block_reason: isBlocked ? 'Calendar busy' : null,
          synced_at: new Date().toISOString(),
          createdAt: new Date().toISOString()
        });
      }
    }

    res.json({
      message: 'Availability synced successfully',
      slots_created: slotsCreated.length,
      available_slots: slotsCreated.filter(s => !s.is_blocked).length,
      blocked_slots: slotsCreated.filter(s => s.is_blocked).length
    });
  } catch (error: any) {
    console.error('Error syncing availability:', error);
    res.status(500).json({ error: error.message || 'Failed to sync availability' });
  }
});

// Get available interview slots
router.get('/availability', (req: Request, res: Response): void => {
  try {
    const { interviewer_id, date_from, date_to, available_only = 'true' } = req.query;

    let query = `
      SELECT ia.*, u.name as interviewer_name, u.email as interviewer_email
      FROM interviewer_availability ia
      JOIN users u ON ia.interviewer_id = u.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (interviewer_id) {
      query += ' AND ia.interviewer_id = ?';
      params.push(interviewer_id);
    }

    if (date_from) {
      query += ' AND ia.slot_date >= ?';
      params.push(date_from);
    } else {
      query += ' AND ia.slot_date >= date("now")';
    }

    if (date_to) {
      query += ' AND ia.slot_date <= ?';
      params.push(date_to);
    }

    if (available_only === 'true') {
      query += ' AND ia.is_blocked = 0';
    }

    query += ' ORDER BY ia.slot_date, ia.start_time';

    const availability = db.prepare(query).all(...params) as InterviewerAvailabilityWithUser[];

    res.json(availability.map(a => ({
      ...a,
      is_blocked: Boolean(a.is_blocked)
    })));
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// AI suggest optimal interview slots
router.post('/suggest-slots', async (req: Request, res: Response): Promise<void> => {
  try {
    const { candidate_id, interviewer_ids, duration_minutes = 60, preferred_dates } = req.body;

    if (!candidate_id) {
      res.status(400).json({ error: 'candidate_id is required' });
      return;
    }

    // Get candidate details
    const candidate = db.prepare(`
      SELECT c.*, v.title as vacancy_title
      FROM candidates c
      LEFT JOIN vacancies v ON c.vacancy_id = v.id
      WHERE c.id = ?
    `).get(candidate_id) as any;

    if (!candidate) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    // Get available slots for interviewers
    let slotsQuery = `
      SELECT ia.*, u.name as interviewer_name, u.email as interviewer_email
      FROM interviewer_availability ia
      JOIN users u ON ia.interviewer_id = u.id
      WHERE ia.is_blocked = 0
        AND ia.slot_date >= date('now', '+1 day')
        AND ia.slot_date <= date('now', '+14 days')
    `;

    const params: any[] = [];

    if (interviewer_ids && interviewer_ids.length > 0) {
      const placeholders = interviewer_ids.map(() => '?').join(',');
      slotsQuery += ` AND ia.interviewer_id IN (${placeholders})`;
      params.push(...interviewer_ids);
    }

    slotsQuery += ' ORDER BY ia.slot_date, ia.start_time LIMIT 50';

    const availableSlots = db.prepare(slotsQuery).all(...params) as InterviewerAvailabilityWithUser[];

    // Score and rank slots
    const suggestions: SlotSuggestion[] = availableSlots.map(slot => {
      const reasons: string[] = [];
      let score = 50; // Base score

      // Prefer morning slots
      const hour = parseInt(slot.start_time.split(':')[0]);
      if (hour >= 9 && hour <= 11) {
        score += 10;
        reasons.push('Morning slot (optimal attention)');
      }

      // Prefer earlier dates
      const daysAway = Math.floor((new Date(slot.slot_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysAway <= 3) {
        score += 15;
        reasons.push('Available soon');
      } else if (daysAway <= 7) {
        score += 10;
        reasons.push('Within a week');
      }

      // Check preferred dates
      if (preferred_dates && preferred_dates.includes(slot.slot_date)) {
        score += 20;
        reasons.push('Matches preferred date');
      }

      // Avoid Monday mornings and Friday afternoons
      const dayOfWeek = new Date(slot.slot_date).getDay();
      if (dayOfWeek === 1 && hour < 11) {
        score -= 5;
        reasons.push('Monday morning');
      } else if (dayOfWeek === 5 && hour > 15) {
        score -= 5;
        reasons.push('Friday afternoon');
      }

      return {
        slot: {
          date: slot.slot_date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          interviewer_id: slot.interviewer_id,
          interviewer_name: slot.interviewer_name
        },
        score,
        reasons
      };
    });

    // Sort by score and return top 5
    suggestions.sort((a, b) => b.score - a.score);
    const topSuggestions = suggestions.slice(0, 5);

    res.json({
      candidate: {
        id: candidate.id,
        name: `${candidate.first_name} ${candidate.last_name}`,
        vacancy_title: candidate.vacancy_title
      },
      suggestions: topSuggestions
    });
  } catch (error: any) {
    console.error('Error suggesting slots:', error);
    res.status(500).json({ error: error.message || 'Failed to suggest slots' });
  }
});

// Create calendar event (returns draft data, actual creation after approval)
router.post('/create-event', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      connection_id,
      candidate_id,
      interview_id,
      slot_date,
      start_time,
      end_time,
      title,
      description,
      attendees,
      location,
      meeting_link
    } = req.body;

    if (!connection_id || !candidate_id || !slot_date || !start_time) {
      res.status(400).json({ error: 'connection_id, candidate_id, slot_date, and start_time are required' });
      return;
    }

    // Get candidate details
    const candidate = db.prepare(`
      SELECT c.*, v.title as vacancy_title
      FROM candidates c
      LEFT JOIN vacancies v ON c.vacancy_id = v.id
      WHERE c.id = ?
    `).get(candidate_id) as any;

    if (!candidate) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    // Create event data structure
    const startDateTime = new Date(`${slot_date}T${start_time}:00`);
    const endDateTime = new Date(`${slot_date}T${end_time || start_time}:00`);
    if (!end_time) {
      endDateTime.setHours(endDateTime.getHours() + 1);
    }

    const eventData = {
      summary: title || `Interview - ${candidate.first_name} ${candidate.last_name} - ${candidate.vacancy_title || 'Position'}`,
      description: description || `Interview for ${candidate.vacancy_title || 'open position'} with ${candidate.first_name} ${candidate.last_name}`,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'Asia/Kolkata'
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'Asia/Kolkata'
      },
      attendees: attendees || [
        { email: candidate.email }
      ],
      location: location || undefined,
      conferenceData: meeting_link ? undefined : {
        createRequest: {
          requestId: `interview-${candidate_id}-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      }
    };

    // Store as calendar event data in email draft if interview_id provided
    if (interview_id) {
      db.prepare(`
        UPDATE interviews
        SET calendar_event_data = ?, updatedAt = datetime('now')
        WHERE id = ?
      `).run(JSON.stringify(eventData), interview_id);
    }

    res.json({
      message: 'Calendar event data prepared',
      event_data: eventData,
      note: 'Event will be created after HR approves the interview invitation email'
    });
  } catch (error: any) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: error.message || 'Failed to create calendar event' });
  }
});

// Actually create the calendar event (called after email draft approval)
router.post('/send-event', async (req: Request, res: Response): Promise<void> => {
  try {
    const { connection_id, event_data, interview_id } = req.body;

    if (!connection_id || !event_data) {
      res.status(400).json({ error: 'connection_id and event_data are required' });
      return;
    }

    const calendar = await getCalendarClient(connection_id);

    // Get connection for calendar ID
    const connection = db.prepare(`
      SELECT * FROM calendar_connections WHERE id = ? AND is_active = 1
    `).get(connection_id) as CalendarConnection | undefined;

    if (!connection) {
      res.status(404).json({ error: 'Calendar connection not found' });
      return;
    }

    // Create the event
    const response = await calendar.events.insert({
      calendarId: connection.calendar_id || 'primary',
      requestBody: event_data,
      conferenceDataVersion: 1,
      sendUpdates: 'all'
    });

    // Update interview with calendar event ID
    if (interview_id && response.data.id) {
      db.prepare(`
        UPDATE interviews
        SET calendar_event_id = ?, meeting_link = ?, updatedAt = datetime('now')
        WHERE id = ?
      `).run(
        response.data.id,
        response.data.hangoutLink || null,
        interview_id
      );
    }

    res.json({
      message: 'Calendar event created successfully',
      event_id: response.data.id,
      meeting_link: response.data.hangoutLink,
      html_link: response.data.htmlLink
    });
  } catch (error: any) {
    console.error('Error sending event:', error);
    res.status(500).json({ error: error.message || 'Failed to send calendar event' });
  }
});

export default router;
