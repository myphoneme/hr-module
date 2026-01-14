import React, { useState, useCallback, useEffect } from 'react';
import { useVacancies, useCandidates, useBatchSendInterestEmails } from '../../hooks/useRecruitment';
import { api } from '../../api/client';

// Gmail connection interface
interface GmailConnection {
  id: number;
  email: string;
  name?: string;
}

const API_BASE_URL = 'http://localhost:3001/api';

// Work history entry
interface WorkHistoryEntry {
  company: string;
  role: string;
  duration: string;
  years?: number;
  projects?: string[]; // Projects worked on at this company
}

// Project entry
interface ProjectEntry {
  name: string;
  description?: string;
  technologies?: string[];
}

// Education entry
interface EducationEntry {
  degree: string;
  institution: string;
  year?: string;
  type: 'college' | 'school' | 'certification' | 'other';
}

// Resume extraction result from AI
interface ExtractedResume {
  id?: string;
  file_name?: string;
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
  skill_experience?: Record<string, number | string>;
  // Enhanced fields
  work_history?: WorkHistoryEntry[];
  projects?: ProjectEntry[];
  education_details?: EducationEntry[];
  certifications?: string[];
  languages?: string[];
  summary?: string;
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

// Screening Results Table Component - Tabular format for easy reading
function ScreeningResultsTable({
  results,
  onConfirm,
  onClear,
  isConfirming = false,
  gmailConnections,
  selectedGmailConnection,
  setSelectedGmailConnection,
  isSendingEmails = false,
  selectedForEmail,
  setSelectedForEmail
}: {
  results: ScreeningResult[];
  onConfirm: () => void;
  onClear: () => void;
  isConfirming?: boolean;
  gmailConnections: GmailConnection[];
  selectedGmailConnection: number | null;
  setSelectedGmailConnection: (id: number | null) => void;
  isSendingEmails?: boolean;
  selectedForEmail: Set<number>;
  setSelectedForEmail: (selected: Set<number>) => void;
}) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Filter out error results for counting
  const validResults = results.filter(r => r.resume && !r.error);
  const shortlisted = validResults.filter(r => r.classification === 'shortlisted');
  const hold = validResults.filter(r => r.classification === 'hold');
  const rejected = validResults.filter(r => r.classification === 'rejected');
  const errorResults = results.filter(r => r.error);

  // Selectable candidates are shortlisted and hold (not rejected)
  const selectableCandidates = validResults.filter(r => r.classification !== 'rejected');

  // Toggle candidate selection
  const toggleCandidateSelection = (idx: number) => {
    const newSelected = new Set(selectedForEmail);
    if (newSelected.has(idx)) {
      newSelected.delete(idx);
    } else {
      newSelected.add(idx);
    }
    setSelectedForEmail(newSelected);
  };

  // Select/Deselect all
  const toggleSelectAll = () => {
    const selectableIndices = new Set<number>();
    results.forEach((r, idx) => {
      if ((r.classification === 'shortlisted' || r.classification === 'hold') && r.resume && !r.error) {
        selectableIndices.add(idx);
      }
    });

    if (selectedForEmail.size === selectableIndices.size) {
      setSelectedForEmail(new Set());
    } else {
      setSelectedForEmail(selectableIndices);
    }
  };

  // Select only shortlisted
  const selectAllShortlisted = () => {
    const shortlistedIndices = new Set<number>();
    results.forEach((r, idx) => {
      if (r.classification === 'shortlisted' && r.resume && !r.error) {
        shortlistedIndices.add(idx);
      }
    });
    setSelectedForEmail(shortlistedIndices);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Header with Stats */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Resume Screening Complete
            </h3>
            <p className="text-sm text-white/80 mt-1">
              {results.length} resume(s) analyzed • Select candidates to add & send confirmation emails
            </p>
          </div>
          <div className="flex gap-3">
            <div className="text-center px-4 py-2 bg-white/20 rounded-lg">
              <div className="text-2xl font-bold text-green-300">{shortlisted.length}</div>
              <div className="text-xs text-white/80">Shortlisted</div>
            </div>
            <div className="text-center px-4 py-2 bg-white/20 rounded-lg">
              <div className="text-2xl font-bold text-yellow-300">{hold.length}</div>
              <div className="text-xs text-white/80">On Hold</div>
            </div>
            <div className="text-center px-4 py-2 bg-white/20 rounded-lg">
              <div className="text-2xl font-bold text-red-300">{rejected.length}</div>
              <div className="text-xs text-white/80">Rejected</div>
            </div>
          </div>
        </div>
      </div>

      {/* Selection Controls */}
      <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={selectAllShortlisted}
            className="px-3 py-1.5 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 text-sm font-medium flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Select Shortlisted ({shortlisted.length})
          </button>
          <button
            type="button"
            onClick={toggleSelectAll}
            className="px-3 py-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 text-sm font-medium"
          >
            {selectedForEmail.size === selectableCandidates.length ? 'Deselect All' : 'Select All Eligible'}
          </button>
        </div>
        <div className={`px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 ${
          selectedForEmail.size > 0
            ? 'bg-green-500 text-white'
            : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
        }`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {selectedForEmail.size} / {selectableCandidates.length} selected
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300">
            <tr>
              <th className="px-4 py-3 text-left w-12">
                <input
                  type="checkbox"
                  checked={selectedForEmail.size === selectableCandidates.length && selectableCandidates.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
              </th>
              <th className="px-4 py-3 text-left">Candidate Name</th>
              <th className="px-4 py-3 text-left">Contact</th>
              <th className="px-4 py-3 text-left">Experience</th>
              <th className="px-4 py-3 text-left">Current Role</th>
              <th className="px-4 py-3 text-left">Skills</th>
              <th className="px-4 py-3 text-left">Education</th>
              <th className="px-4 py-3 text-center">Score</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center w-12">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {results.map((result, idx) => {
              const resume = result.resume;
              const isError = !!result.error;
              const isSelectable = !isError && result.classification !== 'rejected';
              const isSelected = selectedForEmail.has(idx);
              const isExpanded = expandedRow === idx;

              if (isError) {
                return (
                  <tr key={idx} className="bg-red-50 dark:bg-red-900/20">
                    <td className="px-4 py-3">
                      <div className="w-4 h-4 rounded bg-gray-200 dark:bg-gray-700" />
                    </td>
                    <td className="px-4 py-3 text-red-600 dark:text-red-400" colSpan={8}>
                      <span className="font-medium">{result.file_name}</span>
                      <span className="ml-2 text-red-500">Error: {result.error}</span>
                    </td>
                    <td className="px-4 py-3" />
                  </tr>
                );
              }

              if (!resume) return null;

              const statusColor = result.classification === 'shortlisted' ? 'green'
                : result.classification === 'hold' ? 'yellow' : 'red';

              return (
                <React.Fragment key={idx}>
                  <tr
                    className={`hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors ${
                      isSelected ? 'bg-green-50 dark:bg-green-900/20' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3">
                      {isSelectable ? (
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCandidateSelection(idx)}
                            className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                          />
                        </label>
                      ) : (
                        <div className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      )}
                    </td>

                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {resume.candidate_name || 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-500">{resume.location || 'N/A'}</div>
                    </td>

                    {/* Contact */}
                    <td className="px-4 py-3">
                      <div className="text-gray-700 dark:text-gray-300 text-xs">
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {resume.email || 'N/A'}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {resume.phone || 'N/A'}
                        </div>
                      </div>
                    </td>

                    {/* Experience */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {resume.total_experience || 0} years
                      </div>
                      <div className="text-xs text-gray-500">
                        Relevant: {resume.relevant_experience || 0}y
                      </div>
                    </td>

                    {/* Current Role */}
                    <td className="px-4 py-3">
                      <div className="text-gray-900 dark:text-white font-medium text-xs">
                        {resume.current_role || 'N/A'}
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400">
                        {resume.current_company || 'N/A'}
                      </div>
                    </td>

                    {/* Skills */}
                    <td className="px-4 py-3 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {(resume.skills || []).slice(0, 4).map((skill, i) => (
                          <span key={i} className="px-1.5 py-0.5 text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded">
                            {skill}
                          </span>
                        ))}
                        {(resume.skills || []).length > 4 && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                            +{resume.skills!.length - 4}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Education */}
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-700 dark:text-gray-300 max-w-[150px] truncate">
                        {resume.education_details && resume.education_details.length > 0
                          ? resume.education_details[0].degree
                          : resume.education || 'N/A'}
                      </div>
                    </td>

                    {/* Score */}
                    <td className="px-4 py-3 text-center">
                      <div className={`text-lg font-bold ${
                        statusColor === 'green' ? 'text-green-600' :
                        statusColor === 'yellow' ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {result.match_score ?? 0}%
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        statusColor === 'green' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                        statusColor === 'yellow' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                        'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                      }`}>
                        {result.classification?.toUpperCase()}
                      </span>
                    </td>

                    {/* Expand Button */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setExpandedRow(isExpanded ? null : idx)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                      >
                        <svg className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Details Row */}
                  {isExpanded && (
                    <tr className="bg-gray-50 dark:bg-gray-900">
                      <td colSpan={10} className="px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Work History */}
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                              </svg>
                              Work History
                            </h4>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {resume.work_history && resume.work_history.length > 0 ? (
                                resume.work_history.map((work, i) => (
                                  <div key={i} className="text-xs border-l-2 border-blue-300 pl-2">
                                    <p className="font-medium text-gray-900 dark:text-white">{work.company}</p>
                                    <p className="text-blue-600">{work.role}</p>
                                    <p className="text-gray-500">{work.duration}</p>
                                    {work.projects && work.projects.length > 0 && (
                                      <div className="mt-1 text-orange-600">
                                        Projects: {work.projects.join(', ')}
                                      </div>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <p className="text-xs text-gray-500">
                                  {resume.current_company ? `${resume.current_role} at ${resume.current_company}` : 'No work history'}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* All Skills */}
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                              <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                              Skills with Experience
                            </h4>
                            <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
                              {resume.skill_experience && Object.keys(resume.skill_experience).length > 0 ? (
                                Object.entries(resume.skill_experience).map(([skill, exp], i) => (
                                  <span key={i} className={`px-2 py-1 text-[10px] rounded ${
                                    exp === 'No' || exp === 'no'
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-green-100 text-green-700'
                                  }`}>
                                    {skill}: {typeof exp === 'number' ? `${exp}y` : exp}
                                  </span>
                                ))
                              ) : resume.skills && resume.skills.length > 0 ? (
                                resume.skills.map((skill, i) => (
                                  <span key={i} className="px-2 py-1 text-[10px] bg-blue-100 text-blue-700 rounded">
                                    {skill}
                                  </span>
                                ))
                              ) : (
                                <p className="text-xs text-gray-500">No skills listed</p>
                              )}
                            </div>
                          </div>

                          {/* Education & Match Details */}
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                              <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                              </svg>
                              Education
                            </h4>
                            <div className="space-y-2 max-h-40 overflow-y-auto text-xs">
                              {resume.education_details && resume.education_details.length > 0 ? (
                                resume.education_details.map((edu, i) => (
                                  <div key={i} className="border-l-2 border-indigo-300 pl-2">
                                    <span className={`text-[10px] px-1 py-0.5 rounded ${
                                      edu.type === 'college' ? 'bg-indigo-100 text-indigo-700' :
                                      edu.type === 'school' ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-700'
                                    }`}>{edu.type?.toUpperCase()}</span>
                                    <p className="font-medium text-gray-900 dark:text-white mt-1">{edu.degree}</p>
                                    <p className="text-gray-500">{edu.institution}</p>
                                  </div>
                                ))
                              ) : (
                                <p className="text-gray-500">{resume.education || 'No education details'}</p>
                              )}
                            </div>

                            {/* Match Summary */}
                            {result.summary && (
                              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                <p className="text-xs text-gray-600 dark:text-gray-400">{result.summary}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer with Gmail & Confirm */}
      <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {selectedForEmail.size > 0 && (
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Send emails from:
                </label>
                {gmailConnections.length > 0 ? (
                  <select
                    value={selectedGmailConnection || ''}
                    onChange={(e) => setSelectedGmailConnection(e.target.value ? Number(e.target.value) : null)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="">Select Gmail account...</option>
                    {gmailConnections.map((conn) => (
                      <option key={conn.id} value={conn.id}>
                        {conn.email}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm text-amber-600">No Gmail connected</span>
                )}
              </div>
            )}

            <div className="text-sm text-gray-600 dark:text-gray-400">
              {selectedForEmail.size > 0 ? (
                <span className="flex items-center gap-2">
                  <span className="font-bold text-green-600">{selectedForEmail.size}</span> candidates will be added
                  {selectedGmailConnection && <span className="text-blue-600">+ receive emails</span>}
                </span>
              ) : (
                <span className="text-amber-600">Select candidates to proceed</span>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClear}
              disabled={isConfirming || isSendingEmails}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Clear Results
            </button>
            <button
              onClick={onConfirm}
              disabled={isConfirming || isSendingEmails || selectedForEmail.size === 0 || (selectedForEmail.size > 0 && !selectedGmailConnection && gmailConnections.length > 0)}
              className={`px-6 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium ${
                selectedForEmail.size > 0 ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400'
              }`}
            >
              {isConfirming ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Adding...
                </>
              ) : isSendingEmails ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Sending Emails...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Confirm {selectedForEmail.size} Candidate(s)
                </>
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
  const batchSendEmails = useBatchSendInterestEmails();

  const [selectedVacancy, setSelectedVacancy] = useState<number | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [screeningResults, setScreeningResults] = useState<ScreeningResult[] | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email sending states
  const [gmailConnections, setGmailConnections] = useState<GmailConnection[]>([]);
  const [selectedGmailConnection, setSelectedGmailConnection] = useState<number | null>(null);
  const [selectedForEmail, setSelectedForEmail] = useState<Set<number>>(new Set());

  const selectedVacancyDetails = vacancies?.find((v: any) => v.id === selectedVacancy);

  // Initialize selectedForEmail when screeningResults changes (select all shortlisted by default)
  useEffect(() => {
    if (screeningResults) {
      const shortlistedIndices = new Set<number>();
      screeningResults.forEach((r, idx) => {
        if (r.classification === 'shortlisted' && r.resume && !r.error) {
          shortlistedIndices.add(idx);
        }
      });
      setSelectedForEmail(shortlistedIndices);
    } else {
      setSelectedForEmail(new Set());
    }
  }, [screeningResults]);

  // Fetch Gmail connections on mount
  useEffect(() => {
    const fetchGmailConnections = async () => {
      try {
        const connections = await api.get<GmailConnection[]>('/gmail/connections');
        setGmailConnections(connections);
        // Auto-select first connection if available
        if (connections.length > 0) {
          setSelectedGmailConnection(connections[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch Gmail connections:', err);
      }
    };
    fetchGmailConnections();
  }, []);

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
  // Only selected candidates will be added
  const confirmAndAddCandidates = async () => {
    if (!screeningResults || !selectedVacancyDetails || !selectedVacancy || selectedForEmail.size === 0) return;

    setIsConfirming(true);
    setError(null);

    try {
      // Prepare candidates data for the API - ONLY include SELECTED candidates
      // Send in the format expected by the backend (with nested resume object)
      const candidatesToAdd = screeningResults
        .map((r, idx) => ({ result: r, index: idx }))
        .filter(({ result, index }) =>
          result.resume &&
          !result.error &&
          selectedForEmail.has(index) // Only include selected candidates
        )
        .map(({ result }) => ({
          resume: result.resume,
          classification: result.classification,
          match_score: result.match_score || 0,
          summary: result.summary || '',
          strong_matches: result.strong_matches || [],
          gaps: result.gaps || [],
          rejection_reason: result.rejection_reason,
          file_path: result.file_name,
          selectedForEmail: true, // All selected candidates will receive email
        }));

      // Call real backend API to add candidates
      const response = await api.post<{
        success: boolean;
        message?: string;
        added: number;
        skipped: number;
        addedCandidates?: Array<{ id: number; email: string; status: string; selectedForEmail?: boolean }>;
      }>('/recruitment/screen-resumes/confirm', {
        vacancy_id: selectedVacancy,
        candidates: candidatesToAdd,
      });

      if (response.success) {
        // Refetch candidates to update the Candidates tab
        await refetchCandidates();

        // Send emails to SELECTED shortlisted candidates (when Gmail is selected and candidates are chosen)
        if (selectedGmailConnection && response.addedCandidates && selectedForEmail.size > 0) {
          setIsConfirming(false);
          setIsSendingEmails(true);

          // Get IDs of shortlisted candidates that were SELECTED for email
          const selectedCandidateIds = response.addedCandidates
            .filter(c => c.status === 'shortlisted' && c.selectedForEmail)
            .map(c => c.id);

          if (selectedCandidateIds.length > 0) {
            try {
              const emailResult = await batchSendEmails.mutateAsync({
                candidateIds: selectedCandidateIds,
                gmailConnectionId: selectedGmailConnection
              });

              console.log('Batch email result:', emailResult);

              // Show success message
              if (emailResult.sent_count > 0) {
                // Emails sent successfully - refetch to update status
                await refetchCandidates();
              }
            } catch (emailErr: any) {
              console.error('Error sending batch emails:', emailErr);
              // Don't throw - candidates were added successfully, just email failed
              setError(`Candidates added but email sending failed: ${emailErr.message}`);
            }
          }
        }

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
      setIsSendingEmails(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Resume Screening</h2>
        <p className="text-gray-600 dark:text-gray-400">
          {screeningResults
            ? 'Review screened candidates and confirm selection'
            : 'Upload resumes manually and let AI screen them against the Job Description'
          }
        </p>
      </div>

      {/* Show upload section only when no screening results */}
      {!screeningResults && (
        <>
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
        </>
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

      {/* Screening Results Table */}
      {screeningResults && (
        <ScreeningResultsTable
          results={screeningResults}
          onClear={() => setScreeningResults(null)}
          onConfirm={confirmAndAddCandidates}
          isConfirming={isConfirming}
          gmailConnections={gmailConnections}
          selectedGmailConnection={selectedGmailConnection}
          setSelectedGmailConnection={setSelectedGmailConnection}
          isSendingEmails={isSendingEmails}
          selectedForEmail={selectedForEmail}
          setSelectedForEmail={setSelectedForEmail}
        />
      )}
    </div>
  );
}
