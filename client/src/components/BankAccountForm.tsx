import { useState } from 'react';
import { useCreateBankAccount, useUpdateBankAccount } from '../hooks/useBankAccounts';
import type { BankAccountWithBranch, BankAccountType, CompanyWithBranches, CreateBankAccountInput } from '../types';

interface BankAccountFormProps {
  account: BankAccountWithBranch | null;
  defaultType: BankAccountType;
  companies: CompanyWithBranches[];
  onClose: () => void;
}

const accountTypeLabels: Record<BankAccountType, string> = {
  savings: 'Savings Account',
  current: 'Current Account',
  credit_card: 'Credit Card',
  fd: 'Fixed Deposit',
  loan: 'Loan Account',
};

export function BankAccountForm({ account, defaultType, companies, onClose }: BankAccountFormProps) {
  const isEditing = !!account;
  const createAccount = useCreateBankAccount();
  const updateAccount = useUpdateBankAccount();

  const [formData, setFormData] = useState<CreateBankAccountInput>({
    branch_id: account?.branch_id || 0,
    account_type: account?.account_type || defaultType,
    account_name: account?.account_name || '',
    alias: account?.alias || '',
    account_number: account?.account_number || '',
    // Savings/Current
    institution_name: account?.institution_name || '',
    ifsc_code: account?.ifsc_code || '',
    swift_code: account?.swift_code || '',
    bank_address: account?.bank_address || '',
    bank_city: account?.bank_city || '',
    // Credit Card
    cc_credit_limit: account?.cc_credit_limit || undefined,
    cc_monthly_interest: account?.cc_monthly_interest || undefined,
    cc_issue_date: account?.cc_issue_date || '',
    cc_expiry_date: account?.cc_expiry_date || '',
    cc_cvv: account?.cc_cvv || '',
    cc_due_date: account?.cc_due_date || undefined,
    // FD
    fd_yearly_interest: account?.fd_yearly_interest || undefined,
    fd_amount: account?.fd_amount || undefined,
    fd_maturity_amount: account?.fd_maturity_amount || undefined,
    fd_tenure_months: account?.fd_tenure_months || undefined,
    fd_start_date: account?.fd_start_date || '',
    fd_maturity_date: account?.fd_maturity_date || '',
    // Loan
    loan_monthly_interest: account?.loan_monthly_interest || undefined,
    loan_amount: account?.loan_amount || undefined,
    loan_tenure_months: account?.loan_tenure_months || undefined,
    loan_first_emi_date: account?.loan_first_emi_date || '',
    loan_monthly_emi: account?.loan_monthly_emi || undefined,
  });
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value ? parseFloat(value) : undefined) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.branch_id || !formData.account_name || !formData.account_number) {
      setError('Branch, account name, and account number are required');
      return;
    }

    try {
      if (isEditing) {
        await updateAccount.mutateAsync({ id: account.id, data: formData });
      } else {
        await createAccount.mutateAsync(formData);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save account');
    }
  };

  const isPending = createAccount.isPending || updateAccount.isPending;
  const accountType = formData.account_type;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-gray-200 z-10">
          <h2 className="text-xl font-bold text-gray-900">
            {isEditing ? 'Edit' : 'Add'} {accountTypeLabels[accountType]}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Account Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Type <span className="text-red-500">*</span>
            </label>
            <select
              name="account_type"
              value={formData.account_type}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              disabled={isEditing}
            >
              <option value="savings">Savings Account</option>
              <option value="current">Current Account</option>
              <option value="credit_card">Credit Card</option>
              <option value="fd">Fixed Deposit</option>
              <option value="loan">Loan Account</option>
            </select>
          </div>

          {/* Branch Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Branch <span className="text-red-500">*</span>
            </label>
            <select
              name="branch_id"
              value={formData.branch_id}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              required
            >
              <option value="">Select Branch</option>
              {companies.map(company => (
                <optgroup key={company.id} label={company.name}>
                  {company.branches.map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.branch_name} ({branch.city})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Common Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="account_name"
                value={formData.account_name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alias</label>
              <input
                type="text"
                name="alias"
                value={formData.alias}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="account_number"
              value={formData.account_number}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
              required
            />
          </div>

          {/* Savings/Current Fields */}
          {(accountType === 'savings' || accountType === 'current') && (
            <>
              <div className="border-t border-gray-200 pt-4 mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Bank Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Institution Name</label>
                    <input
                      type="text"
                      name="institution_name"
                      value={formData.institution_name}
                      onChange={handleChange}
                      placeholder="e.g., ICICI Bank"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                    <input
                      type="text"
                      name="ifsc_code"
                      value={formData.ifsc_code}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SWIFT Code</label>
                    <input
                      type="text"
                      name="swift_code"
                      value={formData.swift_code}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      name="bank_city"
                      value={formData.bank_city}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Address</label>
                  <textarea
                    name="bank_address"
                    value={formData.bank_address}
                    onChange={handleChange}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>
            </>
          )}

          {/* Credit Card Fields */}
          {accountType === 'credit_card' && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Credit Card Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit</label>
                  <input
                    type="number"
                    name="cc_credit_limit"
                    value={formData.cc_credit_limit || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Interest %</label>
                  <input
                    type="number"
                    step="0.01"
                    name="cc_monthly_interest"
                    value={formData.cc_monthly_interest || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
                  <input
                    type="date"
                    name="cc_issue_date"
                    value={formData.cc_issue_date}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    name="cc_expiry_date"
                    value={formData.cc_expiry_date}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
                  <input
                    type="text"
                    name="cc_cvv"
                    value={formData.cc_cvv}
                    onChange={handleChange}
                    maxLength={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date (day of month)</label>
                  <input
                    type="number"
                    name="cc_due_date"
                    value={formData.cc_due_date || ''}
                    onChange={handleChange}
                    min={1}
                    max={31}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* FD Fields */}
          {accountType === 'fd' && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Fixed Deposit Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">FD Amount</label>
                  <input
                    type="number"
                    name="fd_amount"
                    value={formData.fd_amount || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Yearly Interest %</label>
                  <input
                    type="number"
                    step="0.01"
                    name="fd_yearly_interest"
                    value={formData.fd_yearly_interest || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tenure (months)</label>
                  <input
                    type="number"
                    name="fd_tenure_months"
                    value={formData.fd_tenure_months || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Maturity Amount</label>
                  <input
                    type="number"
                    name="fd_maturity_amount"
                    value={formData.fd_maturity_amount || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    name="fd_start_date"
                    value={formData.fd_start_date}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Maturity Date</label>
                  <input
                    type="date"
                    name="fd_maturity_date"
                    value={formData.fd_maturity_date}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Loan Fields */}
          {accountType === 'loan' && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Loan Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loan Amount</label>
                  <input
                    type="number"
                    name="loan_amount"
                    value={formData.loan_amount || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Interest %</label>
                  <input
                    type="number"
                    step="0.01"
                    name="loan_monthly_interest"
                    value={formData.loan_monthly_interest || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tenure (months)</label>
                  <input
                    type="number"
                    name="loan_tenure_months"
                    value={formData.loan_tenure_months || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly EMI</label>
                  <input
                    type="number"
                    name="loan_monthly_emi"
                    value={formData.loan_monthly_emi || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">First EMI Date</label>
                  <input
                    type="date"
                    name="loan_first_emi_date"
                    value={formData.loan_first_emi_date}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isPending && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              {isEditing ? 'Save Changes' : 'Add Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
