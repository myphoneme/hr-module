import type {
  RAGDocument,
  ResumeExtraction,
  RAGGenerateRequest,
  RAGGenerateResponse,
  RAGStats
} from '../types';

import { API_BASE_URL } from '../config/api';

export const ragApi = {
  // Training document endpoints
  uploadTrainingDocument: async (file: File): Promise<RAGDocument> => {
    const formData = new FormData();
    formData.append('document', file);

    const response = await fetch(`${API_BASE_URL}/rag/upload-training`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  getDocuments: async (): Promise<RAGDocument[]> => {
    const response = await fetch(`${API_BASE_URL}/rag/documents`, {
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  getDocument: async (id: number): Promise<RAGDocument> => {
    const response = await fetch(`${API_BASE_URL}/rag/documents/${id}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  deleteDocument: async (id: number): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/rag/documents/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
  },

  // Resume endpoints
  uploadResume: async (file: File): Promise<ResumeExtraction> => {
    const formData = new FormData();
    formData.append('resume', file);

    const response = await fetch(`${API_BASE_URL}/rag/upload-resume`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  getResumes: async (): Promise<ResumeExtraction[]> => {
    const response = await fetch(`${API_BASE_URL}/rag/resumes`, {
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  getResume: async (id: number): Promise<ResumeExtraction> => {
    const response = await fetch(`${API_BASE_URL}/rag/resumes/${id}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  deleteResume: async (id: number): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/rag/resumes/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
  },

  // Generation endpoint
  generateOfferLetter: async (request: RAGGenerateRequest): Promise<RAGGenerateResponse> => {
    const response = await fetch(`${API_BASE_URL}/rag/generate`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Generation failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  // Quick generate - one-click resume upload and offer letter generation
  quickGenerate: async (file: File): Promise<QuickGenerateResponse> => {
    const formData = new FormData();
    formData.append('resume', file);

    const response = await fetch(`${API_BASE_URL}/rag/quick-generate`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Generation failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  // Get learned patterns
  getLearnedPatterns: async (): Promise<LearnedPatternsResponse> => {
    const response = await fetch(`${API_BASE_URL}/rag/learned-patterns`, {
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  // Prompt-based generation - HR describes offer in plain English
  promptGenerate: async (request: PromptGenerateRequest): Promise<PromptGenerateResponse> => {
    const response = await fetch(`${API_BASE_URL}/rag/prompt-generate`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Generation failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  // Extract details from existing offer letter PDF
  extractOfferLetter: async (file: File): Promise<ExtractOfferLetterResponse> => {
    const formData = new FormData();
    formData.append('document', file);

    const response = await fetch(`${API_BASE_URL}/rag/extract-offer-letter`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Extraction failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  // Stats endpoint
  getStats: async (): Promise<RAGStats> => {
    const response = await fetch(`${API_BASE_URL}/rag/stats`, {
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  // Template Profile endpoints
  getTemplateProfiles: async (): Promise<TemplateProfile[]> => {
    const response = await fetch(`${API_BASE_URL}/rag/template-profiles`, {
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  getTemplateProfile: async (id: number): Promise<TemplateProfile> => {
    const response = await fetch(`${API_BASE_URL}/rag/template-profiles/${id}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  setDefaultTemplate: async (id: number): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/rag/template-profiles/${id}/set-default`, {
      method: 'PUT',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
  },

  deleteTemplateProfile: async (id: number): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/rag/template-profiles/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
  },

  // Generate with specific template
  generateWithTemplate: async (request: GenerateWithTemplateRequest): Promise<RAGGenerateResponse> => {
    const response = await fetch(`${API_BASE_URL}/rag/generate-with-template`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Generation failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  // Auto-generate with template matching
  autoGenerateWithTemplate: async (file: File): Promise<AutoGenerateWithTemplateResponse> => {
    const formData = new FormData();
    formData.append('resume', file);

    const response = await fetch(`${API_BASE_URL}/rag/auto-generate-with-template`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Generation failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  // Preview template with sample data
  previewTemplate: async (id: number, options?: { designation?: string; experience_years?: number; annual_ctc?: number }): Promise<TemplatePreviewResponse> => {
    const response = await fetch(`${API_BASE_URL}/rag/template-profiles/${id}/preview`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options || {}),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Preview failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },
};

// Types for new endpoints
export interface QuickGenerateResponse {
  success: boolean;
  resume: {
    id: number;
    candidate_name: string | null;
    designation: string | null;
    experience_years: number | null;
    skills: string[] | null;
  };
  offer_letter: RAGGenerateResponse;
  learned_defaults: Record<string, string>;
}

export interface LearnedPattern {
  id: number;
  document_id: number;
  document_name: string;
  company_name: string | null;
  company_address: string | null;
  hr_manager_name: string | null;
  hr_manager_title: string | null;
  working_location: string | null;
  probation_period: string | null;
  notice_period: string | null;
  working_hours: string | null;
  leave_policy: string | null;
  benefits: string[] | null;
  salary_structure: any | null;
  designation_found: string | null;
  annual_ctc_found: number | null;
  template_style: string | null;
  clauses: string[] | null;
  full_analysis: any | null;
  createdAt: string;
}

export interface SalaryBenchmark {
  id: number;
  designation: string;
  experience_min: number;
  experience_max: number;
  annual_ctc_min: number | null;
  annual_ctc_max: number | null;
  annual_ctc_avg: number | null;
  basic_percentage: number | null;
  hra_percentage: number | null;
  sample_count: number;
  source_document_ids: string | null;
  updatedAt: string;
}

export interface LearnedPatternsResponse {
  patterns: LearnedPattern[];
  companyDefaults: Record<string, string>;
  salaryBenchmarks: SalaryBenchmark[];
}

export interface PromptGenerateRequest {
  resume_id?: number;
  prompt: string;
  signatory_id?: number;
  letterhead_id?: number;
  candidate_id?: number;
}

export interface PromptGenerateResponse {
  success: boolean;
  offer_letter_data?: any;
  letter_content?: any;
  parsed_from_prompt?: {
    designation: string;
    salary: number;
    joining_date: string;
  };
  error?: string;
}

export interface ExtractOfferLetterResponse {
  success: boolean;
  candidate_name?: string;
  candidate_address?: string;
  designation?: string;
  joining_date?: string;
  annual_ctc?: number;
  salary_breakdown?: any[];
  working_location?: string;
  hr_manager_name?: string;
  hr_manager_title?: string;
  offer_valid_till?: string;
  letter_date?: string;
  template_type?: string;
  extracted_text_preview?: string;
  error?: string;
}

// Template Profile types
export interface TemplateProfile {
  id: number;
  profile_name: string;
  profile_description: string | null;
  source_document_ids: number[];
  header_format: string | null;
  greeting_format: string | null;
  opening_paragraph: string | null;
  sections_order: string[];
  closing_format: string | null;
  signature_format: string | null;
  tone_style: 'formal' | 'semi_formal' | 'friendly' | null;
  language_patterns: any | null;
  common_phrases: string[];
  has_salary_table: boolean;
  has_kra_section: boolean;
  has_annexures: boolean;
  annexure_types: string[];
  date_format: string | null;
  salary_format: string | null;
  paragraph_style: string | null;
  bullet_point_style: string | null;
  probation_clause: string | null;
  notice_period_clause: string | null;
  confidentiality_clause: string | null;
  termination_clause: string | null;
  general_terms_clause: string | null;
  benefits_section: string | null;
  working_hours_clause: string | null;
  leave_policy_clause: string | null;
  full_structure: any | null;
  sample_generated_content: string | null;
  designation_types: string[];
  experience_levels: string[];
  is_default: boolean;
  usage_count: number;
  match_score_avg: number;
  document_count?: number;
  linked_documents?: { id: number; original_name: string; match_confidence: number }[];
  createdAt: string;
  updatedAt: string;
}

export interface GenerateWithTemplateRequest {
  resume_id: number;
  template_profile_id?: number;
  designation?: string;
  working_location?: string;
  hr_manager_name?: string;
  hr_manager_title?: string;
  offer_valid_days?: number;
  joining_date?: string;
  signatory_id?: number;
  secondary_signatory_id?: number;
}

export interface AutoGenerateWithTemplateResponse {
  success: boolean;
  resume: {
    id: number;
    candidate_name: string | null;
    designation: string | null;
    experience_years: number | null;
    skills: string[] | null;
  };
  template_used: {
    id: number;
    name: string;
    tone: string | null;
  };
  offer_letter: RAGGenerateResponse;
  company_defaults: Record<string, string>;
}

export interface TemplatePreviewResponse {
  success: boolean;
  preview: RAGGenerateResponse;
  template: {
    id: number;
    name: string;
    tone: string | null;
  };
}
