import { useState } from 'react';
import { useVacancies } from '../../hooks/useRecruitment';
import {
  useMockRecruitment,
  type MockCandidate,
} from '../../contexts/MockRecruitmentContext';

interface EditingCell {
  candidateId: number;
  field: 'current_salary' | 'expected_salary' | 'notice_period';
}

export function CandidateManager() {
  const [vacancyFilter, setVacancyFilter] = useState<number | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [editingCandidate, setEditingCandidate] = useState<MockCandidate | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [scheduleModal, setScheduleModal] = useState<MockCandidate | null>(null);

  const { data: vacancies } = useVacancies();
  const {
    mockCandidates,
    updateMockCandidate,
    deleteMockCandidate,
    scheduleMockInterview,
  } = useMockRecruitment();

  // Filter candidates
  const filteredCandidates = mockCandidates.filter(c => {
    if (vacancyFilter && c.vacancy_id !== vacancyFilter) return false;
    if (statusFilter && c.status !== statusFilter) return false;
    return true;
  });

  // Get vacancy details for skill columns
  const selectedVacancy = vacancies?.find((v: any) => v.id === vacancyFilter);
  const requiredSkills = selectedVacancy?.skills_required
    ? selectedVacancy.skills_required.split(',').map((s: string) => s.trim()).filter(Boolean)
    : [];

  const handleStartEdit = (candidateId: number, field: EditingCell['field'], currentValue: any) => {
    setEditingCell({ candidateId, field });
    if (field === 'current_salary' || field === 'expected_salary') {
      setEditValue(currentValue ? String(currentValue / 100000) : '');
    } else {
      setEditValue(currentValue || '');
    }
  };

  const handleSaveEdit = () => {
    if (!editingCell) return;

    const { candidateId, field } = editingCell;
    let value: any = editValue;

    if (field === 'current_salary' || field === 'expected_salary') {
      value = editValue ? parseFloat(editValue) * 100000 : undefined;
    }

    updateMockCandidate(candidateId, { [field]: value });
    setEditingCell(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleDeleteCandidate = (id: number) => {
    deleteMockCandidate(id);
    setDeleteConfirm(null);
  };

  // Parse skill experience data for a candidate
  const getSkillExperience = (candidate: MockCandidate, skill: string): string => {
    try {
      const data = candidate.skill_experience_data ? JSON.parse(candidate.skill_experience_data) : {};
      const value = data[skill];
      if (value === undefined || value === null || value === '') return '-';
      if (typeof value === 'number') return `${value} yrs`;
      return String(value);
    } catch {
      return '-';
    }
  };

  // Get status badge color
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      new: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', label: 'New' },
      screening: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', label: 'Screening' },
      shortlisted: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', label: 'Shortlisted' },
      interview_scheduled: { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', label: 'Interview Scheduled' },
      interviewed: { color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200', label: 'Interviewed' },
      selected: { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', label: 'Selected' },
      offer_sent: { color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200', label: 'Offer Sent' },
      rejected: { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', label: 'Rejected' },
    };
    const config = statusConfig[status] || statusConfig.new;
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>{config.label}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Candidates Screening Table
          </h2>
          <select
            value={vacancyFilter || ''}
            onChange={(e) => setVacancyFilter(e.target.value ? Number(e.target.value) : undefined)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Vacancies</option>
            {vacancies?.map((v: any) => (
              <option key={v.id} value={v.id}>{v.title}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Status</option>
            <option value="new">New</option>
            <option value="screening">Screening</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="interview_scheduled">Interview Scheduled</option>
            <option value="interviewed">Interviewed</option>
            <option value="selected">Selected</option>
          </select>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {filteredCandidates.length} candidates
        </div>
      </div>

      {/* Info Banner */}
      {vacancyFilter && requiredSkills.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Skills from JD:</strong> {requiredSkills.join(', ')}
          </p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Delete Candidate?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this candidate? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteCandidate(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Candidate Modal */}
      {editingCandidate && (
        <EditCandidateModal
          candidate={editingCandidate}
          onClose={() => setEditingCandidate(null)}
          onSave={(updates) => {
            updateMockCandidate(editingCandidate.id, updates);
            setEditingCandidate(null);
          }}
        />
      )}

      {/* Schedule Interview Modal */}
      {scheduleModal && (
        <ScheduleInterviewModal
          candidate={scheduleModal}
          onClose={() => setScheduleModal(null)}
          onSchedule={(interview) => {
            scheduleMockInterview(interview);
            setScheduleModal(null);
          }}
        />
      )}

      {/* Screening Table */}
      {filteredCandidates.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-100 dark:bg-gray-900">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                    S.No
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                    Date
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 whitespace-nowrap min-w-[180px]">
                    Candidate Name
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                    Status
                  </th>
                  {/* Dynamic skill columns from JD */}
                  {requiredSkills.slice(0, 5).map((skill: string) => (
                    <th
                      key={skill}
                      className="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 whitespace-nowrap"
                    >
                      Exp. in {skill}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                    Total Exp.
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                    Current CTC
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                    Expected CTC
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                    Notice Period
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                    Location
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredCandidates.map((candidate, index) => (
                  <tr key={candidate.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    {/* S.No */}
                    <td className="px-3 py-3 text-sm text-gray-900 dark:text-white text-center border-r border-gray-200 dark:border-gray-700">
                      {index + 1}
                    </td>
                    {/* Date */}
                    <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap border-r border-gray-200 dark:border-gray-700">
                      {candidate.screening_date || candidate.createdAt?.split('T')[0] || '-'}
                    </td>
                    {/* Candidate Name */}
                    <td className="px-3 py-3 border-r border-gray-200 dark:border-gray-700">
                      <div className="font-medium text-gray-900 dark:text-white text-sm">
                        {candidate.first_name} {candidate.last_name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{candidate.email}</div>
                      <div className="text-xs text-gray-400">{candidate.current_company}</div>
                    </td>
                    {/* Status */}
                    <td className="px-3 py-3 border-r border-gray-200 dark:border-gray-700">
                      {getStatusBadge(candidate.status)}
                    </td>
                    {/* Dynamic skill experience columns */}
                    {requiredSkills.slice(0, 5).map((skill: string) => (
                      <td
                        key={skill}
                        className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300 text-center border-r border-gray-200 dark:border-gray-700"
                      >
                        {getSkillExperience(candidate, skill)}
                      </td>
                    ))}
                    {/* Total Years of Work Exp */}
                    <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300 text-center border-r border-gray-200 dark:border-gray-700">
                      {candidate.experience_years || 0} yrs
                    </td>
                    {/* Editable Current CTC */}
                    <td className="px-3 py-3 text-sm border-r border-gray-200 dark:border-gray-700">
                      {editingCell?.candidateId === candidate.id && editingCell?.field === 'current_salary' ? (
                        <input
                          type="number"
                          step="0.1"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onBlur={handleSaveEdit}
                          autoFocus
                          className="w-20 px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="LPA"
                        />
                      ) : (
                        <div
                          className="cursor-pointer text-center hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded"
                          onClick={() => handleStartEdit(candidate.id, 'current_salary', candidate.current_salary)}
                          title="Click to edit"
                        >
                          {candidate.current_salary
                            ? `${(candidate.current_salary / 100000).toFixed(1)} LPA`
                            : <span className="text-gray-400">&nbsp;</span>
                          }
                        </div>
                      )}
                    </td>
                    {/* Editable Expected CTC */}
                    <td className="px-3 py-3 text-sm border-r border-gray-200 dark:border-gray-700">
                      {editingCell?.candidateId === candidate.id && editingCell?.field === 'expected_salary' ? (
                        <input
                          type="number"
                          step="0.1"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onBlur={handleSaveEdit}
                          autoFocus
                          className="w-20 px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="LPA"
                        />
                      ) : (
                        <div
                          className="cursor-pointer text-center hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded"
                          onClick={() => handleStartEdit(candidate.id, 'expected_salary', candidate.expected_salary)}
                          title="Click to edit"
                        >
                          {candidate.expected_salary
                            ? `${(candidate.expected_salary / 100000).toFixed(1)} LPA`
                            : <span className="text-gray-400">&nbsp;</span>
                          }
                        </div>
                      )}
                    </td>
                    {/* Editable Notice Period */}
                    <td className="px-3 py-3 text-sm border-r border-gray-200 dark:border-gray-700">
                      {editingCell?.candidateId === candidate.id && editingCell?.field === 'notice_period' ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onBlur={handleSaveEdit}
                          autoFocus
                          className="w-24 px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="e.g. 30 days"
                        />
                      ) : (
                        <div
                          className="cursor-pointer text-center hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded"
                          onClick={() => handleStartEdit(candidate.id, 'notice_period', candidate.notice_period)}
                          title="Click to edit"
                        >
                          {candidate.notice_period || <span className="text-gray-400">&nbsp;</span>}
                        </div>
                      )}
                    </td>
                    {/* Location */}
                    <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300 text-center border-r border-gray-200 dark:border-gray-700">
                      {candidate.location || '-'}
                    </td>
                    {/* Actions */}
                    <td className="px-3 py-3 text-sm">
                      <div className="flex items-center justify-center gap-1">
                        {/* Schedule Interview - only for shortlisted */}
                        {(candidate.status === 'shortlisted' || candidate.status === 'screening') && (
                          <button
                            onClick={() => setScheduleModal(candidate)}
                            className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                            title="Schedule Interview"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </button>
                        )}
                        {/* Edit */}
                        <button
                          onClick={() => setEditingCandidate(candidate)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => setDeleteConfirm(candidate.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">
            No candidates found. Import candidates from Naukri tab.
          </p>
        </div>
      )}
    </div>
  );
}

// Edit Candidate Modal
function EditCandidateModal({
  candidate,
  onClose,
  onSave,
}: {
  candidate: MockCandidate;
  onClose: () => void;
  onSave: (updates: Partial<MockCandidate>) => void;
}) {
  const [formData, setFormData] = useState({
    current_salary: candidate.current_salary ? candidate.current_salary / 100000 : '',
    expected_salary: candidate.expected_salary ? candidate.expected_salary / 100000 : '',
    notice_period: candidate.notice_period || '',
    status: candidate.status,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      current_salary: formData.current_salary ? Number(formData.current_salary) * 100000 : undefined,
      expected_salary: formData.expected_salary ? Number(formData.expected_salary) * 100000 : undefined,
      notice_period: formData.notice_period || undefined,
      status: formData.status as MockCandidate['status'],
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Edit Candidate: {candidate.first_name} {candidate.last_name}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 text-2xl">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Read-only info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input type="text" value={candidate.email} disabled className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
              <input type="text" value={candidate.phone} disabled className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Company</label>
              <input type="text" value={candidate.current_company} disabled className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Experience</label>
              <input type="text" value={`${candidate.experience_years} years`} disabled className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Skills</label>
            <input type="text" value={candidate.skills} disabled className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500" />
          </div>

          <hr className="border-gray-200 dark:border-gray-700" />

          {/* Editable fields */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Current CTC (LPA) <span className="text-blue-500">*HR</span>
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.current_salary}
                onChange={(e) => setFormData({ ...formData, current_salary: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="e.g. 12.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Expected CTC (LPA) <span className="text-blue-500">*HR</span>
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.expected_salary}
                onChange={(e) => setFormData({ ...formData, expected_salary: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="e.g. 15.0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notice Period <span className="text-blue-500">*HR</span>
              </label>
              <input
                type="text"
                value={formData.notice_period}
                onChange={(e) => setFormData({ ...formData, notice_period: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="e.g. 30 days"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="new">New</option>
              <option value="screening">Screening</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="interview_scheduled">Interview Scheduled</option>
              <option value="interviewed">Interviewed</option>
              <option value="selected">Selected</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Schedule Interview Modal
function ScheduleInterviewModal({
  candidate,
  onClose,
  onSchedule,
}: {
  candidate: MockCandidate;
  onClose: () => void;
  onSchedule: (interview: any) => void;
}) {
  const [formData, setFormData] = useState({
    interview_type: 'technical' as 'technical' | 'hr' | 'managerial' | 'final',
    scheduled_date: '',
    scheduled_time: '10:00',
    duration_minutes: 60,
    location: 'Online',
    meeting_link: '',
    interviewer_name: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.scheduled_date || !formData.interviewer_name) {
      alert('Please fill all required fields');
      return;
    }

    onSchedule({
      candidate_id: candidate.id,
      vacancy_id: candidate.vacancy_id,
      vacancy_title: candidate.vacancy_title,
      candidate_name: `${candidate.first_name} ${candidate.last_name}`,
      candidate_email: candidate.email,
      candidate_phone: candidate.phone,
      interview_type: formData.interview_type,
      round_number: 1,
      scheduled_date: formData.scheduled_date,
      scheduled_time: formData.scheduled_time,
      duration_minutes: formData.duration_minutes,
      location: formData.location,
      meeting_link: formData.meeting_link || undefined,
      interviewer_name: formData.interviewer_name,
      status: 'scheduled' as const,
      experience_years: candidate.experience_years,
      skills: candidate.skills,
      current_salary: candidate.current_salary,
      expected_salary: candidate.expected_salary,
      notice_period: candidate.notice_period,
      current_location: candidate.location,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg">
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Schedule Interview
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 text-2xl">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Candidate Info */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
            <h3 className="font-medium text-gray-900 dark:text-white">
              {candidate.first_name} {candidate.last_name}
            </h3>
            <p className="text-sm text-gray-500">{candidate.vacancy_title}</p>
            <p className="text-sm text-gray-500">{candidate.experience_years} years exp. | {candidate.location}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Interview Type *
              </label>
              <select
                value={formData.interview_type}
                onChange={(e) => setFormData({ ...formData, interview_type: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="technical">Technical</option>
                <option value="hr">HR</option>
                <option value="managerial">Managerial</option>
                <option value="final">Final</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Duration (mins)
              </label>
              <select
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value={30}>30 mins</option>
                <option value={45}>45 mins</option>
                <option value={60}>60 mins</option>
                <option value={90}>90 mins</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date *
              </label>
              <input
                type="date"
                value={formData.scheduled_date}
                onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Time *
              </label>
              <input
                type="time"
                value={formData.scheduled_time}
                onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Interviewer Name *
            </label>
            <input
              type="text"
              value={formData.interviewer_name}
              onChange={(e) => setFormData({ ...formData, interviewer_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter interviewer name"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Location
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Online / Office"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Meeting Link
              </label>
              <input
                type="url"
                value={formData.meeting_link}
                onChange={(e) => setFormData({ ...formData, meeting_link: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="https://meet.google.com/..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Schedule Interview
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
