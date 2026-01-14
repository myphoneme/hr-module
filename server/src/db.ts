import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcrypt';

// Use process.cwd() for reliable path with tsx
const dbPath = path.join(process.cwd(), 'database.sqlite');
console.log('Database path:', dbPath);
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
    isActive INTEGER DEFAULT 1,
    profilePhoto TEXT,
    lastLoginAt TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    relatedId INTEGER,
    isRead INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_notifications_userId ON notifications(userId);

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    assignerId INTEGER NOT NULL,
    assigneeId INTEGER NOT NULL,
    completed INTEGER DEFAULT 0,
    priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
    isFavorite INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (assignerId) REFERENCES users(id),
    FOREIGN KEY (assigneeId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    todoId INTEGER NOT NULL,
    authorId INTEGER NOT NULL,
    content TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (todoId) REFERENCES todos(id) ON DELETE CASCADE,
    FOREIGN KEY (authorId) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_comments_todoId ON comments(todoId);
  CREATE INDEX IF NOT EXISTS idx_todos_assignerId ON todos(assignerId);
  CREATE INDEX IF NOT EXISTS idx_todos_assigneeId ON todos(assigneeId);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    pan_no TEXT UNIQUE NOT NULL,
    logo TEXT,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    branch_name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state_name TEXT NOT NULL,
    pin_code TEXT NOT NULL,
    gstin TEXT UNIQUE NOT NULL,
    is_head_office INTEGER DEFAULT 0,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_companies_pan ON companies(pan_no);
  CREATE INDEX IF NOT EXISTS idx_branches_company ON branches(company_id);
  CREATE INDEX IF NOT EXISTS idx_branches_gstin ON branches(gstin);

  CREATE TABLE IF NOT EXISTS bank_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER NOT NULL,
    account_type TEXT NOT NULL CHECK(account_type IN ('savings', 'current', 'credit_card', 'fd', 'loan')),
    account_name TEXT NOT NULL,
    alias TEXT,
    account_number TEXT NOT NULL,

    -- Savings/Current specific fields
    institution_name TEXT,
    ifsc_code TEXT,
    swift_code TEXT,
    bank_address TEXT,
    bank_city TEXT,

    -- Credit Card specific fields
    cc_credit_limit REAL,
    cc_monthly_interest REAL,
    cc_issue_date TEXT,
    cc_expiry_date TEXT,
    cc_cvv TEXT,
    cc_due_date INTEGER,

    -- FD specific fields
    fd_yearly_interest REAL,
    fd_amount REAL,
    fd_maturity_amount REAL,
    fd_tenure_months INTEGER,
    fd_start_date TEXT,
    fd_maturity_date TEXT,

    -- Loan specific fields
    loan_monthly_interest REAL,
    loan_amount REAL,
    loan_tenure_months INTEGER,
    loan_first_emi_date TEXT,
    loan_monthly_emi REAL,

    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_bank_accounts_branch ON bank_accounts(branch_id);
  CREATE INDEX IF NOT EXISTS idx_bank_accounts_type ON bank_accounts(account_type);

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    branch_id INTEGER NOT NULL,
    assigned_to INTEGER,
    start_date TEXT,
    end_date TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'on_hold')),
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_projects_branch ON projects(branch_id);
  CREATE INDEX IF NOT EXISTS idx_projects_assigned ON projects(assigned_to);

  CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_name TEXT NOT NULL,
    vendor_legal_name TEXT,
    gstin TEXT,
    pan TEXT,
    email TEXT,
    mobile_no TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    party_type TEXT NOT NULL DEFAULT 'vendor' CHECK(party_type IN ('vendor', 'customer', 'both')),
    opening_date TEXT,
    opening_balance REAL DEFAULT 0,
    msme_certificate TEXT,
    beneficiary_name TEXT,
    bank_account_type TEXT CHECK(bank_account_type IN ('savings', 'current', 'none')),
    account_number TEXT,
    ifsc_code TEXT,
    branch_id INTEGER NOT NULL,
    project_id INTEGER,
    category TEXT,
    company_bank_account_id INTEGER,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (company_bank_account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_vendors_branch ON vendors(branch_id);
  CREATE INDEX IF NOT EXISTS idx_vendors_party_type ON vendors(party_type);
  CREATE INDEX IF NOT EXISTS idx_vendors_gstin ON vendors(gstin);

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER NOT NULL,
    employee_name TEXT NOT NULL,
    father_name TEXT NOT NULL,
    date_of_joining TEXT NOT NULL,
    date_of_birth TEXT NOT NULL,
    designation TEXT NOT NULL,
    mobile_number TEXT NOT NULL,
    email TEXT NOT NULL,
    personal_email TEXT,
    aadhar_no TEXT,
    pan_no TEXT,
    address TEXT,
    city_type TEXT CHECK(city_type IN ('metro', 'non_metro')),
    event TEXT,
    event_date TEXT,
    monthly_rent REAL,
    monthly_ctc REAL,
    document_path TEXT,
    image_path TEXT,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_employees_branch ON employees(branch_id);
  CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);

  CREATE TABLE IF NOT EXISTS transaction_nature (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_transaction_nature_name ON transaction_nature(name);

  CREATE TABLE IF NOT EXISTS category_group (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_nature_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (transaction_nature_id) REFERENCES transaction_nature(id) ON DELETE CASCADE,
    UNIQUE(transaction_nature_id, name)
  );

  CREATE INDEX IF NOT EXISTS idx_category_group_transaction_nature ON category_group(transaction_nature_id);
  CREATE INDEX IF NOT EXISTS idx_category_group_name ON category_group(name);

  CREATE TABLE IF NOT EXISTS category (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_group_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (category_group_id) REFERENCES category_group(id) ON DELETE CASCADE,
    UNIQUE(category_group_id, name)
  );

  CREATE INDEX IF NOT EXISTS idx_category_category_group ON category(category_group_id);
  CREATE INDEX IF NOT EXISTS idx_category_name ON category(name);

  CREATE TABLE IF NOT EXISTS offer_letters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_name TEXT NOT NULL,
    candidate_address TEXT NOT NULL,
    designation TEXT NOT NULL,
    joining_date TEXT NOT NULL,
    annual_ctc REAL NOT NULL,
    salary_breakdown TEXT NOT NULL,
    working_location TEXT NOT NULL,
    hr_manager_name TEXT NOT NULL,
    hr_manager_title TEXT DEFAULT 'Manager-Human Resource',
    offer_valid_till TEXT NOT NULL,
    letter_date TEXT NOT NULL,
    template_type TEXT DEFAULT 'short',
    optional_sections TEXT DEFAULT '[]',
    kra_details TEXT DEFAULT '[]',
    joining_bonus REAL,
    signatory_id INTEGER,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'approved', 'sent')),
    created_by INTEGER NOT NULL,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (signatory_id) REFERENCES signatories(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_offer_letters_created_by ON offer_letters(created_by);
  CREATE INDEX IF NOT EXISTS idx_offer_letters_status ON offer_letters(status);

  CREATE TABLE IF NOT EXISTS signatories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    position TEXT NOT NULL,
    signature_image TEXT,
    stamp_image TEXT,
    email TEXT,
    phone TEXT,
    department TEXT,
    display_order INTEGER DEFAULT 0,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_signatories_active ON signatories(isActive);
  CREATE INDEX IF NOT EXISTS idx_signatories_display_order ON signatories(display_order);

  CREATE TABLE IF NOT EXISTS company_letters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    letter_number TEXT,
    recipient_name TEXT NOT NULL,
    recipient_address TEXT NOT NULL,
    recipient_city TEXT,
    recipient_state TEXT,
    recipient_pincode TEXT,
    subject TEXT NOT NULL,
    letter_date TEXT NOT NULL,
    greeting TEXT DEFAULT 'Dear Sir/Madam',
    body TEXT NOT NULL,
    closing TEXT DEFAULT 'Warm Regards',
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'finalized', 'sent')),
    created_by INTEGER NOT NULL,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_company_letters_status ON company_letters(status);
  CREATE INDEX IF NOT EXISTS idx_company_letters_created_by ON company_letters(created_by);

  CREATE TABLE IF NOT EXISTS letter_signatories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    letter_id INTEGER NOT NULL,
    signatory_id INTEGER NOT NULL,
    signature_order INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (letter_id) REFERENCES company_letters(id) ON DELETE CASCADE,
    FOREIGN KEY (signatory_id) REFERENCES signatories(id) ON DELETE CASCADE,
    UNIQUE(letter_id, signatory_id)
  );

  CREATE INDEX IF NOT EXISTS idx_letter_signatories_letter ON letter_signatories(letter_id);
  CREATE INDEX IF NOT EXISTS idx_letter_signatories_signatory ON letter_signatories(signatory_id);

  -- RAG Tables for AI Offer Letter Generator
  CREATE TABLE IF NOT EXISTS rag_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    extracted_text TEXT,
    chunk_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    uploaded_by INTEGER NOT NULL,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_rag_documents_status ON rag_documents(status);
  CREATE INDEX IF NOT EXISTS idx_rag_documents_uploaded_by ON rag_documents(uploaded_by);

  CREATE TABLE IF NOT EXISTS rag_embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (document_id) REFERENCES rag_documents(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_rag_embeddings_document ON rag_embeddings(document_id);

  CREATE TABLE IF NOT EXISTS resume_extractions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    extracted_text TEXT,
    candidate_name TEXT,
    candidate_email TEXT,
    candidate_phone TEXT,
    candidate_address TEXT,
    designation TEXT,
    skills TEXT,
    experience_years REAL,
    experience_details TEXT,
    education TEXT,
    expected_salary REAL,
    current_salary REAL,
    notice_period TEXT,
    full_extraction TEXT,
    offer_letter_id INTEGER,
    status TEXT DEFAULT 'extracted',
    uploaded_by INTEGER NOT NULL,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (uploaded_by) REFERENCES users(id),
    FOREIGN KEY (offer_letter_id) REFERENCES offer_letters(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_resume_extractions_status ON resume_extractions(status);
  CREATE INDEX IF NOT EXISTS idx_resume_extractions_uploaded_by ON resume_extractions(uploaded_by);

  -- RAG Learned Patterns Table - stores extracted patterns from offer letters
  CREATE TABLE IF NOT EXISTS rag_learned_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    company_name TEXT,
    company_address TEXT,
    hr_manager_name TEXT,
    hr_manager_title TEXT,
    working_location TEXT,
    probation_period TEXT,
    notice_period TEXT,
    working_hours TEXT,
    leave_policy TEXT,
    benefits TEXT,
    salary_structure TEXT,
    designation_found TEXT,
    annual_ctc_found REAL,
    template_style TEXT,
    clauses TEXT,
    full_analysis TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (document_id) REFERENCES rag_documents(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_rag_learned_patterns_document ON rag_learned_patterns(document_id);

  -- RAG Company Defaults - stores default settings learned from patterns
  CREATE TABLE IF NOT EXISTS rag_company_defaults (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    source_document_id INTEGER,
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_rag_company_defaults_key ON rag_company_defaults(setting_key);

  -- RAG Salary Benchmarks - stores salary patterns by designation
  CREATE TABLE IF NOT EXISTS rag_salary_benchmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    designation TEXT NOT NULL,
    experience_min REAL DEFAULT 0,
    experience_max REAL DEFAULT 99,
    annual_ctc_min REAL,
    annual_ctc_max REAL,
    annual_ctc_avg REAL,
    basic_percentage REAL,
    hra_percentage REAL,
    sample_count INTEGER DEFAULT 1,
    source_document_ids TEXT,
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_rag_salary_benchmarks_designation ON rag_salary_benchmarks(designation);

  -- RAG Template Profiles - stores distinct offer letter templates/formats
  CREATE TABLE IF NOT EXISTS rag_template_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_name TEXT NOT NULL,
    profile_description TEXT,
    source_document_ids TEXT,

    -- Template Structure
    header_format TEXT,
    greeting_format TEXT,
    opening_paragraph TEXT,
    sections_order TEXT,
    closing_format TEXT,
    signature_format TEXT,

    -- Language Patterns
    tone_style TEXT CHECK(tone_style IN ('formal', 'semi_formal', 'friendly')),
    language_patterns TEXT,
    common_phrases TEXT,

    -- Structural Elements
    has_salary_table INTEGER DEFAULT 1,
    has_kra_section INTEGER DEFAULT 0,
    has_annexures INTEGER DEFAULT 0,
    annexure_types TEXT,

    -- Formatting
    date_format TEXT,
    salary_format TEXT,
    paragraph_style TEXT,
    bullet_point_style TEXT,

    -- Template Content Blocks
    probation_clause TEXT,
    notice_period_clause TEXT,
    confidentiality_clause TEXT,
    termination_clause TEXT,
    general_terms_clause TEXT,
    benefits_section TEXT,
    working_hours_clause TEXT,
    leave_policy_clause TEXT,

    -- Full Template Structure JSON
    full_structure TEXT,
    sample_generated_content TEXT,

    -- Metadata
    designation_types TEXT,
    experience_levels TEXT,
    is_default INTEGER DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    match_score_avg REAL DEFAULT 0,

    created_by INTEGER,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_rag_template_profiles_active ON rag_template_profiles(isActive);
  CREATE INDEX IF NOT EXISTS idx_rag_template_profiles_default ON rag_template_profiles(is_default);
  CREATE INDEX IF NOT EXISTS idx_rag_template_profiles_tone ON rag_template_profiles(tone_style);

  -- RAG Document Template Mapping - links documents to their identified templates
  CREATE TABLE IF NOT EXISTS rag_document_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    template_profile_id INTEGER NOT NULL,
    match_confidence REAL DEFAULT 0,
    extraction_notes TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (document_id) REFERENCES rag_documents(id) ON DELETE CASCADE,
    FOREIGN KEY (template_profile_id) REFERENCES rag_template_profiles(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_rag_document_templates_doc ON rag_document_templates(document_id);
  CREATE INDEX IF NOT EXISTS idx_rag_document_templates_profile ON rag_document_templates(template_profile_id);

  -- Letterheads table for custom letterhead images
  CREATE TABLE IF NOT EXISTS letterheads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    header_image TEXT,
    footer_image TEXT,
    logo_image TEXT,
    company_name TEXT,
    company_address TEXT,
    company_contact TEXT,
    company_email TEXT,
    company_website TEXT,
    company_cin TEXT,
    company_gstin TEXT,
    is_default INTEGER DEFAULT 0,
    uploaded_by INTEGER NOT NULL,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_letterheads_is_default ON letterheads(is_default);
  CREATE INDEX IF NOT EXISTS idx_letterheads_uploaded_by ON letterheads(uploaded_by);

  -- =====================================================
  -- RECRUITMENT HUB TABLES
  -- =====================================================

  -- Vacancies / Job Openings
  CREATE TABLE IF NOT EXISTS vacancies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    department TEXT,
    location TEXT,
    employment_type TEXT DEFAULT 'full_time' CHECK(employment_type IN ('full_time', 'part_time', 'contract', 'internship')),
    experience_min REAL DEFAULT 0,
    experience_max REAL,
    salary_min REAL,
    salary_max REAL,
    openings_count INTEGER DEFAULT 1,
    job_description TEXT,
    requirements TEXT,
    responsibilities TEXT,
    benefits TEXT,
    skills_required TEXT,
    qualifications TEXT,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'open', 'on_hold', 'closed', 'filled')),
    priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
    posted_date TEXT,
    closing_date TEXT,
    hiring_manager_id INTEGER,
    created_by INTEGER NOT NULL,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (hiring_manager_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_vacancies_status ON vacancies(status);
  CREATE INDEX IF NOT EXISTS idx_vacancies_department ON vacancies(department);
  CREATE INDEX IF NOT EXISTS idx_vacancies_created_by ON vacancies(created_by);

  -- Candidates (applicants for vacancies)
  CREATE TABLE IF NOT EXISTS candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vacancy_id INTEGER,
    first_name TEXT NOT NULL,
    last_name TEXT,
    email TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    current_company TEXT,
    current_designation TEXT,
    current_salary REAL,
    expected_salary REAL,
    experience_years REAL,
    notice_period TEXT,
    skills TEXT,
    education TEXT,
    resume_path TEXT,
    resume_extracted_text TEXT,
    resume_extraction_id INTEGER,
    source TEXT DEFAULT 'direct' CHECK(source IN ('direct', 'referral', 'job_portal', 'linkedin', 'campus', 'consultant', 'other')),
    referral_name TEXT,
    referral_employee_id INTEGER,
    screening_score REAL,
    screening_notes TEXT,
    skill_experience_data TEXT,
    screening_date TEXT,
    status TEXT DEFAULT 'new' CHECK(status IN ('new', 'screening', 'shortlisted', 'interview_scheduled', 'interviewed', 'selected', 'offer_sent', 'offer_accepted', 'offer_rejected', 'joined', 'rejected', 'withdrawn', 'on_hold')),
    rejection_reason TEXT,
    offer_letter_id INTEGER,
    joined_as_employee_id INTEGER,
    created_by INTEGER NOT NULL,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (vacancy_id) REFERENCES vacancies(id) ON DELETE SET NULL,
    FOREIGN KEY (resume_extraction_id) REFERENCES resume_extractions(id) ON DELETE SET NULL,
    FOREIGN KEY (referral_employee_id) REFERENCES employees(id) ON DELETE SET NULL,
    FOREIGN KEY (offer_letter_id) REFERENCES offer_letters(id) ON DELETE SET NULL,
    FOREIGN KEY (joined_as_employee_id) REFERENCES employees(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_candidates_vacancy ON candidates(vacancy_id);
  CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
  CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);
  CREATE INDEX IF NOT EXISTS idx_candidates_created_by ON candidates(created_by);

  -- Interview Slots (available time slots for interviews)
  CREATE TABLE IF NOT EXISTS interview_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interviewer_id INTEGER NOT NULL,
    slot_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    interview_type TEXT DEFAULT 'technical' CHECK(interview_type IN ('hr', 'technical', 'managerial', 'final')),
    is_available INTEGER DEFAULT 1,
    location TEXT,
    meeting_link TEXT,
    notes TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (interviewer_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_interview_slots_interviewer ON interview_slots(interviewer_id);
  CREATE INDEX IF NOT EXISTS idx_interview_slots_date ON interview_slots(slot_date);
  CREATE INDEX IF NOT EXISTS idx_interview_slots_available ON interview_slots(is_available);

  -- Interviews (scheduled interviews)
  CREATE TABLE IF NOT EXISTS interviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL,
    vacancy_id INTEGER,
    interview_slot_id INTEGER,
    round_number INTEGER DEFAULT 1,
    interview_type TEXT DEFAULT 'technical' CHECK(interview_type IN ('hr', 'technical', 'managerial', 'final')),
    scheduled_date TEXT NOT NULL,
    scheduled_time TEXT NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    interviewer_id INTEGER NOT NULL,
    co_interviewer_ids TEXT,
    location TEXT,
    meeting_link TEXT,
    status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled')),
    questions_generated TEXT,
    feedback TEXT,
    rating REAL,
    recommendation TEXT CHECK(recommendation IN ('strong_hire', 'hire', 'maybe', 'no_hire', 'strong_no_hire')),
    strengths TEXT,
    weaknesses TEXT,
    notes TEXT,
    created_by INTEGER NOT NULL,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (vacancy_id) REFERENCES vacancies(id) ON DELETE SET NULL,
    FOREIGN KEY (interview_slot_id) REFERENCES interview_slots(id) ON DELETE SET NULL,
    FOREIGN KEY (interviewer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_interviews_candidate ON interviews(candidate_id);
  CREATE INDEX IF NOT EXISTS idx_interviews_vacancy ON interviews(vacancy_id);
  CREATE INDEX IF NOT EXISTS idx_interviews_interviewer ON interviews(interviewer_id);
  CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews(status);
  CREATE INDEX IF NOT EXISTS idx_interviews_scheduled_date ON interviews(scheduled_date);

  -- Interview Question Bank
  CREATE TABLE IF NOT EXISTS interview_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    subcategory TEXT,
    question TEXT NOT NULL,
    expected_answer TEXT,
    difficulty TEXT DEFAULT 'medium' CHECK(difficulty IN ('easy', 'medium', 'hard')),
    question_type TEXT DEFAULT 'technical' CHECK(question_type IN ('technical', 'behavioral', 'situational', 'hr', 'culture_fit')),
    skills_tested TEXT,
    time_limit_minutes INTEGER,
    source TEXT,
    is_active INTEGER DEFAULT 1,
    created_by INTEGER,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_interview_questions_category ON interview_questions(category);
  CREATE INDEX IF NOT EXISTS idx_interview_questions_type ON interview_questions(question_type);
  CREATE INDEX IF NOT EXISTS idx_interview_questions_difficulty ON interview_questions(difficulty);

  -- Candidate Evaluations (detailed evaluation after interview)
  CREATE TABLE IF NOT EXISTS candidate_evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL,
    interview_id INTEGER,
    evaluated_by INTEGER NOT NULL,
    evaluation_type TEXT DEFAULT 'interview' CHECK(evaluation_type IN ('screening', 'interview', 'final')),

    -- Scoring criteria (1-10 scale)
    technical_skills REAL,
    communication REAL,
    problem_solving REAL,
    cultural_fit REAL,
    leadership REAL,
    attitude REAL,
    domain_knowledge REAL,

    overall_score REAL,
    recommendation TEXT CHECK(recommendation IN ('strong_hire', 'hire', 'maybe', 'no_hire', 'strong_no_hire')),

    strengths TEXT,
    weaknesses TEXT,
    detailed_feedback TEXT,
    questions_asked TEXT,
    candidate_questions TEXT,

    salary_recommendation REAL,
    designation_recommendation TEXT,
    joining_timeline TEXT,

    is_final INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE SET NULL,
    FOREIGN KEY (evaluated_by) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_candidate_evaluations_candidate ON candidate_evaluations(candidate_id);
  CREATE INDEX IF NOT EXISTS idx_candidate_evaluations_interview ON candidate_evaluations(interview_id);
  CREATE INDEX IF NOT EXISTS idx_candidate_evaluations_recommendation ON candidate_evaluations(recommendation);

  -- HR Documents (for RAG - different document types)
  CREATE TABLE IF NOT EXISTS hr_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_type TEXT NOT NULL CHECK(document_type IN ('offer_letter', 'jd_template', 'policy', 'salary_structure', 'interview_questions', 'evaluation_form', 'onboarding', 'nda', 'agreement', 'other')),
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    extracted_text TEXT,
    metadata TEXT,
    tags TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    uploaded_by INTEGER NOT NULL,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_hr_documents_type ON hr_documents(document_type);
  CREATE INDEX IF NOT EXISTS idx_hr_documents_status ON hr_documents(status);
  CREATE INDEX IF NOT EXISTS idx_hr_documents_uploaded_by ON hr_documents(uploaded_by);

  -- Onboarding Tasks
  CREATE TABLE IF NOT EXISTS onboarding_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL,
    employee_id INTEGER,
    task_name TEXT NOT NULL,
    task_description TEXT,
    task_category TEXT DEFAULT 'documentation' CHECK(task_category IN ('documentation', 'it_setup', 'training', 'compliance', 'orientation', 'other')),
    assigned_to INTEGER,
    due_date TEXT,
    completed_date TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'skipped')),
    documents_required TEXT,
    documents_submitted TEXT,
    notes TEXT,
    display_order INTEGER DEFAULT 0,
    created_by INTEGER NOT NULL,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_candidate ON onboarding_tasks(candidate_id);
  CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_employee ON onboarding_tasks(employee_id);
  CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_status ON onboarding_tasks(status);

  -- =====================================================
  -- RECRUITMENT AUTOMATION TABLES
  -- =====================================================

  -- Gmail OAuth Connections
  CREATE TABLE IF NOT EXISTS gmail_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expiry TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    last_sync_at TEXT,
    sync_interval_minutes INTEGER DEFAULT 15,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_gmail_connections_user ON gmail_connections(user_id);
  CREATE INDEX IF NOT EXISTS idx_gmail_connections_email ON gmail_connections(email);

  -- Gmail Sync History
  CREATE TABLE IF NOT EXISTS gmail_sync_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    connection_id INTEGER NOT NULL,
    sync_type TEXT DEFAULT 'incremental' CHECK(sync_type IN ('full', 'incremental')),
    emails_fetched INTEGER DEFAULT 0,
    resumes_extracted INTEGER DEFAULT 0,
    candidates_created INTEGER DEFAULT 0,
    errors TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    status TEXT DEFAULT 'running' CHECK(status IN ('running', 'completed', 'failed')),
    FOREIGN KEY (connection_id) REFERENCES gmail_connections(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_gmail_sync_history_connection ON gmail_sync_history(connection_id);
  CREATE INDEX IF NOT EXISTS idx_gmail_sync_history_status ON gmail_sync_history(status);

  -- Email Applications (fetched from Gmail)
  CREATE TABLE IF NOT EXISTS email_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gmail_connection_id INTEGER NOT NULL,
    gmail_message_id TEXT UNIQUE NOT NULL,
    gmail_thread_id TEXT,
    sender_email TEXT NOT NULL,
    sender_name TEXT,
    subject TEXT,
    body_text TEXT,
    received_at TEXT NOT NULL,
    resume_filename TEXT,
    resume_path TEXT,
    resume_extracted_text TEXT,
    vacancy_id INTEGER,
    candidate_id INTEGER,
    ai_match_score REAL,
    ai_match_analysis TEXT,
    ai_recommendation TEXT CHECK(ai_recommendation IN ('shortlist', 'review', 'reject')),
    missing_criteria TEXT,
    hr_action TEXT CHECK(hr_action IN ('pending', 'approved', 'rejected', 'needs_info')),
    hr_notes TEXT,
    processed_at TEXT,
    status TEXT DEFAULT 'new' CHECK(status IN ('new', 'processing', 'processed', 'failed', 'duplicate')),
    error_message TEXT,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (gmail_connection_id) REFERENCES gmail_connections(id),
    FOREIGN KEY (vacancy_id) REFERENCES vacancies(id) ON DELETE SET NULL,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_email_applications_connection ON email_applications(gmail_connection_id);
  CREATE INDEX IF NOT EXISTS idx_email_applications_status ON email_applications(status);
  CREATE INDEX IF NOT EXISTS idx_email_applications_vacancy ON email_applications(vacancy_id);
  CREATE INDEX IF NOT EXISTS idx_email_applications_candidate ON email_applications(candidate_id);
  CREATE INDEX IF NOT EXISTS idx_email_applications_hr_action ON email_applications(hr_action);

  -- Google Calendar Connections
  CREATE TABLE IF NOT EXISTS calendar_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    calendar_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expiry TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_calendar_connections_user ON calendar_connections(user_id);

  -- Interviewer Availability (synced from Google Calendar)
  CREATE TABLE IF NOT EXISTS interviewer_availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    calendar_connection_id INTEGER NOT NULL,
    interviewer_id INTEGER NOT NULL,
    slot_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    calendar_event_id TEXT,
    is_blocked INTEGER DEFAULT 0,
    block_reason TEXT,
    synced_at TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (calendar_connection_id) REFERENCES calendar_connections(id) ON DELETE CASCADE,
    FOREIGN KEY (interviewer_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_interviewer_availability_interviewer ON interviewer_availability(interviewer_id);
  CREATE INDEX IF NOT EXISTS idx_interviewer_availability_date ON interviewer_availability(slot_date);
  CREATE INDEX IF NOT EXISTS idx_interviewer_availability_blocked ON interviewer_availability(is_blocked);

  -- Email Templates
  CREATE TABLE IF NOT EXISTS email_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email_type TEXT NOT NULL CHECK(email_type IN ('interview_invite', 'rejection', 'offer', 'follow_up', 'custom')),
    subject_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    variables TEXT,
    is_default INTEGER DEFAULT 0,
    created_by INTEGER NOT NULL,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(email_type);
  CREATE INDEX IF NOT EXISTS idx_email_templates_default ON email_templates(is_default);

  -- Email Drafts (for HR approval)
  CREATE TABLE IF NOT EXISTS email_drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL,
    email_type TEXT NOT NULL CHECK(email_type IN ('interview_invite', 'rejection', 'offer', 'follow_up', 'custom')),
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,
    attachments TEXT,
    calendar_event_data TEXT,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'approved', 'sent', 'failed')),
    approved_by INTEGER,
    approved_at TEXT,
    sent_at TEXT,
    error_message TEXT,
    created_by INTEGER NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_email_drafts_candidate ON email_drafts(candidate_id);
  CREATE INDEX IF NOT EXISTS idx_email_drafts_status ON email_drafts(status);
  CREATE INDEX IF NOT EXISTS idx_email_drafts_type ON email_drafts(email_type);

  -- CTC Discussions (salary negotiation)
  CREATE TABLE IF NOT EXISTS ctc_discussions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL,
    expected_ctc REAL,
    offered_ctc REAL,
    fixed_pay REAL,
    variable_pay REAL,
    joining_bonus REAL,
    joining_date TEXT,
    salary_breakdown TEXT,
    company_benchmark TEXT,
    hr_notes TEXT,
    candidate_response TEXT CHECK(candidate_response IN ('pending', 'accepted', 'negotiating', 'rejected')),
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'finalized', 'cancelled')),
    finalized_by INTEGER,
    finalized_at TEXT,
    created_by INTEGER NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (finalized_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_ctc_discussions_candidate ON ctc_discussions(candidate_id);
  CREATE INDEX IF NOT EXISTS idx_ctc_discussions_status ON ctc_discussions(status);

  -- Automation Workflow Logs
  CREATE TABLE IF NOT EXISTS automation_workflow_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL,
    workflow_step TEXT NOT NULL,
    previous_step TEXT,
    action_taken TEXT,
    action_by TEXT CHECK(action_by IN ('system', 'hr', 'candidate')),
    action_user_id INTEGER,
    details TEXT,
    is_automated INTEGER DEFAULT 1,
    requires_hr_action INTEGER DEFAULT 0,
    hr_prompt TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (action_user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_automation_workflow_logs_candidate ON automation_workflow_logs(candidate_id);
  CREATE INDEX IF NOT EXISTS idx_automation_workflow_logs_step ON automation_workflow_logs(workflow_step);
  CREATE INDEX IF NOT EXISTS idx_automation_workflow_logs_requires_action ON automation_workflow_logs(requires_hr_action);

  -- =============================================
  -- RECRUITMENT WORKFLOW REDESIGN TABLES
  -- =============================================

  -- Naukri API Configuration
  CREATE TABLE IF NOT EXISTS naukri_api_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key_encrypted TEXT,
    api_secret_encrypted TEXT,
    account_id TEXT,
    subscription_type TEXT DEFAULT 'basic',
    daily_search_limit INTEGER DEFAULT 100,
    searches_today INTEGER DEFAULT 0,
    last_reset_date TEXT,
    is_active INTEGER DEFAULT 1,
    created_by INTEGER NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  -- Naukri Search History
  CREATE TABLE IF NOT EXISTS naukri_searches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vacancy_id INTEGER NOT NULL,
    search_query TEXT NOT NULL,
    search_params TEXT NOT NULL,
    total_results INTEGER DEFAULT 0,
    candidates_imported INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    searched_by INTEGER NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (vacancy_id) REFERENCES vacancies(id) ON DELETE CASCADE,
    FOREIGN KEY (searched_by) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_naukri_searches_vacancy ON naukri_searches(vacancy_id);
  CREATE INDEX IF NOT EXISTS idx_naukri_searches_status ON naukri_searches(status);

  -- JD Templates for AI Generation
  CREATE TABLE IF NOT EXISTS jd_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    department TEXT,
    template_content TEXT NOT NULL,
    skills_keywords TEXT,
    experience_level TEXT CHECK(experience_level IN ('fresher', 'junior', 'mid', 'senior', 'lead', 'executive')),
    is_default INTEGER DEFAULT 0,
    created_by INTEGER NOT NULL,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_jd_templates_department ON jd_templates(department);
  CREATE INDEX IF NOT EXISTS idx_jd_templates_active ON jd_templates(isActive);

  -- AI Interview Scores (Structured Evaluation)
  CREATE TABLE IF NOT EXISTS ai_interview_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL,
    interview_id INTEGER NOT NULL,
    evaluation_id INTEGER,
    hr_feedback_raw TEXT NOT NULL,

    -- AI-calculated scores (out of 5)
    technical_skills_score REAL,
    technical_skills_reasoning TEXT,
    communication_score REAL,
    communication_reasoning TEXT,
    problem_solving_score REAL,
    problem_solving_reasoning TEXT,
    cultural_fit_score REAL,
    cultural_fit_reasoning TEXT,
    overall_performance_score REAL,
    overall_performance_reasoning TEXT,

    -- Final composite score and recommendation
    final_ai_score REAL,
    ai_recommendation TEXT CHECK(ai_recommendation IN ('strong_hire', 'hire', 'borderline', 'no_hire', 'strong_no_hire')),
    selection_threshold_met INTEGER DEFAULT 0,
    detailed_analysis TEXT,
    key_strengths TEXT,
    areas_for_development TEXT,
    risk_factors TEXT,

    scored_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE,
    FOREIGN KEY (evaluation_id) REFERENCES candidate_evaluations(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_ai_interview_scores_candidate ON ai_interview_scores(candidate_id);
  CREATE INDEX IF NOT EXISTS idx_ai_interview_scores_interview ON ai_interview_scores(interview_id);
  CREATE INDEX IF NOT EXISTS idx_ai_interview_scores_recommendation ON ai_interview_scores(ai_recommendation);

  -- Recruitment Workflow Stage Tracking (Visual Pipeline)
  CREATE TABLE IF NOT EXISTS recruitment_workflow_stages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL,
    vacancy_id INTEGER,
    current_stage TEXT NOT NULL DEFAULT 'new' CHECK(current_stage IN (
      'new', 'screening', 'screened', 'shortlisted', 'rejected',
      'interview_scheduled', 'interview_completed', 'interview_scored',
      'selected', 'ctc_discussion', 'ctc_finalized',
      'offer_generated', 'offer_sent', 'offer_accepted', 'offer_rejected',
      'joined', 'withdrawn'
    )),
    previous_stage TEXT,
    stage_started_at TEXT DEFAULT (datetime('now')),
    stage_completed_at TEXT,
    stage_notes TEXT,
    updated_by INTEGER,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (vacancy_id) REFERENCES vacancies(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_workflow_stages_candidate ON recruitment_workflow_stages(candidate_id);
  CREATE INDEX IF NOT EXISTS idx_workflow_stages_vacancy ON recruitment_workflow_stages(vacancy_id);
  CREATE INDEX IF NOT EXISTS idx_workflow_stages_stage ON recruitment_workflow_stages(current_stage);

  -- Selection Thresholds Configuration
  CREATE TABLE IF NOT EXISTS selection_thresholds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vacancy_id INTEGER,
    department TEXT,
    min_screening_score REAL DEFAULT 60,
    min_interview_score REAL DEFAULT 3.5,
    auto_shortlist_threshold REAL DEFAULT 75,
    auto_reject_threshold REAL DEFAULT 40,
    is_default INTEGER DEFAULT 0,
    created_by INTEGER NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (vacancy_id) REFERENCES vacancies(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_selection_thresholds_vacancy ON selection_thresholds(vacancy_id);
  CREATE INDEX IF NOT EXISTS idx_selection_thresholds_default ON selection_thresholds(is_default);

  -- Workflow Stage History (Audit Trail)
  CREATE TABLE IF NOT EXISTS workflow_stage_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL,
    vacancy_id INTEGER,
    from_stage TEXT,
    to_stage TEXT NOT NULL,
    changed_by INTEGER,
    change_reason TEXT,
    is_automated INTEGER DEFAULT 0,
    metadata TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (vacancy_id) REFERENCES vacancies(id) ON DELETE SET NULL,
    FOREIGN KEY (changed_by) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_workflow_history_candidate ON workflow_stage_history(candidate_id);
  CREATE INDEX IF NOT EXISTS idx_workflow_history_stage ON workflow_stage_history(to_stage);

  -- Recruitment Workflow Log (for automated workflow tracking)
  CREATE TABLE IF NOT EXISTS recruitment_workflow_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK(action_type IN ('auto_screen', 'auto_decision', 'offer_generated', 'status_change', 'interview_score', 'manual_override', 'screening_communication')),
    details TEXT,
    performed_by INTEGER,
    is_automated INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (performed_by) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_workflow_log_candidate ON recruitment_workflow_log(candidate_id);
  CREATE INDEX IF NOT EXISTS idx_workflow_log_action_type ON recruitment_workflow_log(action_type);
  CREATE INDEX IF NOT EXISTS idx_workflow_log_created ON recruitment_workflow_log(createdAt);

  -- Head person review tokens table
  CREATE TABLE IF NOT EXISTS head_review_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    vacancy_id INTEGER NOT NULL,
    reviewer_email TEXT NOT NULL,
    reviewer_name TEXT,
    candidate_ids TEXT NOT NULL,
    sent_by INTEGER NOT NULL,
    is_responded INTEGER DEFAULT 0,
    response_date TEXT,
    response_data TEXT,
    expires_at TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (vacancy_id) REFERENCES vacancies(id) ON DELETE CASCADE,
    FOREIGN KEY (sent_by) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_head_review_token ON head_review_tokens(token);
  CREATE INDEX IF NOT EXISTS idx_head_review_vacancy ON head_review_tokens(vacancy_id);
`);

// Migration: Add new columns to users table if they don't exist
const userColumns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
const columnNames = userColumns.map(c => c.name);

if (!columnNames.includes('profilePhoto')) {
  db.exec('ALTER TABLE users ADD COLUMN profilePhoto TEXT');
  console.log('Added profilePhoto column to users table');
}

if (!columnNames.includes('lastLoginAt')) {
  db.exec('ALTER TABLE users ADD COLUMN lastLoginAt TEXT');
  console.log('Added lastLoginAt column to users table');
}

// Migration: Add new columns to todos table if they don't exist
const todoColumns = db.prepare("PRAGMA table_info(todos)").all() as Array<{ name: string }>;
const todoColumnNames = todoColumns.map(c => c.name);

if (!todoColumnNames.includes('priority')) {
  db.exec("ALTER TABLE todos ADD COLUMN priority TEXT DEFAULT 'medium'");
  console.log('Added priority column to todos table');
}

if (!todoColumnNames.includes('isFavorite')) {
  db.exec('ALTER TABLE todos ADD COLUMN isFavorite INTEGER DEFAULT 0');
  console.log('Added isFavorite column to todos table');
}

if (!todoColumnNames.includes('dueDate')) {
  db.exec('ALTER TABLE todos ADD COLUMN dueDate TEXT');
  console.log('Added dueDate column to todos table');
}

// Migration: Add new columns to offer_letters table if they don't exist
const offerLetterColumns = db.prepare("PRAGMA table_info(offer_letters)").all() as Array<{ name: string }>;
const offerLetterColumnNames = offerLetterColumns.map(c => c.name);

if (!offerLetterColumnNames.includes('template_type')) {
  db.exec("ALTER TABLE offer_letters ADD COLUMN template_type TEXT DEFAULT 'long' CHECK(template_type IN ('short', 'long'))");
  console.log('Added template_type column to offer_letters table');
}

if (!offerLetterColumnNames.includes('optional_sections')) {
  db.exec("ALTER TABLE offer_letters ADD COLUMN optional_sections TEXT DEFAULT '[]'");
  console.log('Added optional_sections column to offer_letters table');
}

if (!offerLetterColumnNames.includes('kra_details')) {
  db.exec('ALTER TABLE offer_letters ADD COLUMN kra_details TEXT');
  console.log('Added kra_details column to offer_letters table');
}

if (!offerLetterColumnNames.includes('joining_bonus')) {
  db.exec('ALTER TABLE offer_letters ADD COLUMN joining_bonus REAL');
  console.log('Added joining_bonus column to offer_letters table');
}

if (!offerLetterColumnNames.includes('signatory_id')) {
  db.exec('ALTER TABLE offer_letters ADD COLUMN signatory_id INTEGER REFERENCES signatories(id)');
  console.log('Added signatory_id column to offer_letters table');
}

if (!offerLetterColumnNames.includes('secondary_signatory_id')) {
  db.exec('ALTER TABLE offer_letters ADD COLUMN secondary_signatory_id INTEGER REFERENCES signatories(id)');
  console.log('Added secondary_signatory_id column to offer_letters table');
}

// Migration: Add stamp_image column to signatories table if it doesn't exist
const signatoryColumns = db.prepare("PRAGMA table_info(signatories)").all() as Array<{ name: string }>;
const signatoryColumnNames = signatoryColumns.map(c => c.name);

if (!signatoryColumnNames.includes('stamp_image')) {
  db.exec('ALTER TABLE signatories ADD COLUMN stamp_image TEXT');
  console.log('Added stamp_image column to signatories table');
}

// Migration: Add letterhead_id column to offer_letters table if it doesn't exist
if (!offerLetterColumnNames.includes('letterhead_id')) {
  db.exec('ALTER TABLE offer_letters ADD COLUMN letterhead_id INTEGER REFERENCES letterheads(id)');
  console.log('Added letterhead_id column to offer_letters table');
}

if (!offerLetterColumnNames.includes('template_profile_id')) {
  db.exec('ALTER TABLE offer_letters ADD COLUMN template_profile_id INTEGER REFERENCES rag_template_profiles(id)');
  console.log('Added template_profile_id column to offer_letters table');
}

// Seed default admin user if no users exist
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  const hashedPassword = bcrypt.hashSync('Solution@1979', 12);
  db.prepare(`
    INSERT INTO users (email, password, name, role)
    VALUES (?, ?, ?, ?)
  `).run('phoneme2016@gmail.com', hashedPassword, 'Admin', 'admin');
  console.log('Default admin user created: phoneme2016@gmail.com');
}

// Seed default allowed domains setting if not exists
const domainSetting = db.prepare('SELECT * FROM settings WHERE key = ?').get('allowed_domains');
if (!domainSetting) {
  db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
  `).run('allowed_domains', JSON.stringify(['gmail.com']));
  console.log('Default allowed domains setting created');
}

// Migration: Add automation columns to candidates table
const candidateColumns = db.prepare("PRAGMA table_info(candidates)").all() as Array<{ name: string }>;
const candidateColumnNames = candidateColumns.map(c => c.name);

if (!candidateColumnNames.includes('email_application_id')) {
  db.exec('ALTER TABLE candidates ADD COLUMN email_application_id INTEGER REFERENCES email_applications(id)');
  console.log('Added email_application_id column to candidates table');
}

if (!candidateColumnNames.includes('automation_status')) {
  db.exec("ALTER TABLE candidates ADD COLUMN automation_status TEXT DEFAULT 'manual' CHECK(automation_status IN ('manual', 'automated', 'paused', 'completed'))");
  console.log('Added automation_status column to candidates table');
}

if (!candidateColumnNames.includes('final_interview_score')) {
  db.exec('ALTER TABLE candidates ADD COLUMN final_interview_score REAL');
  console.log('Added final_interview_score column to candidates table');
}

if (!candidateColumnNames.includes('ctc_discussion_id')) {
  db.exec('ALTER TABLE candidates ADD COLUMN ctc_discussion_id INTEGER REFERENCES ctc_discussions(id)');
  console.log('Added ctc_discussion_id column to candidates table');
}

if (!candidateColumnNames.includes('auto_shortlisted_at')) {
  db.exec('ALTER TABLE candidates ADD COLUMN auto_shortlisted_at TEXT');
  console.log('Added auto_shortlisted_at column to candidates table');
}

if (!candidateColumnNames.includes('auto_rejected_at')) {
  db.exec('ALTER TABLE candidates ADD COLUMN auto_rejected_at TEXT');
  console.log('Added auto_rejected_at column to candidates table');
}

if (!candidateColumnNames.includes('auto_rejection_reason')) {
  db.exec('ALTER TABLE candidates ADD COLUMN auto_rejection_reason TEXT');
  console.log('Added auto_rejection_reason column to candidates table');
}

// Head person review columns
if (!candidateColumnNames.includes('head_review_approved')) {
  db.exec('ALTER TABLE candidates ADD COLUMN head_review_approved INTEGER');
  console.log('Added head_review_approved column to candidates table');
}

if (!candidateColumnNames.includes('head_review_date')) {
  db.exec('ALTER TABLE candidates ADD COLUMN head_review_date TEXT');
  console.log('Added head_review_date column to candidates table');
}

if (!candidateColumnNames.includes('head_review_remarks')) {
  db.exec('ALTER TABLE candidates ADD COLUMN head_review_remarks TEXT');
  console.log('Added head_review_remarks column to candidates table');
}

// Migration: Add automation columns to interviews table
const interviewColumns = db.prepare("PRAGMA table_info(interviews)").all() as Array<{ name: string }>;
const interviewColumnNames = interviewColumns.map(c => c.name);

if (!interviewColumnNames.includes('calendar_event_id')) {
  db.exec('ALTER TABLE interviews ADD COLUMN calendar_event_id TEXT');
  console.log('Added calendar_event_id column to interviews table');
}

if (!interviewColumnNames.includes('email_draft_id')) {
  db.exec('ALTER TABLE interviews ADD COLUMN email_draft_id INTEGER REFERENCES email_drafts(id)');
  console.log('Added email_draft_id column to interviews table');
}

if (!interviewColumnNames.includes('auto_scheduled')) {
  db.exec('ALTER TABLE interviews ADD COLUMN auto_scheduled INTEGER DEFAULT 0');
  console.log('Added auto_scheduled column to interviews table');
}

if (!interviewColumnNames.includes('candidate_confirmed')) {
  db.exec('ALTER TABLE interviews ADD COLUMN candidate_confirmed INTEGER DEFAULT 0');
  console.log('Added candidate_confirmed column to interviews table');
}

if (!interviewColumnNames.includes('candidate_confirmed_at')) {
  db.exec('ALTER TABLE interviews ADD COLUMN candidate_confirmed_at TEXT');
  console.log('Added candidate_confirmed_at column to interviews table');
}

// Interview score columns for automated workflow
if (!interviewColumnNames.includes('technical_skills_score')) {
  db.exec('ALTER TABLE interviews ADD COLUMN technical_skills_score REAL');
  console.log('Added technical_skills_score column to interviews table');
}

if (!interviewColumnNames.includes('communication_score')) {
  db.exec('ALTER TABLE interviews ADD COLUMN communication_score REAL');
  console.log('Added communication_score column to interviews table');
}

if (!interviewColumnNames.includes('problem_solving_score')) {
  db.exec('ALTER TABLE interviews ADD COLUMN problem_solving_score REAL');
  console.log('Added problem_solving_score column to interviews table');
}

if (!interviewColumnNames.includes('cultural_fit_score')) {
  db.exec('ALTER TABLE interviews ADD COLUMN cultural_fit_score REAL');
  console.log('Added cultural_fit_score column to interviews table');
}

if (!interviewColumnNames.includes('overall_performance_score')) {
  db.exec('ALTER TABLE interviews ADD COLUMN overall_performance_score REAL');
  console.log('Added overall_performance_score column to interviews table');
}

// Migration: Add recruitment workflow columns to vacancies table
const vacancyColumns = db.prepare("PRAGMA table_info(vacancies)").all() as Array<{ name: string }>;
const vacancyColumnNames = vacancyColumns.map(c => c.name);

if (!vacancyColumnNames.includes('jd_status')) {
  db.exec("ALTER TABLE vacancies ADD COLUMN jd_status TEXT DEFAULT 'draft'");
  console.log('Added jd_status column to vacancies table');
}

if (!vacancyColumnNames.includes('jd_template_id')) {
  db.exec('ALTER TABLE vacancies ADD COLUMN jd_template_id INTEGER REFERENCES jd_templates(id)');
  console.log('Added jd_template_id column to vacancies table');
}

if (!vacancyColumnNames.includes('ai_generated_jd')) {
  db.exec('ALTER TABLE vacancies ADD COLUMN ai_generated_jd TEXT');
  console.log('Added ai_generated_jd column to vacancies table');
}

if (!vacancyColumnNames.includes('naukri_search_enabled')) {
  db.exec('ALTER TABLE vacancies ADD COLUMN naukri_search_enabled INTEGER DEFAULT 0');
  console.log('Added naukri_search_enabled column to vacancies table');
}

if (!vacancyColumnNames.includes('selection_threshold_id')) {
  db.exec('ALTER TABLE vacancies ADD COLUMN selection_threshold_id INTEGER REFERENCES selection_thresholds(id)');
  console.log('Added selection_threshold_id column to vacancies table');
}

// Migration: Add recruitment workflow columns to candidates table
if (!candidateColumnNames.includes('naukri_profile_id')) {
  db.exec('ALTER TABLE candidates ADD COLUMN naukri_profile_id TEXT');
  console.log('Added naukri_profile_id column to candidates table');
}

if (!candidateColumnNames.includes('naukri_search_id')) {
  db.exec('ALTER TABLE candidates ADD COLUMN naukri_search_id INTEGER REFERENCES naukri_searches(id)');
  console.log('Added naukri_search_id column to candidates table');
}

if (!candidateColumnNames.includes('match_score_breakdown')) {
  db.exec('ALTER TABLE candidates ADD COLUMN match_score_breakdown TEXT');
  console.log('Added match_score_breakdown column to candidates table');
}

if (!candidateColumnNames.includes('ai_recommendation_reason')) {
  db.exec('ALTER TABLE candidates ADD COLUMN ai_recommendation_reason TEXT');
  console.log('Added ai_recommendation_reason column to candidates table');
}

if (!candidateColumnNames.includes('workflow_stage')) {
  db.exec("ALTER TABLE candidates ADD COLUMN workflow_stage TEXT DEFAULT 'new'");
  console.log('Added workflow_stage column to candidates table');
}

if (!candidateColumnNames.includes('parsed_resume_data')) {
  db.exec('ALTER TABLE candidates ADD COLUMN parsed_resume_data TEXT');
  console.log('Added parsed_resume_data column to candidates table');
}

if (!candidateColumnNames.includes('resume_parsed_at')) {
  db.exec('ALTER TABLE candidates ADD COLUMN resume_parsed_at TEXT');
  console.log('Added resume_parsed_at column to candidates table');
}

if (!candidateColumnNames.includes('screening_skill_data')) {
  db.exec('ALTER TABLE candidates ADD COLUMN screening_skill_data TEXT');
  console.log('Added screening_skill_data column to candidates table');
}

if (!candidateColumnNames.includes('offer_ctc')) {
  db.exec('ALTER TABLE candidates ADD COLUMN offer_ctc REAL');
  console.log('Added offer_ctc column to candidates table');
}

if (!candidateColumnNames.includes('offer_generated_at')) {
  db.exec('ALTER TABLE candidates ADD COLUMN offer_generated_at TEXT');
  console.log('Added offer_generated_at column to candidates table');
}

if (!candidateColumnNames.includes('expected_joining_date')) {
  db.exec('ALTER TABLE candidates ADD COLUMN expected_joining_date TEXT');
  console.log('Added expected_joining_date column to candidates table');
}

if (!candidateColumnNames.includes('actual_joining_date')) {
  db.exec('ALTER TABLE candidates ADD COLUMN actual_joining_date TEXT');
  console.log('Added actual_joining_date column to candidates table');
}

if (!candidateColumnNames.includes('skill_experience_data')) {
  db.exec('ALTER TABLE candidates ADD COLUMN skill_experience_data TEXT');
  console.log('Added skill_experience_data column to candidates table');
}

if (!candidateColumnNames.includes('screening_date')) {
  db.exec('ALTER TABLE candidates ADD COLUMN screening_date TEXT');
  console.log('Added screening_date column to candidates table');
}

if (!candidateColumnNames.includes('notes')) {
  db.exec('ALTER TABLE candidates ADD COLUMN notes TEXT');
  console.log('Added notes column to candidates table');
}

// Migration: Add interest email workflow columns to candidates table
if (!candidateColumnNames.includes('is_interested')) {
  db.exec("ALTER TABLE candidates ADD COLUMN is_interested TEXT CHECK(is_interested IN ('yes', 'no', 'pending'))");
  console.log('Added is_interested column to candidates table');
}

if (!candidateColumnNames.includes('interview_availability')) {
  db.exec("ALTER TABLE candidates ADD COLUMN interview_availability TEXT CHECK(interview_availability IN ('tomorrow', 'preferred_date'))");
  console.log('Added interview_availability column to candidates table');
}

if (!candidateColumnNames.includes('preferred_interview_date')) {
  db.exec('ALTER TABLE candidates ADD COLUMN preferred_interview_date TEXT');
  console.log('Added preferred_interview_date column to candidates table');
}

if (!candidateColumnNames.includes('form_response_date')) {
  db.exec('ALTER TABLE candidates ADD COLUMN form_response_date TEXT');
  console.log('Added form_response_date column to candidates table');
}

if (!candidateColumnNames.includes('interest_email_sent_date')) {
  db.exec('ALTER TABLE candidates ADD COLUMN interest_email_sent_date TEXT');
  console.log('Added interest_email_sent_date column to candidates table');
}

if (!candidateColumnNames.includes('form_token')) {
  db.exec('ALTER TABLE candidates ADD COLUMN form_token TEXT');
  // Create unique index separately (SQLite doesn't support UNIQUE in ALTER TABLE)
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_candidates_form_token ON candidates(form_token) WHERE form_token IS NOT NULL');
  console.log('Added form_token column to candidates table');
}

// Migration: Add columns to vacancies table for vacancy completion tracking
if (!vacancyColumnNames.includes('openings')) {
  db.exec('ALTER TABLE vacancies ADD COLUMN openings INTEGER DEFAULT 1');
  console.log('Added openings column to vacancies table');
}

if (!vacancyColumnNames.includes('filled_date')) {
  db.exec('ALTER TABLE vacancies ADD COLUMN filled_date TEXT');
  console.log('Added filled_date column to vacancies table');
}

// Add technical_score and communication_score to interviews if not present
if (!interviewColumnNames.includes('technical_score')) {
  db.exec('ALTER TABLE interviews ADD COLUMN technical_score REAL');
  console.log('Added technical_score column to interviews table');
}

// Seed default selection thresholds if none exist
const thresholdCount = db.prepare('SELECT COUNT(*) as count FROM selection_thresholds').get() as { count: number };
if (thresholdCount.count === 0) {
  db.prepare(`
    INSERT INTO selection_thresholds (vacancy_id, department, min_screening_score, min_interview_score, auto_shortlist_threshold, auto_reject_threshold, is_default, created_by)
    VALUES (NULL, NULL, 60, 3.5, 75, 40, 1, 1)
  `).run();
  console.log('Default selection thresholds created');
}

// Seed default email templates if none exist
const emailTemplateCount = db.prepare('SELECT COUNT(*) as count FROM email_templates').get() as { count: number };
if (emailTemplateCount.count === 0) {
  // Interview Invite Template
  db.prepare(`
    INSERT INTO email_templates (name, email_type, subject_template, body_template, variables, is_default, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    'Interview Invitation',
    'interview_invite',
    'Interview Invitation - {{vacancy_title}} at {{company_name}}',
    `Dear {{candidate_name}},

Thank you for your interest in the {{vacancy_title}} position at {{company_name}}.

We are pleased to invite you for an interview. Please find the details below:

**Interview Details:**
- **Date:** {{interview_date}}
- **Time:** {{interview_time}}
- **Duration:** {{interview_duration}} minutes
- **Type:** {{interview_type}}
- **Interviewer:** {{interviewer_name}}
{{#if meeting_link}}
- **Meeting Link:** {{meeting_link}}
{{/if}}
{{#if location}}
- **Location:** {{location}}
{{/if}}

Please confirm your availability by replying to this email.

Best regards,
{{hr_manager_name}}
{{hr_manager_title}}
{{company_name}}`,
    JSON.stringify(['candidate_name', 'vacancy_title', 'company_name', 'interview_date', 'interview_time', 'interview_duration', 'interview_type', 'interviewer_name', 'meeting_link', 'location', 'hr_manager_name', 'hr_manager_title']),
    1,
    1
  );

  // Rejection Email Template
  db.prepare(`
    INSERT INTO email_templates (name, email_type, subject_template, body_template, variables, is_default, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    'Application Update',
    'rejection',
    'Application Update - {{vacancy_title}} at {{company_name}}',
    `Dear {{candidate_name}},

Thank you for taking the time to apply for the {{vacancy_title}} position at {{company_name}} and for your interest in joining our team.

After careful consideration, we regret to inform you that we have decided to move forward with other candidates whose qualifications more closely match our current requirements.

This decision was not easy, as we received many impressive applications. We encourage you to apply for future openings that match your skills and experience.

We wish you all the best in your career endeavors.

Best regards,
{{hr_manager_name}}
{{hr_manager_title}}
{{company_name}}`,
    JSON.stringify(['candidate_name', 'vacancy_title', 'company_name', 'hr_manager_name', 'hr_manager_title']),
    1,
    1
  );

  // Offer Email Template
  db.prepare(`
    INSERT INTO email_templates (name, email_type, subject_template, body_template, variables, is_default, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    'Offer Letter',
    'offer',
    'Offer Letter - {{designation}} at {{company_name}}',
    `Dear {{candidate_name}},

Congratulations! We are delighted to extend an offer of employment to you for the position of {{designation}} at {{company_name}}.

**Offer Details:**
- **Position:** {{designation}}
- **Annual CTC:** {{annual_ctc}}
- **Joining Date:** {{joining_date}}
- **Working Location:** {{working_location}}

Please find the detailed offer letter attached to this email. This offer is valid until {{offer_valid_till}}.

To accept this offer, please sign and return the attached offer letter by the validity date.

We are excited about the possibility of you joining our team and look forward to your positive response.

Best regards,
{{hr_manager_name}}
{{hr_manager_title}}
{{company_name}}`,
    JSON.stringify(['candidate_name', 'designation', 'company_name', 'annual_ctc', 'joining_date', 'working_location', 'offer_valid_till', 'hr_manager_name', 'hr_manager_title']),
    1,
    1
  );

  console.log('Default email templates created');
}

// Migration: Add all_sections_content column to rag_template_profiles for storing complete document sections
const templateProfileColumns = db.prepare("PRAGMA table_info(rag_template_profiles)").all() as Array<{ name: string }>;
const templateProfileColumnNames = templateProfileColumns.map(c => c.name);

if (!templateProfileColumnNames.includes('all_sections_content')) {
  db.exec('ALTER TABLE rag_template_profiles ADD COLUMN all_sections_content TEXT');
  console.log('Added all_sections_content column to rag_template_profiles table');
}

export default db;
