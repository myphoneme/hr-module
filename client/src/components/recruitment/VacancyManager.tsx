import { useState } from 'react';
import {
  useVacancies,
  useUpdateVacancy,
  useDeleteVacancy,
  useGenerateJobDescription,
  type Vacancy,
} from '../../hooks/useRecruitment';
import { VacancyChatBox } from './VacancyChatBox';

export function VacancyManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingVacancy, setEditingVacancy] = useState<Vacancy | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data: vacancies, isLoading, refetch } = useVacancies({ status: statusFilter || undefined });
  const updateMutation = useUpdateVacancy();
  const deleteMutation = useDeleteVacancy();

  const handleEdit = (vacancy: Vacancy) => {
    setEditingVacancy(vacancy);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this vacancy?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingVacancy(null);
  };

  return (
    <div className="flex gap-6">
      {/* Left: Vacancy List */}
      <div className="flex-1 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Vacancies
            </h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="open">Open</option>
              <option value="on_hold">On Hold</option>
              <option value="closed">Closed</option>
              <option value="filled">Filled</option>
            </select>
          </div>
        </div>

        {/* Form Modal - Only for editing */}
        {showForm && editingVacancy && (
          <VacancyForm
            vacancy={editingVacancy}
            onClose={handleFormClose}
            onSave={async (data) => {
              await updateMutation.mutateAsync({ id: editingVacancy.id, vacancy: data });
              handleFormClose();
            }}
            isLoading={updateMutation.isPending}
          />
        )}

        {/* Vacancy List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : vacancies && vacancies.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {vacancies.map((vacancy) => (
              <VacancyCard
                key={vacancy.id}
                vacancy={vacancy}
                onEdit={() => handleEdit(vacancy)}
                onDelete={() => handleDelete(vacancy.id)}
                onStatusChange={(status) => updateMutation.mutate({ id: vacancy.id, vacancy: { status } })}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400">
              No vacancies found. Use the chat to create your first vacancy!
            </p>
          </div>
        )}
      </div>

      {/* Right: Chat Box */}
      <div className="w-96 flex-shrink-0">
        <div className="sticky top-4">
          <VacancyChatBox onVacancyCreated={() => refetch()} />
        </div>
      </div>
    </div>
  );
}

// Vacancy Card Component
function VacancyCard({
  vacancy,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  vacancy: Vacancy;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: Vacancy['status']) => void;
}) {
  const [showExportModal, setShowExportModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);

  const statusColors: Record<Vacancy['status'], string> = {
    draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    open: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    on_hold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    closed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    filled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  };

  const priorityColors: Record<string, string> = {
    low: 'border-l-gray-400',
    medium: 'border-l-blue-400',
    high: 'border-l-orange-400',
    urgent: 'border-l-red-500',
  };

  return (
    <>
      <div
        onClick={() => setShowViewModal(true)}
        className={`bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 border-l-4 ${priorityColors[vacancy.priority]} cursor-pointer hover:shadow-lg transition-shadow`}
      >
        <div className="p-4">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-semibold text-gray-900 dark:text-white">{vacancy.title}</h3>
            <span className={`text-xs px-2 py-1 rounded-full ${statusColors[vacancy.status]}`}>
              {vacancy.status.replace('_', ' ')}
            </span>
          </div>

          <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
            {vacancy.department && <p>📁 {vacancy.department}</p>}
            {vacancy.location && <p>📍 {vacancy.location}</p>}
            <p>👥 {vacancy.openings_count} opening(s) • {vacancy.candidate_count || 0} applicants</p>
            {vacancy.experience_min !== undefined && (
              <p>💼 {vacancy.experience_min} - {vacancy.experience_max || '∞'} years</p>
            )}
            {vacancy.salary_min && (
              <p>💰 ₹{(vacancy.salary_min / 100000).toFixed(1)}L - ₹{((vacancy.salary_max || 0) / 100000).toFixed(1)}L</p>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
            <select
              value={vacancy.status}
              onChange={(e) => onStatusChange(e.target.value as Vacancy['status'])}
              className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="draft">Draft</option>
              <option value="open">Open</option>
              <option value="on_hold">On Hold</option>
              <option value="closed">Closed</option>
              <option value="filled">Filled</option>
            </select>

            <div className="flex gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); setShowExportModal(true); }}
                className="text-green-600 hover:text-green-800 dark:text-green-400 text-sm"
                title="Export for Job Portals"
              >
                Export
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-sm"
              >
                Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="text-red-600 hover:text-red-800 dark:text-red-400 text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* View JD Modal */}
      {showViewModal && (
        <ViewJDModal vacancy={vacancy} onClose={() => setShowViewModal(false)} onEdit={onEdit} />
      )}

      {/* Export Modal */}
      {showExportModal && (
        <ExportJDModal vacancy={vacancy} onClose={() => setShowExportModal(false)} />
      )}
    </>
  );
}

// View JD Modal - Displays Job Description in a properly formatted view
function ViewJDModal({
  vacancy,
  onClose,
  onEdit
}: {
  vacancy: Vacancy;
  onClose: () => void;
  onEdit: () => void;
}) {
  const statusColors: Record<Vacancy['status'], string> = {
    draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    open: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    on_hold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    closed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    filled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  };

  const priorityLabels: Record<string, { label: string; color: string }> = {
    low: { label: 'Low Priority', color: 'text-gray-500' },
    medium: { label: 'Medium Priority', color: 'text-blue-500' },
    high: { label: 'High Priority', color: 'text-orange-500' },
    urgent: { label: 'Urgent', color: 'text-red-500' },
  };

  // Helper to format text with bullet points
  const formatAsList = (text: string | undefined) => {
    if (!text) return null;
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return null;

    return (
      <ul className="list-disc list-inside space-y-1">
        {lines.map((line, i) => (
          <li key={i} className="text-gray-700 dark:text-gray-300">
            {line.replace(/^[-•*]\s*/, '')}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-5 text-white">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold">{vacancy.title}</h1>
                <span className={`text-xs px-2 py-1 rounded-full ${statusColors[vacancy.status]} text-opacity-90`}>
                  {vacancy.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-white/90">
                {vacancy.department && (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    {vacancy.department}
                  </span>
                )}
                {vacancy.location && (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {vacancy.location}
                  </span>
                )}
                <span className={`flex items-center gap-1 ${priorityLabels[vacancy.priority]?.color || ''}`}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
                  </svg>
                  {priorityLabels[vacancy.priority]?.label || 'Medium Priority'}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Key Details Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Employment Type</div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {vacancy.employment_type?.replace('_', ' ').toUpperCase() || 'Full Time'}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Experience</div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {vacancy.experience_min !== undefined
                  ? `${vacancy.experience_min} - ${vacancy.experience_max || 'Any'} years`
                  : 'Not specified'}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Salary Range</div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {vacancy.salary_min
                  ? `₹${(vacancy.salary_min / 100000).toFixed(1)}L - ₹${((vacancy.salary_max || 0) / 100000).toFixed(1)}L`
                  : 'Not disclosed'}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Openings</div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {vacancy.openings_count || 1} Position(s)
              </div>
            </div>
          </div>

          {/* Job Description */}
          {vacancy.job_description && (
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Job Description
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {vacancy.job_description}
                </p>
              </div>
            </section>
          )}

          {/* Responsibilities */}
          {vacancy.responsibilities && (
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Key Responsibilities
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                {formatAsList(vacancy.responsibilities)}
              </div>
            </section>
          )}

          {/* Requirements */}
          {vacancy.requirements && (
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Requirements
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                {formatAsList(vacancy.requirements)}
              </div>
            </section>
          )}

          {/* Skills Required */}
          {vacancy.skills_required && (
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Required Skills
              </h3>
              <div className="flex flex-wrap gap-2">
                {vacancy.skills_required.split(',').map((skill, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium"
                  >
                    {skill.trim()}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Qualifications */}
          {vacancy.qualifications && (
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                </svg>
                Qualifications
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {vacancy.qualifications}
                </p>
              </div>
            </section>
          )}

          {/* Benefits */}
          {vacancy.benefits && (
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                What We Offer
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                {formatAsList(vacancy.benefits)}
              </div>
            </section>
          )}

          {/* No Content Message */}
          {!vacancy.job_description && !vacancy.responsibilities && !vacancy.requirements &&
           !vacancy.skills_required && !vacancy.qualifications && !vacancy.benefits && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg mb-2">No job description available</p>
              <p className="text-sm">Click "Edit" to add job details or use AI to generate a complete JD.</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 px-6 py-4 flex justify-between items-center">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {vacancy.candidate_count || 0} applicant(s) • Created {new Date(vacancy.createdAt || '').toLocaleDateString()}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => { onClose(); onEdit(); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Vacancy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export JD Modal for Job Portals (Naukri, LinkedIn, etc.)
function ExportJDModal({ vacancy, onClose }: { vacancy: Vacancy; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);

  const formatForNaukri = () => {
    const parts = [];

    parts.push(`Job Title: ${vacancy.title}`);
    if (vacancy.department) parts.push(`Department: ${vacancy.department}`);
    if (vacancy.location) parts.push(`Location: ${vacancy.location}`);
    parts.push(`Employment Type: ${vacancy.employment_type?.replace('_', ' ').toUpperCase() || 'Full Time'}`);

    if (vacancy.experience_min !== undefined) {
      parts.push(`Experience: ${vacancy.experience_min} - ${vacancy.experience_max || 'Any'} years`);
    }

    if (vacancy.salary_min) {
      parts.push(`Salary: ₹${(vacancy.salary_min / 100000).toFixed(1)}L - ₹${((vacancy.salary_max || 0) / 100000).toFixed(1)}L per annum`);
    }

    parts.push('');

    if (vacancy.job_description) {
      parts.push('Job Description:');
      parts.push(vacancy.job_description);
      parts.push('');
    }

    if (vacancy.responsibilities) {
      parts.push('Key Responsibilities:');
      parts.push(vacancy.responsibilities);
      parts.push('');
    }

    if (vacancy.requirements) {
      parts.push('Requirements:');
      parts.push(vacancy.requirements);
      parts.push('');
    }

    if (vacancy.skills_required) {
      parts.push('Required Skills:');
      parts.push(vacancy.skills_required);
      parts.push('');
    }

    if (vacancy.qualifications) {
      parts.push('Qualifications:');
      parts.push(vacancy.qualifications);
      parts.push('');
    }

    if (vacancy.benefits) {
      parts.push('Benefits:');
      parts.push(vacancy.benefits);
      parts.push('');
    }

    parts.push('---');
    parts.push('Apply now to join our team!');
    parts.push('');
    parts.push('Send your resume to: hr@myphoneme.com');

    return parts.join('\n');
  };

  const formatForLinkedIn = () => {
    const parts = [];

    parts.push(`🚀 We're Hiring: ${vacancy.title}`);
    parts.push('');

    if (vacancy.location) parts.push(`📍 Location: ${vacancy.location}`);
    if (vacancy.department) parts.push(`🏢 Department: ${vacancy.department}`);
    parts.push(`💼 Type: ${vacancy.employment_type?.replace('_', ' ').toUpperCase() || 'Full Time'}`);

    if (vacancy.experience_min !== undefined) {
      parts.push(`📊 Experience: ${vacancy.experience_min} - ${vacancy.experience_max || 'Any'} years`);
    }

    parts.push('');

    if (vacancy.job_description) {
      parts.push('About the Role:');
      parts.push(vacancy.job_description);
      parts.push('');
    }

    if (vacancy.responsibilities) {
      parts.push('What You\'ll Do:');
      parts.push(vacancy.responsibilities);
      parts.push('');
    }

    if (vacancy.requirements) {
      parts.push('What We\'re Looking For:');
      parts.push(vacancy.requirements);
      parts.push('');
    }

    if (vacancy.skills_required) {
      parts.push('Skills:');
      parts.push(vacancy.skills_required);
      parts.push('');
    }

    if (vacancy.benefits) {
      parts.push('What We Offer:');
      parts.push(vacancy.benefits);
      parts.push('');
    }

    parts.push('Interested? Apply now or DM for details! 🎯');
    parts.push('');
    parts.push('📧 Send your resume to: hr@myphoneme.com');
    parts.push('');
    parts.push('#hiring #jobs #careers #opportunity');

    return parts.join('\n');
  };

  const copyToClipboard = async (text: string, format: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(format);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('Failed to copy to clipboard');
    }
  };

  const naukriText = formatForNaukri();
  const linkedInText = formatForLinkedIn();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Export JD for Job Portals
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Naukri Format */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="text-orange-500">📋</span> Naukri / Indeed Format
                </h3>
                <button
                  onClick={() => copyToClipboard(naukriText, 'naukri')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    copied === 'naukri'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                      : 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-300'
                  }`}
                >
                  {copied === 'naukri' ? '✓ Copied!' : 'Copy for Naukri'}
                </button>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
                <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans">
                  {naukriText}
                </pre>
              </div>
            </div>

            {/* LinkedIn Format */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="text-blue-500">💼</span> LinkedIn Format
                </h3>
                <button
                  onClick={() => copyToClipboard(linkedInText, 'linkedin')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    copied === 'linkedin'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300'
                  }`}
                >
                  {copied === 'linkedin' ? '✓ Copied!' : 'Copy for LinkedIn'}
                </button>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
                <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans">
                  {linkedInText}
                </pre>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Post directly to job portals:
            </h4>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://recruiter.naukri.com/post-job"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm flex items-center gap-2"
              >
                <span>🔗</span> Post on Naukri
              </a>
              <a
                href="https://www.linkedin.com/talent/post-a-job"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-2"
              >
                <span>🔗</span> Post on LinkedIn
              </a>
              <a
                href="https://employers.indeed.com/p/post-job"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm flex items-center gap-2"
              >
                <span>🔗</span> Post on Indeed
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Vacancy Form Component
function VacancyForm({
  vacancy,
  onClose,
  onSave,
  isLoading,
}: {
  vacancy: Vacancy | null;
  onClose: () => void;
  onSave: (data: Partial<Vacancy>) => Promise<void>;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<Partial<Vacancy>>(
    vacancy || {
      title: '',
      department: '',
      location: '',
      employment_type: 'full_time',
      experience_min: 0,
      experience_max: undefined,
      salary_min: undefined,
      salary_max: undefined,
      openings_count: 1,
      job_description: '',
      requirements: '',
      responsibilities: '',
      benefits: '',
      skills_required: '',
      qualifications: '',
      status: 'draft',
      priority: 'medium',
    }
  );

  const generateJDMutation = useGenerateJobDescription();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateJD = async () => {
    if (!formData.title) {
      alert('Please enter a job title first');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateJDMutation.mutateAsync({
        title: formData.title,
        department: formData.department,
        experience_min: formData.experience_min,
        experience_max: formData.experience_max,
        skills_required: formData.skills_required,
      });

      setFormData((prev) => ({
        ...prev,
        job_description: result.job_description,
        responsibilities: result.responsibilities,
        requirements: result.requirements,
        qualifications: result.qualifications,
        benefits: result.benefits,
      }));
    } catch (error) {
      console.error('Error generating JD:', error);
      alert('Failed to generate job description. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {vacancy ? 'Edit Vacancy' : 'Create New Vacancy'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Job Title *
              </label>
              <input
                type="text"
                required
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="e.g., Software Developer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Department
              </label>
              <input
                type="text"
                value={formData.department || ''}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="e.g., Engineering"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Location
              </label>
              <input
                type="text"
                value={formData.location || ''}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="e.g., Noida, India"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Employment Type
              </label>
              <select
                value={formData.employment_type || 'full_time'}
                onChange={(e) => setFormData({ ...formData, employment_type: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Experience (Years)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={formData.experience_min || 0}
                  onChange={(e) => setFormData({ ...formData, experience_min: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Min"
                />
                <span className="flex items-center text-gray-500">to</span>
                <input
                  type="number"
                  min="0"
                  value={formData.experience_max || ''}
                  onChange={(e) => setFormData({ ...formData, experience_max: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Max"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Salary Range (₹/Year)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={formData.salary_min || ''}
                  onChange={(e) => setFormData({ ...formData, salary_min: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Min"
                />
                <span className="flex items-center text-gray-500">to</span>
                <input
                  type="number"
                  min="0"
                  value={formData.salary_max || ''}
                  onChange={(e) => setFormData({ ...formData, salary_max: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Max"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Number of Openings
              </label>
              <input
                type="number"
                min="1"
                value={formData.openings_count || 1}
                onChange={(e) => setFormData({ ...formData, openings_count: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Priority
              </label>
              <select
                value={formData.priority || 'medium'}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Skills */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Required Skills
            </label>
            <input
              type="text"
              value={formData.skills_required || ''}
              onChange={(e) => setFormData({ ...formData, skills_required: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g., React, Node.js, TypeScript"
            />
          </div>

          {/* AI Generate Button */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleGenerateJD}
              disabled={isGenerating || !formData.title}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Generating...
                </>
              ) : (
                <>
                  ✨ Generate JD with AI
                </>
              )}
            </button>
          </div>

          {/* Job Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Job Description
            </label>
            <textarea
              rows={4}
              value={formData.job_description || ''}
              onChange={(e) => setFormData({ ...formData, job_description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Brief description of the role..."
            />
          </div>

          {/* Responsibilities */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Responsibilities
            </label>
            <textarea
              rows={4}
              value={formData.responsibilities || ''}
              onChange={(e) => setFormData({ ...formData, responsibilities: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Key responsibilities (one per line)..."
            />
          </div>

          {/* Requirements */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Requirements
            </label>
            <textarea
              rows={4}
              value={formData.requirements || ''}
              onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Job requirements (one per line)..."
            />
          </div>

          {/* Qualifications */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Qualifications
            </label>
            <textarea
              rows={2}
              value={formData.qualifications || ''}
              onChange={(e) => setFormData({ ...formData, qualifications: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Educational qualifications..."
            />
          </div>

          {/* Benefits */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Benefits
            </label>
            <textarea
              rows={2}
              value={formData.benefits || ''}
              onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="What the company offers..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : vacancy ? 'Update Vacancy' : 'Create Vacancy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
