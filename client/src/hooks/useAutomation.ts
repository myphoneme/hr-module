import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  gmailApi,
  calendarApi,
  emailTemplatesApi,
  emailDraftsApi,
  ctcDiscussionApi,
  automationApi
} from '../api/automation';
import type { EmailType, HRAction, WorkflowStep } from '../api/automation';

// =====================================================
// Gmail Integration Hooks
// =====================================================

export function useGmailStatus() {
  return useQuery({
    queryKey: ['gmail', 'status'],
    queryFn: () => gmailApi.getStatus()
  });
}

export function useGmailConnections() {
  return useQuery({
    queryKey: ['gmail', 'connections'],
    queryFn: () => gmailApi.getConnections()
  });
}

export function useGmailSyncHistory(connectionId?: number) {
  return useQuery({
    queryKey: ['gmail', 'sync-history', connectionId],
    queryFn: () => gmailApi.getSyncHistory(connectionId)
  });
}

export function useEmailApplications(params?: {
  status?: string;
  hr_action?: string;
  vacancy_id?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['gmail', 'applications', params],
    queryFn: () => gmailApi.getApplications(params),
    enabled: params !== undefined
  });
}

export function useEmailApplication(id: number) {
  return useQuery({
    queryKey: ['gmail', 'applications', id],
    queryFn: () => gmailApi.getApplication(id),
    enabled: !!id
  });
}

export function useGmailMutations() {
  const queryClient = useQueryClient();

  const connectGmail = useMutation({
    mutationFn: (code: string) => gmailApi.handleCallback(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail', 'connections'] });
    }
  });

  const disconnectGmail = useMutation({
    mutationFn: (id: number) => gmailApi.disconnectAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail', 'connections'] });
    }
  });

  const triggerSync = useMutation({
    mutationFn: ({ connectionId, syncType }: { connectionId: number; syncType?: 'full' | 'incremental' }) =>
      gmailApi.triggerSync(connectionId, syncType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail', 'sync-history'] });
      queryClient.invalidateQueries({ queryKey: ['gmail', 'applications'] });
    }
  });

  const processApplication = useMutation({
    mutationFn: ({ id, vacancyId }: { id: number; vacancyId: number }) =>
      gmailApi.processApplication(id, vacancyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail', 'applications'] });
    }
  });

  const hrAction = useMutation({
    mutationFn: ({ id, action, notes }: { id: number; action: HRAction; notes?: string }) =>
      gmailApi.hrAction(id, action, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail', 'applications'] });
      queryClient.invalidateQueries({ queryKey: ['automation'] });
    }
  });

  return {
    connectGmail,
    disconnectGmail,
    triggerSync,
    processApplication,
    hrAction
  };
}

// =====================================================
// Calendar Integration Hooks
// =====================================================

export function useCalendarConnections() {
  return useQuery({
    queryKey: ['calendar', 'connections'],
    queryFn: () => calendarApi.getConnections()
  });
}

export function useInterviewerAvailability(params?: {
  interviewer_id?: number;
  date_from?: string;
  date_to?: string;
  available_only?: boolean;
}) {
  return useQuery({
    queryKey: ['calendar', 'availability', params],
    queryFn: () => calendarApi.getAvailability(params)
  });
}

export function useCalendarMutations() {
  const queryClient = useQueryClient();

  const connectCalendar = useMutation({
    mutationFn: (code: string) => calendarApi.handleCallback(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar', 'connections'] });
    }
  });

  const disconnectCalendar = useMutation({
    mutationFn: (id: number) => calendarApi.disconnectAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar', 'connections'] });
    }
  });

  const syncAvailability = useMutation({
    mutationFn: ({ connectionId, interviewerId, daysAhead }: {
      connectionId: number;
      interviewerId?: number;
      daysAhead?: number;
    }) => calendarApi.syncAvailability(connectionId, interviewerId, daysAhead),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar', 'availability'] });
    }
  });

  const suggestSlots = useMutation({
    mutationFn: ({ candidateId, interviewerIds, preferredDates }: {
      candidateId: number;
      interviewerIds?: number[];
      preferredDates?: string[];
    }) => calendarApi.suggestSlots(candidateId, interviewerIds, preferredDates)
  });

  const createEvent = useMutation({
    mutationFn: calendarApi.createEvent
  });

  return {
    connectCalendar,
    disconnectCalendar,
    syncAvailability,
    suggestSlots,
    createEvent
  };
}

// =====================================================
// Email Templates Hooks
// =====================================================

export function useEmailTemplates(params?: { email_type?: EmailType; is_default?: boolean }) {
  return useQuery({
    queryKey: ['email-templates', params],
    queryFn: () => emailTemplatesApi.getAll(params)
  });
}

export function useEmailTemplate(id: number) {
  return useQuery({
    queryKey: ['email-templates', id],
    queryFn: () => emailTemplatesApi.getById(id),
    enabled: !!id
  });
}

export function useEmailTemplateMutations() {
  const queryClient = useQueryClient();

  const createTemplate = useMutation({
    mutationFn: emailTemplatesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
    }
  });

  const updateTemplate = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof emailTemplatesApi.update>[1] }) =>
      emailTemplatesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
    }
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: number) => emailTemplatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
    }
  });

  const previewTemplate = useMutation({
    mutationFn: ({ id, variables }: { id: number; variables: Record<string, string> }) =>
      emailTemplatesApi.preview(id, variables)
  });

  return {
    createTemplate,
    updateTemplate,
    deleteTemplate,
    previewTemplate
  };
}

// =====================================================
// Email Drafts Hooks
// =====================================================

export function useEmailDrafts(params?: {
  status?: string;
  email_type?: EmailType;
  candidate_id?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['email-drafts', params],
    queryFn: () => emailDraftsApi.getAll(params)
  });
}

export function usePendingDraftsCount() {
  return useQuery({
    queryKey: ['email-drafts', 'pending-count'],
    queryFn: async () => {
      const result = await emailDraftsApi.getPendingCount();
      return result.count;
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });
}

export function useEmailDraft(id: number) {
  return useQuery({
    queryKey: ['email-drafts', id],
    queryFn: () => emailDraftsApi.getById(id),
    enabled: !!id
  });
}

export function useEmailDraftMutations() {
  const queryClient = useQueryClient();

  const createDraft = useMutation({
    mutationFn: emailDraftsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-drafts'] });
    }
  });

  const updateDraft = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof emailDraftsApi.update>[1] }) =>
      emailDraftsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-drafts'] });
    }
  });

  const approveDraft = useMutation({
    mutationFn: ({ id, gmailConnectionId }: { id: number; gmailConnectionId?: number }) =>
      emailDraftsApi.approve(id, gmailConnectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-drafts'] });
      queryClient.invalidateQueries({ queryKey: ['automation'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
    }
  });

  const rejectDraft = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      emailDraftsApi.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-drafts'] });
    }
  });

  const generateDraft = useMutation({
    mutationFn: emailDraftsApi.generate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-drafts'] });
    }
  });

  return {
    createDraft,
    updateDraft,
    approveDraft,
    rejectDraft,
    generateDraft
  };
}

// =====================================================
// CTC Discussion Hooks
// =====================================================

export function useCTCDiscussions(params?: {
  status?: string;
  candidate_id?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['ctc-discussions', params],
    queryFn: () => ctcDiscussionApi.getAll(params)
  });
}

export function useCTCDiscussion(id: number) {
  return useQuery({
    queryKey: ['ctc-discussions', id],
    queryFn: () => ctcDiscussionApi.getById(id),
    enabled: !!id
  });
}

export function useCTCDiscussionMutations() {
  const queryClient = useQueryClient();

  const createDiscussion = useMutation({
    mutationFn: ctcDiscussionApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ctc-discussions'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
    }
  });

  const updateDiscussion = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof ctcDiscussionApi.update>[1] }) =>
      ctcDiscussionApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ctc-discussions'] });
    }
  });

  const compareBenchmark = useMutation({
    mutationFn: (id: number) => ctcDiscussionApi.compareBenchmark(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['ctc-discussions', id] });
    }
  });

  const generateBreakdown = useMutation({
    mutationFn: ({ id, annualCtc }: { id: number; annualCtc?: number }) =>
      ctcDiscussionApi.generateBreakdown(id, annualCtc),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['ctc-discussions', id] });
    }
  });

  const finalizeDiscussion = useMutation({
    mutationFn: ({ id, candidateAccepted }: { id: number; candidateAccepted?: boolean }) =>
      ctcDiscussionApi.finalize(id, candidateAccepted),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ctc-discussions'] });
      queryClient.invalidateQueries({ queryKey: ['automation'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
    }
  });

  return {
    createDiscussion,
    updateDiscussion,
    compareBenchmark,
    generateBreakdown,
    finalizeDiscussion
  };
}

// =====================================================
// Automation Workflow Hooks
// =====================================================

export function useAutomationStatus() {
  return useQuery({
    queryKey: ['automation', 'status'],
    queryFn: () => automationApi.getStatus(),
    refetchInterval: 30000 // Refresh every 30 seconds
  });
}

export function usePendingActions(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['automation', 'pending-actions', params],
    queryFn: () => automationApi.getPendingActions(params),
    refetchInterval: 30000
  });
}

export function useCandidateWorkflow(candidateId: number) {
  return useQuery({
    queryKey: ['automation', 'workflow', candidateId],
    queryFn: () => automationApi.getCandidateWorkflow(candidateId),
    enabled: !!candidateId
  });
}

export function useAutomationMutations() {
  const queryClient = useQueryClient();

  const advanceWorkflow = useMutation({
    mutationFn: ({ candidateId, targetStep, actionTaken, details }: {
      candidateId: number;
      targetStep: WorkflowStep;
      actionTaken?: string;
      details?: unknown;
    }) => automationApi.advanceWorkflow(candidateId, targetStep, actionTaken, details),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
    }
  });

  const pauseAutomation = useMutation({
    mutationFn: ({ candidateId, reason }: { candidateId: number; reason?: string }) =>
      automationApi.pauseAutomation(candidateId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
    }
  });

  const resumeAutomation = useMutation({
    mutationFn: (candidateId: number) => automationApi.resumeAutomation(candidateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
    }
  });

  const evaluateCandidate = useMutation({
    mutationFn: (candidateId: number) => automationApi.evaluateCandidate(candidateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
    }
  });

  const processInterview = useMutation({
    mutationFn: ({ interviewId, score, notes }: {
      interviewId: number;
      score: number;
      notes?: string;
    }) => automationApi.processInterview(interviewId, score, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation'] });
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
    }
  });

  const completeAction = useMutation({
    mutationFn: ({ logId, resolution, notes }: {
      logId: number;
      resolution: string;
      notes?: string;
    }) => automationApi.completeAction(logId, resolution, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation', 'pending-actions'] });
    }
  });

  return {
    advanceWorkflow,
    pauseAutomation,
    resumeAutomation,
    evaluateCandidate,
    processInterview,
    completeAction
  };
}
