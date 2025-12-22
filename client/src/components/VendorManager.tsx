import { useState } from 'react';
import { useVendors, useDeleteVendor } from '../hooks/useVendors';
import { useCompanies } from '../hooks/useCompanies';
import { useProjects } from '../hooks/useProjects';
import { useBankAccounts } from '../hooks/useBankAccounts';
import type { VendorWithDetails } from '../types';
import { VendorForm } from './VendorForm';

interface VendorManagerProps {
  onBack: () => void;
}

export function VendorManager({ onBack }: VendorManagerProps) {
  const { data: vendors, isLoading } = useVendors();
  const { data: companies } = useCompanies();
  const { data: projects } = useProjects();
  const { data: bankAccounts } = useBankAccounts();
  const deleteVendor = useDeleteVendor();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorWithDetails | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleEdit = (vendor: VendorWithDetails) => {
    setEditingVendor(vendor);
    setShowAddModal(true);
  };

  const handleDelete = async (vendor: VendorWithDetails) => {
    if (confirm(`Are you sure you want to delete "${vendor.vendor_name}"?`)) {
      deleteVendor.mutate(vendor.id);
    }
  };

  const filteredVendors = vendors?.filter(v =>
    v.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.gstin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.pan?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.email?.toLowerCase().includes(searchTerm.toLowerCase())
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
              <h1 className="text-2xl font-bold text-gray-900">Vendor</h1>
              <p className="text-sm text-gray-500">Manage vendors and suppliers</p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingVendor(null);
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Vendor
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
              className="px-3 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
        {!isLoading && (!filteredVendors || filteredVendors.length === 0) && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-lg text-gray-600">No vendors found</p>
            <button
              onClick={() => {
                setEditingVendor(null);
                setShowAddModal(true);
              }}
              className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              Add Vendor
            </button>
          </div>
        )}

        {/* Vendors Table */}
        {!isLoading && filteredVendors && filteredVendors.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-600 text-white">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium">SN</th>
                    <th className="px-3 py-3 text-left font-medium">Vendor Name</th>
                    <th className="px-3 py-3 text-left font-medium">GSTIN</th>
                    <th className="px-3 py-3 text-left font-medium">PAN</th>
                    <th className="px-3 py-3 text-left font-medium">Address</th>
                    <th className="px-3 py-3 text-left font-medium">Pincode</th>
                    <th className="px-3 py-3 text-left font-medium">State</th>
                    <th className="px-3 py-3 text-left font-medium">City</th>
                    <th className="px-3 py-3 text-left font-medium">Party type</th>
                    <th className="px-3 py-3 text-left font-medium">Opening Date</th>
                    <th className="px-3 py-3 text-left font-medium">Opening balance</th>
                    <th className="px-3 py-3 text-left font-medium">Email</th>
                    <th className="px-3 py-3 text-left font-medium">Mobile no</th>
                    <th className="px-3 py-3 text-left font-medium">Beneficiary Name</th>
                    <th className="px-3 py-3 text-left font-medium">Account type</th>
                    <th className="px-3 py-3 text-left font-medium">Account No</th>
                    <th className="px-3 py-3 text-left font-medium">IFSC code</th>
                    <th className="px-3 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredVendors.map((vendor, index) => (
                    <tr key={vendor.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-3 text-gray-500">{index + 1}</td>
                      <td className="px-3 py-3 font-medium text-blue-600">{vendor.vendor_name}</td>
                      <td className="px-3 py-3 text-gray-600">{vendor.gstin || ''}</td>
                      <td className="px-3 py-3 text-gray-600">{vendor.pan || ''}</td>
                      <td className="px-3 py-3 text-gray-600 max-w-[200px] truncate">{vendor.address || ''}</td>
                      <td className="px-3 py-3 text-gray-600">{vendor.pincode || ''}</td>
                      <td className="px-3 py-3 text-gray-600">{vendor.state || ''}</td>
                      <td className="px-3 py-3 text-gray-600">{vendor.city || ''}</td>
                      <td className="px-3 py-3 text-gray-600">{vendor.party_type}</td>
                      <td className="px-3 py-3 text-gray-600">{vendor.opening_date || ''}</td>
                      <td className="px-3 py-3 text-gray-600">{vendor.opening_balance}</td>
                      <td className="px-3 py-3 text-gray-600">{vendor.email || ''}</td>
                      <td className="px-3 py-3 text-gray-600">{vendor.mobile_no || ''}</td>
                      <td className="px-3 py-3 text-gray-600">{vendor.beneficiary_name || ''}</td>
                      <td className="px-3 py-3 text-gray-600">{vendor.bank_account_type || ''}</td>
                      <td className="px-3 py-3 text-gray-600">{vendor.account_number || ''}</td>
                      <td className="px-3 py-3 text-gray-600">{vendor.ifsc_code || ''}</td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(vendor)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(vendor)}
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
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <VendorForm
          vendor={editingVendor}
          companies={companies || []}
          projects={projects || []}
          bankAccounts={bankAccounts || []}
          onClose={() => {
            setShowAddModal(false);
            setEditingVendor(null);
          }}
        />
      )}
    </div>
  );
}
