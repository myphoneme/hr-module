import { useState, useRef } from 'react';
import { useBulkCreateProjects } from '../hooks/useProjects';
import type { CompanyWithBranches, CreateProjectInput } from '../types';

interface ProjectUploadProps {
  companies: CompanyWithBranches[];
  onClose: () => void;
}

export function ProjectUpload({ companies, onClose }: ProjectUploadProps) {
  const bulkCreate = useBulkCreateProjects();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<CreateProjectInput[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [uploadResult, setUploadResult] = useState<{
    successCount: number;
    errorCount: number;
    errors: string[];
  } | null>(null);

  // Create branch lookup map
  const branchMap = new Map<string, number>();
  companies.forEach(company => {
    company.branches.forEach(branch => {
      // Map by branch name (case insensitive)
      branchMap.set(branch.branch_name.toLowerCase(), branch.id);
      // Also map by "branch_name (company_name)"
      branchMap.set(`${branch.branch_name.toLowerCase()} (${company.name.toLowerCase()})`, branch.id);
    });
  });

  const downloadFormat = () => {
    const headers = ['Name', 'Branch Name', 'Assigned To Email', 'Start Date', 'End Date'];
    const sampleData = ['Sample Project', 'Head Office', 'user@example.com', '2024-01-01', '2024-12-31'];

    const csvContent = [headers.join(','), sampleData.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'project_upload_format.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setErrors([]);
    setParsedData([]);
    setUploadResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(selectedFile);
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      setErrors(['File must contain at least a header row and one data row']);
      return;
    }

    const parseErrors: string[] = [];
    const projects: CreateProjectInput[] = [];

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));

      if (values.length < 2) {
        parseErrors.push(`Row ${i + 1}: Missing required fields`);
        continue;
      }

      const [name, branchName, _assignedToEmail, startDate, endDate] = values;

      if (!name) {
        parseErrors.push(`Row ${i + 1}: Project name is required`);
        continue;
      }

      // Find branch by name
      const branchId = branchMap.get(branchName.toLowerCase());
      if (!branchId) {
        parseErrors.push(`Row ${i + 1}: Branch "${branchName}" not found`);
        continue;
      }

      projects.push({
        name,
        branch_id: branchId,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
    }

    setErrors(parseErrors);
    setParsedData(projects);
  };

  const handleUpload = async () => {
    if (parsedData.length === 0) return;

    try {
      const result = await bulkCreate.mutateAsync(parsedData);
      setUploadResult(result);
      if (result.errorCount === 0) {
        setTimeout(() => onClose(), 2000);
      }
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Upload failed']);
    }
  };

  const isPending = bulkCreate.isPending;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Orange Header */}
        <div className="bg-orange-500 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Project</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Section Header with Download Button */}
        <div className="bg-gray-100 px-6 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800">Upload Project</h3>
            <p className="text-sm text-blue-600">Please upload excel file of Project</p>
          </div>
          <button
            onClick={downloadFormat}
            className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors text-sm font-medium"
          >
            Download Format
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Choose File */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Choose File
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded file:border file:border-gray-300
                  file:text-sm file:font-medium
                  file:bg-white file:text-gray-700
                  hover:file:bg-gray-50"
              />
            </div>
            {file && (
              <p className="mt-2 text-sm text-gray-600">
                Selected: {file.name} ({parsedData.length} valid projects found)
              </p>
            )}
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="font-medium text-red-800 mb-2">Validation Errors:</h4>
              <ul className="text-sm text-red-700 space-y-1 max-h-32 overflow-y-auto">
                {errors.map((error, index) => (
                  <li key={index}>* {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Upload Result */}
          {uploadResult && (
            <div className={`p-4 rounded-lg ${
              uploadResult.errorCount === 0
                ? 'bg-green-50 border border-green-200'
                : 'bg-yellow-50 border border-yellow-200'
            }`}>
              <p className={`font-medium ${
                uploadResult.errorCount === 0 ? 'text-green-800' : 'text-yellow-800'
              }`}>
                {uploadResult.successCount} projects created successfully
                {uploadResult.errorCount > 0 && `, ${uploadResult.errorCount} failed`}
              </p>
              {uploadResult.errors.length > 0 && (
                <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                  {uploadResult.errors.map((error, index) => (
                    <li key={index}>* {error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Preview Table */}
          {parsedData.length > 0 && !uploadResult && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h4 className="font-medium text-gray-700">Preview ({parsedData.length} projects)</h4>
              </div>
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Branch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedData.slice(0, 10).map((project, index) => {
                      const branch = companies
                        .flatMap(c => c.branches)
                        .find(b => b.id === project.branch_id);
                      return (
                        <tr key={index}>
                          <td className="px-3 py-2 text-gray-500">{index + 1}</td>
                          <td className="px-3 py-2">{project.name}</td>
                          <td className="px-3 py-2 text-gray-600">{branch?.branch_name || '-'}</td>
                        </tr>
                      );
                    })}
                    {parsedData.length > 10 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-center text-gray-500">
                          ... and {parsedData.length - 10} more
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Upload Button */}
          <div className="pt-4">
            <button
              onClick={handleUpload}
              disabled={isPending || parsedData.length === 0}
              className="px-6 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isPending && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
