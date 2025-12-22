import { api } from './client';

// =============================================
// TYPES
// =============================================

export interface JDTemplate {
  id: number;
  name: string;
  department: string | null;
  template_content: string;
  skills_keywords: string | null;
  experience_level: 'fresher' | 'junior' | 'mid' | 'senior' | 'lead' | 'executive' | null;
  is_default: boolean;
  created_by: number;
  created_by_name?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NaukriConfig {
  configured: boolean;
  account_id?: string;
  subscription_type?: string;
  daily_search_limit?: number;
  searches_today?: number;
  is_active?: boolean;
  has_api_key?: boolean;
  has_api_secret?: boolean;
  message?: string;
}

export interface NaukriSearchParams {
  keywords?: string[];
  location?: string[];
  experience_min?: number;
  experience_max?: number;
  skills?: string[];
  limit?: number;
}

export interface NaukriCandidate {
  profile_id: string;
  first_name: string;
  last_name: string;
  name: string;
  email: string;
  phone?: string;
  current_company?: string;
  current_designation?: string;
  experience_years?: number;
  current_salary?: number;
  expected_salary?: number;
  skills?: string[];
  location?: string;
  last_active?: string;
  resume_headline?: string;
}

export interface NaukriSearchResult {
  search_id: number;
  mock_data?: boolean;
  message?: string;
  total_results: number;
  candidates: NaukriCandidate[];
}

export interface NaukriSearch {
  id: number;
  vacancy_id: number;
  vacancy_title?: string;
  search_query: string;
  search_params: string;
  total_results: number;
  candidates_imported: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  searched_by: number;
  searched_by_name?: string;
  createdAt: string;
}

export interface AIInterviewScore {
  id: number;
  candidate_id: number;
  interview_id: number;
  hr_feedback_raw: string;
  technical_skills_score: number | null;
  technical_skills_reasoning: string | null;
  communication_score: number | null;
  communication_reasoning: string | null;
  problem_solving_score: number | null;
  problem_solving_reasoning: string | null;
  cultural_fit_score: number | null;
  cultural_fit_reasoning: string | null;
  overall_performance_score: number | null;
  overall_performance_reasoning: string | null;
  final_ai_score: number | null;
  ai_recommendation: 'strong_hire' | 'hire' | 'borderline' | 'no_hire' | 'strong_no_hire' | null;
  selection_threshold_met: boolean;
  detailed_analysis: string | null;
  key_strengths?: string[];
  areas_for_development?: string[];
  risk_factors?: string[];
  scored_at: string;
  // Joined fields
  interview_type?: string;
  round_number?: number;
  scheduled_date?: string;
}

export interface SelectionThreshold {
  id: number;
  vacancy_id: number | null;
  vacancy_title?: string;
  department: string | null;
  min_screening_score: number;
  min_interview_score: number;
  auto_shortlist_threshold: number;
  auto_reject_threshold: number;
  is_default: boolean;
  created_by: number;
  created_by_name?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStage {
  id: number;
  candidate_id: number;
  vacancy_id: number | null;
  current_stage: string;
  previous_stage: string | null;
  stage_started_at: string;
  stage_completed_at: string | null;
  stage_notes: string | null;
  updated_by: number | null;
}

export interface WorkflowHistory {
  id: number;
  candidate_id: number;
  vacancy_id: number | null;
  from_stage: string | null;
  to_stage: string;
  changed_by: number | null;
  changed_by_name?: string;
  change_reason: string | null;
  is_automated: boolean;
  metadata?: string;
  createdAt: string;
}

export interface PipelineData {
  stage_counts: Array<{ stage: string; count: number }>;
  pipeline: Record<string, Array<{
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    screening_score: number | null;
    final_interview_score: number | null;
    workflow_stage: string;
    vacancy_title?: string;
    updatedAt: string;
  }>>;
  stages: string[];
}

export interface WorkflowStats {
  total_candidates: number;
  new_count: number;
  screened_count: number;
  interviewing_count: number;
  selected_count: number;
  offer_count: number;
  joined_count: number;
  rejected_count: number;
  avg_screening_score: number | null;
  avg_interview_score: number | null;
}

export interface GeneratedJD {
  job_summary: string;
  responsibilities: string[];
  requirements: string[];
  preferred_qualifications: string[];
  what_we_offer: string[];
  skills_extracted: string[];
  full_jd_text?: string;
}

// Helper to build query string
const buildQueryString = (params?: Record<string, any>): string => {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

// =============================================
// JD TEMPLATES API
// =============================================

export const jdTemplatesApi = {
  getAll: (params?: { department?: string; experience_level?: string; active_only?: boolean }) =>
    api.get<JDTemplate[]>(`/recruitment-workflow/jd-templates${buildQueryString(params)}`),

  getById: (id: number) =>
    api.get<JDTemplate>(`/recruitment-workflow/jd-templates/${id}`),

  create: (data: Partial<JDTemplate>) =>
    api.post<JDTemplate>('/recruitment-workflow/jd-templates', data),

  update: (id: number, data: Partial<JDTemplate>) =>
    api.put<JDTemplate>(`/recruitment-workflow/jd-templates/${id}`, data),

  delete: (id: number) =>
    api.delete(`/recruitment-workflow/jd-templates/${id}`),
};

// =============================================
// JD GENERATION API
// =============================================

export const jdGenerationApi = {
  generateJD: (vacancyId: number, templateId?: number) =>
    api.post<{ vacancy: any; generated_jd: GeneratedJD; message: string }>(
      `/recruitment-workflow/vacancies/${vacancyId}/generate-jd`,
      { template_id: templateId }
    ),

  approveJD: (vacancyId: number, editedJD?: Partial<GeneratedJD>) =>
    api.post<{ vacancy: any; message: string }>(
      `/recruitment-workflow/vacancies/${vacancyId}/approve-jd`,
      { edited_jd: editedJD }
    ),
};

// =============================================
// NAUKRI API
// =============================================

export const naukriApi = {
  getConfig: () =>
    api.get<NaukriConfig>('/recruitment-workflow/naukri/config'),

  saveConfig: (data: {
    api_key?: string;
    api_secret?: string;
    account_id?: string;
    subscription_type?: string;
    daily_search_limit?: number;
  }) =>
    api.post<{ message: string; id: number }>('/recruitment-workflow/naukri/config', data),

  search: (vacancyId: number, params: NaukriSearchParams) =>
    api.post<NaukriSearchResult>(`/recruitment-workflow/naukri/search/${vacancyId}`, params),

  importCandidates: (data: {
    search_id?: number;
    vacancy_id: number;
    candidates: NaukriCandidate[];
    auto_screen?: boolean;
  }) =>
    api.post<{
      message: string;
      imported_count: number;
      duplicate_count: number;
      imported_ids: number[];
      duplicates: string[];
      required_skills?: string[];
      automation_results: {
        shortlisted: { id: number; name: string; score: number }[];
        rejected: { id: number; name: string; score: number; reason: string }[];
        interviews_scheduled: any[];
        summary: {
          total_processed: number;
          auto_shortlisted: number;
          auto_rejected: number;
          pending_review: number;
          interviews_auto_scheduled: number;
        };
      };
    }>('/recruitment-workflow/naukri/import-candidates', data),

  getSearchHistory: (vacancyId?: number, limit?: number) =>
    api.get<NaukriSearch[]>(`/recruitment-workflow/naukri/search-history${buildQueryString({ vacancy_id: vacancyId, limit })}`),

  updateCandidateScreeningFields: (candidateId: number, data: {
    current_salary?: number;
    expected_salary?: number;
    notes?: string;
    notice_period?: string;
  }) =>
    api.patch<any>(`/recruitment-workflow/candidates/${candidateId}/screening-fields`, data),
};

// =============================================
// AI INTERVIEW SCORING API
// =============================================

export const aiScoringApi = {
  submitFeedbackAndScore: (interviewId: number, data: {
    hr_feedback: string;
    strengths?: string;
    weaknesses?: string;
    technical_notes?: string;
    communication_notes?: string;
  }) =>
    api.post<{
      ai_score: AIInterviewScore;
      meets_threshold: boolean;
      threshold: number;
      recommendation: string;
      message: string;
    }>(`/recruitment-workflow/interviews/${interviewId}/ai-score`, data),

  getCandidateScores: (candidateId: number) =>
    api.get<AIInterviewScore[]>(`/recruitment-workflow/candidates/${candidateId}/interview-scores`),
};

// =============================================
// SELECTION THRESHOLDS API
// =============================================

export const selectionThresholdsApi = {
  getAll: (vacancyId?: number) =>
    api.get<SelectionThreshold[]>(`/recruitment-workflow/selection-thresholds${buildQueryString({ vacancy_id: vacancyId })}`),

  save: (data: Partial<SelectionThreshold>) =>
    api.post<SelectionThreshold | { message: string; updated: boolean }>(
      '/recruitment-workflow/selection-thresholds',
      data
    ),
};

// =============================================
// WORKFLOW PIPELINE API
// =============================================

export const workflowApi = {
  getPipeline: (vacancyId?: number) =>
    api.get<PipelineData>(`/recruitment-workflow/workflow/pipeline${buildQueryString({ vacancy_id: vacancyId })}`),

  getCandidateTimeline: (candidateId: number) =>
    api.get<{
      current_stage: WorkflowStage | null;
      history: WorkflowHistory[];
    }>(`/recruitment-workflow/workflow/${candidateId}/timeline`),

  advanceCandidate: (candidateId: number, data: {
    to_stage: string;
    reason?: string;
    is_automated?: boolean;
  }) =>
    api.post<{
      message: string;
      from_stage: string;
      to_stage: string;
    }>(`/recruitment-workflow/workflow/${candidateId}/advance`, data),

  getStats: (vacancyId?: number, days?: number) =>
    api.get<WorkflowStats>(`/recruitment-workflow/workflow/stats${buildQueryString({ vacancy_id: vacancyId, days })}`),
};

// =============================================
// STAGE CONSTANTS
// =============================================

export const WORKFLOW_STAGES = [
  { key: 'new', label: 'New', color: 'gray' },
  { key: 'screening', label: 'Screening', color: 'blue' },
  { key: 'screened', label: 'Screened', color: 'blue' },
  { key: 'shortlisted', label: 'Shortlisted', color: 'green' },
  { key: 'rejected', label: 'Rejected', color: 'red' },
  { key: 'interview_scheduled', label: 'Interview Scheduled', color: 'purple' },
  { key: 'interview_completed', label: 'Interview Completed', color: 'purple' },
  { key: 'interview_scored', label: 'Interview Scored', color: 'purple' },
  { key: 'selected', label: 'Selected', color: 'green' },
  { key: 'ctc_discussion', label: 'CTC Discussion', color: 'yellow' },
  { key: 'ctc_finalized', label: 'CTC Finalized', color: 'yellow' },
  { key: 'offer_generated', label: 'Offer Generated', color: 'indigo' },
  { key: 'offer_sent', label: 'Offer Sent', color: 'indigo' },
  { key: 'offer_accepted', label: 'Offer Accepted', color: 'green' },
  { key: 'offer_rejected', label: 'Offer Rejected', color: 'red' },
  { key: 'joined', label: 'Joined', color: 'green' },
  { key: 'withdrawn', label: 'Withdrawn', color: 'gray' },
] as const;

export const getStageInfo = (stageKey: string) => {
  return WORKFLOW_STAGES.find(s => s.key === stageKey) || { key: stageKey, label: stageKey, color: 'gray' };
};

export const AI_RECOMMENDATIONS = {
  strong_hire: { label: 'Strong Hire', color: 'green', icon: '✓✓' },
  hire: { label: 'Hire', color: 'green', icon: '✓' },
  borderline: { label: 'Borderline', color: 'yellow', icon: '~' },
  no_hire: { label: 'No Hire', color: 'red', icon: '✗' },
  strong_no_hire: { label: 'Strong No Hire', color: 'red', icon: '✗✗' },
} as const;

// =============================================
// AUTOMATED WORKFLOW TYPES
// =============================================

export interface ParsedSkillExperience {
  skill: string;
  years: number;
  proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  matched: boolean;
}

export interface ParsedResume {
  candidate_name: string;
  total_experience_years: number;
  current_company: string | null;
  current_designation: string | null;
  project_history: Array<{
    name: string;
    duration: string;
    technologies: string[];
    description: string;
  }>;
  skill_experience: ParsedSkillExperience[];
  education: string[];
  certifications: string[];
}

export interface SkillMatch {
  skill: string;
  required: boolean;
  candidate_years: number | null;
  jd_requirement: string;
  match_status: 'match' | 'partial' | 'no_match';
}

export interface ScreeningResult {
  candidate_id: number;
  candidate_name: string;
  total_experience: number;
  skill_matches: SkillMatch[];
  overall_match_percentage: number;
  recommendation: 'shortlist' | 'review' | 'reject';
  screening_notes: string;
}

export interface ScreeningTableCandidate {
  id: number;
  name: string;
  email: string;
  total_experience: number;
  screening_score: number | null;
  status: string;
  workflow_stage: string;
  skill_columns: Record<string, { years: number | null; status: 'tick' | 'cross' | 'partial' }>;
  screening_notes: string | null;
}

export interface ScreeningTableData {
  vacancy_id: number;
  vacancy_title: string;
  jd_skills: string[];
  experience_range: { min: number; max: number };
  candidates: ScreeningTableCandidate[];
  summary: {
    total: number;
    screened: number;
    shortlisted: number;
    rejected: number;
    pending: number;
  };
}

export interface VacancyCompletionStatus {
  vacancy_id: number;
  vacancy_title: string;
  vacancy_status: string;
  openings: number;
  filled: number;
  pending_joins: number;
  progress_percentage: number;
  is_complete: boolean;
  candidate_counts: {
    total_candidates: number;
    new_count: number;
    screening_count: number;
    interview_count: number;
    selected_count: number;
    offer_generated_count: number;
    offer_accepted_count: number;
    offer_rejected_count: number;
    joined_count: number;
    rejected_count: number;
  };
  pipeline: {
    total: number;
    in_screening: number;
    in_interviews: number;
    selected: number;
    offers_pending: number;
    offers_accepted: number;
    joined: number;
    dropped: number;
  };
}

export interface ScheduledInterview {
  interview_id: number;
  candidate_id: number;
  candidate_name: string;
  scheduled_date: string;
  interview_type: string;
}

export interface InterviewScoreResult {
  message: string;
  interview_id: number;
  candidate_id: number;
  candidate_name: string;
  average_score: number;
  threshold: number;
  is_selected: boolean;
  new_status: string;
}

export interface OfferData {
  candidate_id: number;
  candidate_name: string;
  designation: string;
  department: string;
  annual_ctc: number;
  joining_date: string;
  location: string;
  generated_at: string;
}

// =============================================
// AUTOMATED WORKFLOW API
// =============================================

export const automatedWorkflowApi = {
  // Resume parsing
  parseResume: (candidateId: number) =>
    api.post<{
      candidate_id: number;
      parsed_resume: ParsedResume;
      jd_skills: string[];
      message: string;
    }>(`/recruitment-workflow/candidates/${candidateId}/parse-resume`, {}),

  batchParseResumes: (vacancyId: number, candidateIds?: number[]) =>
    api.post<{
      message: string;
      parsed_count: number;
      candidates: Array<{
        candidate_id: number;
        candidate_name: string;
        parsed: boolean;
        skill_count?: number;
        error?: string;
      }>;
    }>(`/recruitment-workflow/vacancies/${vacancyId}/parse-resumes`, { candidate_ids: candidateIds }),

  // Auto-screening
  autoScreen: (vacancyId: number, params?: { candidate_ids?: number[]; screening_threshold?: number }) =>
    api.post<{
      message: string;
      vacancy_id: number;
      jd_skills: string[];
      experience_range: { min: number; max: number };
      screening_threshold: number;
      screening_results: ScreeningResult[];
      summary: { total: number; shortlisted: number; review: number; rejected: number };
    }>(`/recruitment-workflow/vacancies/${vacancyId}/auto-screen`, params || {}),

  getScreeningTable: (vacancyId: number) =>
    api.get<ScreeningTableData>(`/recruitment-workflow/vacancies/${vacancyId}/screening-table`),

  // Interview scheduling
  autoScheduleInterviews: (vacancyId: number, params?: {
    interview_type?: string;
    start_date?: string;
    interviewer_id?: number;
    duration_minutes?: number;
  }) =>
    api.post<{
      message: string;
      scheduled_count: number;
      interviews: ScheduledInterview[];
    }>(`/recruitment-workflow/vacancies/${vacancyId}/auto-schedule-interviews`, params || {}),

  submitInterviewScore: (interviewId: number, scores: {
    technical_score: number;
    communication_score: number;
    overall_score: number;
    notes?: string;
    recommendation?: string;
  }) =>
    api.post<InterviewScoreResult>(`/recruitment-workflow/interviews/${interviewId}/submit-score`, scores),

  // Offer management
  generateOffer: (candidateId: number, params: {
    annual_ctc: number;
    joining_date: string;
    designation?: string;
    department?: string;
  }) =>
    api.post<{ message: string; offer: OfferData }>(`/recruitment-workflow/candidates/${candidateId}/generate-offer`, params),

  updateOfferResponse: (candidateId: number, response: 'accepted' | 'rejected', joiningDate?: string, reason?: string) =>
    api.post<{ message: string; candidate_id: number; new_status: string }>(
      `/recruitment-workflow/candidates/${candidateId}/offer-response`,
      { response, joining_date: joiningDate, reason }
    ),

  markJoined: (candidateId: number, actualJoiningDate?: string) =>
    api.post<{ message: string; candidate_id: number }>(
      `/recruitment-workflow/candidates/${candidateId}/mark-joined`,
      { actual_joining_date: actualJoiningDate }
    ),

  // Vacancy completion
  getCompletionStatus: (vacancyId: number) =>
    api.get<VacancyCompletionStatus>(`/recruitment-workflow/vacancies/${vacancyId}/completion-status`),

  // Communication tracking
  logCommunication: (candidateId: number, data: {
    communication_type: string;
    notes: string;
    outcome?: string;
  }) =>
    api.post<{ message: string; candidate_id: number }>(
      `/recruitment-workflow/candidates/${candidateId}/screening-communication`,
      data
    ),

  getCommunications: (candidateId: number) =>
    api.get<Array<{
      id: number;
      candidate_id: number;
      action: string;
      action_type: string;
      details: string;
      performed_by: number;
      performed_by_name: string;
      createdAt: string;
    }>>(`/recruitment-workflow/candidates/${candidateId}/communications`),
};
