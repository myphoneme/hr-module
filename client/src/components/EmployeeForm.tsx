import { useState } from 'react';
import { useCreateEmployee, useUpdateEmployee } from '../hooks/useEmployees';
import type { EmployeeWithBranch, CompanyWithBranches, CityType } from '../types';

interface EmployeeFormProps {
  employee: EmployeeWithBranch | null;
  companies: CompanyWithBranches[];
  onClose: () => void;
}

const EVENT_TYPES = ['Birthday', 'Anniversary', 'Joining Day', 'Other'];

export function EmployeeForm({ employee, companies, onClose }: EmployeeFormProps) {
  const isEditing = !!employee;
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();

  const [formData, setFormData] = useState({
    branch_id: employee?.branch_id || 0,
    employee_name: employee?.employee_name || '',
    father_name: employee?.father_name || '',
    date_of_joining: employee?.date_of_joining || '',
    date_of_birth: employee?.date_of_birth || '',
    designation: employee?.designation || '',
    mobile_number: employee?.mobile_number || '',
    email: employee?.email || '',
    personal_email: employee?.personal_email || '',
    aadhar_no: employee?.aadhar_no || '',
    pan_no: employee?.pan_no || '',
    address: employee?.address || '',
    city_type: employee?.city_type || '' as CityType | '',
    event: employee?.event || '',
    event_date: employee?.event_date || '',
    monthly_rent: employee?.monthly_rent || 0,
    monthly_ctc: employee?.monthly_ctc || 0,
    isActive: employee?.isActive ?? true,
  });

  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [documentPreview, setDocumentPreview] = useState<string | null>(
    employee?.document_path || null
  );
  const [imagePreview, setImagePreview] = useState<string | null>(
    employee?.image_path || null
  );
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : type === 'number'
          ? parseFloat(value) || 0
          : name === 'branch_id'
            ? parseInt(value) || 0
            : value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'document' | 'image') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'document') {
      setDocumentFile(file);
      setDocumentPreview(file.name);
    } else {
      setImageFile(file);
      // Create image preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.employee_name.trim()) {
      setError('Employee name is required');
      return;
    }
    if (!formData.father_name.trim()) {
      setError('Father name is required');
      return;
    }
    if (!formData.branch_id) {
      setError('Branch is required');
      return;
    }
    if (!formData.date_of_joining) {
      setError('Date of joining is required');
      return;
    }
    if (!formData.date_of_birth) {
      setError('Date of birth is required');
      return;
    }
    if (!formData.designation.trim()) {
      setError('Designation is required');
      return;
    }
    if (!formData.mobile_number.trim()) {
      setError('Mobile number is required');
      return;
    }
    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }

    try {
      const submitData = {
        branch_id: formData.branch_id,
        employee_name: formData.employee_name.trim(),
        father_name: formData.father_name.trim(),
        date_of_joining: formData.date_of_joining,
        date_of_birth: formData.date_of_birth,
        designation: formData.designation.trim(),
        mobile_number: formData.mobile_number.trim(),
        email: formData.email.trim(),
        personal_email: formData.personal_email || undefined,
        aadhar_no: formData.aadhar_no || undefined,
        pan_no: formData.pan_no || undefined,
        address: formData.address || undefined,
        city_type: formData.city_type as CityType || undefined,
        event: formData.event || undefined,
        event_date: formData.event_date || undefined,
        monthly_rent: formData.monthly_rent || undefined,
        monthly_ctc: formData.monthly_ctc || undefined,
        document: documentFile || undefined,
        image: imageFile || undefined,
      };

      if (isEditing) {
        await updateEmployee.mutateAsync({
          id: employee.id,
          data: {
            ...submitData,
            isActive: formData.isActive,
          },
        });
      } else {
        await createEmployee.mutateAsync(submitData);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save employee');
    }
  };

  const isPending = createEmployee.isPending || updateEmployee.isPending;

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
          <h2 className="text-lg font-semibold">Add Employee</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            {/* Row 1 */}
            <div>
              <label className="block text-sm font-medium text-orange-600 mb-1">
                * Branch Name:
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
                    {branch.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-orange-600 mb-1">
                * Employee Name:
              </label>
              <input
                type="text"
                name="employee_name"
                value={formData.employee_name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-orange-600 mb-1">
                * Father Name:
              </label>
              <input
                type="text"
                name="father_name"
                value={formData.father_name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
              />
            </div>

            {/* Row 2 */}
            <div>
              <label className="block text-sm font-medium text-orange-600 mb-1">
                * Date of Joining:
              </label>
              <input
                type="date"
                name="date_of_joining"
                value={formData.date_of_joining}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-orange-600 mb-1">
                * Date of Birth:
              </label>
              <input
                type="date"
                name="date_of_birth"
                value={formData.date_of_birth}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-orange-600 mb-1">
                * Designation:
              </label>
              <input
                type="text"
                name="designation"
                value={formData.designation}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
              />
            </div>

            {/* Row 3 */}
            <div>
              <label className="block text-sm font-medium text-orange-600 mb-1">
                * Mobile Number:
              </label>
              <input
                type="tel"
                name="mobile_number"
                value={formData.mobile_number}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email:
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                * Personal Email:
              </label>
              <input
                type="email"
                name="personal_email"
                value={formData.personal_email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            {/* Row 4 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Aadhar No:
              </label>
              <input
                type="text"
                name="aadhar_no"
                value={formData.aadhar_no}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pan No:
              </label>
              <input
                type="text"
                name="pan_no"
                value={formData.pan_no}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address:
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            {/* Row 5 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                * Select City Type:
              </label>
              <select
                name="city_type"
                value={formData.city_type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="">Non-Metro</option>
                <option value="metro">Metro</option>
                <option value="non_metro">Non-Metro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                * Select Event:
              </label>
              <select
                name="event"
                value={formData.event}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="">Select Event</option>
                {EVENT_TYPES.map(event => (
                  <option key={event} value={event}>{event}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                * Event Date:
              </label>
              <input
                type="date"
                name="event_date"
                value={formData.event_date}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            {/* Row 6 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                * Monthly Rent:
              </label>
              <input
                type="number"
                step="0.01"
                name="monthly_rent"
                value={formData.monthly_rent}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                * Monthly CTC:
              </label>
              <input
                type="number"
                step="0.01"
                name="monthly_ctc"
                value={formData.monthly_ctc}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            {/* Row 7 - File uploads */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Document:
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => handleFileChange(e, 'document')}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
              />
              {documentPreview && (
                <p className="mt-1 text-xs text-gray-600">
                  {documentFile ? documentFile.name : 'Current file: ' + documentPreview}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Image:
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'image')}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
              />
              {imagePreview && (
                <div className="mt-2">
                  <img
                    src={imagePreview.startsWith('data:') ? imagePreview : `/api/employees/files/${imagePreview}`}
                    alt="Preview"
                    className="w-20 h-20 object-cover rounded border border-gray-300"
                  />
                </div>
              )}
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
