import { google, Auth } from 'googleapis';
import db from '../db';

// Google OAuth Configuration
const SCOPES = {
  gmail: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.labels'
  ],
  calendar: [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events'
  ]
};

// Get OAuth2 client with specific redirect URI
export function getOAuth2Client(redirectUri?: string): Auth.OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const defaultRedirectUri = redirectUri || process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/gmail/callback';

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.');
  }

  return new google.auth.OAuth2(clientId, clientSecret, defaultRedirectUri);
}

// Generate OAuth URL for Gmail
export function getGmailAuthUrl(): string {
  const redirectUri = process.env.GOOGLE_GMAIL_REDIRECT_URI || 'http://localhost:5173/auth/gmail/callback';
  console.log('Gmail OAuth redirect URI:', redirectUri); // Debug log
  const oauth2Client = getOAuth2Client(redirectUri);
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES.gmail,
    prompt: 'select_account consent'
  });
}

// Generate OAuth URL for Calendar
export function getCalendarAuthUrl(): string {
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI || 'http://localhost:5173/auth/google/callback';
  console.log('Calendar OAuth redirect URI:', redirectUri); // Debug log
  const oauth2Client = getOAuth2Client(redirectUri);

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES.calendar,
    prompt: 'select_account consent'
  });
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string, type: 'gmail' | 'calendar' = 'gmail'): Promise<{
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  email: string;
}> {
  const redirectUri = type === 'calendar'
    ? (process.env.GOOGLE_CALENDAR_REDIRECT_URI || 'http://localhost:5173/auth/google/callback')
    : (process.env.GOOGLE_GMAIL_REDIRECT_URI || 'http://localhost:5173/auth/gmail/callback');

  const oauth2Client = getOAuth2Client(redirectUri);

  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Failed to get tokens from Google');
  }

  oauth2Client.setCredentials(tokens);

  // Get user email
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();

  if (!userInfo.data.email) {
    throw new Error('Failed to get user email from Google');
  }

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date || Date.now() + 3600000,
    email: userInfo.data.email
  };
}

// Get authenticated OAuth2 client with stored credentials
export async function getAuthenticatedClient(connectionId: number, type: 'gmail' | 'calendar'): Promise<Auth.OAuth2Client> {
  const tableName = type === 'gmail' ? 'gmail_connections' : 'calendar_connections';

  const connection = db.prepare(`SELECT * FROM ${tableName} WHERE id = ? AND is_active = 1`).get(connectionId) as {
    access_token: string;
    refresh_token: string;
    token_expiry: string;
    id: number;
  } | undefined;

  if (!connection) {
    throw new Error(`${type === 'gmail' ? 'Gmail' : 'Calendar'} connection not found`);
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: connection.access_token,
    refresh_token: connection.refresh_token,
    expiry_date: new Date(connection.token_expiry).getTime()
  });

  // Check if token needs refresh
  const expiryDate = new Date(connection.token_expiry).getTime();
  if (expiryDate < Date.now() + 60000) { // Refresh if expiring in less than 1 minute
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();

      // Update stored tokens
      db.prepare(`
        UPDATE ${tableName}
        SET access_token = ?, token_expiry = ?, updatedAt = datetime('now')
        WHERE id = ?
      `).run(
        credentials.access_token,
        new Date(credentials.expiry_date || Date.now() + 3600000).toISOString(),
        connection.id
      );

      oauth2Client.setCredentials(credentials);
    } catch (error) {
      console.error('Failed to refresh token:', error);
      throw new Error('Failed to refresh authentication token. Please reconnect.');
    }
  }

  return oauth2Client;
}

// Get Gmail API client
export async function getGmailClient(connectionId: number) {
  const auth = await getAuthenticatedClient(connectionId, 'gmail');
  return google.gmail({ version: 'v1', auth });
}

// Get Calendar API client
export async function getCalendarClient(connectionId: number) {
  const auth = await getAuthenticatedClient(connectionId, 'calendar');
  return google.calendar({ version: 'v3', auth });
}

// Check if Google OAuth is configured
export function isGoogleOAuthConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
