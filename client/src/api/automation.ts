import { api } from './client';

// =====================================================
// Types
// =====================================================

export interface GmailConnection {
  id: number;
  user_id: number;
  email: string;
  is_active: boolean;
  last_sync_at: string | null;
  sync_interval_minutes: number;
  user_name: string;
  user_email: string;
  createdAt: string;
  updatedAt: string;
}

export interface GmailSyncHistory {
  id: number;
  connection_id: number;
  connection_email: string;
  sync_type: 'full' | 'incremental';
  emails_fetched: number;
  resumes_extracted: number;
  candidates_created: number;
  errors: string | null;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed';
}

export type AIRecommendation = 'shortlist' | 'review' | 'reject';
export type HRAction = 'pending' | 'approved' | 'rejected' | 'needs_info';

export interface EmailApplication {
  id: number;
  gmail_connection_id: number;
  gmail_message_id: string;
  sender_email: string;
  sender_name: string | null;
  subject: string | null;
  body_text: string | null;
  received_at: string;
  resume_filename: string | null;
  resume_path: string | null;
  resume_extracted_text: string | null;
  vacancy_id: number | null;
  vacancy_title?: string;
  candidate_id: number | null;
  candidate_name?: string;
  ai_match_score: number | null;
  ai_match_analysis: string | null;
  ai_recommendation: AIRecommendation | null;
  missing_criteria: string | null;
  hr_action: HRAction | null;
  hr_notes: string | null;
  status: 'new' | 'processing' | 'processed' | 'failed' | 'duplicate';
  isActive: boolean;
  createdAt: string;
}

export interface CalendarConnection {
  id: number;
  user_id: number;
  email: string;
  calendar_id: string;
  is_active: boolean;
  user_name: string;
  user_email: string;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewerAvailability {
  id: number;
  interviewer_id: number;
  interviewer_name: string;
  interviewer_email: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  is_blocked: boolean;
  block_reason: string | null;
}

export interface TimeSlot {
  date: string;
  start_time: string;
  end_time: string;
  interviewer_id: number;
  interviewer_name: string;
}

export interface SlotSuggestion {
  slot: TimeSlot;
  score: number;
  reasons: string[];
}

export type EmailType = 'interview_invite' | 'rejection' | 'offer' | 'follow_up' | 'custom';

export interface EmailTemplate {
  id: number;
  name: string;
  email_type: EmailType;
  subject_template: string;
  body_template: string;
  variables: string[];
  is_default: boolean;
  isActive: boolean;
  creator_name: string;
  createdAt: string;
}

export interface EmailDraft {
  id: number;
  candidate_id: number;
  candidate_name: string;
  candidate_email: string;
  email_type: EmailType;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  body_html: string;
  body_text: string | null;
  status: 'draft' | 'approved' | 'sent' | 'failed';
  approved_by: number | null;
  approver_name?: string;
  creator_name: string;
  createdAt: string;
}

export interface CTCDiscussion {
  id: number;
  candidate_id: number;
  candidate_name: string;
  candidate_email: string;
  vacancy_title?: string;
  expected_ctc: number | null;
  offered_ctc: number | null;
  fixed_pay: number | null;
  variable_pay: number | null;
  joining_bonus: number | null;
  joining_date: string | null;
  salary_breakdown: SalaryComponent[] | null;
  company_benchmark: unknown | null;
  hr_notes: string | null;
  candidate_response: 'pending' | 'accepted' | 'negotiating' | 'rejected' | null;
  status: 'pending' | 'in_progress' | 'finalized' | 'cancelled';
  creator_name: string;
  finalizer_name?: string;
  createdAt: string;
}

export interface SalaryComponent {
  component: string;
  perMonth: number;
  annual: number;
}

export type WorkflowStep =
  | 'new_application'
  | 'ai_screening'
  | 'hr_review_required'
  | 'shortlisted'
  | 'rejected'
  | 'schedule_interview'
  | 'interview_scheduled'
  | 'interview_completed'
  | 'selected'
  | 'ctc_discussion'
  | 'ctc_finalized'
  | 'generate_offer_letter'
  | 'offer_sent'
  | 'offer_accepted'
  | 'offer_rejected'
  | 'joined';

export interface WorkflowLog {
  id: number;
  candidate_id: number;
  candidate_name: string;
  workflow_step: WorkflowStep;
  previous_step: WorkflowStep | null;
  action_taken: string | null;
  action_by: 'system' | 'hr' | 'candidate' | null;
  action_user_name?: string;
  details: unknown;
  is_automated: boolean;
  requires_hr_action: boolean;
  hr_prompt: string | null;
  createdAt: string;
}

export interface PendingAction {
  id: number;
  candidate_id: number;
  candidate_name: string;
  candidate_email: string;
  vacancy_title: string | null;
  workflow_step: WorkflowStep;
  hr_prompt: string;
  createdAt: string;
}

export interface AutomationStatus {
  total_candidates: number;
  automated_candidates: number;
  pending_hr_actions: number;
  today_applications: number;
  today_shortlisted: number;
  today_rejected: number;
  pending_interviews: number;
  pending_offers: number;
}

// Helper to build query string from params
function buildQueryString(params?: Record<string, unknown>): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

// =====================================================
// Gmail Integration API
// =====================================================

export const gmailApi = {
  getStatus: () => api.get<{ configured: boolean; message: string }>('/gmail/status'),

  getAuthUrl: () => api.get<{ authUrl: string }>('/gmail/auth-url'),

  handleCallback: (code: string) =>
    api.post<{ message: string; connection: GmailConnection }>('/gmail/callback', { code }),

  getConnections: () => api.get<GmailConnection[]>('/gmail/connections'),

  disconnectAccount: (id: number) => api.delete(`/gmail/connections/${id}`),

  triggerSync: (connectionId: number, syncType: 'full' | 'incremental' = 'incremental') =>
    api.post<{ message: string; sync_id: number }>('/gmail/sync', {
      connection_id: connectionId,
      sync_type: syncType
    }),

  getSyncHistory: (connectionId?: number) => {
    const query = buildQueryString({ connection_id: connectionId });
    return api.get<GmailSyncHistory[]>(`/gmail/sync-history${query}`);
  },

  getApplications: (params?: {
    status?: string;
    hr_action?: string;
    vacancy_id?: number;
    limit?: number;
    offset?: number;
  }) => {
    const query = buildQueryString(params);
    return api.get<EmailApplication[]>(`/gmail/applications${query}`);
  },

  getApplication: (id: number) => api.get<EmailApplication>(`/gmail/applications/${id}`),

  processApplication: (id: number, vacancyId: number) =>
    api.post<EmailApplication>(`/gmail/applications/${id}/process`, { vacancy_id: vacancyId }),

  hrAction: (id: number, action: HRAction, notes?: string) =>
    api.post<EmailApplication>(`/gmail/applications/${id}/action`, { action, notes })
};

// =====================================================
// Calendar Integration API
// =====================================================

export const calendarApi = {
  getAuthUrl: () => api.get<{ authUrl: string }>('/calendar/auth-url'),

  handleCallback: (code: string) =>
    api.post<{ message: string; connection: CalendarConnection }>('/calendar/callback', { code }),

  getConnections: () => api.get<CalendarConnection[]>('/calendar/connections'),

  disconnectAccount: (id: number) => api.delete(`/calendar/connections/${id}`),

  syncAvailability: (connectionId: number, interviewerId?: number, daysAhead?: number) =>
    api.post<{ message: string; slots_created: number; available_slots: number }>('/calendar/sync-availability', {
      connection_id: connectionId,
      interviewer_id: interviewerId,
      days_ahead: daysAhead
    }),

  getAvailability: (params?: {
    interviewer_id?: number;
    date_from?: string;
    date_to?: string;
    available_only?: boolean;
  }) => {
    const query = buildQueryString(params);
    return api.get<InterviewerAvailability[]>(`/calendar/availability${query}`);
  },

  suggestSlots: (candidateId: number, interviewerIds?: number[], preferredDates?: string[]) =>
    api.post<{ candidate: unknown; suggestions: SlotSuggestion[] }>('/calendar/suggest-slots', {
      candidate_id: candidateId,
      interviewer_ids: interviewerIds,
      preferred_dates: preferredDates
    }),

  createEvent: (data: {
    connection_id: number;
    candidate_id: number;
    interview_id?: number;
    slot_date: string;
    start_time: string;
    end_time?: string;
    title?: string;
    description?: string;
    attendees?: { email: string }[];
    location?: string;
    meeting_link?: string;
  }) => api.post('/calendar/create-event', data),

  sendEvent: (connectionId: number, eventData: unknown, interviewId?: number) =>
    api.post('/calendar/send-event', {
      connection_id: connectionId,
      event_data: eventData,
      interview_id: interviewId
    })
};

// =====================================================
// Email Templates API
// =====================================================

export const emailTemplatesApi = {
  getAll: (params?: { email_type?: EmailType; is_default?: boolean }) => {
    const query = buildQueryString(params);
    return api.get<EmailTemplate[]>(`/email-templates${query}`);
  },

  getById: (id: number) => api.get<EmailTemplate>(`/email-templates/${id}`),

  getDefault: (type: EmailType) => api.get<EmailTemplate>(`/email-templates/default/${type}`),

  create: (data: {
    name: string;
    email_type: EmailType;
    subject_template: string;
    body_template: string;
    variables?: string[];
    is_default?: boolean;
  }) => api.post<EmailTemplate>('/email-templates', data),

  update: (id: number, data: Partial<{
    name: string;
    email_type: EmailType;
    subject_template: string;
    body_template: string;
    variables: string[];
    is_default: boolean;
    isActive: boolean;
  }>) => api.put<EmailTemplate>(`/email-templates/${id}`, data),

  delete: (id: number) => api.delete(`/email-templates/${id}`),

  preview: (id: number, variables: Record<string, string>) =>
    api.post<{ subject: string; body: string; missing_variables: string[] }>(
      `/email-templates/${id}/preview`,
      { variables }
    )
};

// =====================================================
// Email Drafts API
// =====================================================

export const emailDraftsApi = {
  getAll: (params?: {
    status?: string;
    email_type?: EmailType;
    candidate_id?: number;
    limit?: number;
    offset?: number;
  }) => {
    const query = buildQueryString(params);
    return api.get<EmailDraft[]>(`/email-drafts${query}`);
  },

  getPendingCount: () => api.get<{ count: number }>('/email-drafts/pending-count'),

  getById: (id: number) => api.get<EmailDraft>(`/email-drafts/${id}`),

  create: (data: {
    candidate_id: number;
    email_type: EmailType;
    recipient_email: string;
    recipient_name?: string;
    subject: string;
    body_html: string;
    body_text?: string;
    attachments?: string;
    calendar_event_data?: string;
  }) => api.post<EmailDraft>('/email-drafts', data),

  update: (id: number, data: { subject?: string; body_html?: string; body_text?: string }) =>
    api.put<EmailDraft>(`/email-drafts/${id}`, data),

  approve: (id: number, gmailConnectionId?: number) =>
    api.post<{ message: string; draft: EmailDraft }>(`/email-drafts/${id}/approve`, {
      gmail_connection_id: gmailConnectionId
    }),

  reject: (id: number, reason?: string) =>
    api.post<{ message: string }>(`/email-drafts/${id}/reject`, { reason }),

  generate: (data: {
    template_id: number;
    candidate_id: number;
    interview_id?: number;
    variables?: Record<string, string>;
  }) => api.post<EmailDraft>('/email-drafts/generate', data)
};

// =====================================================
// CTC Discussion API
// =====================================================

export const ctcDiscussionApi = {
  getAll: (params?: { status?: string; candidate_id?: number; limit?: number; offset?: number }) => {
    const query = buildQueryString(params);
    return api.get<CTCDiscussion[]>(`/ctc-discussions${query}`);
  },

  getById: (id: number) => api.get<CTCDiscussion>(`/ctc-discussions/${id}`),

  create: (data: {
    candidate_id: number;
    expected_ctc?: number;
    offered_ctc?: number;
    fixed_pay?: number;
    variable_pay?: number;
    joining_bonus?: number;
    joining_date?: string;
    hr_notes?: string;
  }) => api.post<CTCDiscussion>('/ctc-discussions', data),

  update: (id: number, data: Partial<{
    expected_ctc: number;
    offered_ctc: number;
    fixed_pay: number;
    variable_pay: number;
    joining_bonus: number;
    joining_date: string;
    salary_breakdown: string;
    hr_notes: string;
    candidate_response: 'pending' | 'accepted' | 'negotiating' | 'rejected';
    status: 'pending' | 'in_progress' | 'finalized' | 'cancelled';
  }>) => api.put<CTCDiscussion>(`/ctc-discussions/${id}`, data),

  compareBenchmark: (id: number) =>
    api.post<{
      benchmark: unknown;
      analysis: string[];
      expected_ctc: number | null;
      offered_ctc: number | null;
    }>(`/ctc-discussions/${id}/compare-benchmark`, {}),

  generateBreakdown: (id: number, annualCtc?: number) =>
    api.post<{
      annual_ctc: number;
      breakdown: SalaryComponent[];
      totals: { annual: number; perMonth: number };
    }>(`/ctc-discussions/${id}/generate-breakdown`, { annual_ctc: annualCtc }),

  validate: (id: number) =>
    api.get<{ isComplete: boolean; missingFields: string[]; warnings: string[] }>(
      `/ctc-discussions/${id}/validate`
    ),

  finalize: (id: number, candidateAccepted?: boolean) =>
    api.post<{
      message: string;
      discussion_id: number;
      candidate_id: number;
      next_step?: string;
      offer_letter_data?: unknown;
    }>(`/ctc-discussions/${id}/finalize`, { candidate_accepted: candidateAccepted })
};

// =====================================================
// Automation Workflow API
// =====================================================

export const automationApi = {
  getStatus: () =>
    api.get<{ status: AutomationStatus; config: unknown }>('/automation/status'),

  getPendingActions: (params?: { limit?: number; offset?: number }) => {
    const query = buildQueryString(params);
    return api.get<PendingAction[]>(`/automation/pending-actions${query}`);
  },

  getCandidateWorkflow: (candidateId: number) =>
    api.get<{
      candidate: { id: number; name: string; email: string; status: string; automation_status: string; vacancy_title: string | null };
      workflow: WorkflowLog[];
      current_step: WorkflowStep | null;
    }>(`/automation/candidates/${candidateId}/workflow`),

  advanceWorkflow: (candidateId: number, targetStep: WorkflowStep, actionTaken?: string, details?: unknown) =>
    api.post<{ message: string; candidate_id: number; new_step: WorkflowStep }>(
      `/automation/candidates/${candidateId}/advance`,
      { target_step: targetStep, action_taken: actionTaken, details }
    ),

  pauseAutomation: (candidateId: number, reason?: string) =>
    api.post<{ message: string; candidate_id: number }>(`/automation/candidates/${candidateId}/pause`, { reason }),

  resumeAutomation: (candidateId: number) =>
    api.post<{ message: string; candidate_id: number }>(`/automation/candidates/${candidateId}/resume`, {}),

  evaluateCandidate: (candidateId: number) =>
    api.post<{
      candidate_id: number;
      screening_result: unknown;
      workflow_step: WorkflowStep;
      new_status: string;
      requires_hr_action: boolean;
      hr_prompt: string | null;
    }>(`/automation/evaluate-candidate/${candidateId}`, {}),

  processInterview: (interviewId: number, score: number, notes?: string) =>
    api.post<{
      candidate_id: number;
      interview_id: number;
      score: number;
      workflow_step: WorkflowStep;
      new_status: string;
      requires_hr_action: boolean;
      hr_prompt: string | null;
    }>(`/automation/process-interview/${interviewId}`, { score, notes }),

  completeAction: (logId: number, resolution: string, notes?: string) =>
    api.post<{ message: string; log_id: number }>(`/automation/complete-action/${logId}`, {
      resolution,
      notes
    }),

  getConfig: () => api.get<unknown>('/automation/config')
};
