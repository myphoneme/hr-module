import { api } from './client';
import type {
  CompanyLetterWithDetails,
  CreateCompanyLetterInput,
  UpdateCompanyLetterInput,
} from '../types';

// Transform snake_case response to camelCase
const transformLetter = (serverLetter: any): CompanyLetterWithDetails => ({
  id: serverLetter.id,
  letterNumber: serverLetter.letter_number,
  recipientName: serverLetter.recipient_name,
  recipientAddress: serverLetter.recipient_address,
  recipientCity: serverLetter.recipient_city,
  recipientState: serverLetter.recipient_state,
  recipientPincode: serverLetter.recipient_pincode,
  subject: serverLetter.subject,
  letterDate: serverLetter.letter_date,
  greeting: serverLetter.greeting,
  body: serverLetter.body,
  closing: serverLetter.closing,
  status: serverLetter.status,
  createdBy: serverLetter.created_by,
  isActive: serverLetter.isActive,
  createdAt: serverLetter.createdAt,
  updatedAt: serverLetter.updatedAt,
  creatorName: serverLetter.creator_name,
  creatorEmail: serverLetter.creator_email,
  signatories: serverLetter.signatories || [],
});

export const companyLettersApi = {
  getAll: async () => {
    const response = await api.get<any[]>('/company-letters');
    return response.map(transformLetter);
  },

  getById: async (id: number) => {
    const response = await api.get<any>(`/company-letters/${id}`);
    return transformLetter(response);
  },

  create: async (data: CreateCompanyLetterInput) => {
    // Transform camelCase to snake_case for server
    const serverData = {
      letter_number: data.letterNumber,
      recipient_name: data.recipientName,
      recipient_address: data.recipientAddress,
      recipient_city: data.recipientCity,
      recipient_state: data.recipientState,
      recipient_pincode: data.recipientPincode,
      subject: data.subject,
      letter_date: data.letterDate,
      greeting: data.greeting,
      body: data.body,
      closing: data.closing,
      signatory_ids: data.signatoryIds,
    };
    const response = await api.post<any>('/company-letters', serverData);
    return transformLetter(response);
  },

  update: async (id: number, data: UpdateCompanyLetterInput) => {
    // Transform camelCase to snake_case for server
    const serverData: any = {};
    if (data.letterNumber !== undefined) serverData.letter_number = data.letterNumber;
    if (data.recipientName !== undefined) serverData.recipient_name = data.recipientName;
    if (data.recipientAddress !== undefined) serverData.recipient_address = data.recipientAddress;
    if (data.recipientCity !== undefined) serverData.recipient_city = data.recipientCity;
    if (data.recipientState !== undefined) serverData.recipient_state = data.recipientState;
    if (data.recipientPincode !== undefined) serverData.recipient_pincode = data.recipientPincode;
    if (data.subject !== undefined) serverData.subject = data.subject;
    if (data.letterDate !== undefined) serverData.letter_date = data.letterDate;
    if (data.greeting !== undefined) serverData.greeting = data.greeting;
    if (data.body !== undefined) serverData.body = data.body;
    if (data.closing !== undefined) serverData.closing = data.closing;
    if (data.status !== undefined) serverData.status = data.status;
    if (data.isActive !== undefined) serverData.isActive = data.isActive;
    if (data.signatoryIds !== undefined) serverData.signatory_ids = data.signatoryIds;

    const response = await api.put<any>(`/company-letters/${id}`, serverData);
    return transformLetter(response);
  },

  delete: (id: number) => api.delete(`/company-letters/${id}`),

  addSignatory: (letterId: number, signatoryId: number, order: number) =>
    api.post(`/company-letters/${letterId}/signatories`, { signatoryId, order }),

  removeSignatory: (letterId: number, signatoryId: number) =>
    api.delete(`/company-letters/${letterId}/signatories/${signatoryId}`),
};
