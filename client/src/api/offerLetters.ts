import { api } from './client';
import type {
  OfferLetterWithSignatory,
  CreateOfferLetterInput,
  UpdateOfferLetterInput
} from '../types';

export const offerLettersApi = {
  getAll: async (): Promise<OfferLetterWithSignatory[]> => {
    return await api.get<OfferLetterWithSignatory[]>('/offer-letters');
  },

  getById: async (id: number): Promise<OfferLetterWithSignatory> => {
    return await api.get<OfferLetterWithSignatory>(`/offer-letters/${id}`);
  },

  create: async (data: CreateOfferLetterInput): Promise<OfferLetterWithSignatory> => {
    return await api.post<OfferLetterWithSignatory>('/offer-letters', data);
  },

  update: async (id: number, data: UpdateOfferLetterInput): Promise<OfferLetterWithSignatory> => {
    return await api.put<OfferLetterWithSignatory>(`/offer-letters/${id}`, data);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/offer-letters/${id}`);
  },

  generate: async (id: number): Promise<any> => {
    return await api.post<any>(`/offer-letters/${id}/generate`);
  }
};
