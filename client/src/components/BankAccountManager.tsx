import { useState } from 'react';
import { useBankAccountsByType, useDeleteBankAccount } from '../hooks/useBankAccounts';
import { useCompanies } from '../hooks/useCompanies';
import type { BankAccountWithBranch, BankAccountType } from '../types';
import { BankAccountForm } from './BankAccountForm';

interface BankAccountManagerProps {
  onBack: () => void;
}

const accountTypes: { id: BankAccountType; label: string; icon: string }[] = [
  { id: 'savings', label: 'Savings/Current', icon: '🏦' },
  { id: 'credit_card', label: 'Credit Card', icon: '💳' },
  { id: 'fd', label: 'Fixed Deposit', icon: '📊' },
  { id: 'loan', label: 'Loan', icon: '💰' },
];

export function BankAccountManager({ onBack }: BankAccountManagerProps) {
  const [activeTab, setActiveTab] = useState<BankAccountType>('savings');
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccountWithBranch | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: accounts, isLoading } = useBankAccountsByType(activeTab);
  const { data: companies } = useCompanies();
  const deleteAccount = useDeleteBankAccount();

  const handleAdd = () => {
    setEditingAccount(null);
    setShowForm(true);
  };

  const handleEdit = (account: BankAccountWithBranch) => {
    setEditingAccount(account);
    setShowForm(true);
  };

  const handleDelete = async (account: BankAccountWithBranch) => {
    if (confirm(`Are you sure you want to delete "${account.account_name}"?`)) {
      deleteAccount.mutate(account.id);
    }
  };

  const filteredAccounts = accounts?.filter(acc =>
    acc.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    acc.account_number.includes(searchTerm) ||
    acc.alias?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    acc.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    acc.branch_name.toLowerCase().includes(searchTerm.toLowerCase())
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
              <h1 className="text-2xl font-bold text-gray-900">Bank Accounts</h1>
              <p className="text-sm text-gray-500">Manage bank accounts linked to branches</p>
            </div>
          </div>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Account
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {accountTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setActiveTab(type.id)}
                className={`flex items-center gap-2 px-6 py-4 font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                  activeTab === type.id
                    ? 'text-orange-600 border-orange-500 bg-orange-50/50'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{type.icon}</span>
                <span>{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search accounts..."
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
        {!isLoading && (!filteredAccounts || filteredAccounts.length === 0) && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              {accountTypes.find(t => t.id === activeTab)?.icon}
            </div>
            <p className="text-lg text-gray-600">No {accountTypes.find(t => t.id === activeTab)?.label} accounts</p>
            <button
              onClick={handleAdd}
              className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              Add Account
            </button>
          </div>
        )}

        {/* Accounts Table */}
        {!isLoading && filteredAccounts && filteredAccounts.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alias</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Number</th>
                    {activeTab === 'savings' && (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bank</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IFSC</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                      </>
                    )}
                    {activeTab === 'credit_card' && (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Credit Limit</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Interest %</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry</th>
                      </>
                    )}
                    {activeTab === 'fd' && (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Interest %</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Maturity</th>
                      </>
                    )}
                    {activeTab === 'loan' && (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loan Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">EMI</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenure</th>
                      </>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAccounts.map((account) => (
                    <tr key={account.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 font-medium text-gray-900">{account.account_name}</td>
                      <td className="px-4 py-4 text-gray-500">{account.alias || '-'}</td>
                      <td className="px-4 py-4 font-mono text-sm">{account.account_number}</td>
                      {activeTab === 'savings' && (
                        <>
                          <td className="px-4 py-4">{account.institution_name}</td>
                          <td className="px-4 py-4 font-mono text-sm">{account.ifsc_code}</td>
                          <td className="px-4 py-4">{account.bank_city}</td>
                        </>
                      )}
                      {activeTab === 'credit_card' && (
                        <>
                          <td className="px-4 py-4">{account.cc_credit_limit?.toLocaleString()}</td>
                          <td className="px-4 py-4">{account.cc_monthly_interest}%</td>
                          <td className="px-4 py-4">{account.cc_expiry_date}</td>
                        </>
                      )}
                      {activeTab === 'fd' && (
                        <>
                          <td className="px-4 py-4">{account.fd_amount?.toLocaleString()}</td>
                          <td className="px-4 py-4">{account.fd_yearly_interest}%</td>
                          <td className="px-4 py-4">{account.fd_maturity_date}</td>
                        </>
                      )}
                      {activeTab === 'loan' && (
                        <>
                          <td className="px-4 py-4">{account.loan_amount?.toLocaleString()}</td>
                          <td className="px-4 py-4">{account.loan_monthly_emi?.toLocaleString()}</td>
                          <td className="px-4 py-4">{account.loan_tenure_months} months</td>
                        </>
                      )}
                      <td className="px-4 py-4">
                        <div className="text-sm">
                          <div className="font-medium text-gray-700">{account.branch_name}</div>
                          <div className="text-gray-500">{account.company_name}</div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(account)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(account)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

      {/* Form Modal */}
      {showForm && (
        <BankAccountForm
          account={editingAccount}
          defaultType={activeTab}
          companies={companies || []}
          onClose={() => {
            setShowForm(false);
            setEditingAccount(null);
          }}
        />
      )}
    </div>
  );
}
