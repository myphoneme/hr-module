import { api } from './client';

const API_BASE = '/recruitment';

// Types
export interface Vacancy {
  id: number;
  title: string;
  department?: string;
  location?: string;
  employment_type: 'full_time' | 'part_time' | 'contract' | 'internship';
  experience_min?: number;
  experience_max?: number;
  salary_min?: number;
  salary_max?: number;
  openings_count: number;
  job_description?: string;
  requirements?: string;
  responsibilities?: string;
  benefits?: string;
  skills_required?: string;
  qualifications?: string;
  status: 'draft' | 'open' | 'on_hold' | 'closed' | 'filled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  posted_date?: string;
  closing_date?: string;
  hiring_manager_id?: number;
  hiring_manager_name?: string;
  created_by: number;
  created_by_name?: string;
  candidate_count?: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

export interface Candidate {
  id: number;
  vacancy_id?: number;
  vacancy_title?: string;
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  current_company?: string;
  current_designation?: string;
  current_salary?: number;
  expected_salary?: number;
  experience_years?: number;
  notice_period?: string;
  skills?: string;
  education?: string;
  resume_path?: string;
  resume_extracted_text?: string;
  source: 'direct' | 'referral' | 'job_portal' | 'linkedin' | 'campus' | 'consultant' | 'other';
  referral_name?: string;
  screening_score?: number;
  screening_notes?: string;
  skill_experience_data?: string;
  screening_date?: string;
  notes?: string;
  status: 'new' | 'screening' | 'shortlisted' | 'interview_scheduled' | 'interviewed' | 'selected' | 'offer_sent' | 'offer_accepted' | 'offer_rejected' | 'joined' | 'rejected' | 'withdrawn' | 'on_hold';
  rejection_reason?: string;
  offer_letter_id?: number;
  created_by: number;
  created_by_name?: string;
  isActive: number;
  createdAt: string;
  updatedAt: string;
  interviews?: Interview[];
  evaluations?: CandidateEvaluation[];
  // Interest email workflow fields
  is_interested?: 'yes' | 'no' | 'pending';
  interview_availability?: 'tomorrow' | 'preferred_date';
  preferred_interview_date?: string;
  form_response_date?: string;
  interest_email_sent_date?: string;
  form_token?: string;
  // Head review fields
  head_review_approved?: number;
  head_review_date?: string;
  head_review_remarks?: string;
}

export interface Interview {
  id: number;
  candidate_id: number;
  vacancy_id?: number;
  vacancy_title?: string;
  round_number: number;
  interview_type: 'hr' | 'technical' | 'managerial' | 'final';
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  interviewer_id: number;
  interviewer_name?: string;
  co_interviewer_ids?: string;
  location?: string;
  meeting_link?: string;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled';
  questions_generated?: string;
  feedback?: string;
  rating?: number;
  recommendation?: 'strong_hire' | 'hire' | 'maybe' | 'no_hire' | 'strong_no_hire' | 'selected' | 'rejected';
  strengths?: string;
  weaknesses?: string;
  notes?: string;
  first_name?: string;
  last_name?: string;
  candidate_email?: string;
  created_by: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateEvaluation {
  id: number;
  candidate_id: number;
  interview_id?: number;
  evaluated_by: number;
  evaluator_name?: string;
  evaluation_type: 'screening' | 'interview' | 'final';
  technical_skills?: number;
  communication?: number;
  problem_solving?: number;
  cultural_fit?: number;
  leadership?: number;
  attitude?: number;
  domain_knowledge?: number;
  overall_score?: number;
  recommendation?: 'strong_hire' | 'hire' | 'maybe' | 'no_hire' | 'strong_no_hire';
  strengths?: string;
  weaknesses?: string;
  detailed_feedback?: string;
  questions_asked?: string;
  candidate_questions?: string;
  salary_recommendation?: number;
  designation_recommendation?: string;
  joining_timeline?: string;
  is_final: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecruitmentStats {
  vacancies: {
    total: number;
    open: number;
    filled: number;
  };
  candidates: {
    total: number;
    new: number;
    shortlisted: number;
    interviewing: number;
    selected: number;
    offer_sent: number;
    joined: number;
  };
  interviews: {
    scheduled: number;
    today: number;
    upcoming: number;
  };
  hr_documents: number;
}

export interface InterviewQuestion {
  question: string;
  type: 'technical' | 'behavioral' | 'situational' | 'hr';
  difficulty: 'easy' | 'medium' | 'hard';
  expected_answer?: string;
  time_minutes?: number;
}

export interface CTCBreakdown {
  annual_ctc: number;
  monthly_ctc: number;
  breakdown: {
    component: string;
    perMonth: number;
    annual: number;
  }[];
  candidate: {
    name: string;
    email: string;
  };
}

// Vacancy APIs
export const getVacancies = async (filters?: { status?: string; department?: string }): Promise<Vacancy[]> => {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.department) params.append('department', filters.department);
  const queryString = params.toString();
  return api.get<Vacancy[]>(`${API_BASE}/vacancies${queryString ? `?${queryString}` : ''}`);
};

export const getVacancy = async (id: number): Promise<Vacancy & { candidates: Candidate[] }> => {
  return api.get<Vacancy & { candidates: Candidate[] }>(`${API_BASE}/vacancies/${id}`);
};

export const createVacancy = async (vacancy: Partial<Vacancy>): Promise<Vacancy> => {
  return api.post<Vacancy>(`${API_BASE}/vacancies`, vacancy);
};

export const updateVacancy = async (id: number, vacancy: Partial<Vacancy>): Promise<Vacancy> => {
  return api.put<Vacancy>(`${API_BASE}/vacancies/${id}`, vacancy);
};

export const deleteVacancy = async (id: number): Promise<void> => {
  await api.delete(`${API_BASE}/vacancies/${id}`);
};

export const generateJobDescription = async (params: {
  title: string;
  department?: string;
  experience_min?: number;
  experience_max?: number;
  skills_required?: string;
}): Promise<{
  job_description: string;
  responsibilities: string;
  requirements: string;
  qualifications: string;
  benefits: string;
}> => {
  return api.post(`${API_BASE}/vacancies/generate-jd`, params);
};

// Chat-based vacancy creation types
export interface VacancyChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ExtractedVacancyData {
  title?: string;
  department?: string;
  location?: string;
  employment_type?: 'full_time' | 'part_time' | 'contract' | 'internship';
  experience_min?: number;
  experience_max?: number;
  salary_min?: number;
  salary_max?: number;
  openings_count?: number;
  additional_notes?: string;
}

export interface GeneratedJD {
  title: string;
  department?: string;
  location: string;
  employment_type: string;
  experience_min: number;
  experience_max: number;
  salary_min: number;
  salary_max: number;
  openings_count: number;
  job_description: string;
  responsibilities: string;
  skills_required: string;
  qualifications: string;
  requirements: string;
  benefits: string;
}

export interface VacancyChatResponse {
  response: string;
  extractedData: ExtractedVacancyData;
  missingFields: string[];
  isComplete: boolean;
  generatedJD?: GeneratedJD;
}

// Chat-based vacancy creation API
export const processVacancyChat = async (params: {
  message: string;
  conversationHistory: VacancyChatMessage[];
  extractedData: ExtractedVacancyData;
}): Promise<VacancyChatResponse> => {
  return api.post(`${API_BASE}/vacancies/chat-process`, params);
};

// Resume screening types and API
export interface ScreenedCandidate {
  id: number;
  candidate_name: string;
  total_experience_years: number | string;
  current_ctc: string;
  expected_ctc: string;
  notice_period: string;
  current_location: string;
  technology_experience: Record<string, number | string>;
  skills_matched: string[];
  overall_match_score: number;
  status: string;
  email: string;
  error?: string;
}

export interface ResumeScreeningResult {
  vacancy_title: string;
  technologies_analyzed: string[];
  total_candidates: number;
  screenedCandidates: ScreenedCandidate[];
}

export const screenResumes = async (
  vacancyId: number,
  candidateIds?: number[]
): Promise<ResumeScreeningResult> => {
  return api.post(`${API_BASE}/vacancies/${vacancyId}/screen-resumes`, {
    candidate_ids: candidateIds
  });
};

// Candidate APIs
export const getCandidates = async (filters?: { vacancy_id?: number; status?: string }): Promise<Candidate[]> => {
  const params = new URLSearchParams();
  if (filters?.vacancy_id) params.append('vacancy_id', filters.vacancy_id.toString());
  if (filters?.status) params.append('status', filters.status);
  const queryString = params.toString();
  return api.get<Candidate[]>(`${API_BASE}/candidates${queryString ? `?${queryString}` : ''}`);
};

export const getCandidate = async (id: number): Promise<Candidate> => {
  return api.get<Candidate>(`${API_BASE}/candidates/${id}`);
};

export const createCandidate = async (formData: FormData): Promise<Candidate> => {
  const response = await fetch(`http://localhost:3001/api${API_BASE}/candidates`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

export const updateCandidate = async (id: number, candidate: Partial<Candidate>): Promise<Candidate> => {
  return api.put<Candidate>(`${API_BASE}/candidates/${id}`, candidate);
};

export const deleteCandidate = async (id: number): Promise<void> => {
  await api.delete(`${API_BASE}/candidates/${id}`);
};

export const screenCandidate = async (id: number): Promise<{
  screening_score: number;
  match_analysis: string;
  strengths: string[];
  concerns: string[];
  recommendation: 'shortlist' | 'maybe' | 'reject';
  notes: string;
}> => {
  return api.post(`${API_BASE}/candidates/${id}/screen`);
};

export const makeCandidateDecision = async (id: number, decision: {
  decision: 'selected' | 'rejected';
  rejection_reason?: string;
  salary_offered?: number;
  designation_offered?: string;
  joining_date?: string;
}): Promise<{ message: string }> => {
  return api.post(`${API_BASE}/candidates/${id}/decision`, decision);
};

export const generateCTC = async (id: number, annual_ctc: number): Promise<CTCBreakdown> => {
  return api.post(`${API_BASE}/candidates/${id}/generate-ctc`, { annual_ctc });
};

// Interview APIs
export const getInterviews = async (filters?: {
  candidate_id?: number;
  interviewer_id?: number;
  status?: string;
  date?: string;
}): Promise<Interview[]> => {
  const params = new URLSearchParams();
  if (filters?.candidate_id) params.append('candidate_id', filters.candidate_id.toString());
  if (filters?.interviewer_id) params.append('interviewer_id', filters.interviewer_id.toString());
  if (filters?.status) params.append('status', filters.status);
  if (filters?.date) params.append('date', filters.date);
  const queryString = params.toString();
  return api.get<Interview[]>(`${API_BASE}/interviews${queryString ? `?${queryString}` : ''}`);
};

export const scheduleInterview = async (interview: {
  candidate_id: number;
  vacancy_id?: number;
  round_number?: number;
  interview_type?: 'hr' | 'technical' | 'managerial' | 'final';
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes?: number;
  interviewer_id: number;
  location?: string;
  meeting_link?: string;
}): Promise<Interview> => {
  return api.post<Interview>(`${API_BASE}/interviews`, interview);
};

export const generateInterviewQuestions = async (id: number, question_count?: number): Promise<{
  questions: InterviewQuestion[];
}> => {
  return api.post(`${API_BASE}/interviews/${id}/generate-questions`, { question_count });
};

export const submitInterviewFeedback = async (id: number, feedback: {
  score: number;
  notes?: string;
  ai_decision: 'selected' | 'rejected';
}): Promise<{ message: string; decision: string; score: number }> => {
  return api.post(`${API_BASE}/interviews/${id}/feedback`, feedback);
};

export const updateInterview = async (id: number, updates: {
  scheduled_date?: string;
  scheduled_time?: string;
  interviewer_id?: number;
  interview_type?: 'hr' | 'technical' | 'managerial' | 'final';
  duration_minutes?: number;
  location?: string;
  meeting_link?: string;
  status?: string;
  notes?: string;
}): Promise<Interview> => {
  return api.patch<Interview>(`${API_BASE}/interviews/${id}`, updates);
};

export const deleteInterview = async (id: number): Promise<void> => {
  return api.delete(`${API_BASE}/interviews/${id}`);
};

// Send Interview Invitation Email
export interface SendInterviewInviteParams {
  interview_id: number;
  gmail_connection_id: number;
  additional_interviewers?: { name: string; email: string }[];
  custom_message?: string;
  is_online?: boolean;
  location_or_link?: string;
}

export interface SendInterviewInviteResult {
  success: boolean;
  message: string;
  sent_to: string;
  sent_from: string;
  cc_sent_to?: string[];
  interview_details: {
    round: string;
    date: string;
    time: string;
    location: string;
  };
}

export const sendInterviewInvite = async (params: SendInterviewInviteParams): Promise<SendInterviewInviteResult> => {
  const { interview_id, ...body } = params;
  return api.post(`${API_BASE}/interviews/${interview_id}/send-invite`, body);
};

export const batchSendInterviewInvites = async (params: {
  interview_ids: number[];
  gmail_connection_id: number;
  additional_interviewers?: string[];
  custom_message?: string;
}): Promise<{
  success: boolean;
  message: string;
  results: {
    success: { id: number; candidate: string; email: string }[];
    failed: { id: number; error: string }[];
  };
}> => {
  return api.post(`${API_BASE}/interviews/batch-send-invites`, params);
};

// Evaluation APIs
export const getEvaluations = async (candidate_id?: number): Promise<CandidateEvaluation[]> => {
  const params = candidate_id ? `?candidate_id=${candidate_id}` : '';
  return api.get<CandidateEvaluation[]>(`${API_BASE}/evaluations${params}`);
};

// Stats API
export const getRecruitmentStats = async (): Promise<RecruitmentStats> => {
  return api.get<RecruitmentStats>(`${API_BASE}/stats`);
};

// =====================================================
// AUTOMATED WORKFLOW APIs
// =====================================================

export interface AutoScreeningResult {
  screening_score: number;
  experience_match: {
    score: number;
    reasoning: string;
    candidate_exp: number;
    required_range: string;
  };
  skills_match: {
    score: number;
    reasoning: string;
    matched_skills: string[];
    missing_skills: string[];
  };
  location_match: {
    score: number;
    reasoning: string;
  };
  overall_analysis: string;
  recommendation: 'shortlist' | 'maybe' | 'reject';
  auto_decision: boolean;
  decision_reason: string;
  new_status: string;
  thresholds: {
    AUTO_SHORTLIST: number;
    AUTO_REJECT: number;
    INTERVIEW_PASS: number;
    INTERVIEW_FAIL: number;
  };
}

export interface InterviewScoreResult {
  interview_id: number;
  candidate_id: number;
  candidate_name: string;
  scores: {
    technical_skills: number;
    communication: number;
    problem_solving: number;
    cultural_fit: number;
    overall_performance: number;
  };
  average_score: number;
  decision: 'selected' | 'rejected' | 'pending';
  decision_reason: string;
  thresholds: {
    pass: number;
    fail: number;
  };
  offer_letter_ready: boolean;
  offer_letter_generated: boolean;  // Auto-generated if selected
  offer_letter_id: number | null;   // ID of auto-generated offer letter
}

export interface AutoOfferResult {
  success: boolean;
  offer_letter_id: number;
  candidate_name: string;
  designation: string;
  annual_ctc: number;
  salary_breakdown: {
    component: string;
    perMonth: number;
    annual: number;
  }[];
  letter_content: string;
  subject_line: string;
}

export interface WorkflowStatus {
  candidate: {
    id: number;
    name: string;
    status: string;
    vacancy_title: string;
    screening_score: number;
  };
  current_stage: string;
  workflow_logs: {
    id: number;
    candidate_id: number;
    action: string;
    action_type: string;
    details: string;
    performed_by: number;
    is_automated: number;
    createdAt: string;
  }[];
  interviews: Interview[];
  ai_scores: {
    id: number;
    candidate_id: number;
    interview_id: number;
    technical_skills_score: number;
    communication_score: number;
    problem_solving_score: number;
    cultural_fit_score: number;
    overall_performance_score: number;
    final_ai_score: number;
    ai_recommendation: string;
    selection_threshold_met: number;
    scored_at: string;
  }[];
  stages: {
    name: string;
    key: string;
    completed: boolean;
  }[];
}

export interface AutomationSettings {
  thresholds: {
    AUTO_SHORTLIST: number;
    AUTO_REJECT: number;
    INTERVIEW_PASS: number;
    INTERVIEW_FAIL: number;
  };
  features: {
    auto_screen: boolean;
    auto_decision: boolean;
    auto_offer: boolean;
  };
}

// Auto-screen candidate based on JD criteria
export const autoScreenCandidate = async (candidateId: number): Promise<AutoScreeningResult> => {
  return api.post(`${API_BASE}/candidates/${candidateId}/auto-screen`);
};

// Batch auto-screen all new candidates for a vacancy
export const batchAutoScreenCandidates = async (vacancyId: number): Promise<{
  total: number;
  shortlisted: number;
  rejected: number;
  manual_review: number;
  errors: number;
}> => {
  return api.post(`${API_BASE}/vacancies/${vacancyId}/auto-screen-candidates`);
};

// Submit interview score (out of 5) and auto-determine selection
export const submitInterviewScore = async (interviewId: number, scores: {
  technical_skills: number;      // 1-5
  communication: number;         // 1-5
  problem_solving: number;       // 1-5
  cultural_fit: number;          // 1-5
  overall_performance: number;   // 1-5
  feedback?: string;
  notes?: string;
}): Promise<InterviewScoreResult> => {
  return api.post(`${API_BASE}/interviews/${interviewId}/submit-score`, scores);
};

// Auto-generate offer letter for selected candidate using RAG
export const autoGenerateOffer = async (candidateId: number, params: {
  annual_ctc: number;
  designation?: string;
  joining_date?: string;
  probation_months?: number;
}): Promise<AutoOfferResult> => {
  return api.post(`${API_BASE}/candidates/${candidateId}/auto-generate-offer`, params);
};

// Get workflow status for a candidate
export const getWorkflowStatus = async (candidateId: number): Promise<WorkflowStatus> => {
  return api.get(`${API_BASE}/candidates/${candidateId}/workflow-status`);
};

// Get automation settings
export const getAutomationSettings = async (): Promise<AutomationSettings> => {
  return api.get(`${API_BASE}/automation/settings`);
};

// =====================================================
// INTEREST EMAIL WORKFLOW APIs
// =====================================================

export interface SendInterestEmailResponse {
  success: boolean;
  message: string;
  form_token: string;
  sent_at: string;
  sent_to: string;
  test_mode: boolean;
  note: string;
}

export interface InterestDetailsUpdate {
  is_interested?: 'yes' | 'no' | 'pending';
  current_salary?: number;
  expected_salary?: number;
  notice_period?: string;
  interview_availability?: 'tomorrow' | 'preferred_date';
  preferred_interview_date?: string;
}

// Send interest email to candidate
export const sendInterestEmail = async (
  candidateId: number,
  gmailConnectionId: number
): Promise<SendInterestEmailResponse> => {
  return api.post(`${API_BASE}/candidates/${candidateId}/send-interest-email`, {
    gmail_connection_id: gmailConnectionId
  });
};

// Update candidate interest details manually (by HR)
export const updateInterestDetails = async (
  candidateId: number,
  details: InterestDetailsUpdate
): Promise<Candidate> => {
  return api.patch(`${API_BASE}/candidates/${candidateId}/interest-details`, details);
};

// Re-extract experience from resume (fixes incorrect experience calculation)
export interface ReExtractExperienceResult {
  success: boolean;
  old_experience: number;
  new_experience: number;
  calculation: string;
  candidate: Candidate;
}

export const reExtractExperience = async (candidateId: number): Promise<ReExtractExperienceResult> => {
  return api.post(`${API_BASE}/candidates/${candidateId}/re-extract-experience`);
};

// Batch send interest emails to multiple candidates
export interface BatchSendInterestEmailsResult {
  success: boolean;
  message: string;
  sent_count: number;
  skipped_count: number;
  failed_count: number;
  details: Array<{
    candidate_id: number;
    email: string;
    status: 'sent' | 'skipped' | 'failed';
    message?: string;
  }>;
}

export const batchSendInterestEmails = async (
  candidateIds: number[],
  gmailConnectionId: number
): Promise<BatchSendInterestEmailsResult> => {
  return api.post(`${API_BASE}/candidates/batch-send-interest-emails`, {
    candidate_ids: candidateIds,
    gmail_connection_id: gmailConnectionId
  });
};

// Head Person Review API
export interface ReviewerEmail {
  email: string;
  name?: string;
}

export interface SendHeadReviewResult {
  success: boolean;
  message: string;
  results: {
    email: string;
    success: boolean;
    token?: string;
    error?: string;
  }[];
}

export const sendHeadReview = async (params: {
  vacancy_id: number;
  candidate_ids: number[];
  reviewer_emails: ReviewerEmail[];
  gmail_connection_id?: number;
}): Promise<SendHeadReviewResult> => {
  return api.post(`${API_BASE}/send-head-review`, params);
};
