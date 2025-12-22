// Hook to use mock recruitment data
// Set USE_MOCK_DATA to true to use mock data instead of API calls

import { useState, useMemo } from 'react';
import {
  mockVacancies,
  mockCandidates,
  mockInterviews,
  mockRecruitmentStats,
  departmentBreakdown,
  skillWiseCandidates,
} from '../data/mockRecruitmentData';
import type { Vacancy, Candidate, Interview, RecruitmentStats } from '../api/recruitment';

// Toggle this to switch between mock and real data
export const USE_MOCK_DATA = true;

export function useMockVacancies(filters?: { status?: string; department?: string }) {
  const data = useMemo(() => {
    let filtered = [...mockVacancies];

    if (filters?.status) {
      filtered = filtered.filter(v => v.status === filters.status);
    }
    if (filters?.department) {
      filtered = filtered.filter(v => v.department === filters.department);
    }

    return filtered;
  }, [filters?.status, filters?.department]);

  return {
    data,
    isLoading: false,
    isError: false,
    error: null,
  };
}

export function useMockVacancy(id: number) {
  const data = useMemo(() => {
    const vacancy = mockVacancies.find(v => v.id === id);
    if (!vacancy) return null;

    const candidates = mockCandidates.filter(c => c.vacancy_id === id);
    return { ...vacancy, candidates };
  }, [id]);

  return {
    data,
    isLoading: false,
    isError: false,
    error: null,
  };
}

export function useMockCandidates(filters?: { vacancy_id?: number; status?: string }) {
  const data = useMemo(() => {
    let filtered = [...mockCandidates];

    if (filters?.vacancy_id) {
      filtered = filtered.filter(c => c.vacancy_id === filters.vacancy_id);
    }
    if (filters?.status) {
      filtered = filtered.filter(c => c.status === filters.status);
    }

    return filtered;
  }, [filters?.vacancy_id, filters?.status]);

  return {
    data,
    isLoading: false,
    isError: false,
    error: null,
  };
}

export function useMockCandidate(id: number) {
  const data = useMemo(() => {
    const candidate = mockCandidates.find(c => c.id === id);
    if (!candidate) return null;

    const interviews = mockInterviews.filter(i => i.candidate_id === id);
    return { ...candidate, interviews, evaluations: [] };
  }, [id]);

  return {
    data,
    isLoading: false,
    isError: false,
    error: null,
  };
}

export function useMockInterviews(filters?: {
  candidate_id?: number;
  interviewer_id?: number;
  status?: string;
  date?: string;
}) {
  const data = useMemo(() => {
    let filtered = [...mockInterviews];

    if (filters?.candidate_id) {
      filtered = filtered.filter(i => i.candidate_id === filters.candidate_id);
    }
    if (filters?.interviewer_id) {
      filtered = filtered.filter(i => i.interviewer_id === filters.interviewer_id);
    }
    if (filters?.status) {
      filtered = filtered.filter(i => i.status === filters.status);
    }
    if (filters?.date) {
      filtered = filtered.filter(i => i.scheduled_date === filters.date);
    }

    return filtered;
  }, [filters?.candidate_id, filters?.interviewer_id, filters?.status, filters?.date]);

  return {
    data,
    isLoading: false,
    isError: false,
    error: null,
  };
}

export function useMockRecruitmentStats(): { data: RecruitmentStats; isLoading: boolean } {
  return {
    data: mockRecruitmentStats,
    isLoading: false,
  };
}

export function useMockDepartmentBreakdown() {
  return departmentBreakdown;
}

export function useMockSkillWiseCandidates() {
  return skillWiseCandidates;
}

// Utility to filter candidates by various criteria
export function useFilteredCandidates(options: {
  search?: string;
  status?: string;
  vacancy_id?: number;
  experience_min?: number;
  experience_max?: number;
  skills?: string[];
  location?: string;
}) {
  const data = useMemo(() => {
    let filtered = [...mockCandidates];

    if (options.search) {
      const searchLower = options.search.toLowerCase();
      filtered = filtered.filter(c =>
        c.first_name.toLowerCase().includes(searchLower) ||
        c.last_name?.toLowerCase().includes(searchLower) ||
        c.email.toLowerCase().includes(searchLower) ||
        c.skills?.toLowerCase().includes(searchLower) ||
        c.current_company?.toLowerCase().includes(searchLower)
      );
    }

    if (options.status) {
      filtered = filtered.filter(c => c.status === options.status);
    }

    if (options.vacancy_id) {
      filtered = filtered.filter(c => c.vacancy_id === options.vacancy_id);
    }

    if (options.experience_min !== undefined) {
      filtered = filtered.filter(c => (c.experience_years || 0) >= options.experience_min!);
    }

    if (options.experience_max !== undefined) {
      filtered = filtered.filter(c => (c.experience_years || 0) <= options.experience_max!);
    }

    if (options.skills && options.skills.length > 0) {
      filtered = filtered.filter(c => {
        const candidateSkills = c.skills?.toLowerCase() || '';
        return options.skills!.some(skill => candidateSkills.includes(skill.toLowerCase()));
      });
    }

    if (options.location) {
      const locationLower = options.location.toLowerCase();
      filtered = filtered.filter(c =>
        c.city?.toLowerCase().includes(locationLower) ||
        c.state?.toLowerCase().includes(locationLower)
      );
    }

    return filtered;
  }, [options]);

  return {
    data,
    count: data.length,
  };
}

// Get pipeline summary for a vacancy
export function useVacancyPipeline(vacancy_id: number) {
  const pipeline = useMemo(() => {
    const candidates = mockCandidates.filter(c => c.vacancy_id === vacancy_id);

    return {
      total: candidates.length,
      new: candidates.filter(c => c.status === 'new').length,
      screening: candidates.filter(c => c.status === 'screening').length,
      shortlisted: candidates.filter(c => c.status === 'shortlisted').length,
      interview_scheduled: candidates.filter(c => c.status === 'interview_scheduled').length,
      interviewed: candidates.filter(c => c.status === 'interviewed').length,
      selected: candidates.filter(c => c.status === 'selected').length,
      offer_sent: candidates.filter(c => c.status === 'offer_sent').length,
      rejected: candidates.filter(c => c.status === 'rejected').length,
    };
  }, [vacancy_id]);

  return pipeline;
}

// Get today's interviews
export function useTodayInterviews() {
  const today = new Date().toISOString().split('T')[0];

  const interviews = useMemo(() => {
    return mockInterviews.filter(i => i.scheduled_date === today && i.status === 'scheduled');
  }, [today]);

  return interviews;
}

// Get upcoming interviews (next 7 days)
export function useUpcomingInterviews() {
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const interviews = useMemo(() => {
    return mockInterviews.filter(i => {
      const interviewDate = new Date(i.scheduled_date);
      return interviewDate >= today && interviewDate <= nextWeek && i.status === 'scheduled';
    });
  }, []);

  return interviews;
}

export default {
  USE_MOCK_DATA,
  useMockVacancies,
  useMockVacancy,
  useMockCandidates,
  useMockCandidate,
  useMockInterviews,
  useMockRecruitmentStats,
  useMockDepartmentBreakdown,
  useMockSkillWiseCandidates,
  useFilteredCandidates,
  useVacancyPipeline,
  useTodayInterviews,
  useUpcomingInterviews,
};
