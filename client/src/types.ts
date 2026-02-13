export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'user';
  isActive?: boolean;
  profilePhoto?: string;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
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
  assignerName: string;
  assignerEmail: string;
  assigneeName: string;
  assigneeEmail: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  isFavorite: boolean;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: number;
  todoId: number;
  authorId: number;
  authorName: string;
  authorEmail: string;
  content: string;
  createdAt: string;
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

export interface LoginInput {
  email: string;
  password: string;
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

export interface Setting {
  key: string;
  value: any;
  updatedAt: string;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
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
  document?: File;
  image?: File;
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
  project_details?: string; // Add this line
  joining_date: string;
  annual_ctc: number;
  salary_breakdown: string;
  working_location: string;
  hr_manager_name: string;
  hr_manager_title: string;
  offer_valid_till: string;
  letter_date: string;
  status: 'draft' | 'approved' | 'sent';
  template_type: 'short' | 'long' | 'internship' | 'extension';
  optional_sections: string;
  kra_details?: string;
  joining_bonus?: number;
  signatory_id?: number;
  secondary_signatory_id?: number;
  letterhead_id?: number;
  template_profile_id?: number;
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
  project_details?: string; // Add this line
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
  letterhead_id?: number;
  template_profile_id?: number;
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
  signatureImage: string | null;
  stampImage: string | null;
  email: string | null;
  phone: string | null;
  department: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSignatoryInput {
  name: string;
  position: string;
  signatureImage?: File | null;
  stampImage?: File | null;
  email?: string;
  phone?: string;
  department?: string;
  displayOrder?: number;
}

export interface UpdateSignatoryInput {
  name?: string;
  position?: string;
  signatureImage?: File | null;
  stampImage?: File | null;
  email?: string;
  phone?: string;
  department?: string;
  displayOrder?: number;
  isActive?: boolean;
}

// Company Letter types
export interface CompanyLetter {
  id: number;
  letterNumber: string | null;
  recipientName: string;
  recipientAddress: string;
  recipientCity: string | null;
  recipientState: string | null;
  recipientPincode: string | null;
  subject: string;
  letterDate: string;
  greeting: string;
  body: string;
  closing: string;
  status: 'draft' | 'finalized' | 'sent';
  createdBy: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SignatoryWithOrder extends Signatory {
  signatureOrder: number;
}

export interface CompanyLetterWithDetails extends CompanyLetter {
  creatorName: string;
  creatorEmail: string;
  signatories: SignatoryWithOrder[];
}

export interface CreateCompanyLetterInput {
  letterNumber?: string;
  recipientName: string;
  recipientAddress: string;
  recipientCity?: string;
  recipientState?: string;
  recipientPincode?: string;
  subject: string;
  letterDate: string;
  greeting?: string;
  body: string;
  closing?: string;
  signatoryIds?: number[];
}

export interface UpdateCompanyLetterInput extends Partial<CreateCompanyLetterInput> {
  status?: 'draft' | 'finalized' | 'sent';
  isActive?: boolean;
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
  uploader_name: string;
  uploader_email: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  skills: string[];
  experience_years: number | null;
  experience_details: ExperienceDetail[];
  education: EducationDetail[];
  expected_salary: number | null;
  current_salary: number | null;
  notice_period: string | null;
  full_extraction: any;
  offer_letter_id: number | null;
  status: string;
  uploaded_by: number;
  uploader_name: string;
  uploader_email: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExperienceDetail {
  company: string;
  role: string;
  duration: string;
  description?: string;
}

export interface EducationDetail {
  degree: string;
  institution: string;
  year: string;
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
}

export interface RAGGenerateResponse {
  success: boolean;
  offer_letter_data?: CreateOfferLetterInput;
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

export interface RAGStats {
  training: {
    total: number;
    completed: number;
    processing: number;
    failed: number;
    totalChunks: number;
  };
  resumes: {
    total: number;
    convertedToOffers: number;
  };
}
