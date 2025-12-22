import { useState } from 'react';
import { useCreateProject, useUpdateProject } from '../hooks/useProjects';
import type { ProjectWithDetails, CompanyWithBranches, User } from '../types';

interface ProjectFormProps {
  project: ProjectWithDetails | null;
  companies: CompanyWithBranches[];
  users: User[];
  onClose: () => void;
}

export function ProjectForm({ project, companies, users, onClose }: ProjectFormProps) {
  const isEditing = !!project;
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();

  const [formData, setFormData] = useState({
    name: project?.name || '',
    branch_id: project?.branch_id || 0,
    assigned_to: project?.assigned_to || 0,
    start_date: project?.start_date || '',
    end_date: project?.end_date || '',
    status: project?.status || 'active',
    isActive: project?.isActive ?? true,
  });
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : name === 'branch_id' || name === 'assigned_to'
          ? parseInt(value) || 0
          : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Project name is required');
      return;
    }
    if (!formData.branch_id) {
      setError('Branch is required');
      return;
    }

    try {
      const submitData = {
        name: formData.name.trim(),
        branch_id: formData.branch_id,
        assigned_to: formData.assigned_to || undefined,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
      };

      if (isEditing) {
        await updateProject.mutateAsync({
          id: project.id,
          data: {
            ...submitData,
            status: formData.status as 'active' | 'completed' | 'on_hold',
            isActive: formData.isActive,
          },
        });
      } else {
        await createProject.mutateAsync(submitData);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project');
    }
  };

  const isPending = createProject.isPending || updateProject.isPending;

  // Get all branches with company names for the dropdown
  const branchOptions = companies.flatMap(company =>
    company.branches
      .filter(branch => branch.isActive)
      .map(branch => ({
        id: branch.id,
        label: `${branch.branch_name} (${company.name})`,
        name: branch.branch_name,
      }))
  );

  // Filter active users for assignment
  const activeUsers = users.filter(user => user.isActive !== false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Orange Header */}
        <div className="bg-orange-500 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Project</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Section Header */}
        <div className="bg-gray-100 px-6 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800">
            {isEditing ? 'Edit Project' : 'Add Project'}
          </h3>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-6">
            {/* Project Name */}
            <div>
              <label className="block text-sm font-medium text-orange-600 mb-1">
                * Name:
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder=""
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
              />
            </div>

            {/* Assigned To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assigned To:
              </label>
              <select
                name="assigned_to"
                value={formData.assigned_to}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value={0}>Assigned To</option>
                {activeUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date:
              </label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                placeholder="dd-mm-yyyy"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date:
              </label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleChange}
                placeholder="dd-mm-yyyy"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            {/* Branch */}
            <div>
              <label className="block text-sm font-medium text-orange-600 mb-1">
                * Branch name:
              </label>
              <select
                name="branch_id"
                value={formData.branch_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
              >
                <option value={0}>Branch Name</option>
                {branchOptions.map(branch => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status (only for editing) */}
            {isEditing && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status:
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                </select>
              </div>
            )}
          </div>

          {/* Required fields note */}
          <p className="mt-4 text-sm text-orange-600">* Required fields must be filled out.</p>

          {/* Active Status (only for editing) */}
          {isEditing && (
            <div className="mt-4 flex items-center gap-3">
              <input
                type="checkbox"
                id="isActive"
                name="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">
                Project is active
              </label>
            </div>
          )}

          {/* Submit Button */}
          <div className="mt-6">
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isPending && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
