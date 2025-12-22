import { useState } from 'react';
import { useEmployees, useDeleteEmployee } from '../hooks/useEmployees';
import { useCompanies } from '../hooks/useCompanies';
import type { EmployeeWithBranch } from '../types';
import { EmployeeForm } from './EmployeeForm';

interface EmployeeManagerProps {
  onBack: () => void;
}

// Calculate age from date of birth
const calculateAge = (dob: string): number => {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
};

export function EmployeeManager({ onBack }: EmployeeManagerProps) {
  const { data: employees, isLoading } = useEmployees();
  const { data: companies } = useCompanies();
  const deleteEmployee = useDeleteEmployee();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithBranch | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleEdit = (employee: EmployeeWithBranch) => {
    setEditingEmployee(employee);
    setShowAddModal(true);
  };

  const handleDelete = async (employee: EmployeeWithBranch) => {
    if (confirm(`Are you sure you want to delete "${employee.employee_name}"?`)) {
      deleteEmployee.mutate(employee.id);
    }
  };

  const filteredEmployees = employees?.filter(e =>
    e.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.father_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.branch_name.toLowerCase().includes(searchTerm.toLowerCase())
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
              <h1 className="text-2xl font-bold text-gray-900">Employee</h1>
              <p className="text-sm text-gray-500">Manage employee information and records</p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingEmployee(null);
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Employee
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
        {!isLoading && (!filteredEmployees || filteredEmployees.length === 0) && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-lg text-gray-600">No employees found</p>
            <button
              onClick={() => {
                setEditingEmployee(null);
                setShowAddModal(true);
              }}
              className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              Add Employee
            </button>
          </div>
        )}

        {/* Employees Table */}
        {!isLoading && filteredEmployees && filteredEmployees.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-600 text-white">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium">SN</th>
                    <th className="px-3 py-3 text-left font-medium">Branch Name</th>
                    <th className="px-3 py-3 text-left font-medium">Employee Name</th>
                    <th className="px-3 py-3 text-left font-medium">Father Name</th>
                    <th className="px-3 py-3 text-left font-medium">Address</th>
                    <th className="px-3 py-3 text-left font-medium">DOB</th>
                    <th className="px-3 py-3 text-left font-medium">Age</th>
                    <th className="px-3 py-3 text-left font-medium">Email</th>
                    <th className="px-3 py-3 text-left font-medium">Personal Email</th>
                    <th className="px-3 py-3 text-left font-medium">Mobile No</th>
                    <th className="px-3 py-3 text-left font-medium">Designation</th>
                    <th className="px-3 py-3 text-left font-medium">City Type</th>
                    <th className="px-3 py-3 text-left font-medium">Document</th>
                    <th className="px-3 py-3 text-left font-medium">Image</th>
                    <th className="px-3 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredEmployees.map((employee, index) => (
                    <tr key={employee.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-3 text-gray-500">{index + 1}</td>
                      <td className="px-3 py-3 text-gray-600">{employee.branch_name}</td>
                      <td className="px-3 py-3 font-medium text-blue-600">{employee.employee_name}</td>
                      <td className="px-3 py-3 text-gray-600">{employee.father_name}</td>
                      <td className="px-3 py-3 text-gray-600 max-w-[200px] truncate">{employee.address || ''}</td>
                      <td className="px-3 py-3 text-gray-600">{employee.date_of_birth}</td>
                      <td className="px-3 py-3 text-gray-600">{calculateAge(employee.date_of_birth)}</td>
                      <td className="px-3 py-3 text-gray-600">{employee.email}</td>
                      <td className="px-3 py-3 text-gray-600">{employee.personal_email || ''}</td>
                      <td className="px-3 py-3 text-gray-600">{employee.mobile_number}</td>
                      <td className="px-3 py-3 text-gray-600">{employee.designation}</td>
                      <td className="px-3 py-3 text-gray-600">
                        {employee.city_type ? (employee.city_type === 'metro' ? 'Metro' : 'Non-Metro') : ''}
                      </td>
                      <td className="px-3 py-3">
                        {employee.document_path ? (
                          <a
                            href={`http://localhost:3001/api/employees/files/${employee.document_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            View
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {employee.image_path ? (
                          <img
                            src={`http://localhost:3001/api/employees/files/${employee.image_path}`}
                            alt={employee.employee_name}
                            className="w-10 h-10 object-cover rounded"
                          />
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(employee)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(employee)}
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
        <EmployeeForm
          employee={editingEmployee}
          companies={companies || []}
          onClose={() => {
            setShowAddModal(false);
            setEditingEmployee(null);
          }}
        />
      )}
    </div>
  );
}
