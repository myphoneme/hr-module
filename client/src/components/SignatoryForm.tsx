import { useState } from 'react';
import { useCreateSignatory, useUpdateSignatory } from '../hooks/useSignatories';
import type { Signatory } from '../types';
import { signatoriesApi } from '../api/signatories';

interface SignatoryFormProps {
  signatory: Signatory | null;
  onClose: () => void;
}

export function SignatoryForm({ signatory, onClose }: SignatoryFormProps) {
  const isEditing = !!signatory;
  const createSignatory = useCreateSignatory();
  const updateSignatory = useUpdateSignatory();

  const [formData, setFormData] = useState({
    name: signatory?.name || '',
    position: signatory?.position || '',
    email: signatory?.email || '',
    phone: signatory?.phone || '',
    department: signatory?.department || '',
    displayOrder: signatory?.displayOrder || 0,
  });

  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [stampFile, setStampFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(
    signatory?.signatureImage ? signatoriesApi.getSignatureUrl(signatory.signatureImage) : null
  );
  const [stampPreview, setStampPreview] = useState<string | null>(
    signatory?.stampImage ? signatoriesApi.getStampUrl(signatory.stampImage) : null
  );
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'signature' | 'stamp') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      setError('Only PNG, JPG, and JPEG images are allowed');
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('File size must be less than 2MB');
      return;
    }

    if (type === 'signature') {
      setSignatureFile(file);
      // Create image preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setSignaturePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setStampFile(file);
      // Create image preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setStampPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }

    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim() || !formData.position.trim()) {
      setError('Name and position are required');
      return;
    }

    try {
      const submitData = {
        name: formData.name.trim(),
        position: formData.position.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        department: formData.department.trim() || undefined,
        displayOrder: formData.displayOrder,
        signatureImage: signatureFile,
        stampImage: stampFile,
      };

      if (isEditing) {
        await updateSignatory.mutateAsync({
          id: signatory.id,
          data: submitData,
        });
      } else {
        await createSignatory.mutateAsync(submitData);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save signatory');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">
            {isEditing ? 'Edit Signatory' : 'Add Signatory'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="e.g., John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Position <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="position"
                value={formData.position}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="e.g., Manager-Human Resource"
              />
            </div>
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="john.doe@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <input
                type="text"
                name="department"
                value={formData.department}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="e.g., Human Resources"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Order
              </label>
              <input
                type="number"
                name="displayOrder"
                value={formData.displayOrder}
                onChange={handleChange}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="0"
              />
              <p className="mt-1 text-xs text-gray-500">
                Lower numbers appear first
              </p>
            </div>
          </div>

          {/* Signature Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Signature Image
            </label>
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={(e) => handleFileChange(e, 'signature')}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-medium
                    file:bg-orange-50 file:text-orange-700
                    hover:file:bg-orange-100
                    cursor-pointer"
                />
                <p className="mt-1 text-xs text-gray-500">
                  PNG, JPG up to 2MB
                </p>
              </div>
              {signaturePreview && (
                <div className="flex-shrink-0">
                  <img
                    src={signaturePreview}
                    alt="Signature preview"
                    className="h-24 w-40 object-contain border border-gray-200 rounded-lg p-2 bg-gray-50"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Stamp Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stamp/Seal Image
            </label>
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={(e) => handleFileChange(e, 'stamp')}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-medium
                    file:bg-orange-50 file:text-orange-700
                    hover:file:bg-orange-100
                    cursor-pointer"
                />
                <p className="mt-1 text-xs text-gray-500">
                  PNG, JPG up to 2MB
                </p>
              </div>
              {stampPreview && (
                <div className="flex-shrink-0">
                  <img
                    src={stampPreview}
                    alt="Stamp preview"
                    className="h-24 w-40 object-contain border border-gray-200 rounded-lg p-2 bg-gray-50"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createSignatory.isPending || updateSignatory.isPending}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {(createSignatory.isPending || updateSignatory.isPending) && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              {isEditing ? 'Update Signatory' : 'Create Signatory'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
