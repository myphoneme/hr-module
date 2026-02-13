import { useState, useEffect } from 'react';
import { useCandidate } from '../../hooks/useRecruitment';
import { useSignatories } from '../../hooks/useSignatories';
import { useOfferLetters } from '../../hooks/useOfferLetters';
import { useRAG } from '../../hooks/useRAG';
import type { Signatory, SalaryComponent, RAGDocument } from '../../types';

interface OfferLetterModalProps {
  candidateId: number;
  onClose: () => void;
  onSuccess?: () => void;
}

// Standard salary breakdown percentages
const DEFAULT_SALARY_STRUCTURE = {
  basic: 40,
  hra: 20,
  special_allowance: 25,
  pf_employer: 12,
  medical: 3,
};

function calculateSalaryBreakdown(annualCTC: number): SalaryComponent[] {
  const breakdown: SalaryComponent[] = [];

  const basic = Math.round(annualCTC * (DEFAULT_SALARY_STRUCTURE.basic / 100));
  const hra = Math.round(annualCTC * (DEFAULT_SALARY_STRUCTURE.hra / 100));
  const specialAllowance = Math.round(annualCTC * (DEFAULT_SALARY_STRUCTURE.special_allowance / 100));
  const pfEmployer = Math.round(annualCTC * (DEFAULT_SALARY_STRUCTURE.pf_employer / 100));
  const medical = Math.round(annualCTC * (DEFAULT_SALARY_STRUCTURE.medical / 100));

  breakdown.push({ component: 'Basic Salary', perMonth: Math.round(basic / 12), annual: basic });
  breakdown.push({ component: 'House Rent Allowance (HRA)', perMonth: Math.round(hra / 12), annual: hra });
  breakdown.push({ component: 'Special Allowance', perMonth: Math.round(specialAllowance / 12), annual: specialAllowance });
  breakdown.push({ component: 'Employer PF Contribution', perMonth: Math.round(pfEmployer / 12), annual: pfEmployer });
  breakdown.push({ component: 'Medical Allowance', perMonth: Math.round(medical / 12), annual: medical });

  return breakdown;
}

export default function OfferLetterModal({ candidateId, onClose, onSuccess }: OfferLetterModalProps) {
  const { data: candidate, isLoading: candidateLoading } = useCandidate(candidateId);
  const { data: signatories } = useSignatories();
  const { createOfferLetter, isCreating } = useOfferLetters();
  const { documents } = useRAG();

  const [step, setStep] = useState<'form' | 'preview' | 'success'>('form');
  const [error, setError] = useState<string | null>(null);
  const [salaryBreakdown, setSalaryBreakdown] = useState<SalaryComponent[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    designation: '',
    joining_date: '',
    annual_ctc: 0,
    working_location: '',
    offer_valid_till: '',
    signatory_id: '',
    template_type: 'long' as 'long' | 'short',
  });

  // Pre-fill form when candidate data is available
  useEffect(() => {
    if (candidate) {
      // Get working location from vacancy/JD or use default company location
      const workingLocation = (candidate as any).vacancy_location ||
        (candidate as any).jd_location ||
        'Phoneme Solutions Pvt Ltd, Advant Navis Business Park, B-614 Sector 142, Noida-201307';

      setFormData(prev => ({
        ...prev,
        designation: candidate.vacancy_title || candidate.current_designation || '',
        annual_ctc: candidate.expected_salary || candidate.current_salary || 0,
        working_location: workingLocation,
        joining_date: getDefaultJoiningDate(),
        offer_valid_till: getDefaultValidTill(),
      }));
    }
  }, [candidate]);

  // Calculate salary breakdown when CTC changes
  useEffect(() => {
    if (formData.annual_ctc > 0) {
      setSalaryBreakdown(calculateSalaryBreakdown(formData.annual_ctc));
    }
  }, [formData.annual_ctc]);

  const getDefaultJoiningDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0];
  };

  const getDefaultValidTill = () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  };

  const handlePreview = () => {
    if (!candidate) return;
    setError(null);
    setStep('preview');
  };

  const handleSaveOfferLetter = async () => {
    if (!candidate) return;

    try {
      const selectedSignatory = signatories?.find((s: Signatory) => s.id === Number(formData.signatory_id));

      // Build address from candidate data
      const addressParts = [
        candidate.address,
        candidate.city,
        candidate.state,
        candidate.pincode
      ].filter(Boolean);
      const fullAddress = addressParts.join(', ') || 'Address not provided';

      await createOfferLetter({
        candidate_name: `${candidate.first_name} ${candidate.last_name || ''}`.trim(),
        candidate_address: fullAddress,
        designation: formData.designation,
        joining_date: formData.joining_date,
        letter_date: new Date().toISOString().split('T')[0],
        annual_ctc: formData.annual_ctc,
        offer_valid_till: formData.offer_valid_till,
        working_location: formData.working_location,
        hr_manager_name: selectedSignatory?.name || '',
        hr_manager_title: selectedSignatory?.position || '',
        template_type: formData.template_type,
        salary_breakdown: salaryBreakdown,
      });

      setStep('success');
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Failed to save offer letter');
    }
  };

  const processedDocsCount = documents.filter((d: RAGDocument) => d.status === 'completed').length;

  if (candidateLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading candidate details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Generate Offer Letter
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              For {candidate?.first_name} {candidate?.last_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* RAG Status */}
          {processedDocsCount > 0 && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-700 dark:text-blue-300 text-sm">
              {processedDocsCount} training document(s) available for reference.
            </div>
          )}

          {step === 'form' && (
            <div className="space-y-6">
              {/* Candidate Info */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">Candidate Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Name:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">{candidate?.first_name} {candidate?.last_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Email:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">{candidate?.email}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Phone:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">{candidate?.phone || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Experience:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">{candidate?.experience_years || 0} years</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Current Salary:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">
                      {candidate?.current_salary ? `₹${candidate.current_salary.toLocaleString()}` : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Expected Salary:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">
                      {candidate?.expected_salary ? `₹${candidate.expected_salary.toLocaleString()}` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Offer Details Form */}
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">Offer Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Designation *
                    </label>
                    <input
                      type="text"
                      value={formData.designation}
                      onChange={(e) => setFormData(prev => ({ ...prev, designation: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g., Senior Software Engineer"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Annual CTC (₹) *
                    </label>
                    <input
                      type="number"
                      value={formData.annual_ctc}
                      onChange={(e) => setFormData(prev => ({ ...prev, annual_ctc: Number(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g., 1200000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Joining Date *
                    </label>
                    <input
                      type="date"
                      value={formData.joining_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, joining_date: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Offer Valid Till *
                    </label>
                    <input
                      type="date"
                      value={formData.offer_valid_till}
                      onChange={(e) => setFormData(prev => ({ ...prev, offer_valid_till: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Signatory
                    </label>
                    <select
                      value={formData.signatory_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, signatory_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Select signatory...</option>
                      {signatories?.map((s: Signatory) => (
                        <option key={s.id} value={s.id}>{s.name} - {s.position}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Template Type
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="template_type"
                          value="long"
                          checked={formData.template_type === 'long'}
                          onChange={() => setFormData(prev => ({ ...prev, template_type: 'long' }))}
                          className="mr-2"
                        />
                        <span className="text-gray-700 dark:text-gray-300">Long Form (Detailed)</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="template_type"
                          value="short"
                          checked={formData.template_type === 'short'}
                          onChange={() => setFormData(prev => ({ ...prev, template_type: 'short' }))}
                          className="mr-2"
                        />
                        <span className="text-gray-700 dark:text-gray-300">Short Form (Concise)</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-6">
              {/* Offer Summary */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">Offer Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Candidate:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">{candidate?.first_name} {candidate?.last_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Designation:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">{formData.designation}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Annual CTC:</span>
                    <span className="ml-2 text-gray-900 dark:text-white font-semibold">₹{formData.annual_ctc.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Joining Date:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">{formData.joining_date}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Valid Till:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">{formData.offer_valid_till}</span>
                  </div>
                </div>
              </div>

              {/* Salary Breakdown */}
              {salaryBreakdown.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-3">Salary Breakdown</h3>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500">
                          <th className="pb-2">Component</th>
                          <th className="pb-2 text-right">Monthly (₹)</th>
                          <th className="pb-2 text-right">Annual (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {salaryBreakdown.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-2 text-gray-900 dark:text-white">{item.component}</td>
                            <td className="py-2 text-right text-gray-900 dark:text-white">
                              {item.perMonth.toLocaleString('en-IN')}
                            </td>
                            <td className="py-2 text-right text-gray-900 dark:text-white">
                              {item.annual.toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                        <tr className="font-semibold border-t-2 border-gray-300 dark:border-gray-600">
                          <td className="pt-3 text-gray-900 dark:text-white">Total CTC</td>
                          <td className="pt-3 text-right text-gray-900 dark:text-white">
                            {Math.round(formData.annual_ctc / 12).toLocaleString('en-IN')}
                          </td>
                          <td className="pt-3 text-right text-gray-900 dark:text-white">
                            {formData.annual_ctc.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Offer Letter Created!
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-center">
                The offer letter has been saved and can be viewed/downloaded in HR Docs.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          {step === 'form' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handlePreview}
                disabled={!formData.designation || !formData.annual_ctc || !formData.joining_date}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <span>Preview Offer</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={() => setStep('form')}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Back to Edit
              </button>
              <button
                onClick={handleSaveOfferLetter}
                disabled={isCreating}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? 'Creating...' : 'Create Offer Letter'}
              </button>
            </>
          )}

          {step === 'success' && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
