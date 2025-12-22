import { useState } from 'react';
import { useCompanies, useDeleteCompany } from '../hooks/useCompanies';
import { useDeleteBranch } from '../hooks/useBranches';
import type { CompanyWithBranches, Branch, Company } from '../types';
import { CompanyForm } from './CompanyForm';
import { BranchForm } from './BranchForm';

interface CompanyBranchManagerProps {
  onBack: () => void;
}

export function CompanyBranchManager({ onBack }: CompanyBranchManagerProps) {
  const { data: companies, isLoading } = useCompanies();
  const deleteCompany = useDeleteCompany();
  const deleteBranch = useDeleteBranch();

  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleAddCompany = () => {
    setEditingCompany(null);
    setShowCompanyForm(true);
  };

  const handleEditCompany = (company: Company) => {
    setEditingCompany(company);
    setShowCompanyForm(true);
  };

  const handleDeleteCompany = async (company: CompanyWithBranches) => {
    const branchCount = company.branches.length;
    const message = branchCount > 0
      ? `Are you sure you want to delete "${company.name}" and its ${branchCount} branch(es)?`
      : `Are you sure you want to delete "${company.name}"?`;

    if (confirm(message)) {
      deleteCompany.mutate(company.id);
    }
  };

  const handleAddBranch = (companyId: number) => {
    setSelectedCompanyId(companyId);
    setEditingBranch(null);
    setShowBranchForm(true);
  };

  const handleEditBranch = (branch: Branch) => {
    setSelectedCompanyId(branch.company_id);
    setEditingBranch(branch);
    setShowBranchForm(true);
  };

  const handleDeleteBranch = async (branch: Branch) => {
    if (confirm(`Are you sure you want to delete branch "${branch.branch_name}"?`)) {
      deleteBranch.mutate(branch.id);
    }
  };

  const filteredCompanies = companies?.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.pan_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.branches.some(branch =>
      branch.branch_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      branch.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      branch.gstin.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

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
              <h1 className="text-2xl font-bold text-gray-900">Company & Branches</h1>
              <p className="text-sm text-gray-500">Manage companies and their branch locations</p>
            </div>
          </div>
          <button
            onClick={handleAddCompany}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Company
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search companies, branches, cities, GSTIN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!filteredCompanies || filteredCompanies.length === 0) && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="text-lg text-gray-600">No companies found</p>
            <p className="text-sm text-gray-500 mt-2">
              {searchTerm ? 'Try a different search term' : 'Add your first company to get started'}
            </p>
            {!searchTerm && (
              <button
                onClick={handleAddCompany}
                className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                Add Company
              </button>
            )}
          </div>
        )}

        {/* Company Cards */}
        <div className="space-y-6">
          {filteredCompanies?.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              onEditCompany={() => handleEditCompany(company)}
              onDeleteCompany={() => handleDeleteCompany(company)}
              onAddBranch={() => handleAddBranch(company.id)}
              onEditBranch={handleEditBranch}
              onDeleteBranch={handleDeleteBranch}
            />
          ))}
        </div>
      </div>

      {/* Company Form Modal */}
      {showCompanyForm && (
        <CompanyForm
          company={editingCompany}
          onClose={() => {
            setShowCompanyForm(false);
            setEditingCompany(null);
          }}
        />
      )}

      {/* Branch Form Modal */}
      {showBranchForm && selectedCompanyId && (
        <BranchForm
          companyId={selectedCompanyId}
          branch={editingBranch}
          onClose={() => {
            setShowBranchForm(false);
            setEditingBranch(null);
            setSelectedCompanyId(null);
          }}
        />
      )}
    </div>
  );
}

interface CompanyCardProps {
  company: CompanyWithBranches;
  onEditCompany: () => void;
  onDeleteCompany: () => void;
  onAddBranch: () => void;
  onEditBranch: (branch: Branch) => void;
  onDeleteBranch: (branch: Branch) => void;
}

function CompanyCard({
  company,
  onEditCompany,
  onDeleteCompany,
  onAddBranch,
  onEditBranch,
  onDeleteBranch,
}: CompanyCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Company Header */}
      <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-white">
        <div className="flex items-center gap-4">
          {/* Company Logo */}
          <div className="w-16 h-16 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
            {company.logo ? (
              <img src={company.logo} alt={company.name} className="w-full h-full object-cover rounded-xl" />
            ) : (
              <span className="text-2xl font-bold text-white">
                {company.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Company Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-gray-900">{company.name}</h2>
              {!company.isActive && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                  Inactive
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                PAN: <span className="font-medium text-gray-700">{company.pan_no}</span>
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {company.branches.length} Branch{company.branches.length !== 1 ? 'es' : ''}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onAddBranch}
              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Add Branch"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={onEditCompany}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Edit Company"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={onDeleteCompany}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete Company"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors ml-2"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              <svg
                className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Branches Grid */}
      {isExpanded && (
        <div className="p-5">
          {company.branches.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No branches yet</p>
              <button
                onClick={onAddBranch}
                className="mt-2 text-orange-500 hover:text-orange-600 font-medium"
              >
                + Add first branch
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {company.branches.map((branch) => (
                <BranchCard
                  key={branch.id}
                  branch={branch}
                  onEdit={() => onEditBranch(branch)}
                  onDelete={() => onDeleteBranch(branch)}
                />
              ))}
              {/* Add Branch Card */}
              <button
                onClick={onAddBranch}
                className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-orange-400 hover:text-orange-500 transition-colors min-h-[200px]"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="font-medium">Add New Branch</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface BranchCardProps {
  branch: Branch;
  onEdit: () => void;
  onDelete: () => void;
}

function BranchCard({ branch, onEdit, onDelete }: BranchCardProps) {
  return (
    <div className={`bg-gray-50 rounded-xl p-4 border transition-all hover:shadow-md ${
      branch.is_head_office ? 'border-orange-300 bg-orange-50/50' : 'border-gray-200'
    }`}>
      {/* Branch Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            branch.is_head_office ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{branch.branch_name}</h3>
            {branch.is_head_office && (
              <span className="text-xs text-orange-600 font-medium">Head Office</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit Branch"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete Branch"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
          <span className="text-gray-600">{branch.address}</span>
        </div>

        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <span className="text-gray-600">{branch.city}, {branch.state_name}</span>
        </div>

        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="text-gray-600">PIN: {branch.pin_code}</span>
        </div>

        <div className="pt-2 mt-2 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-gray-500">GSTIN:</span>
            <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">
              {branch.gstin}
            </span>
          </div>
        </div>

        {!branch.isActive && (
          <div className="mt-2">
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
              Inactive
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
