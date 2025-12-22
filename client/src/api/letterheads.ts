const API_BASE_URL = 'http://localhost:3001/api';

export interface Letterhead {
  id: number;
  name: string;
  description: string | null;
  header_image: string | null;
  footer_image: string | null;
  logo_image: string | null;
  company_name: string | null;
  company_address: string | null;
  company_contact: string | null;
  company_email: string | null;
  company_website: string | null;
  company_cin: string | null;
  company_gstin: string | null;
  is_default: boolean;
  uploaded_by: number;
  uploader_name?: string;
  uploader_email?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LetterheadWithImages extends Letterhead {
  header_image_base64: string | null;
  footer_image_base64: string | null;
  logo_image_base64: string | null;
}

export interface CreateLetterheadInput {
  name: string;
  description?: string;
  company_name?: string;
  company_address?: string;
  company_contact?: string;
  company_email?: string;
  company_website?: string;
  company_cin?: string;
  company_gstin?: string;
  is_default?: boolean;
  header_image?: File;
  footer_image?: File;
  logo_image?: File;
}

export interface UpdateLetterheadInput extends Partial<CreateLetterheadInput> {}

// Helper for handling responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

// Get all letterheads
export async function getLetterheads(): Promise<Letterhead[]> {
  const response = await fetch(`${API_BASE_URL}/letterheads`, {
    credentials: 'include',
  });
  return handleResponse<Letterhead[]>(response);
}

// Get single letterhead
export async function getLetterhead(id: number): Promise<Letterhead> {
  const response = await fetch(`${API_BASE_URL}/letterheads/${id}`, {
    credentials: 'include',
  });
  return handleResponse<Letterhead>(response);
}

// Get letterhead with images as base64 (for PDF generation)
export async function getLetterheadWithImages(id: number): Promise<LetterheadWithImages> {
  const response = await fetch(`${API_BASE_URL}/letterheads/${id}/with-images`, {
    credentials: 'include',
  });
  return handleResponse<LetterheadWithImages>(response);
}

// Get default letterhead with images
export async function getDefaultLetterhead(): Promise<LetterheadWithImages | null> {
  const response = await fetch(`${API_BASE_URL}/letterheads/default/active`, {
    credentials: 'include',
  });
  return handleResponse<LetterheadWithImages | null>(response);
}

// Create letterhead
export async function createLetterhead(input: CreateLetterheadInput): Promise<Letterhead> {
  const formData = new FormData();

  formData.append('name', input.name);
  if (input.description) formData.append('description', input.description);
  if (input.company_name) formData.append('company_name', input.company_name);
  if (input.company_address) formData.append('company_address', input.company_address);
  if (input.company_contact) formData.append('company_contact', input.company_contact);
  if (input.company_email) formData.append('company_email', input.company_email);
  if (input.company_website) formData.append('company_website', input.company_website);
  if (input.company_cin) formData.append('company_cin', input.company_cin);
  if (input.company_gstin) formData.append('company_gstin', input.company_gstin);
  if (input.is_default !== undefined) formData.append('is_default', String(input.is_default));

  if (input.header_image) formData.append('header_image', input.header_image);
  if (input.footer_image) formData.append('footer_image', input.footer_image);
  if (input.logo_image) formData.append('logo_image', input.logo_image);

  const response = await fetch(`${API_BASE_URL}/letterheads`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  return handleResponse<Letterhead>(response);
}

// Update letterhead
export async function updateLetterhead(id: number, input: UpdateLetterheadInput): Promise<Letterhead> {
  const formData = new FormData();

  if (input.name) formData.append('name', input.name);
  if (input.description !== undefined) formData.append('description', input.description || '');
  if (input.company_name !== undefined) formData.append('company_name', input.company_name || '');
  if (input.company_address !== undefined) formData.append('company_address', input.company_address || '');
  if (input.company_contact !== undefined) formData.append('company_contact', input.company_contact || '');
  if (input.company_email !== undefined) formData.append('company_email', input.company_email || '');
  if (input.company_website !== undefined) formData.append('company_website', input.company_website || '');
  if (input.company_cin !== undefined) formData.append('company_cin', input.company_cin || '');
  if (input.company_gstin !== undefined) formData.append('company_gstin', input.company_gstin || '');
  if (input.is_default !== undefined) formData.append('is_default', String(input.is_default));

  if (input.header_image) formData.append('header_image', input.header_image);
  if (input.footer_image) formData.append('footer_image', input.footer_image);
  if (input.logo_image) formData.append('logo_image', input.logo_image);

  const response = await fetch(`${API_BASE_URL}/letterheads/${id}`, {
    method: 'PUT',
    credentials: 'include',
    body: formData,
  });
  return handleResponse<Letterhead>(response);
}

// Delete letterhead
export async function deleteLetterhead(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/letterheads/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }
}

// Set as default
export async function setDefaultLetterhead(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/letterheads/${id}/set-default`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }
}
