import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  jdTemplatesApi,
  jdGenerationApi,
  naukriApi,
  aiScoringApi,
  selectionThresholdsApi,
  workflowApi,
  automatedWorkflowApi,
} from '../api/recruitmentWorkflow';
import type {
  JDTemplate,
  NaukriSearchParams,
  NaukriCandidate,
  GeneratedJD,
  ScreeningTableData,
  VacancyCompletionStatus,
} from '../api/recruitmentWorkflow';

// =============================================
// JD TEMPLATES HOOKS
// =============================================

export function useJDTemplates(params?: { department?: string; experience_level?: string; active_only?: boolean }) {
  return useQuery({
    queryKey: ['jd-templates', params],
    queryFn: () => jdTemplatesApi.getAll(params),
  });
}

export function useJDTemplate(id: number) {
  return useQuery({
    queryKey: ['jd-template', id],
    queryFn: () => jdTemplatesApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateJDTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<JDTemplate>) => jdTemplatesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jd-templates'] });
    },
  });
}

export function useUpdateJDTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<JDTemplate> }) =>
      jdTemplatesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jd-templates'] });
    },
  });
}

export function useDeleteJDTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => jdTemplatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jd-templates'] });
    },
  });
}

// =============================================
// JD GENERATION HOOKS
// =============================================

export function useGenerateJD() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ vacancyId, templateId }: { vacancyId: number; templateId?: number }) =>
      jdGenerationApi.generateJD(vacancyId, templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacancies'] });
    },
  });
}

export function useApproveJD() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ vacancyId, editedJD }: { vacancyId: number; editedJD?: Partial<GeneratedJD> }) =>
      jdGenerationApi.approveJD(vacancyId, editedJD),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacancies'] });
    },
  });
}

// =============================================
// NAUKRI HOOKS
// =============================================

export function useNaukriConfig() {
  return useQuery({
    queryKey: ['naukri-config'],
    queryFn: () => naukriApi.getConfig(),
  });
}

export function useSaveNaukriConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      api_key?: string;
      api_secret?: string;
      account_id?: string;
      subscription_type?: string;
      daily_search_limit?: number;
    }) => naukriApi.saveConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['naukri-config'] });
    },
  });
}

export function useNaukriSearch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ vacancyId, params }: { vacancyId: number; params: NaukriSearchParams }) =>
      naukriApi.search(vacancyId, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['naukri-search-history'] });
    },
  });
}

export function useImportNaukriCandidates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      search_id?: number;
      vacancy_id: number;
      candidates: NaukriCandidate[];
      auto_screen?: boolean;
    }) => naukriApi.importCandidates(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['naukri-search-history'] });
    },
  });
}

export function useUpdateCandidateScreeningFields() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ candidateId, data }: {
      candidateId: number;
      data: { current_salary?: number; expected_salary?: number; notes?: string; notice_period?: string };
    }) => naukriApi.updateCandidateScreeningFields(candidateId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
    },
  });
}

export function useNaukriSearchHistory(vacancyId?: number, limit?: number) {
  return useQuery({
    queryKey: ['naukri-search-history', vacancyId, limit],
    queryFn: () => naukriApi.getSearchHistory(vacancyId, limit),
  });
}

// =============================================
// AI INTERVIEW SCORING HOOKS
// =============================================

export function useSubmitAIScore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ interviewId, data }: {
      interviewId: number;
      data: {
        hr_feedback: string;
        strengths?: string;
        weaknesses?: string;
        technical_notes?: string;
        communication_notes?: string;
      };
    }) => aiScoringApi.submitFeedbackAndScore(interviewId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['ai-interview-scores'] });
    },
  });
}

export function useCandidateAIScores(candidateId: number) {
  return useQuery({
    queryKey: ['ai-interview-scores', candidateId],
    queryFn: () => aiScoringApi.getCandidateScores(candidateId),
    enabled: !!candidateId,
  });
}

// =============================================
// SELECTION THRESHOLDS HOOKS
// =============================================

export function useSelectionThresholds(vacancyId?: number) {
  return useQuery({
    queryKey: ['selection-thresholds', vacancyId],
    queryFn: () => selectionThresholdsApi.getAll(vacancyId),
  });
}

export function useSaveSelectionThreshold() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      vacancy_id?: number;
      department?: string;
      min_screening_score?: number;
      min_interview_score?: number;
      auto_shortlist_threshold?: number;
      auto_reject_threshold?: number;
      is_default?: boolean;
    }) => selectionThresholdsApi.save(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['selection-thresholds'] });
    },
  });
}

// =============================================
// WORKFLOW PIPELINE HOOKS
// =============================================

export function useWorkflowPipeline(vacancyId?: number) {
  return useQuery({
    queryKey: ['workflow-pipeline', vacancyId],
    queryFn: () => workflowApi.getPipeline(vacancyId),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useCandidateTimeline(candidateId: number) {
  return useQuery({
    queryKey: ['candidate-timeline', candidateId],
    queryFn: () => workflowApi.getCandidateTimeline(candidateId),
    enabled: !!candidateId,
  });
}

export function useAdvanceCandidate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ candidateId, data }: {
      candidateId: number;
      data: {
        to_stage: string;
        reason?: string;
        is_automated?: boolean;
      };
    }) => workflowApi.advanceCandidate(candidateId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: ['candidate-timeline'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-stats'] });
    },
  });
}

export function useWorkflowStats(vacancyId?: number, days?: number) {
  return useQuery({
    queryKey: ['workflow-stats', vacancyId, days],
    queryFn: () => workflowApi.getStats(vacancyId, days),
    refetchInterval: 60000, // Refresh every minute
  });
}

// =============================================
// AUTOMATED WORKFLOW HOOKS
// =============================================

// Resume Parsing
export function useParseResume() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (candidateId: number) => automatedWorkflowApi.parseResume(candidateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: ['screening-table'] });
    },
  });
}

export function useBatchParseResumes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ vacancyId, candidateIds }: { vacancyId: number; candidateIds?: number[] }) =>
      automatedWorkflowApi.batchParseResumes(vacancyId, candidateIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: ['screening-table'] });
    },
  });
}

// Auto Screening
export function useAutoScreen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ vacancyId, params }: { vacancyId: number; params?: { candidate_ids?: number[]; screening_threshold?: number } }) =>
      automatedWorkflowApi.autoScreen(vacancyId, params),
    onSuccess: (_, { vacancyId }) => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: ['screening-table', vacancyId] });
      queryClient.invalidateQueries({ queryKey: ['workflow-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-stats'] });
    },
  });
}

export function useScreeningTable(vacancyId: number) {
  return useQuery({
    queryKey: ['screening-table', vacancyId],
    queryFn: () => automatedWorkflowApi.getScreeningTable(vacancyId),
    enabled: !!vacancyId,
  });
}

// Interview Scheduling
export function useAutoScheduleInterviews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ vacancyId, params }: {
      vacancyId: number;
      params?: {
        interview_type?: string;
        start_date?: string;
        interviewer_id?: number;
        duration_minutes?: number;
      };
    }) => automatedWorkflowApi.autoScheduleInterviews(vacancyId, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-pipeline'] });
    },
  });
}

export function useSubmitInterviewScore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ interviewId, scores }: {
      interviewId: number;
      scores: {
        technical_score: number;
        communication_score: number;
        overall_score: number;
        notes?: string;
        recommendation?: string;
      };
    }) => automatedWorkflowApi.submitInterviewScore(interviewId, scores),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-stats'] });
    },
  });
}

// Offer Management
export function useGenerateOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ candidateId, params }: {
      candidateId: number;
      params: {
        annual_ctc: number;
        joining_date: string;
        designation?: string;
        department?: string;
      };
    }) => automatedWorkflowApi.generateOffer(candidateId, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['vacancy-completion'] });
    },
  });
}

export function useUpdateOfferResponse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ candidateId, response, joiningDate, reason }: {
      candidateId: number;
      response: 'accepted' | 'rejected';
      joiningDate?: string;
      reason?: string;
    }) => automatedWorkflowApi.updateOfferResponse(candidateId, response, joiningDate, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['vacancy-completion'] });
      queryClient.invalidateQueries({ queryKey: ['vacancies'] });
    },
  });
}

export function useMarkJoined() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ candidateId, actualJoiningDate }: { candidateId: number; actualJoiningDate?: string }) =>
      automatedWorkflowApi.markJoined(candidateId, actualJoiningDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['vacancy-completion'] });
      queryClient.invalidateQueries({ queryKey: ['vacancies'] });
    },
  });
}

// Vacancy Completion
export function useVacancyCompletion(vacancyId: number) {
  return useQuery({
    queryKey: ['vacancy-completion', vacancyId],
    queryFn: () => automatedWorkflowApi.getCompletionStatus(vacancyId),
    enabled: !!vacancyId,
    refetchInterval: 30000,
  });
}

// Communication Tracking
export function useLogCommunication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ candidateId, data }: {
      candidateId: number;
      data: {
        communication_type: string;
        notes: string;
        outcome?: string;
      };
    }) => automatedWorkflowApi.logCommunication(candidateId, data),
    onSuccess: (_, { candidateId }) => {
      queryClient.invalidateQueries({ queryKey: ['candidate-communications', candidateId] });
    },
  });
}

export function useCandidateCommunications(candidateId: number) {
  return useQuery({
    queryKey: ['candidate-communications', candidateId],
    queryFn: () => automatedWorkflowApi.getCommunications(candidateId),
    enabled: !!candidateId,
  });
}

// Export types for use in components
export type { ScreeningTableData, VacancyCompletionStatus };
