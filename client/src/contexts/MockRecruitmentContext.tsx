import { createContext, useContext, useState, type ReactNode } from 'react';

// Mock Candidate type for imported data
export interface MockCandidate {
  id: number;
  vacancy_id: number;
  vacancy_title: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  current_company: string;
  current_designation: string;
  experience_years: number;
  skills: string;
  skill_experience_data?: string; // JSON string for skill-wise experience
  current_salary?: number; // To be filled by HR
  expected_salary?: number; // To be filled by HR
  notice_period?: string; // To be filled by HR
  location: string;
  education?: string;
  status: 'new' | 'screening' | 'shortlisted' | 'interview_scheduled' | 'interviewed' | 'selected' | 'offer_sent' | 'rejected';
  screening_score?: number;
  screening_summary?: string; // AI-generated screening summary
  source: string;
  createdAt: string;
  screening_date?: string;
}

// Mock Interview type
export interface MockInterview {
  id: number;
  candidate_id: number;
  vacancy_id: number;
  vacancy_title: string;
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string;
  interview_type: 'technical' | 'hr' | 'managerial' | 'final';
  round_number: number;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  location: string;
  meeting_link?: string;
  interviewer_name: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  // Candidate details for display
  experience_years: number;
  skills: string;
  current_salary?: number;
  expected_salary?: number;
  notice_period?: string;
  current_location: string;
  // Feedback
  rating?: number;
  feedback?: string;
  recommendation?: 'strong_hire' | 'hire' | 'no_hire' | 'strong_no_hire';
  createdAt: string;
}

interface MockRecruitmentContextType {
  // Candidates
  mockCandidates: MockCandidate[];
  addMockCandidates: (candidates: MockCandidate[]) => void;
  updateMockCandidate: (id: number, updates: Partial<MockCandidate>) => void;
  deleteMockCandidate: (id: number) => void;
  getMockCandidatesByVacancy: (vacancyId: number) => MockCandidate[];
  getMockCandidatesByStatus: (status: string) => MockCandidate[];

  // Interviews
  mockInterviews: MockInterview[];
  scheduleMockInterview: (interview: Omit<MockInterview, 'id' | 'createdAt'>) => void;
  updateMockInterview: (id: number, updates: Partial<MockInterview>) => void;
  deleteMockInterview: (id: number) => void;
  getMockInterviewsByCandidate: (candidateId: number) => MockInterview[];
  getMockInterviewsByStatus: (status: string) => MockInterview[];
}

const MockRecruitmentContext = createContext<MockRecruitmentContextType | null>(null);

let candidateIdCounter = 1000;
let interviewIdCounter = 1000;

export function MockRecruitmentProvider({ children }: { children: ReactNode }) {
  const [mockCandidates, setMockCandidates] = useState<MockCandidate[]>([]);
  const [mockInterviews, setMockInterviews] = useState<MockInterview[]>([]);

  // Add multiple candidates (from Naukri import)
  const addMockCandidates = (candidates: MockCandidate[]) => {
    const newCandidates = candidates.map(c => ({
      ...c,
      id: candidateIdCounter++,
      createdAt: new Date().toISOString(),
      screening_date: new Date().toISOString().split('T')[0],
    }));
    setMockCandidates(prev => [...prev, ...newCandidates]);
  };

  // Update a candidate
  const updateMockCandidate = (id: number, updates: Partial<MockCandidate>) => {
    setMockCandidates(prev =>
      prev.map(c => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  // Delete a candidate
  const deleteMockCandidate = (id: number) => {
    setMockCandidates(prev => prev.filter(c => c.id !== id));
    // Also delete associated interviews
    setMockInterviews(prev => prev.filter(i => i.candidate_id !== id));
  };

  // Get candidates by vacancy
  const getMockCandidatesByVacancy = (vacancyId: number) => {
    return mockCandidates.filter(c => c.vacancy_id === vacancyId);
  };

  // Get candidates by status
  const getMockCandidatesByStatus = (status: string) => {
    return mockCandidates.filter(c => c.status === status);
  };

  // Schedule an interview
  const scheduleMockInterview = (interview: Omit<MockInterview, 'id' | 'createdAt'>) => {
    const newInterview: MockInterview = {
      ...interview,
      id: interviewIdCounter++,
      createdAt: new Date().toISOString(),
    };
    setMockInterviews(prev => [...prev, newInterview]);

    // Update candidate status to interview_scheduled
    updateMockCandidate(interview.candidate_id, { status: 'interview_scheduled' });
  };

  // Update an interview
  const updateMockInterview = (id: number, updates: Partial<MockInterview>) => {
    setMockInterviews(prev =>
      prev.map(i => (i.id === id ? { ...i, ...updates } : i))
    );
  };

  // Delete an interview
  const deleteMockInterview = (id: number) => {
    const interview = mockInterviews.find(i => i.id === id);
    setMockInterviews(prev => prev.filter(i => i.id !== id));

    // Check if candidate has other interviews, if not, revert status to shortlisted
    if (interview) {
      const otherInterviews = mockInterviews.filter(
        i => i.candidate_id === interview.candidate_id && i.id !== id
      );
      if (otherInterviews.length === 0) {
        updateMockCandidate(interview.candidate_id, { status: 'shortlisted' });
      }
    }
  };

  // Get interviews by candidate
  const getMockInterviewsByCandidate = (candidateId: number) => {
    return mockInterviews.filter(i => i.candidate_id === candidateId);
  };

  // Get interviews by status
  const getMockInterviewsByStatus = (status: string) => {
    return mockInterviews.filter(i => i.status === status);
  };

  return (
    <MockRecruitmentContext.Provider
      value={{
        mockCandidates,
        addMockCandidates,
        updateMockCandidate,
        deleteMockCandidate,
        getMockCandidatesByVacancy,
        getMockCandidatesByStatus,
        mockInterviews,
        scheduleMockInterview,
        updateMockInterview,
        deleteMockInterview,
        getMockInterviewsByCandidate,
        getMockInterviewsByStatus,
      }}
    >
      {children}
    </MockRecruitmentContext.Provider>
  );
}

export function useMockRecruitment() {
  const context = useContext(MockRecruitmentContext);
  if (!context) {
    throw new Error('useMockRecruitment must be used within a MockRecruitmentProvider');
  }
  return context;
}
