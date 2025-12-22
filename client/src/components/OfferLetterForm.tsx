import { useState, useEffect } from 'react';
import { useSignatories } from '../hooks/useSignatories';
import type { OfferLetterWithSignatory, CreateOfferLetterInput, SalaryComponent } from '../types';

interface OfferLetterFormProps {
  offerLetter?: OfferLetterWithSignatory | null;
  onSubmit: (data: CreateOfferLetterInput) => Promise<void>;
  onCancel: () => void;
}

export default function OfferLetterForm({ offerLetter, onSubmit, onCancel }: OfferLetterFormProps) {
  const { data: signatories } = useSignatories();

  const [formData, setFormData] = useState<CreateOfferLetterInput>({
    candidate_name: '',
    candidate_address: '',
    designation: '',
    joining_date: '',
    annual_ctc: 0,
    salary_breakdown: [
      { component: 'Basic', perMonth: 0, annual: 0 },
      { component: 'HRA', perMonth: 0, annual: 0 },
      { component: 'Travel Allowance', perMonth: 0, annual: 0 },
      { component: 'Mobile Reimbursement', perMonth: 0, annual: 0 },
      { component: 'Special Allowance', perMonth: 0, annual: 0 },
    ],
    working_location: 'Phoneme Solutions Pvt Ltd, Advant Navis Business Park, B-614 Sector 142, Noida-201307',
    hr_manager_name: 'Deepika',
    hr_manager_title: 'Manager-Human Resource',
    offer_valid_till: '',
    letter_date: '',
    template_type: 'long',
    optional_sections: [],
    kra_details: [],
    joining_bonus: undefined,
    signatory_id: undefined,
    secondary_signatory_id: undefined,
  });

  useEffect(() => {
    if (offerLetter) {
      const salaryBreakdown = JSON.parse(offerLetter.salary_breakdown) as SalaryComponent[];
      const optionalSections = offerLetter.optional_sections ? JSON.parse(offerLetter.optional_sections) : [];
      const kraDetails = offerLetter.kra_details ? JSON.parse(offerLetter.kra_details) : [];

      setFormData({
        candidate_name: offerLetter.candidate_name,
        candidate_address: offerLetter.candidate_address,
        designation: offerLetter.designation,
        joining_date: offerLetter.joining_date,
        annual_ctc: offerLetter.annual_ctc,
        salary_breakdown: salaryBreakdown,
        working_location: offerLetter.working_location,
        hr_manager_name: offerLetter.hr_manager_name,
        hr_manager_title: offerLetter.hr_manager_title,
        offer_valid_till: offerLetter.offer_valid_till,
        letter_date: offerLetter.letter_date,
        template_type: offerLetter.template_type,
        optional_sections: optionalSections,
        kra_details: kraDetails,
        joining_bonus: offerLetter.joining_bonus,
        signatory_id: offerLetter.signatory_id,
        secondary_signatory_id: offerLetter.secondary_signatory_id,
      });
    }
  }, [offerLetter]);

  // Auto-detect template type based on designation
  useEffect(() => {
    const designation = formData.designation.toLowerCase();

    // Don't auto-change if editing existing letter
    if (offerLetter) return;

    // Detect internship
    if (designation.includes('intern')) {
      if (formData.template_type !== 'internship') {
        setFormData(prev => ({ ...prev, template_type: 'internship', optional_sections: [] }));
      }
    }
    // Detect trainee/junior - use short form
    else if (designation.includes('trainee') || designation.includes('junior')) {
      if (formData.template_type !== 'short') {
        setFormData(prev => ({ ...prev, template_type: 'short', optional_sections: [] }));
      }
    }
    // Regular positions - use long form
    else {
      if (formData.template_type === 'short' || formData.template_type === 'internship') {
        setFormData(prev => ({ ...prev, template_type: 'long' }));
      }
    }
  }, [formData.designation, offerLetter]);

  const handleInputChange = (field: keyof CreateOfferLetterInput, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSalaryComponentChange = (index: number, field: keyof SalaryComponent, value: number) => {
    const newBreakdown = [...formData.salary_breakdown];
    newBreakdown[index] = {
      ...newBreakdown[index],
      [field]: value,
    };

    // If perMonth changes, auto-calculate annual
    if (field === 'perMonth') {
      newBreakdown[index].annual = value * 12;
    }
    // If annual changes, auto-calculate perMonth
    else if (field === 'annual') {
      newBreakdown[index].perMonth = value / 12;
    }

    setFormData(prev => ({ ...prev, salary_breakdown: newBreakdown }));
  };

  const addSalaryComponent = () => {
    setFormData(prev => ({
      ...prev,
      salary_breakdown: [...prev.salary_breakdown, { component: '', perMonth: 0, annual: 0 }],
    }));
  };

  const removeSalaryComponent = (index: number) => {
    setFormData(prev => ({
      ...prev,
      salary_breakdown: prev.salary_breakdown.filter((_, i) => i !== index),
    }));
  };

  const calculateTotalCTC = () => {
    return formData.salary_breakdown.reduce((sum, item) => sum + item.annual, 0);
  };

  const handleOptionalSectionToggle = (section: string) => {
    const currentSections = formData.optional_sections || [];
    const newSections = currentSections.includes(section)
      ? currentSections.filter(s => s !== section)
      : [...currentSections, section];
    setFormData(prev => ({ ...prev, optional_sections: newSections }));
  };

  const addKRADetail = () => {
    const currentKRA = formData.kra_details || [];
    setFormData(prev => ({
      ...prev,
      kra_details: [...currentKRA, { responsibility: '' }]
    }));
  };

  const updateKRADetail = (index: number, value: string) => {
    const currentKRA = formData.kra_details || [];
    const newKRA = [...currentKRA];
    newKRA[index] = { responsibility: value };
    setFormData(prev => ({ ...prev, kra_details: newKRA }));
  };

  const removeKRADetail = (index: number) => {
    const currentKRA = formData.kra_details || [];
    setFormData(prev => ({
      ...prev,
      kra_details: currentKRA.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Auto-calculate total CTC from breakdown
    const totalCTC = calculateTotalCTC();

    await onSubmit({
      ...formData,
      annual_ctc: totalCTC,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
      <h2 className="text-2xl font-bold text-gray-900">
        {offerLetter ? 'Edit Offer Letter' : 'Create Offer Letter'}
      </h2>

      {/* Candidate Information */}
      <div className="border-b pb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Candidate Information</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Candidate Name *
            </label>
            <input
              type="text"
              value={formData.candidate_name}
              onChange={(e) => handleInputChange('candidate_name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address *
            </label>
            <textarea
              value={formData.candidate_address}
              onChange={(e) => handleInputChange('candidate_address', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Designation *
            </label>
            <input
              type="text"
              value={formData.designation}
              onChange={(e) => handleInputChange('designation', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Trainee - PHP Developer"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Joining Date *
            </label>
            <input
              type="date"
              value={formData.joining_date}
              onChange={(e) => handleInputChange('joining_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>
      </div>

      {/* Salary Breakdown */}
      <div className="border-b pb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Salary Breakdown (Annexure A)</h3>

        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-4 font-semibold text-sm text-gray-700">
            <div>Component</div>
            <div>Per Month (₹)</div>
            <div>Annual (₹)</div>
            <div>Action</div>
          </div>

          {formData.salary_breakdown.map((component, index) => (
            <div key={index} className="grid grid-cols-4 gap-4 items-center">
              <input
                type="text"
                value={component.component}
                onChange={(e) => {
                  const newBreakdown = [...formData.salary_breakdown];
                  newBreakdown[index].component = e.target.value;
                  setFormData(prev => ({ ...prev, salary_breakdown: newBreakdown }));
                }}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Component name"
                required
              />
              <input
                type="number"
                value={component.perMonth}
                onChange={(e) => handleSalaryComponentChange(index, 'perMonth', parseFloat(e.target.value) || 0)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.01"
                required
              />
              <input
                type="number"
                value={component.annual}
                onChange={(e) => handleSalaryComponentChange(index, 'annual', parseFloat(e.target.value) || 0)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.01"
                required
              />
              <button
                type="button"
                onClick={() => removeSalaryComponent(index)}
                className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                disabled={formData.salary_breakdown.length === 1}
              >
                Remove
              </button>
            </div>
          ))}

          <div className="grid grid-cols-4 gap-4 font-bold text-gray-900 border-t pt-3">
            <div>Total</div>
            <div>₹ {formData.salary_breakdown.reduce((sum, item) => sum + item.perMonth, 0).toLocaleString('en-IN')}</div>
            <div>₹ {calculateTotalCTC().toLocaleString('en-IN')}</div>
            <div></div>
          </div>

          <button
            type="button"
            onClick={addSalaryComponent}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            Add Component
          </button>
        </div>
      </div>

      {/* HR Information */}
      <div className="border-b pb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">HR Manager Information</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              HR Manager Name *
            </label>
            <input
              type="text"
              value={formData.hr_manager_name}
              onChange={(e) => handleInputChange('hr_manager_name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              HR Manager Title
            </label>
            <input
              type="text"
              value={formData.hr_manager_title}
              onChange={(e) => handleInputChange('hr_manager_title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Letter Signatory (Optional)
          </label>
          <select
            value={formData.signatory_id || ''}
            onChange={(e) => handleInputChange('signatory_id', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- No Signatory (Use HR Manager) --</option>
            {signatories?.map((signatory) => (
              <option key={signatory.id} value={signatory.id}>
                {signatory.name} - {signatory.position}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Select a signatory to display their signature and stamp in the PDF. If not selected, HR Manager name will be used.
          </p>
        </div>
      </div>

      {/* Dates */}
      <div className="border-b pb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Offer Letter Dates</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Letter Date *
            </label>
            <input
              type="date"
              value={formData.letter_date}
              onChange={(e) => handleInputChange('letter_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Offer Valid Till *
            </label>
            <input
              type="date"
              value={formData.offer_valid_till}
              onChange={(e) => handleInputChange('offer_valid_till', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>
      </div>

      {/* Template Selection */}
      <div className="border-b pb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Template Configuration</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template Type *
            </label>
            <select
              value={formData.template_type}
              onChange={(e) => handleInputChange('template_type', e.target.value as 'short' | 'long' | 'internship' | 'extension')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="short">Short Form (4 pages - Trainee/Junior roles)</option>
              <option value="long">Long Form (12-16 pages - Regular/Senior roles)</option>
              <option value="internship">Internship Letter (2-3 pages - Internship positions)</option>
              <option value="extension">Contract Extension (2-3 pages - Contract renewals)</option>
            </select>
            <p className="mt-1 text-sm text-gray-500">
              Auto-detected based on designation. Trainee/Intern → Internship, Others → Long Form
            </p>
          </div>

          {/* Optional Sections - Only for Long Form */}
          {formData.template_type === 'long' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Optional Sections (Long Form Only)
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.optional_sections?.includes('joiningBonus')}
                    onChange={() => handleOptionalSectionToggle('joiningBonus')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Include Joining Bonus clause</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.optional_sections?.includes('deputation')}
                    onChange={() => handleOptionalSectionToggle('deputation')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Include On Deputation terms (90-day notice)</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.optional_sections?.includes('annexureB')}
                    onChange={() => handleOptionalSectionToggle('annexureB')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Include Annexure B (Key Responsibility Areas)</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.optional_sections?.includes('extendedIP')}
                    onChange={() => handleOptionalSectionToggle('extendedIP')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Include Extended IP/Moral Rights clauses</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.optional_sections?.includes('personalData')}
                    onChange={() => handleOptionalSectionToggle('personalData')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Include Personal Data clause</span>
                </label>
              </div>
            </div>
          )}

          {/* Joining Bonus Field */}
          {formData.optional_sections?.includes('joiningBonus') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Joining Bonus Amount (₹)
              </label>
              <input
                type="number"
                value={formData.joining_bonus || ''}
                onChange={(e) => handleInputChange('joining_bonus', parseFloat(e.target.value) || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.01"
                placeholder="Enter joining bonus amount"
              />
            </div>
          )}
        </div>
      </div>

      {/* KRA Details - Only if Annexure B is checked */}
      {formData.optional_sections?.includes('annexureB') && (
        <div className="border-b pb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Responsibility Areas (Annexure B)</h3>

          <div className="space-y-3">
            {formData.kra_details && formData.kra_details.length > 0 ? (
              formData.kra_details.map((kra, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={kra.responsibility}
                    onChange={(e) => updateKRADetail(index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Responsibility ${index + 1}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => removeKRADetail(index)}
                    className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No KRA details added yet. Click "Add KRA" to start.</p>
            )}

            <button
              type="button"
              onClick={addKRADetail}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              Add KRA
            </button>
          </div>
        </div>
      )}

      {/* Secondary Signatory - displays on last page after annexures */}
      <div className="border-b pb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Secondary Signatory (Last Page)</h3>
        <p className="text-sm text-gray-600 mb-4">
          This signatory will appear on the right side of the last page after all annexures, with their signature, name, position, and stamp.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Secondary Signatory (Optional)
          </label>
          <select
            value={formData.secondary_signatory_id || ''}
            onChange={(e) => handleInputChange('secondary_signatory_id', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- No Secondary Signatory --</option>
            {signatories?.map((signatory) => (
              <option key={signatory.id} value={signatory.id}>
                {signatory.name} - {signatory.position}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            If selected, this signatory's signature, name, position, and stamp will appear on the last page of the offer letter.
          </p>
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
          {offerLetter ? 'Update' : 'Create'} Offer Letter
        </button>
      </div>
    </form>
  );
}
