import { useState } from 'react';
import { useSignatories, useDeleteSignatory } from '../hooks/useSignatories';
import type { Signatory } from '../types';
import { SignatoryForm } from './SignatoryForm';
import { signatoriesApi } from '../api/signatories';

interface SignatoryManagerProps {
  onBack: () => void;
}

export function SignatoryManager({ onBack }: SignatoryManagerProps) {
  const { data: signatories, isLoading } = useSignatories();
  const deleteSignatory = useDeleteSignatory();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSignatory, setEditingSignatory] = useState<Signatory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleEdit = (signatory: Signatory) => {
    setEditingSignatory(signatory);
    setShowAddModal(true);
  };

  const handleDelete = async (signatory: Signatory) => {
    if (confirm(`Are you sure you want to delete "${signatory.name}"?`)) {
      deleteSignatory.mutate(signatory.id);
    }
  };

  const filteredSignatories = signatories?.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase())
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
              <h1 className="text-2xl font-bold text-gray-900">Signatories</h1>
              <p className="text-sm text-gray-500">Manage letter signatories with signatures and stamps</p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingSignatory(null);
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Signatory
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {/* Search */}
        <div className="mb-4 flex items-center justify-end">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Search:</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Name, position, department..."
              className="px-3 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        </div>

        {/* Signatories List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredSignatories && filteredSignatories.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name & Position
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Images
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSignatories.map((signatory) => (
                  <tr key={signatory.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{signatory.name}</div>
                        <div className="text-sm text-gray-500">{signatory.position}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {signatory.email && (
                          <div className="flex items-center gap-1">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs">{signatory.email}</span>
                          </div>
                        )}
                        {signatory.phone && (
                          <div className="flex items-center gap-1 mt-1">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span className="text-xs">{signatory.phone}</span>
                          </div>
                        )}
                        {!signatory.email && !signatory.phone && (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {signatory.department || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {signatory.signatureImage ? (
                          <div className="relative group">
                            <img
                              src={signatoriesApi.getSignatureUrl(signatory.signatureImage)}
                              alt="Signature"
                              className="h-10 w-20 object-contain border border-gray-200 rounded cursor-pointer hover:border-orange-500"
                            />
                            <span className="absolute hidden group-hover:block bg-black text-white text-xs px-2 py-1 rounded -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                              Signature
                            </span>
                          </div>
                        ) : (
                          <div className="h-10 w-20 border border-dashed border-gray-300 rounded flex items-center justify-center">
                            <span className="text-xs text-gray-400">No Sig</span>
                          </div>
                        )}
                        {signatory.stampImage ? (
                          <div className="relative group">
                            <img
                              src={signatoriesApi.getStampUrl(signatory.stampImage)}
                              alt="Stamp"
                              className="h-10 w-20 object-contain border border-gray-200 rounded cursor-pointer hover:border-orange-500"
                            />
                            <span className="absolute hidden group-hover:block bg-black text-white text-xs px-2 py-1 rounded -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                              Stamp
                            </span>
                          </div>
                        ) : (
                          <div className="h-10 w-20 border border-dashed border-gray-300 rounded flex items-center justify-center">
                            <span className="text-xs text-gray-400">No Stamp</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {signatory.displayOrder}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(signatory)}
                        className="text-orange-600 hover:text-orange-900 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(signatory)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No signatories found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm ? 'Try adjusting your search criteria.' : 'Get started by creating a new signatory.'}
            </p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <SignatoryForm
          signatory={editingSignatory}
          onClose={() => {
            setShowAddModal(false);
            setEditingSignatory(null);
          }}
        />
      )}
    </div>
  );
}
