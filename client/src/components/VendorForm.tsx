import { useState } from 'react';
import { useCreateVendor, useUpdateVendor } from '../hooks/useVendors';
import type { VendorWithDetails, CompanyWithBranches, ProjectWithDetails, BankAccountWithBranch, PartyType, VendorBankAccountType } from '../types';

interface VendorFormProps {
  vendor: VendorWithDetails | null;
  companies: CompanyWithBranches[];
  projects: ProjectWithDetails[];
  bankAccounts: BankAccountWithBranch[];
  onClose: () => void;
}

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
  'Andaman and Nicobar Islands', 'Dadra and Nagar Haveli', 'Daman and Diu', 'Lakshadweep'
];

const VENDOR_CATEGORIES = ['General', 'Service Provider', 'Supplier', 'Contractor', 'Consultant'];

export function VendorForm({ vendor, companies, projects, bankAccounts, onClose }: VendorFormProps) {
  const isEditing = !!vendor;
  const createVendor = useCreateVendor();
  const updateVendor = useUpdateVendor();

  const [formData, setFormData] = useState({
    vendor_name: vendor?.vendor_name || '',
    vendor_legal_name: vendor?.vendor_legal_name || '',
    gstin: vendor?.gstin || '',
    pan: vendor?.pan || '',
    email: vendor?.email || '',
    mobile_no: vendor?.mobile_no || '',
    address: vendor?.address || '',
    city: vendor?.city || '',
    state: vendor?.state || '',
    pincode: vendor?.pincode || '',
    party_type: vendor?.party_type || 'vendor' as PartyType,
    opening_date: vendor?.opening_date || '',
    opening_balance: vendor?.opening_balance || 0,
    msme_certificate: vendor?.msme_certificate || '',
    beneficiary_name: vendor?.beneficiary_name || '',
    bank_account_type: vendor?.bank_account_type || '' as VendorBankAccountType | '',
    account_number: vendor?.account_number || '',
    ifsc_code: vendor?.ifsc_code || '',
    branch_id: vendor?.branch_id || 0,
    project_id: vendor?.project_id || 0,
    category: vendor?.category || '',
    company_bank_account_id: vendor?.company_bank_account_id || 0,
    isActive: vendor?.isActive ?? true,
  });
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : type === 'number'
          ? parseFloat(value) || 0
          : name === 'branch_id' || name === 'project_id' || name === 'company_bank_account_id'
            ? parseInt(value) || 0
            : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.vendor_name.trim()) {
      setError('Vendor name is required');
      return;
    }
    if (!formData.branch_id) {
      setError('Company branch is required');
      return;
    }
    if (!formData.party_type) {
      setError('Party type is required');
      return;
    }

    try {
      const submitData = {
        vendor_name: formData.vendor_name.trim(),
        vendor_legal_name: formData.vendor_legal_name || undefined,
        gstin: formData.gstin || undefined,
        pan: formData.pan || undefined,
        email: formData.email || undefined,
        mobile_no: formData.mobile_no || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        pincode: formData.pincode || undefined,
        party_type: formData.party_type as PartyType,
        opening_date: formData.opening_date || undefined,
        opening_balance: formData.opening_balance,
        msme_certificate: formData.msme_certificate || undefined,
        beneficiary_name: formData.beneficiary_name || undefined,
        bank_account_type: formData.bank_account_type as VendorBankAccountType || undefined,
        account_number: formData.account_number || undefined,
        ifsc_code: formData.ifsc_code || undefined,
        branch_id: formData.branch_id,
        project_id: formData.project_id || undefined,
        category: formData.category || undefined,
        company_bank_account_id: formData.company_bank_account_id || undefined,
      };

      if (isEditing) {
        await updateVendor.mutateAsync({
          id: vendor.id,
          data: {
            ...submitData,
            isActive: formData.isActive,
          },
        });
      } else {
        await createVendor.mutateAsync(submitData);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save vendor');
    }
  };

  const isPending = createVendor.isPending || updateVendor.isPending;

  // Get all branches with company names for the dropdown
  const branchOptions = companies.flatMap(company =>
    company.branches
      .filter(branch => branch.isActive)
      .map(branch => ({
        id: branch.id,
        label: `${branch.branch_name} (${company.name})`,
      }))
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
        {/* Orange Header */}
        <div className="bg-orange-500 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Vendor</h2>
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
            {isEditing ? 'Edit Vendor' : 'Add Vendor'}
          </h3>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            {/* Row 1 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor GST Number:
              </label>
              <input
                type="text"
                name="gstin"
                value={formData.gstin}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-orange-600 mb-1">
                * Vendor Name:
              </label>
              <input
                type="text"
                name="vendor_name"
                value={formData.vendor_name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor Legal Name:
              </label>
              <input
                type="text"
                name="vendor_legal_name"
                value={formData.vendor_legal_name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            {/* Row 2 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor Email Id:
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor Mobile No.:
              </label>
              <input
                type="text"
                name="mobile_no"
                value={formData.mobile_no}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor Address:
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            {/* Row 3 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City:
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pin code:
              </label>
              <input
                type="text"
                name="pincode"
                value={formData.pincode}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor Bank Account Type:
              </label>
              <select
                name="bank_account_type"
                value={formData.bank_account_type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="">Vendor Bank Account Type</option>
                <option value="savings">Savings</option>
                <option value="current">Current</option>
                <option value="none">None</option>
              </select>
            </div>

            {/* Row 4 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Beneficiary name<span className="text-xs text-gray-500">(As Per Bank)</span>:
              </label>
              <input
                type="text"
                name="beneficiary_name"
                value={formData.beneficiary_name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor Account Number:
              </label>
              <input
                type="text"
                name="account_number"
                value={formData.account_number}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor Bank IFSC Code:
              </label>
              <input
                type="text"
                name="ifsc_code"
                value={formData.ifsc_code}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            {/* Row 5 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                MSME Certificate:
              </label>
              <input
                type="text"
                name="msme_certificate"
                value={formData.msme_certificate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor PAN:
              </label>
              <input
                type="text"
                name="pan"
                value={formData.pan}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Vendor State:
              </label>
              <select
                name="state"
                value={formData.state}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="">Select Vendor State</option>
                {INDIAN_STATES.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>

            {/* Row 6 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Vendor Project:
              </label>
              <select
                name="project_id"
                value={formData.project_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value={0}>Select Vendor Project</option>
                {projects.filter(p => p.isActive).map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Vendor Category:
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="">Select Vendor Category</option>
                {VENDOR_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Company Bank Account:
              </label>
              <select
                name="company_bank_account_id"
                value={formData.company_bank_account_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value={0}>Select Company Bank Account</option>
                {bankAccounts.filter(ba => ba.isActive).map(ba => (
                  <option key={ba.id} value={ba.id}>
                    {ba.account_name} ({ba.branch_name})
                  </option>
                ))}
              </select>
            </div>

            {/* Row 7 */}
            <div>
              <label className="block text-sm font-medium text-orange-600 mb-1">
                * Select Company Branch:
              </label>
              <select
                name="branch_id"
                value={formData.branch_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
              >
                <option value={0}>Select Company Branch</option>
                {branchOptions.map(branch => (
                  <option key={branch.id} value={branch.id}>
                    {branch.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Opening Balance Date:
              </label>
              <input
                type="date"
                name="opening_date"
                value={formData.opening_date}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-orange-600 mb-1">
                * Select party type:
              </label>
              <select
                name="party_type"
                value={formData.party_type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
              >
                <option value="">Select Party Type</option>
                <option value="vendor">Vendor</option>
                <option value="customer">Customer</option>
                <option value="both">Both</option>
              </select>
            </div>

            {/* Row 8 */}
            <div>
              <label className="block text-sm font-medium text-orange-600 mb-1">
                * Vendor Opening Balance:
              </label>
              <input
                type="number"
                name="opening_balance"
                value={formData.opening_balance}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>

          {/* Required fields note */}
          <p className="mt-4 text-sm text-orange-600">* Required fields must be filled out.</p>

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
