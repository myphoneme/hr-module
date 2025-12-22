import { useState, useMemo } from 'react';
import { useCategoryGroups, useDeleteCategoryGroup } from '../hooks/useCategoryGroup';
import type { CategoryGroupWithTransactionNature } from '../types';
import { CategoryGroupForm } from './CategoryGroupForm';

interface CategoryGroupManagerProps {
  onBack: () => void;
}

const ITEMS_PER_PAGE = 10;

export function CategoryGroupManager({ onBack }: CategoryGroupManagerProps) {
  const { data: categoryGroups, isLoading } = useCategoryGroups();
  const deleteCategoryGroup = useDeleteCategoryGroup();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategoryGroup, setEditingCategoryGroup] = useState<CategoryGroupWithTransactionNature | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const handleEdit = (categoryGroup: CategoryGroupWithTransactionNature) => {
    setEditingCategoryGroup(categoryGroup);
    setShowAddModal(true);
  };

  const handleDelete = async (categoryGroup: CategoryGroupWithTransactionNature) => {
    if (confirm(`Are you sure you want to delete "${categoryGroup.name}"?`)) {
      deleteCategoryGroup.mutate(categoryGroup.id);
    }
  };

  // Filter and paginate data
  const filteredData = useMemo(() => {
    if (!categoryGroups) return [];
    return categoryGroups.filter(cg =>
      cg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cg.transaction_nature_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [categoryGroups, searchTerm]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
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
              <h1 className="text-2xl font-bold text-gray-900">Category Group</h1>
              <p className="text-sm text-gray-500">Manage category groups by transaction nature</p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingCategoryGroup(null);
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Category Group
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {/* Search and Count */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {paginatedData.length} of {filteredData.length} entries
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Search:</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Search..."
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
        {!isLoading && filteredData.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <p className="text-lg text-gray-600">
              {searchTerm ? 'No category groups found matching your search' : 'No category groups found'}
            </p>
            <button
              onClick={() => {
                setEditingCategoryGroup(null);
                setShowAddModal(true);
              }}
              className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              Add Category Group
            </button>
          </div>
        )}

        {/* Category Groups Table */}
        {!isLoading && paginatedData.length > 0 && (
          <>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-600 text-white">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium w-20">S No.</th>
                      <th className="px-4 py-3 text-left font-medium">Transaction Nature</th>
                      <th className="px-4 py-3 text-left font-medium">Category Group Name</th>
                      <th className="px-4 py-3 text-right font-medium w-32">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedData.map((categoryGroup, index) => (
                      <tr key={categoryGroup.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 text-gray-500">
                          {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{categoryGroup.transaction_nature_name}</td>
                        <td className="px-4 py-3 font-medium text-blue-600">{categoryGroup.name}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEdit(categoryGroup)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(categoryGroup)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Previous
                  </button>
                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(page => {
                        return (
                          page === 1 ||
                          page === totalPages ||
                          Math.abs(page - currentPage) <= 1
                        );
                      })
                      .map((page, index, arr) => {
                        const prevPage = arr[index - 1];
                        const showEllipsis = prevPage && page - prevPage > 1;

                        return (
                          <div key={page} className="flex gap-1">
                            {showEllipsis && (
                              <span className="px-3 py-1.5 text-gray-500">...</span>
                            )}
                            <button
                              onClick={() => setCurrentPage(page)}
                              className={`px-3 py-1.5 border rounded text-sm ${
                                currentPage === page
                                  ? 'bg-orange-500 text-white border-orange-500'
                                  : 'bg-white border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {page}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Last
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <CategoryGroupForm
          categoryGroup={editingCategoryGroup}
          onClose={() => {
            setShowAddModal(false);
            setEditingCategoryGroup(null);
          }}
        />
      )}
    </div>
  );
}
