import { useState, useEffect } from 'react';
import { useSignatories } from '../hooks/useSignatories';
import type { CompanyLetterWithDetails, CreateCompanyLetterInput } from '../types';

interface CompanyLetterFormProps {
  letter?: CompanyLetterWithDetails | null;
  onSubmit: (data: CreateCompanyLetterInput) => Promise<void>;
  onCancel: () => void;
}

export default function CompanyLetterForm({ letter, onSubmit, onCancel }: CompanyLetterFormProps) {
  const { data: signatories } = useSignatories();

  const [formData, setFormData] = useState<CreateCompanyLetterInput>({
    letterNumber: '',
    recipientName: '',
    recipientAddress: '',
    recipientCity: '',
    recipientState: '',
    recipientPincode: '',
    subject: '',
    letterDate: new Date().toISOString().split('T')[0],
    greeting: 'Dear Sir/Madam',
    body: '',
    closing: 'Warm Regards',
    signatoryIds: [],
  });

  useEffect(() => {
    if (letter) {
      setFormData({
        letterNumber: letter.letterNumber || '',
        recipientName: letter.recipientName,
        recipientAddress: letter.recipientAddress,
        recipientCity: letter.recipientCity || '',
        recipientState: letter.recipientState || '',
        recipientPincode: letter.recipientPincode || '',
        subject: letter.subject,
        letterDate: letter.letterDate,
        greeting: letter.greeting,
        body: letter.body,
        closing: letter.closing,
        signatoryIds: letter.signatories?.map(s => s.id) || [],
      });
    }
  }, [letter]);

  const handleInputChange = (field: keyof CreateCompanyLetterInput, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
      <div className="flex items-center gap-4 mb-4">
        <button
          type="button"
          onClick={onCancel}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-2xl font-bold text-gray-900">
          {letter ? 'Edit Company Letter' : 'Create Company Letter'}
        </h2>
      </div>

      {/* Letter Information */}
      <div className="border-b pb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Letter Information</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Letter Number (Optional)
            </label>
            <input
              type="text"
              value={formData.letterNumber}
              onChange={(e) => handleInputChange('letterNumber', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., PSL/2024/001"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Letter Date *
            </label>
            <input
              type="date"
              value={formData.letterDate}
              onChange={(e) => handleInputChange('letterDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subject *
          </label>
          <input
            type="text"
            value={formData.subject}
            onChange={(e) => handleInputChange('subject', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Confirmation of Employment"
            required
          />
        </div>
      </div>

      {/* Recipient Information */}
      <div className="border-b pb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recipient Information</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recipient Name *
            </label>
            <input
              type="text"
              value={formData.recipientName}
              onChange={(e) => handleInputChange('recipientName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address *
            </label>
            <textarea
              value={formData.recipientAddress}
              onChange={(e) => handleInputChange('recipientAddress', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Street address, Building name, etc."
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <input
                type="text"
                value={formData.recipientCity}
                onChange={(e) => handleInputChange('recipientCity', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State
              </label>
              <input
                type="text"
                value={formData.recipientState}
                onChange={(e) => handleInputChange('recipientState', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pincode
              </label>
              <input
                type="text"
                value={formData.recipientPincode}
                onChange={(e) => handleInputChange('recipientPincode', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={6}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Letter Content */}
      <div className="border-b pb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Letter Content</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Greeting
            </label>
            <input
              type="text"
              value={formData.greeting}
              onChange={(e) => handleInputChange('greeting', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Dear Sir/Madam, Dear Mr. Smith"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Body *
            </label>
            <textarea
              value={formData.body}
              onChange={(e) => handleInputChange('body', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={12}
              placeholder="Enter the main content of the letter..."
              required
            />
            <p className="mt-1 text-sm text-gray-500">
              Tip: Use line breaks to separate paragraphs. The letter will be formatted automatically.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Closing
            </label>
            <input
              type="text"
              value={formData.closing}
              onChange={(e) => handleInputChange('closing', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Warm Regards, Sincerely, Best Regards"
            />
          </div>
        </div>
      </div>

      {/* Signatory Selection */}
      <div className="border-b pb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Signatory</h3>
        <p className="text-sm text-gray-500 mb-4">
          Select one or more signatories for this letter. Their signature, name, and position will appear on the PDF.
        </p>

        <div className="space-y-2">
          {signatories && signatories.length > 0 ? (
            signatories.map((signatory) => (
              <label key={signatory.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.signatoryIds?.includes(signatory.id) || false}
                  onChange={(e) => {
                    const currentIds = formData.signatoryIds || [];
                    if (e.target.checked) {
                      setFormData(prev => ({ ...prev, signatoryIds: [...currentIds, signatory.id] }));
                    } else {
                      setFormData(prev => ({ ...prev, signatoryIds: currentIds.filter(id => id !== signatory.id) }));
                    }
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{signatory.name}</div>
                  <div className="text-sm text-gray-500">{signatory.position}</div>
                </div>
                {signatory.signatureImage && (
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">Has Signature</span>
                )}
                {signatory.stampImage && (
                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">Has Stamp</span>
                )}
              </label>
            ))
          ) : (
            <p className="text-sm text-gray-500">No signatories available. Please create signatories first.</p>
          )}
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-4 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {letter ? 'Update' : 'Create'} Letter
        </button>
      </div>
    </form>
  );
}
