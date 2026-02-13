export interface User {
  id: number;
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'user';
  isActive: boolean;
  profilePhoto?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserResponse {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'user';
  isActive: boolean;
  profilePhoto?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: number;
  userId: number;
  type: 'task_assigned' | 'task_completed' | 'comment_added' | 'mention' | 'system';
  title: string;
  message: string;
  relatedId?: number;
  isRead: boolean;
  createdAt: string;
}

export interface Todo {
  id: number;
  title: string;
  description: string;
  assignerId: number;
  assigneeId: number;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  isFavorite: boolean;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TodoWithUsers extends Todo {
  assignerName: string;
  assignerEmail: string;
  assigneeName: string;
  assigneeEmail: string;
}

export interface Comment {
  id: number;
  todoId: number;
  authorId: number;
  content: string;
  createdAt: string;
}

export interface CommentWithAuthor extends Comment {
  authorName: string;
  authorEmail: string;
}

export interface CreateTodoInput {
  title: string;
  description: string;
  assigneeId: number;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
}

export interface UpdateTodoInput {
  title?: string;
  description?: string;
  assigneeId?: number;
  completed?: boolean;
  priority?: 'low' | 'medium' | 'high';
  isFavorite?: boolean;
  dueDate?: string;
}

export interface CreateCommentInput {
  todoId: number;
  content: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'user';
}

export interface UpdateUserInput {
  email?: string;
  password?: string;
  name?: string;
  role?: 'admin' | 'user';
  isActive?: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface JwtPayload {
  userId: number;
  email: string;
  role: 'admin' | 'user';
}

// Company and Branch types
export interface Company {
  id: number;
  name: string;
  pan_no: string;
  logo?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyWithBranches extends Company {
  branches: Branch[];
}

export interface Branch {
  id: number;
  company_id: number;
  branch_name: string;
  address: string;
  city: string;
  state_name: string;
  pin_code: string;
  gstin: string;
  is_head_office: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BranchWithCompany extends Branch {
  company_name: string;
  company_pan_no: string;
}

export interface CreateCompanyInput {
  name: string;
  pan_no: string;
  logo?: string;
}

export interface UpdateCompanyInput {
  name?: string;
  pan_no?: string;
  logo?: string;
  isActive?: boolean;
}

export interface CreateBranchInput {
  company_id: number;
  branch_name: string;
  address: string;
  city: string;
  state_name: string;
  pin_code: string;
  gstin: string;
  is_head_office?: boolean;
}

export interface UpdateBranchInput {
  branch_name?: string;
  address?: string;
  city?: string;
  state_name?: string;
  pin_code?: string;
  gstin?: string;
  is_head_office?: boolean;
  isActive?: boolean;
}

// Bank Account types
export type BankAccountType = 'savings' | 'current' | 'credit_card' | 'fd' | 'loan';

export interface BankAccount {
  id: number;
  branch_id: number;
  account_type: BankAccountType;
  account_name: string;
  alias?: string;
  account_number: string;

  // Savings/Current fields
  institution_name?: string;
  ifsc_code?: string;
  swift_code?: string;
  bank_address?: string;
  bank_city?: string;

  // Credit Card fields
  cc_credit_limit?: number;
  cc_monthly_interest?: number;
  cc_issue_date?: string;
  cc_expiry_date?: string;
  cc_cvv?: string;
  cc_due_date?: number;

  // FD fields
  fd_yearly_interest?: number;
  fd_amount?: number;
  fd_maturity_amount?: number;
  fd_tenure_months?: number;
  fd_start_date?: string;
  fd_maturity_date?: string;

  // Loan fields
  loan_monthly_interest?: number;
  loan_amount?: number;
  loan_tenure_months?: number;
  loan_first_emi_date?: string;
  loan_monthly_emi?: number;

  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BankAccountWithBranch extends BankAccount {
  branch_name: string;
  company_name: string;
}

export interface CreateBankAccountInput {
  branch_id: number;
  account_type: BankAccountType;
  account_name: string;
  alias?: string;
  account_number: string;
  institution_name?: string;
  ifsc_code?: string;
  swift_code?: string;
  bank_address?: string;
  bank_city?: string;
  cc_credit_limit?: number;
  cc_monthly_interest?: number;
  cc_issue_date?: string;
  cc_expiry_date?: string;
  cc_cvv?: string;
  cc_due_date?: number;
  fd_yearly_interest?: number;
  fd_amount?: number;
  fd_maturity_amount?: number;
  fd_tenure_months?: number;
  fd_start_date?: string;
  fd_maturity_date?: string;
  loan_monthly_interest?: number;
  loan_amount?: number;
  loan_tenure_months?: number;
  loan_first_emi_date?: string;
  loan_monthly_emi?: number;
}

export interface UpdateBankAccountInput extends Partial<CreateBankAccountInput> {
  isActive?: boolean;
}

// Project types
export interface Project {
  id: number;
  name: string;
  branch_id: number;
  assigned_to?: number;
  start_date?: string;
  end_date?: string;
  status: 'active' | 'completed' | 'on_hold';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectWithDetails extends Project {
  branch_name: string;
  company_name: string;
  assigned_to_name?: string;
}

export interface CreateProjectInput {
  name: string;
  branch_id: number;
  assigned_to?: number;
  start_date?: string;
  end_date?: string;
}

export interface UpdateProjectInput extends Partial<CreateProjectInput> {
  status?: 'active' | 'completed' | 'on_hold';
  isActive?: boolean;
}

// Vendor types
export type PartyType = 'vendor' | 'customer' | 'both';
export type VendorBankAccountType = 'savings' | 'current' | 'none';

export interface Vendor {
  id: number;
  vendor_name: string;
  vendor_legal_name?: string;
  gstin?: string;
  pan?: string;
  email?: string;
  mobile_no?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  party_type: PartyType;
  opening_date?: string;
  opening_balance: number;
  msme_certificate?: string;
  beneficiary_name?: string;
  bank_account_type?: VendorBankAccountType;
  account_number?: string;
  ifsc_code?: string;
  branch_id: number;
  project_id?: number;
  category?: string;
  company_bank_account_id?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VendorWithDetails extends Vendor {
  branch_name: string;
  company_name: string;
  project_name?: string;
  company_bank_account_name?: string;
}

export interface CreateVendorInput {
  vendor_name: string;
  vendor_legal_name?: string;
  gstin?: string;
  pan?: string;
  email?: string;
  mobile_no?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  party_type: PartyType;
  opening_date?: string;
  opening_balance?: number;
  msme_certificate?: string;
  beneficiary_name?: string;
  bank_account_type?: VendorBankAccountType;
  account_number?: string;
  ifsc_code?: string;
  branch_id: number;
  project_id?: number;
  category?: string;
  company_bank_account_id?: number;
}

export interface UpdateVendorInput extends Partial<CreateVendorInput> {
  isActive?: boolean;
}

// Employee types
export type CityType = 'metro' | 'non_metro';

export interface Employee {
  id: number;
  branch_id: number;
  employee_name: string;
  father_name: string;
  date_of_joining: string;
  date_of_birth: string;
  designation: string;
  mobile_number: string;
  email: string;
  personal_email?: string;
  aadhar_no?: string;
  pan_no?: string;
  address?: string;
  city_type?: CityType;
  event?: string;
  event_date?: string;
  monthly_rent?: number;
  monthly_ctc?: number;
  document_path?: string;
  image_path?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeWithBranch extends Employee {
  branch_name: string;
  company_name: string;
}

export interface CreateEmployeeInput {
  branch_id: number;
  employee_name: string;
  father_name: string;
  date_of_joining: string;
  date_of_birth: string;
  designation: string;
  mobile_number: string;
  email: string;
  personal_email?: string;
  aadhar_no?: string;
  pan_no?: string;
  address?: string;
  city_type?: CityType;
  event?: string;
  event_date?: string;
  monthly_rent?: number;
  monthly_ctc?: number;
  document_path?: string;
  image_path?: string;
}

export interface UpdateEmployeeInput extends Partial<CreateEmployeeInput> {
  isActive?: boolean;
}

// Transaction Nature types
export interface TransactionNature {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransactionNatureInput {
  name: string;
}

export interface UpdateTransactionNatureInput {
  name?: string;
  isActive?: boolean;
}

// Category Group types
export interface CategoryGroup {
  id: number;
  transaction_nature_id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryGroupWithTransactionNature extends CategoryGroup {
  transaction_nature_name: string;
}

export interface CreateCategoryGroupInput {
  transaction_nature_id: number;
  name: string;
}

export interface UpdateCategoryGroupInput {
  transaction_nature_id?: number;
  name?: string;
  isActive?: boolean;
}

// Category types
export interface Category {
  id: number;
  category_group_id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryWithDetails extends Category {
  category_group_name: string;
  transaction_nature_id: number;
  transaction_nature_name: string;
}

export interface CreateCategoryInput {
  category_group_id: number;
  name: string;
}

export interface UpdateCategoryInput {
  category_group_id?: number;
  name?: string;
  isActive?: boolean;
}

// Offer Letter types
export interface SalaryComponent {
  component: string;
  perMonth: number;
  annual: number;
}

export interface KRADetail {
  responsibility: string;
}

export interface OfferLetter {
  id: number;
  candidate_name: string;
  candidate_address: string;
  designation: string;
  project_details?: string;
  joining_date: string;
  annual_ctc: number;
  salary_breakdown: string; // JSON string of SalaryComponent[]
  working_location: string;
  hr_manager_name: string;
  hr_manager_title: string;
  offer_valid_till: string;
  letter_date: string;
  status: 'draft' | 'approved' | 'sent';
  template_type: 'short' | 'long' | 'internship' | 'extension';
  optional_sections: string; // JSON string of array of enabled optional sections
  kra_details?: string; // JSON string of KRADetail[]
  joining_bonus?: number;
  signatory_id?: number;
  secondary_signatory_id?: number;
  letterhead_id?: number; // ID of the letterhead to use for PDF generation
  template_profile_id?: number; // ID of RAG template profile for format-specific generation
  created_by: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OfferLetterWithCreator extends OfferLetter {
  creator_name: string;
  creator_email: string;
}

export interface OfferLetterWithSignatory extends OfferLetterWithCreator {
  signatory_name?: string;
  signatory_position?: string;
  signatory_signature?: string;
  signatory_stamp?: string;
  secondary_signatory_name?: string;
  secondary_signatory_position?: string;
  secondary_signatory_signature?: string;
  secondary_signatory_stamp?: string;
}

export interface CreateOfferLetterInput {
  candidate_name: string;
  candidate_address: string;
  designation: string;
  project_details?: string;
  joining_date: string;
  annual_ctc: number;
  salary_breakdown: SalaryComponent[];
  working_location: string;
  hr_manager_name: string;
  hr_manager_title?: string;
  offer_valid_till: string;
  letter_date: string;
  template_type?: 'short' | 'long' | 'internship' | 'extension';
  optional_sections?: string[];
  kra_details?: KRADetail[];
  joining_bonus?: number;
  signatory_id?: number;
  secondary_signatory_id?: number;
  letterhead_id?: number; // ID of the letterhead to use for PDF generation
  template_profile_id?: number; // ID of RAG template profile for format-specific generation
}

export interface UpdateOfferLetterInput extends Partial<CreateOfferLetterInput> {
  status?: 'draft' | 'approved' | 'sent';
  isActive?: boolean;
}

// Signatory types
export interface Signatory {
  id: number;
  name: string;
  position: string;
  signature_image: string | null;
  stamp_image: string | null;
  email: string | null;
  phone: string | null;
  department: string | null;
  display_order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSignatoryInput {
  name: string;
  position: string;
  signature_image?: string | null;
  stamp_image?: string | null;
  email?: string | null;
  phone?: string | null;
  department?: string | null;
  display_order?: number;
}

export interface UpdateSignatoryInput extends Partial<CreateSignatoryInput> {
  isActive?: boolean;
}

// Company Letter types
export interface CompanyLetter {
  id: number;
  letter_number: string | null;
  recipient_name: string;
  recipient_address: string;
  recipient_city: string | null;
  recipient_state: string | null;
  recipient_pincode: string | null;
  subject: string;
  letter_date: string;
  greeting: string;
  body: string;
  closing: string;
  status: 'draft' | 'finalized' | 'sent';
  created_by: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SignatoryWithOrder extends Signatory {
  signature_order: number;
}

export interface CompanyLetterWithDetails extends CompanyLetter {
  creator_name: string;
  creator_email: string;
  signatories: SignatoryWithOrder[];
}

export interface CreateCompanyLetterInput {
  letter_number?: string | null;
  recipient_name: string;
  recipient_address: string;
  recipient_city?: string | null;
  recipient_state?: string | null;
  recipient_pincode?: string | null;
  subject: string;
  letter_date: string;
  greeting?: string;
  body: string;
  closing?: string;
  signatory_ids?: number[];
}

export interface UpdateCompanyLetterInput extends Partial<CreateCompanyLetterInput> {
  status?: 'draft' | 'finalized' | 'sent';
  isActive?: boolean;
  signatory_ids?: number[];
}

export interface LetterSignatory {
  letter_id: number;
  signatory_id: number;
  signature_order: number;
}

// RAG Types for AI Offer Letter Generator
export interface RAGDocument {
  id: number;
  filename: string;
  original_name: string;
  file_path: string;
  file_size: number;
  extracted_text: string | null;
  chunk_count: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  uploaded_by: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RAGDocumentWithUser extends RAGDocument {
  uploader_name: string;
  uploader_email: string;
}

export interface RAGEmbedding {
  id: number;
  document_id: number;
  chunk_index: number;
  chunk_text: string;
  embedding: string; // JSON string of number array
  createdAt: string;
}

export interface ResumeExtraction {
  id: number;
  filename: string;
  original_name: string;
  file_path: string;
  extracted_text: string | null;
  candidate_name: string | null;
  candidate_email: string | null;
  candidate_phone: string | null;
  candidate_address: string | null;
  designation: string | null;
  skills: string | null; // JSON array
  experience_years: number | null;
  experience_details: string | null; // JSON array
  education: string | null; // JSON array
  expected_salary: number | null;
  current_salary: number | null;
  notice_period: string | null;
  full_extraction: string | null; // Complete JSON
  offer_letter_id: number | null;
  status: string;
  uploaded_by: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeExtractionWithUser extends ResumeExtraction {
  uploader_name: string;
  uploader_email: string;
}

export interface RAGGenerateRequest {
  resume_id: number;
  template_type?: 'short' | 'long' | 'internship' | 'extension';
  signatory_id?: number;
  secondary_signatory_id?: number;
  hr_manager_name?: string;
  hr_manager_title?: string;
  working_location?: string;
  offer_valid_days?: number;
  designation?: string;
  joining_date?: string;
}

export interface RAGGenerateResponse {
  success: boolean;
  offer_letter_data?: CreateOfferLetterInput;
  template_profile?: { // Added template_profile
    id: number;
    name: string;
    tone: 'formal' | 'semi_formal' | 'friendly' | null;
  };
  confidence_scores?: {
    overall: number;
    name: number;
    address: number;
    designation: number;
    salary: number;
  };
  suggestions?: string[];
  error?: string;
}

// =====================================================
// RECRUITMENT AUTOMATION TYPES
// =====================================================

// Gmail Connection Types
export interface GmailConnection {
  id: number;
  user_id: number;
  email: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  is_active: boolean;
  last_sync_at: string | null;
  sync_interval_minutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface GmailConnectionWithUser extends GmailConnection {
  user_name: string;
  user_email: string;
}

export interface CreateGmailConnectionInput {
  email: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
}

// Gmail Sync History Types
export interface GmailSyncHistory {
  id: number;
  connection_id: number;
  sync_type: 'full' | 'incremental';
  emails_fetched: number;
  resumes_extracted: number;
  candidates_created: number;
  errors: string | null;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed';
}

// Email Application Types
export type AIRecommendation = 'shortlist' | 'review' | 'reject';
export type HRAction = 'pending' | 'approved' | 'rejected' | 'needs_info';
export type EmailApplicationStatus = 'new' | 'processing' | 'processed' | 'failed' | 'duplicate';

export interface EmailApplication {
  id: number;
  gmail_connection_id: number;
  gmail_message_id: string;
  gmail_thread_id: string | null;
  sender_email: string;
  sender_name: string | null;
  subject: string | null;
  body_text: string | null;
  received_at: string;
  resume_filename: string | null;
  resume_path: string | null;
  resume_extracted_text: string | null;
  vacancy_id: number | null;
  candidate_id: number | null;
  ai_match_score: number | null;
  ai_match_analysis: string | null;
  ai_recommendation: AIRecommendation | null;
  missing_criteria: string | null;
  hr_action: HRAction | null;
  hr_notes: string | null;
  processed_at: string | null;
  status: EmailApplicationStatus;
  error_message: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailApplicationWithDetails extends EmailApplication {
  vacancy_title?: string;
  candidate_name?: string;
}

export interface ProcessEmailApplicationInput {
  vacancy_id: number;
}

export interface HRActionInput {
  action: HRAction;
  notes?: string;
}

// Calendar Connection Types
export interface CalendarConnection {
  id: number;
  user_id: number;
  email: string;
  calendar_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarConnectionWithUser extends CalendarConnection {
  user_name: string;
  user_email: string;
}

export interface CreateCalendarConnectionInput {
  email: string;
  calendar_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
}

// Interviewer Availability Types
export interface InterviewerAvailability {
  id: number;
  calendar_connection_id: number;
  interviewer_id: number;
  slot_date: string;
  start_time: string;
  end_time: string;
  calendar_event_id: string | null;
  is_blocked: boolean;
  block_reason: string | null;
  synced_at: string | null;
  createdAt: string;
}

export interface InterviewerAvailabilityWithUser extends InterviewerAvailability {
  interviewer_name: string;
  interviewer_email: string;
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

// Email Template Types
export type EmailType = 'interview_invite' | 'rejection' | 'offer' | 'follow_up' | 'custom';

export interface EmailTemplate {
  id: number;
  name: string;
  email_type: EmailType;
  subject_template: string;
  body_template: string;
  variables: string | null;
  is_default: boolean;
  created_by: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplateWithCreator extends EmailTemplate {
  creator_name: string;
  creator_email: string;
}

export interface CreateEmailTemplateInput {
  name: string;
  email_type: EmailType;
  subject_template: string;
  body_template: string;
  variables?: string[];
  is_default?: boolean;
}

export interface UpdateEmailTemplateInput extends Partial<CreateEmailTemplateInput> {
  isActive?: boolean;
}

// Email Draft Types
export type EmailDraftStatus = 'draft' | 'approved' | 'sent' | 'failed';

export interface EmailDraft {
  id: number;
  candidate_id: number;
  email_type: EmailType;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  body_html: string;
  body_text: string | null;
  attachments: string | null;
  calendar_event_data: string | null;
  status: EmailDraftStatus;
  approved_by: number | null;
  approved_at: string | null;
  sent_at: string | null;
  error_message: string | null;
  created_by: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmailDraftWithDetails extends EmailDraft {
  candidate_name: string;
  candidate_email: string;
  approver_name?: string;
  creator_name: string;
}

export interface CreateEmailDraftInput {
  candidate_id: number;
  email_type: EmailType;
  recipient_email: string;
  recipient_name?: string;
  subject: string;
  body_html: string;
  body_text?: string;
  attachments?: string;
  calendar_event_data?: string;
}

export interface UpdateEmailDraftInput {
  subject?: string;
  body_html?: string;
  body_text?: string;
}

// CTC Discussion Types
export type CandidateResponse = 'pending' | 'accepted' | 'negotiating' | 'rejected';
export type CTCDiscussionStatus = 'pending' | 'in_progress' | 'finalized' | 'cancelled';

export interface CTCDiscussion {
  id: number;
  candidate_id: number;
  expected_ctc: number | null;
  offered_ctc: number | null;
  fixed_pay: number | null;
  variable_pay: number | null;
  joining_bonus: number | null;
  joining_date: string | null;
  salary_breakdown: string | null;
  company_benchmark: string | null;
  hr_notes: string | null;
  candidate_response: CandidateResponse | null;
  status: CTCDiscussionStatus;
  finalized_by: number | null;
  finalized_at: string | null;
  created_by: number;
  createdAt: string;
  updatedAt: string;
}

export interface CTCDiscussionWithDetails extends CTCDiscussion {
  candidate_name: string;
  candidate_email: string;
  vacancy_title?: string;
  creator_name: string;
  finalizer_name?: string;
}

export interface CreateCTCDiscussionInput {
  candidate_id: number;
  expected_ctc?: number;
  offered_ctc?: number;
  fixed_pay?: number;
  variable_pay?: number;
  joining_bonus?: number;
  joining_date?: string;
  hr_notes?: string;
}

export interface UpdateCTCDiscussionInput extends Partial<CreateCTCDiscussionInput> {
  salary_breakdown?: string;
  candidate_response?: CandidateResponse;
  status?: CTCDiscussionStatus;
}

export interface CTCValidationResult {
  isComplete: boolean;
  missingFields: string[];
  warnings: string[];
}

// Automation Workflow Types
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

export type ActionBy = 'system' | 'hr' | 'candidate';

export interface AutomationWorkflowLog {
  id: number;
  candidate_id: number;
  workflow_step: WorkflowStep;
  previous_step: WorkflowStep | null;
  action_taken: string | null;
  action_by: ActionBy | null;
  action_user_id: number | null;
  details: string | null;
  is_automated: boolean;
  requires_hr_action: boolean;
  hr_prompt: string | null;
  createdAt: string;
}

export interface AutomationWorkflowLogWithUser extends AutomationWorkflowLog {
  candidate_name: string;
  action_user_name?: string;
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

// Automation Thresholds and Configuration
export interface AutomationConfig {
  auto_reject_threshold: number;  // Default: 40
  hr_review_threshold: number;    // Default: 70
  auto_shortlist_threshold: number; // Default: 70
  interview_pass_score: number;   // Default: 3.5 (out of 5)
  sync_interval_minutes: number;  // Default: 15
}

// Extended Candidate Types for Automation
export type AutomationCandidateStatus = 'manual' | 'automated' | 'paused' | 'completed';

export interface CandidateAutomationFields {
  email_application_id: number | null;
  automation_status: AutomationCandidateStatus;
  final_interview_score: number | null;
  ctc_discussion_id: number | null;
  auto_shortlisted_at: string | null;
  auto_rejected_at: string | null;
  auto_rejection_reason: string | null;
}

// Extended Interview Types for Automation
export interface InterviewAutomationFields {
  calendar_event_id: string | null;
  email_draft_id: number | null;
  auto_scheduled: boolean;
  candidate_confirmed: boolean;
  candidate_confirmed_at: string | null;
}

// Template Variables for Email Rendering
export interface TemplateVariables {
  candidate_name: string;
  candidate_first_name: string;
  candidate_email: string;
  vacancy_title: string;
  vacancy_department: string;
  interview_date: string;
  interview_time: string;
  interview_duration: string;
  interview_type: string;
  interviewer_name: string;
  meeting_link: string;
  location: string;
  designation: string;
  joining_date: string;
  annual_ctc: string;
  ctc_in_words: string;
  offer_valid_till: string;
  working_location: string;
  company_name: string;
  hr_manager_name: string;
  hr_manager_title: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
