import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as recruitmentApi from '../api/recruitment';
import type {
  Vacancy,
  Candidate,
  Interview,
  CandidateEvaluation,
  RecruitmentStats,
  InterviewQuestion,
  VacancyChatMessage,
  ExtractedVacancyData,
} from '../api/recruitment';

// Query Keys
const QUERY_KEYS = {
  vacancies: ['vacancies'] as const,
  vacancy: (id: number) => ['vacancies', id] as const,
  candidates: ['candidates'] as const,
  candidate: (id: number) => ['candidates', id] as const,
  interviews: ['interviews'] as const,
  evaluations: ['evaluations'] as const,
  stats: ['recruitment-stats'] as const,
};

// Vacancy Hooks
export function useVacancies(filters?: { status?: string; department?: string }) {
  return useQuery({
    queryKey: [...QUERY_KEYS.vacancies, filters],
    queryFn: () => recruitmentApi.getVacancies(filters),
  });
}

export function useVacancy(id: number) {
  return useQuery({
    queryKey: QUERY_KEYS.vacancy(id),
    queryFn: () => recruitmentApi.getVacancy(id),
    enabled: !!id,
  });
}

export function useCreateVacancy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vacancy: Partial<Vacancy>) => recruitmentApi.createVacancy(vacancy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vacancies });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
  });
}

export function useUpdateVacancy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, vacancy }: { id: number; vacancy: Partial<Vacancy> }) =>
      recruitmentApi.updateVacancy(id, vacancy),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vacancies });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vacancy(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
  });
}

export function useDeleteVacancy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => recruitmentApi.deleteVacancy(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vacancies });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
  });
}

export function useGenerateJobDescription() {
  return useMutation({
    mutationFn: (params: {
      title: string;
      department?: string;
      experience_min?: number;
      experience_max?: number;
      skills_required?: string;
    }) => recruitmentApi.generateJobDescription(params),
  });
}

// Chat-based vacancy creation hook
export function useVacancyChatProcess() {
  return useMutation({
    mutationFn: (params: {
      message: string;
      conversationHistory: VacancyChatMessage[];
      extractedData: ExtractedVacancyData;
    }) => recruitmentApi.processVacancyChat(params),
  });
}

// Resume screening hook
export function useScreenResumes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ vacancyId, candidateIds }: { vacancyId: number; candidateIds?: number[] }) =>
      recruitmentApi.screenResumes(vacancyId, candidateIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidates });
    },
  });
}

// Candidate Hooks
export function useCandidates(filters?: { vacancy_id?: number; status?: string }) {
  return useQuery({
    queryKey: [...QUERY_KEYS.candidates, filters],
    queryFn: () => recruitmentApi.getCandidates(filters),
  });
}

export function useCandidate(id: number) {
  return useQuery({
    queryKey: QUERY_KEYS.candidate(id),
    queryFn: () => recruitmentApi.getCandidate(id),
    enabled: !!id,
  });
}

export function useCreateCandidate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData: FormData) => recruitmentApi.createCandidate(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidates });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vacancies });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
  });
}

export function useUpdateCandidate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, candidate }: { id: number; candidate: Partial<Candidate> }) =>
      recruitmentApi.updateCandidate(id, candidate),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidates });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidate(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
  });
}

export function useDeleteCandidate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => recruitmentApi.deleteCandidate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidates });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
  });
}

export function useScreenCandidate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => recruitmentApi.screenCandidate(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidates });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidate(id) });
    },
  });
}

export function useMakeCandidateDecision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: Parameters<typeof recruitmentApi.makeCandidateDecision>[1] }) =>
      recruitmentApi.makeCandidateDecision(id, decision),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidates });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidate(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
  });
}

export function useGenerateCTC() {
  return useMutation({
    mutationFn: ({ id, annual_ctc }: { id: number; annual_ctc: number }) =>
      recruitmentApi.generateCTC(id, annual_ctc),
  });
}

// Interview Hooks
export function useInterviews(filters?: {
  candidate_id?: number;
  interviewer_id?: number;
  status?: string;
  date?: string;
}) {
  return useQuery({
    queryKey: [...QUERY_KEYS.interviews, filters],
    queryFn: () => recruitmentApi.getInterviews(filters),
  });
}

export function useScheduleInterview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (interview: Parameters<typeof recruitmentApi.scheduleInterview>[0]) =>
      recruitmentApi.scheduleInterview(interview),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.interviews });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidates });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
  });
}

export function useGenerateInterviewQuestions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, question_count }: { id: number; question_count?: number }) =>
      recruitmentApi.generateInterviewQuestions(id, question_count),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.interviews });
    },
  });
}

export function useSubmitInterviewFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, feedback }: { id: number; feedback: Parameters<typeof recruitmentApi.submitInterviewFeedback>[1] }) =>
      recruitmentApi.submitInterviewFeedback(id, feedback),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.interviews });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidates });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.evaluations });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
  });
}

export function useUpdateInterview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Parameters<typeof recruitmentApi.updateInterview>[1] }) =>
      recruitmentApi.updateInterview(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.interviews });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidates });
    },
  });
}

export function useDeleteInterview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => recruitmentApi.deleteInterview(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.interviews });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidates });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
  });
}

// Evaluation Hooks
export function useEvaluations(candidate_id?: number) {
  return useQuery({
    queryKey: [...QUERY_KEYS.evaluations, candidate_id],
    queryFn: () => recruitmentApi.getEvaluations(candidate_id),
  });
}

// Stats Hook
export function useRecruitmentStats() {
  return useQuery({
    queryKey: QUERY_KEYS.stats,
    queryFn: () => recruitmentApi.getRecruitmentStats(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// =====================================================
// AUTOMATED WORKFLOW HOOKS
// =====================================================

// Auto-screen a single candidate based on JD criteria
export function useAutoScreenCandidate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (candidateId: number) => recruitmentApi.autoScreenCandidate(candidateId),
    onSuccess: (_, candidateId) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidates });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidate(candidateId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
  });
}

// Batch auto-screen all new candidates for a vacancy
export function useBatchAutoScreenCandidates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vacancyId: number) => recruitmentApi.batchAutoScreenCandidates(vacancyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidates });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vacancies });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
  });
}

// Submit interview score (out of 5) and get auto-selection decision
export function useSubmitInterviewScore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ interviewId, scores }: {
      interviewId: number;
      scores: Parameters<typeof recruitmentApi.submitInterviewScore>[1];
    }) => recruitmentApi.submitInterviewScore(interviewId, scores),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.interviews });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidates });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidate(result.candidate_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.evaluations });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
  });
}

// Auto-generate offer letter for selected candidate using RAG
export function useAutoGenerateOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ candidateId, params }: {
      candidateId: number;
      params: Parameters<typeof recruitmentApi.autoGenerateOffer>[1];
    }) => recruitmentApi.autoGenerateOffer(candidateId, params),
    onSuccess: (_, { candidateId }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidates });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidate(candidateId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
  });
}

// Get workflow status for a candidate
export function useWorkflowStatus(candidateId: number) {
  return useQuery({
    queryKey: ['workflow-status', candidateId],
    queryFn: () => recruitmentApi.getWorkflowStatus(candidateId),
    enabled: !!candidateId,
  });
}

// Get automation settings
export function useAutomationSettings() {
  return useQuery({
    queryKey: ['automation-settings'],
    queryFn: () => recruitmentApi.getAutomationSettings(),
  });
}

// =====================================================
// INTEREST EMAIL WORKFLOW HOOKS
// =====================================================

// Send interest email to candidate
export function useSendInterestEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ candidateId, gmailConnectionId }: {
      candidateId: number;
      gmailConnectionId: number;
    }) => recruitmentApi.sendInterestEmail(candidateId, gmailConnectionId),
    onSuccess: (_, { candidateId }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidates });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidate(candidateId) });
    },
  });
}

// Update candidate interest details manually (by HR)
export function useUpdateInterestDetails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ candidateId, details }: {
      candidateId: number;
      details: recruitmentApi.InterestDetailsUpdate;
    }) => recruitmentApi.updateInterestDetails(candidateId, details),
    onSuccess: (_, { candidateId }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidates });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidate(candidateId) });
    },
  });
}

// Re-extract experience from resume
export function useReExtractExperience() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (candidateId: number) => recruitmentApi.reExtractExperience(candidateId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidates });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidate(result.candidate.id) });
    },
  });
}

// Batch send interest emails to multiple candidates
export function useBatchSendInterestEmails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ candidateIds, gmailConnectionId }: {
      candidateIds: number[];
      gmailConnectionId: number;
    }) => recruitmentApi.batchSendInterestEmails(candidateIds, gmailConnectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidates });
    },
  });
}

// Send candidates for head person review
export function useSendHeadReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      vacancy_id: number;
      candidate_ids: number[];
      reviewer_emails: recruitmentApi.ReviewerEmail[];
      gmail_connection_id?: number;
    }) => recruitmentApi.sendHeadReview(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidates });
    },
  });
}

// Send interview invitation email
export function useSendInterviewInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: recruitmentApi.SendInterviewInviteParams) =>
      recruitmentApi.sendInterviewInvite(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.interviews });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidates });
    },
  });
}

// Batch send interview invitation emails
export function useBatchSendInterviewInvites() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      interview_ids: number[];
      gmail_connection_id: number;
      additional_interviewers?: string[];
      custom_message?: string;
    }) => recruitmentApi.batchSendInterviewInvites(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.interviews });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidates });
    },
  });
}

// Export types
export type { Vacancy, Candidate, Interview, CandidateEvaluation, RecruitmentStats, InterviewQuestion };
export type { AutoScreeningResult, InterviewScoreResult, AutoOfferResult, WorkflowStatus, AutomationSettings } from '../api/recruitment';
export type { VacancyChatMessage, ExtractedVacancyData, VacancyChatResponse, GeneratedJD } from '../api/recruitment';
export type { ScreenedCandidate, ResumeScreeningResult } from '../api/recruitment';
export type { SendInterviewInviteParams, SendInterviewInviteResult } from '../api/recruitment';
export type { BatchSendInterestEmailsResult } from '../api/recruitment';
export type { ReExtractExperienceResult } from '../api/recruitment';
export type { ReviewerEmail, SendHeadReviewResult } from '../api/recruitment';
