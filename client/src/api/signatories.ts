import { api } from './client';
import type { Signatory, CreateSignatoryInput, UpdateSignatoryInput } from '../types';
import { API_BASE_URL } from '../config/api';

// Helper to convert input to FormData for file uploads
const createFormData = (data: CreateSignatoryInput | UpdateSignatoryInput): FormData => {
  const formData = new FormData();

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (value instanceof File) {
        // Map field names: signatureImage -> signature, stampImage -> stamp
        if (key === 'signatureImage') {
          formData.append('signature', value);
        } else if (key === 'stampImage') {
          formData.append('stamp', value);
        }
      } else if (key !== 'signatureImage' && key !== 'stampImage') {
        formData.append(key, String(value));
      }
    }
  });

  return formData;
};

export const signatoriesApi = {
  getAll: () => api.get<Signatory[]>('/signatories'),

  getById: (id: number) => api.get<Signatory>(`/signatories/${id}`),

  create: async (data: CreateSignatoryInput): Promise<Signatory> => {
    const formData = createFormData(data);
    const response = await fetch(`${API_BASE_URL}/signatories`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create signatory');
    }

    return response.json();
  },

  update: async (id: number, data: UpdateSignatoryInput): Promise<Signatory> => {
    const formData = createFormData(data);
    const response = await fetch(`${API_BASE_URL}/signatories/${id}`, {
      method: 'PUT',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update signatory');
    }

    return response.json();
  },

  delete: (id: number) => api.delete(`/signatories/${id}`),

  getSignatureUrl: (filename: string) =>
    `${API_BASE_URL}/signatories/files/${filename}`,

  getStampUrl: (filename: string) =>
    `${API_BASE_URL}/signatories/files/${filename}`,
};
