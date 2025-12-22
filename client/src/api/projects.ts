import { api } from './client';
import type { ProjectWithDetails, CreateProjectInput, UpdateProjectInput } from '../types';

export const projectsApi = {
  getAll: () => api.get<ProjectWithDetails[]>('/projects'),

  getById: (id: number) => api.get<ProjectWithDetails>(`/projects/${id}`),

  create: (data: CreateProjectInput) => api.post<ProjectWithDetails>('/projects', data),

  bulkCreate: (projects: CreateProjectInput[]) =>
    api.post<{ message: string; successCount: number; errorCount: number; errors: string[] }>(
      '/projects/bulk',
      { projects }
    ),

  update: (id: number, data: UpdateProjectInput) =>
    api.put<ProjectWithDetails>(`/projects/${id}`, data),

  delete: (id: number) => api.delete(`/projects/${id}`),
};
