import { useState } from 'react';
import { useRAG } from '../../hooks/useRAG';

export function HRDocumentsManager() {
  const {
    documents,
    isLoadingDocuments,
    uploadDocument,
    isUploadingDocument,
    deleteDocument,
  } = useRAG();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      setSelectedFile(file);
    } else {
      alert('Please upload PDF files only');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      await uploadDocument(selectedFile);
      setSelectedFile(null);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload document');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this document?')) {
      try {
        await deleteDocument(id);
      } catch (error) {
        console.error('Delete error:', error);
        alert('Failed to delete document');
      }
    }
  };

  const documentTypeIcons: Record<string, string> = {
    'offer_letter': '📄',
    'policy': '📋',
    'jd_template': '💼',
    'salary_structure': '💰',
    'interview_questions': '❓',
    'evaluation_form': '📝',
    'onboarding': '🎉',
    'nda': '🔒',
    'agreement': '🤝',
    'other': '📁',
  };

  const getDocumentType = (filename: string): string => {
    const lower = filename.toLowerCase();
    if (lower.includes('offer') && lower.includes('letter')) return 'offer_letter';
    if (lower.includes('policy') || lower.includes('handbook')) return 'policy';
    if (lower.includes('jd') || lower.includes('job description')) return 'jd_template';
    if (lower.includes('salary') || lower.includes('ctc')) return 'salary_structure';
    if (lower.includes('question')) return 'interview_questions';
    if (lower.includes('evaluation') || lower.includes('scorecard')) return 'evaluation_form';
    if (lower.includes('onboarding') || lower.includes('welcome')) return 'onboarding';
    if (lower.includes('nda') || lower.includes('confidential')) return 'nda';
    if (lower.includes('agreement') || lower.includes('contract')) return 'agreement';
    return 'other';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            HR Documents (RAG)
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Upload HR documents for AI to learn and use as reference
          </p>
        </div>
      </div>

      {/* Upload Section */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".pdf"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="hidden"
          id="file-upload"
        />

        {selectedFile ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl">📄</span>
              <div className="text-left">
                <p className="font-medium text-gray-900 dark:text-white">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setSelectedFile(null)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={isUploadingDocument}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isUploadingDocument ? 'Uploading...' : 'Upload Document'}
              </button>
            </div>
          </div>
        ) : (
          <label htmlFor="file-upload" className="cursor-pointer">
            <div className="space-y-2">
              <span className="text-4xl">📁</span>
              <p className="text-gray-600 dark:text-gray-400">
                Drag & drop PDF files here, or{' '}
                <span className="text-blue-600 hover:underline">browse</span>
              </p>
              <p className="text-xs text-gray-500">
                Supported: Offer Letters, Policies, JDs, Salary Structures, Interview Questions, etc.
              </p>
            </div>
          </label>
        )}
      </div>

      {/* Document Categories */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Object.entries(documentTypeIcons).map(([type, icon]) => {
          const count = documents?.filter(d => getDocumentType(d.original_name) === type).length || 0;
          return (
            <div
              key={type}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center"
            >
              <span className="text-2xl">{icon}</span>
              <p className="text-sm font-medium text-gray-900 dark:text-white mt-2 capitalize">
                {type.replace('_', ' ')}
              </p>
              <p className="text-xs text-gray-500">{count} docs</p>
            </div>
          );
        })}
      </div>

      {/* Document List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-medium text-gray-900 dark:text-white">
            Uploaded Documents ({documents?.length || 0})
          </h3>
        </div>

        {isLoadingDocuments ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : documents && documents.length > 0 ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {documents.map((doc) => {
              const docType = getDocumentType(doc.original_name);
              return (
                <div
                  key={doc.id}
                  className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{documentTypeIcons[docType]}</span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {doc.original_name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="capitalize">{docType.replace('_', ' ')}</span>
                        <span>•</span>
                        <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className={`px-1.5 py-0.5 rounded ${
                          doc.status === 'completed'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : doc.status === 'processing'
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                            : doc.status === 'failed'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {doc.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.extracted_text && (
                      <span className="text-xs text-gray-500">
                        {doc.extracted_text.length.toLocaleString()} chars
                      </span>
                    )}
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="text-red-600 hover:text-red-800 text-sm px-2 py-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-gray-500 dark:text-gray-400">
            <p>No documents uploaded yet.</p>
            <p className="text-sm mt-1">
              Upload HR documents to enable AI-powered features like JD generation, screening, and offer letter creation.
            </p>
          </div>
        )}
      </div>

      {/* Usage Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
          📘 How RAG Documents Are Used
        </h4>
        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <li>• <strong>Offer Letters:</strong> Used as templates for generating new offer letters with consistent formatting and language</li>
          <li>• <strong>Policies:</strong> Referenced when answering HR-related questions and generating compliance documents</li>
          <li>• <strong>JD Templates:</strong> Used to generate job descriptions matching company style</li>
          <li>• <strong>Salary Structures:</strong> Used for CTC breakdowns and salary benchmarking</li>
          <li>• <strong>Interview Questions:</strong> Used to generate role-specific interview questions</li>
        </ul>
      </div>
    </div>
  );
}
