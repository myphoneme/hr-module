import { api } from './client';
import { API_BASE_URL } from '../config/api';
import type { EmployeeWithBranch, CreateEmployeeInput, UpdateEmployeeInput } from '../types';

// Helper to convert input to FormData for file uploads
const createFormData = (data: CreateEmployeeInput | UpdateEmployeeInput): FormData => {
  const formData = new FormData();

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (value instanceof File) {
        formData.append(key, value);
      } else {
        formData.append(key, String(value));
      }
    }
  });

  return formData;
};

export const employeesApi = {
  getAll: () => api.get<EmployeeWithBranch[]>('/employees'),

  getById: (id: number) => api.get<EmployeeWithBranch>(`/employees/${id}`),

  create: async (data: CreateEmployeeInput): Promise<EmployeeWithBranch> => {
    const formData = createFormData(data);
    const response = await fetch(`${API_BASE_URL}/employees`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create employee');
    }

    return response.json();
  },

  update: async (id: number, data: UpdateEmployeeInput): Promise<EmployeeWithBranch> => {
    const formData = createFormData(data);
    const response = await fetch(`${API_BASE_URL}/employees/${id}`, {
      method: 'PUT',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update employee');
    }

    return response.json();
  },

  delete: (id: number) => api.delete(`/employees/${id}`),

  getFileUrl: (filename: string) =>
    `${API_BASE_URL}/employees/files/${filename}`,
};
