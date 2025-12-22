import { useState } from 'react';
import { useSignatories } from '../hooks/useSignatories';
import type { CreateOfferLetterInput, SalaryComponent, Signatory } from '../types';

interface ExtractedOfferLetterData {
  candidate_name: string;
  candidate_address: string;
  designation: string;
  joining_date: string;
  annual_ctc: number;
  salary_breakdown: SalaryComponent[];
  working_location: string;
  hr_manager_name: string;
  hr_manager_title: string;
  offer_valid_till: string;
  letter_date: string;
  template_type: 'short' | 'long' | 'internship' | 'extension';
  signatory_id?: number;
  secondary_signatory_id?: number;
}

interface UploadOfferLetterExtractorProps {
  onExtracted: (data: CreateOfferLetterInput) => void;
  onCancel: () => void;
}

export default function UploadOfferLetterExtractor({ onExtracted, onCancel }: UploadOfferLetterExtractorProps) {
  const { data: signatories } = useSignatories();
  const [dragOver, setDragOver] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedOfferLetterData | null>(null);
  const [step, setStep] = useState<'upload' | 'review'>('upload');

  // Get HR and Director signatories
  const hrSignatory = signatories?.find((s: Signatory) =>
    s.position.toLowerCase().includes('hr') ||
    s.position.toLowerCase().includes('human resource')
  );
  const directorSignatory = signatories?.find((s: Signatory) =>
    s.position.toLowerCase().includes('director') ||
    s.position.toLowerCase().includes('ceo') ||
    s.position.toLowerCase().includes('managing')
  );

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }

    setError(null);
    setIsExtracting(true);

    try {
      const formData = new FormData();
      formData.append('document', file);

      const response = await fetch('http://localhost:3001/api/rag/extract-offer-letter', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to extract offer letter details');
      }

      const data = await response.json();

      // Set default signatories if found
      const extracted: ExtractedOfferLetterData = {
        candidate_name: data.candidate_name || '',
        candidate_address: data.candidate_address || '',
        designation: data.designation || '',
        joining_date: data.joining_date || '',
        annual_ctc: data.annual_ctc || 0,
        salary_breakdown: data.salary_breakdown || [
          { component: 'Basic Salary', perMonth: 0, annual: 0 },
          { component: 'HRA', perMonth: 0, annual: 0 },
          { component: 'Special Allowance', perMonth: 0, annual: 0 },
          { component: 'Other Allowances', perMonth: 0, annual: 0 },
        ],
        working_location: data.working_location || 'Phoneme Solutions Pvt Ltd, Advant Navis Business Park, B-614 Sector 142, Noida-201307',
        hr_manager_name: data.hr_manager_name || 'Deepika',
        hr_manager_title: data.hr_manager_title || 'Manager-Human Resource',
        offer_valid_till: data.offer_valid_till || '',
        letter_date: data.letter_date || new Date().toISOString().split('T')[0],
        template_type: data.template_type || 'short',
        signatory_id: hrSignatory?.id,
        secondary_signatory_id: directorSignatory?.id,
      };

      setExtractedData(extracted);
      setStep('review');
    } catch (err: any) {
      setError(err.message || 'Failed to extract offer letter');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const updateField = (field: keyof ExtractedOfferLetterData, value: any) => {
    if (!extractedData) return;
    setExtractedData({ ...extractedData, [field]: value });
  };

  const updateSalaryComponent = (index: number, field: keyof SalaryComponent, value: string | number) => {
    if (!extractedData) return;
    const newBreakdown = [...extractedData.salary_breakdown];

    if (field === 'component') {
      newBreakdown[index] = { ...newBreakdown[index], component: value as string };
    } else if (field === 'perMonth') {
      const perMonth = value as number;
      newBreakdown[index] = { ...newBreakdown[index], perMonth, annual: perMonth * 12 };
    } else if (field === 'annual') {
      const annual = value as number;
      newBreakdown[index] = { ...newBreakdown[index], annual, perMonth: annual / 12 };
    }

    const totalAnnual = newBreakdown.reduce((sum, item) => sum + (item.annual || 0), 0);
    setExtractedData({ ...extractedData, salary_breakdown: newBreakdown, annual_ctc: totalAnnual });
  };

  const addSalaryComponent = () => {
    if (!extractedData) return;
    const newBreakdown = [...extractedData.salary_breakdown, { component: 'New Component', perMonth: 0, annual: 0 }];
    setExtractedData({ ...extractedData, salary_breakdown: newBreakdown });
  };

  const removeSalaryComponent = (index: number) => {
    if (!extractedData) return;
    const newBreakdown = extractedData.salary_breakdown.filter((_, i) => i !== index);
    const totalAnnual = newBreakdown.reduce((sum, item) => sum + (item.annual || 0), 0);
    setExtractedData({ ...extractedData, salary_breakdown: newBreakdown, annual_ctc: totalAnnual });
  };

  const handleSubmit = () => {
    if (!extractedData) return;

    // Validate required fields
    if (!extractedData.candidate_name) {
      setError('Candidate name is required');
      return;
    }
    if (!extractedData.candidate_address) {
      setError('Candidate address is required. Please enter the address.');
      return;
    }
    if (!extractedData.designation) {
      setError('Designation is required');
      return;
    }
    if (!extractedData.joining_date) {
      setError('Joining date is required');
      return;
    }

    // Validate signatories - both HR and Director are mandatory
    if (!extractedData.signatory_id) {
      setError('HR signatory is mandatory. Please select an HR signatory.');
      return;
    }
    if (!extractedData.secondary_signatory_id) {
      setError('Director signatory is mandatory. Please select a Director signatory.');
      return;
    }

    onExtracted(extractedData as CreateOfferLetterInput);
  };

  // Upload Step
  if (step === 'upload') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Upload Existing Offer Letter</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Extract details from an existing offer letter PDF</p>
            </div>
          </div>

          <div
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
              dragOver
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-orange-400 dark:hover:border-orange-500 bg-white dark:bg-gray-800'
            } ${isExtracting ? 'opacity-50 pointer-events-none' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {isExtracting ? (
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-orange-200 dark:border-orange-800 rounded-full"></div>
                  <div className="absolute top-0 left-0 w-20 h-20 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="mt-6 text-lg font-medium text-gray-900 dark:text-white">Extracting Details...</p>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  AI is analyzing the offer letter to extract candidate details
                </p>
              </div>
            ) : (
              <>
                <div className="w-20 h-20 mx-auto bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6">
                  <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Upload Offer Letter PDF
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Drop an existing offer letter here to extract and edit details
                </p>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="hidden"
                  id="offer-letter-upload"
                />
                <label
                  htmlFor="offer-letter-upload"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg cursor-pointer transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Select Offer Letter PDF
                </label>
              </>
            )}
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">What this does:</h4>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>- Extracts candidate name and address from the letter</li>
              <li>- Identifies designation, joining date, and salary details</li>
              <li>- Parses CTC breakdown and allowances</li>
              <li>- Allows you to review and edit before creating new offer letter</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Review Step
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setStep('upload')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Review Extracted Details</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Verify and edit the extracted information</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-sm font-medium">
              Extracted Successfully
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Candidate Info */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Candidate Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Candidate Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={extractedData?.candidate_name || ''}
                    onChange={(e) => updateField('candidate_name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Candidate Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={extractedData?.candidate_address || ''}
                    onChange={(e) => updateField('candidate_address', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                    placeholder="Enter candidate's full address"
                    required
                  />
                  {!extractedData?.candidate_address && (
                    <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                      Address is required. Please enter the candidate's address.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Designation <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={extractedData?.designation || ''}
                    onChange={(e) => updateField('designation', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Job Details */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Job Details
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Joining Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={extractedData?.joining_date || ''}
                      onChange={(e) => updateField('joining_date', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Offer Valid Till
                    </label>
                    <input
                      type="date"
                      value={extractedData?.offer_valid_till || ''}
                      onChange={(e) => updateField('offer_valid_till', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Working Location
                  </label>
                  <input
                    type="text"
                    value={extractedData?.working_location || ''}
                    onChange={(e) => updateField('working_location', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Template Type
                  </label>
                  <select
                    value={extractedData?.template_type || 'short'}
                    onChange={(e) => updateField('template_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="short">Short Form (Trainee/Junior)</option>
                    <option value="long">Long Form (Regular/Senior)</option>
                    <option value="internship">Internship Letter</option>
                    <option value="extension">Contract Extension</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Signatories - MANDATORY */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Signatories (Mandatory)
              </h3>
              <div className="p-3 mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Both HR Manager and Director signatures are <strong>mandatory</strong> for all offer letters.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    HR Signatory <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={extractedData?.signatory_id || ''}
                    onChange={(e) => updateField('signatory_id', e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                    required
                  >
                    <option value="">-- Select HR Signatory --</option>
                    {signatories?.map((s: Signatory) => (
                      <option key={s.id} value={s.id}>{s.name} - {s.position}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Director Signatory <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={extractedData?.secondary_signatory_id || ''}
                    onChange={(e) => updateField('secondary_signatory_id', e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                    required
                  >
                    <option value="">-- Select Director Signatory --</option>
                    {signatories?.map((s: Signatory) => (
                      <option key={s.id} value={s.id}>{s.name} - {s.position}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      HR Manager Name
                    </label>
                    <input
                      type="text"
                      value={extractedData?.hr_manager_name || ''}
                      onChange={(e) => updateField('hr_manager_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      HR Manager Title
                    </label>
                    <input
                      type="text"
                      value={extractedData?.hr_manager_title || ''}
                      onChange={(e) => updateField('hr_manager_title', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Salary */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Salary Breakdown (Annexure A)
                </h3>
                <div className="text-right">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Annual CTC</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    ₹{extractedData?.annual_ctc?.toLocaleString('en-IN') || 0}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {extractedData?.salary_breakdown.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <input
                      type="text"
                      value={item.component}
                      onChange={(e) => updateSalaryComponent(index, 'component', e.target.value)}
                      className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-sm text-gray-900 dark:text-white"
                      placeholder="Component name"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">₹</span>
                      <input
                        type="number"
                        value={item.perMonth || 0}
                        onChange={(e) => updateSalaryComponent(index, 'perMonth', parseInt(e.target.value) || 0)}
                        className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-sm text-right text-gray-900 dark:text-white"
                      />
                      <span className="text-xs text-gray-500">/mo</span>
                    </div>
                    <span className="text-xs text-gray-500 w-24 text-right">
                      ₹{item.annual?.toLocaleString('en-IN')}/yr
                    </span>
                    <button
                      onClick={() => removeSalaryComponent(index)}
                      className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}

                <button
                  onClick={addSalaryComponent}
                  className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-green-500 hover:text-green-500 transition-colors"
                >
                  + Add Salary Component
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
              <div className="flex gap-4">
                <button
                  onClick={onCancel}
                  className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg shadow-lg flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Create Offer Letter
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
