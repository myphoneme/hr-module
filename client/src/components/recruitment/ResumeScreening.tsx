import { useState, useCallback } from 'react';
import { useVacancies, useCandidates } from '../../hooks/useRecruitment';
import { api } from '../../api/client';

const API_BASE_URL = 'http://localhost:3001/api';

// Resume extraction result from AI
interface ExtractedResume {
  id: string;
  file_name: string;
  candidate_name: string;
  email: string;
  phone: string;
  skills: string[];
  total_experience: number;
  relevant_experience: number;
  education: string;
  current_role: string;
  current_company: string;
  location: string;
  notice_period?: string;
  current_salary?: number;
  expected_salary?: number;
  skill_experience_data?: Record<string, number>;
}

// JD matching result
interface ScreeningResult {
  file_name?: string;
  resume?: ExtractedResume;
  match_score?: number;
  classification: 'shortlisted' | 'hold' | 'rejected';
  strong_matches?: string[];
  gaps?: string[];
  summary?: string;
  rejection_reason?: string;
  error?: string;
}

// Screening summary modal
function ScreeningSummaryModal({
  results,
  onClose,
  onConfirm,
  isConfirming = false
}: {
  results: ScreeningResult[];
  onClose: () => void;
  onConfirm: () => void;
  isConfirming?: boolean;
}) {
  // Filter out error results for counting
  const validResults = results.filter(r => r.resume && !r.error);
  const shortlisted = validResults.filter(r => r.classification === 'shortlisted');
  const hold = validResults.filter(r => r.classification === 'hold');
  const rejected = validResults.filter(r => r.classification === 'rejected');
  const errorResults = results.filter(r => r.error);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-white">
          <h2 className="text-xl font-bold">Resume Screening Complete</h2>
          <p className="text-sm text-white/80">
            AI has analyzed {results.length} resume(s) against the Job Description
            {errorResults.length > 0 && ` (${errorResults.length} failed to process)`}
          </p>
        </div>

        {/* Summary Stats */}
        <div className={`grid ${errorResults.length > 0 ? 'grid-cols-4' : 'grid-cols-3'} gap-4 p-6 border-b border-gray-200 dark:border-gray-700`}>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{shortlisted.length}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Shortlisted</div>
            <div className="text-xs text-gray-500">Score &gt;= 70%</div>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-yellow-600">{hold.length}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">On Hold</div>
            <div className="text-xs text-gray-500">Score 50-69%</div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-red-600">{rejected.length}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Rejected</div>
            <div className="text-xs text-gray-500">Score &lt; 50%</div>
          </div>
          {errorResults.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-900/20 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-gray-600">{errorResults.length}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Errors</div>
              <div className="text-xs text-gray-500">Failed to process</div>
            </div>
          )}
        </div>

        {/* Results List */}
        <div className="p-6 max-h-[50vh] overflow-y-auto space-y-4">
          {results.map((result, idx) => (
            <div
              key={idx}
              className={`border rounded-lg p-4 ${
                result.classification === 'shortlisted' ? 'border-green-200 bg-green-50/50 dark:bg-green-900/10' :
                result.classification === 'hold' ? 'border-yellow-200 bg-yellow-50/50 dark:bg-yellow-900/10' :
                'border-red-200 bg-red-50/50 dark:bg-red-900/10'
              }`}
            >
              {/* Error case - file processing failed */}
              {result.error ? (
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">{result.file_name || 'Unknown File'}</h4>
                      <p className="text-sm text-red-500">Failed to process resume</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">
                      ERROR
                    </span>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded p-3 text-sm">
                    <p className="text-red-600">{result.error}</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">{result.resume?.candidate_name || 'Unknown Candidate'}</h4>
                      <p className="text-sm text-gray-500">{result.resume?.current_role || 'N/A'} at {result.resume?.current_company || 'N/A'}</p>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${
                        result.classification === 'shortlisted' ? 'text-green-600' :
                        result.classification === 'hold' ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {result.match_score ?? 0}%
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        result.classification === 'shortlisted' ? 'bg-green-100 text-green-700' :
                        result.classification === 'hold' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {result.classification.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Quick Info */}
                  {result.resume && (
                    <div className="grid grid-cols-4 gap-2 text-sm mb-3">
                      <div><span className="text-gray-500">Experience:</span> <span className="text-gray-900 dark:text-white">{result.resume.total_experience ?? 0} yrs</span></div>
                      <div><span className="text-gray-500">Email:</span> <span className="text-gray-900 dark:text-white">{result.resume.email || 'N/A'}</span></div>
                      <div><span className="text-gray-500">Phone:</span> <span className="text-gray-900 dark:text-white">{result.resume.phone || 'N/A'}</span></div>
                      <div><span className="text-gray-500">Location:</span> <span className="text-gray-900 dark:text-white">{result.resume.location || 'N/A'}</span></div>
                    </div>
                  )}

                  {/* Skills */}
                  {result.resume?.skills && result.resume.skills.length > 0 && (
                    <div className="mb-3">
                      <span className="text-sm text-gray-500">Skills: </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {result.resume.skills.slice(0, 8).map((skill, i) => (
                          <span key={i} className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                            {skill}
                          </span>
                        ))}
                        {result.resume.skills.length > 8 && (
                          <span className="text-xs text-gray-400">+{result.resume.skills.length - 8} more</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Screening Summary */}
                  <div className="bg-white dark:bg-gray-800 rounded p-3 text-sm">
                    {result.summary && <p className="text-gray-700 dark:text-gray-300 mb-2">{result.summary}</p>}

                    {result.strong_matches && result.strong_matches.length > 0 && (
                      <div className="mb-2">
                        <span className="text-green-600 font-medium">Strong Matches: </span>
                        <span className="text-gray-600 dark:text-gray-400">{result.strong_matches.join(', ')}</span>
                      </div>
                    )}

                    {result.gaps && result.gaps.length > 0 && (
                      <div>
                        <span className="text-red-600 font-medium">Gaps: </span>
                        <span className="text-gray-600 dark:text-gray-400">{result.gaps.join(', ')}</span>
                      </div>
                    )}

                    {result.rejection_reason && (
                      <div className="mt-2 text-red-600">
                        <span className="font-medium">Rejection Reason: </span>{result.rejection_reason}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
          <p className="text-sm text-gray-500">
            {shortlisted.length + hold.length} candidate(s) will be added to Candidates tab
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isConfirming}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isConfirming}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isConfirming ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Adding Candidates...
                </>
              ) : (
                'Confirm & Add to Candidates'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResumeScreening() {
  const { data: vacancies } = useVacancies({ status: 'open' });
  const { refetch: refetchCandidates } = useCandidates({});

  const [selectedVacancy, setSelectedVacancy] = useState<number | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [screeningResults, setScreeningResults] = useState<ScreeningResult[] | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedVacancyDetails = vacancies?.find((v: any) => v.id === selectedVacancy);

  // Handle file drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'application/pdf' ||
              file.type === 'application/msword' ||
              file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    if (files.length > 0) {
      setUploadedFiles(prev => [...prev, ...files]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles(prev => [...prev, ...files]);
    e.target.value = ''; // Reset input
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Extract and screen resumes using AI - calls real backend API
  const processResumes = async () => {
    if (!selectedVacancy || uploadedFiles.length === 0 || !selectedVacancyDetails) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Create FormData with files and vacancy ID
      const formData = new FormData();
      formData.append('vacancy_id', selectedVacancy.toString());

      uploadedFiles.forEach((file) => {
        formData.append('resumes', file);
      });

      // Call real backend API for AI resume screening using fetch (FormData requires no Content-Type header)
      const response = await fetch(`${API_BASE_URL}/recruitment/screen-resumes`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to process resumes' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.results && data.results.length > 0) {
        setScreeningResults(data.results);
      } else {
        setError('No results returned from screening. Please check the resume files.');
      }
    } catch (err: any) {
      console.error('Error processing resumes:', err);
      setError(err.message || 'Failed to process resumes. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirm and add candidates to the system - calls real backend API
  const confirmAndAddCandidates = async () => {
    if (!screeningResults || !selectedVacancyDetails || !selectedVacancy) return;

    setIsConfirming(true);
    setError(null);

    try {
      // Prepare candidates data for the API - filter out error results
      const candidatesToAdd = screeningResults
        .filter(r => r.resume && !r.error) // Only include results with valid resume data
        .map(r => ({
          vacancy_id: selectedVacancy,
          vacancy_title: selectedVacancyDetails.title,
          first_name: (r.resume?.candidate_name || '').split(' ')[0] || '',
          last_name: (r.resume?.candidate_name || '').split(' ').slice(1).join(' ') || '',
          email: r.resume?.email || '',
          phone: r.resume?.phone || '',
          current_company: r.resume?.current_company || '',
          current_designation: r.resume?.current_role || '',
          experience_years: r.resume?.total_experience || 0,
          skills: (r.resume?.skills || []).join(', '),
          skill_experience_data: JSON.stringify(r.resume?.skill_experience_data || {}),
          current_salary: r.resume?.current_salary,
          expected_salary: r.resume?.expected_salary,
          notice_period: r.resume?.notice_period,
          location: r.resume?.location || '',
          education: r.resume?.education || '',
          classification: r.classification,
          screening_score: r.match_score || 0,
          screening_summary: r.summary || '',
          rejection_reason: r.rejection_reason,
          source: 'resume_upload',
        }));

      // Call real backend API to add candidates
      const response = await api.post<{ success: boolean; message?: string; added: number; skipped: number }>('/recruitment/screen-resumes/confirm', {
        candidates: candidatesToAdd,
      });

      if (response.success) {
        // Refetch candidates to update the Candidates tab
        await refetchCandidates();

        // Reset state
        setScreeningResults(null);
        setUploadedFiles([]);
      } else {
        setError(response.message || 'Failed to add candidates.');
      }
    } catch (err: any) {
      console.error('Error adding candidates:', err);
      setError(err.message || 'Failed to add candidates. Please try again.');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Resume Screening</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Upload resumes manually and let AI screen them against the Job Description
        </p>
      </div>

      {/* Step 1: Select JD */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">1</span>
          Select Job Description
        </h3>

        <select
          value={selectedVacancy || ''}
          onChange={(e) => {
            setSelectedVacancy(e.target.value ? Number(e.target.value) : null);
            setUploadedFiles([]);
            setScreeningResults(null);
          }}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-lg"
        >
          <option value="">Select a vacancy...</option>
          {vacancies?.map((v: any) => (
            <option key={v.id} value={v.id}>
              {v.title} - {v.department} ({v.location})
            </option>
          ))}
        </select>

        {/* JD Preview */}
        {selectedVacancyDetails && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">JD Criteria for Screening</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Position:</span>
                <p className="text-gray-900 dark:text-white font-medium">{selectedVacancyDetails.title}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Experience Range:</span>
                <p className="text-gray-900 dark:text-white font-medium">
                  {selectedVacancyDetails.experience_min || 0} - {selectedVacancyDetails.experience_max || 15} years
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Location:</span>
                <p className="text-gray-900 dark:text-white font-medium">{selectedVacancyDetails.location || 'Any'}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Department:</span>
                <p className="text-gray-900 dark:text-white font-medium">{selectedVacancyDetails.department}</p>
              </div>
            </div>
            {selectedVacancyDetails.skills_required && (
              <div className="mt-3">
                <span className="text-gray-500 dark:text-gray-400 text-sm">Required Skills:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedVacancyDetails.skills_required.split(',').map((skill: string, i: number) => (
                    <span key={i} className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                      {skill.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Upload Resumes */}
      {selectedVacancy && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">2</span>
            Upload Resumes
          </h3>

          {/* Drag & Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Drag and drop resume files here, or
            </p>
            <label className="inline-block">
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx"
                onChange={handleFileInput}
                className="hidden"
              />
              <span className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700">
                Browse Files
              </span>
            </label>
            <p className="text-sm text-gray-500 mt-2">Supports PDF, DOC, DOCX files</p>
          </div>

          {/* Uploaded Files List */}
          {uploadedFiles.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="font-medium text-gray-700 dark:text-gray-300">
                Uploaded Files ({uploadedFiles.length})
              </h4>
              {uploadedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{file.name}</p>
                      <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Process Button */}
      {uploadedFiles.length > 0 && (
        <div className="flex justify-center">
          <button
            onClick={processResumes}
            disabled={isProcessing}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Analyzing Resumes...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Screen {uploadedFiles.length} Resume(s) with AI
              </>
            )}
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h4 className="font-medium text-red-800 dark:text-red-200">Error</h4>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">How AI Screening Works:</h4>
        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <li>• <strong>Extract:</strong> AI extracts candidate name, email, phone, skills, experience, education, and current role</li>
          <li>• <strong>Match:</strong> Compares against JD criteria - skills (40%), experience range (35%), location (15%), role relevance (10%)</li>
          <li>• <strong>Classify:</strong> Shortlisted (≥70%), Hold (50-69%), Rejected (&lt;50%)</li>
          <li>• <strong>Result:</strong> Shortlisted and Hold candidates are added to Candidates tab; Rejected are stored for reference</li>
        </ul>
      </div>

      {/* Screening Results Modal */}
      {screeningResults && (
        <ScreeningSummaryModal
          results={screeningResults}
          onClose={() => setScreeningResults(null)}
          onConfirm={confirmAndAddCandidates}
          isConfirming={isConfirming}
        />
      )}
    </div>
  );
}
