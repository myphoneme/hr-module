import { useState } from 'react';
import { useProjects, useDeleteProject } from '../hooks/useProjects';
import { useCompanies } from '../hooks/useCompanies';
import { useUsers } from '../hooks/useUsers';
import type { ProjectWithDetails } from '../types';
import { ProjectForm } from './ProjectForm';
import { ProjectUpload } from './ProjectUpload';

interface ProjectManagerProps {
  onBack: () => void;
}

export function ProjectManager({ onBack }: ProjectManagerProps) {
  const { data: projects, isLoading } = useProjects();
  const { data: companies } = useCompanies();
  const { data: users } = useUsers();
  const deleteProject = useDeleteProject();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithDetails | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleEdit = (project: ProjectWithDetails) => {
    setEditingProject(project);
    setShowAddModal(true);
  };

  const handleDelete = async (project: ProjectWithDetails) => {
    if (confirm(`Are you sure you want to delete "${project.name}"?`)) {
      deleteProject.mutate(project.id);
    }
  };

  const filteredProjects = projects?.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.branch_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.assigned_to_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (date?: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Project</h1>
              <p className="text-sm text-gray-500">Manage projects and assignments</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload Project
            </button>
            <button
              onClick={() => {
                setEditingProject(null);
                setShowAddModal(true);
              }}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Project
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!filteredProjects || filteredProjects.length === 0) && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-lg text-gray-600">No projects found</p>
            <button
              onClick={() => {
                setEditingProject(null);
                setShowAddModal(true);
              }}
              className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              Add Project
            </button>
          </div>
        )}

        {/* Projects Table */}
        {!isLoading && filteredProjects && filteredProjects.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-600 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">SN</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Assigned To</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Start Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">End Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Branch</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProjects.map((project, index) => (
                    <tr key={project.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 text-gray-500">{index + 1}</td>
                      <td className="px-4 py-4 font-medium text-gray-900">{project.name}</td>
                      <td className="px-4 py-4 text-gray-600">{project.assigned_to_name || '-'}</td>
                      <td className="px-4 py-4 text-gray-600">{formatDate(project.start_date)}</td>
                      <td className="px-4 py-4 text-gray-600">{formatDate(project.end_date)}</td>
                      <td className="px-4 py-4">
                        <div className="text-sm">
                          <div className="text-gray-700">{project.branch_name}</div>
                          <div className="text-gray-400 text-xs">{project.company_name}</div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          project.status === 'completed' ? 'bg-green-100 text-green-700' :
                          project.status === 'on_hold' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {project.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(project)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(project)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
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
            <div className="px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
              Showing 1 to {filteredProjects.length} of {filteredProjects.length} entries
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <ProjectForm
          project={editingProject}
          companies={companies || []}
          users={users || []}
          onClose={() => {
            setShowAddModal(false);
            setEditingProject(null);
          }}
        />
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <ProjectUpload
          companies={companies || []}
          onClose={() => setShowUploadModal(false)}
        />
      )}
    </div>
  );
}
