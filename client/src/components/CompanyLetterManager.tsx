import { useState } from 'react';
import { PDFDownloadLink, pdf } from '@react-pdf/renderer';
import { ChevronLeft } from 'lucide-react';
import { useCompanyLetters, useCreateCompanyLetter, useUpdateCompanyLetter, useDeleteCompanyLetter } from '../hooks/useCompanyLetters';
import CompanyLetterForm from './CompanyLetterForm';
import { CompanyLetterPDF } from './CompanyLetterPDF';
import type { CompanyLetterWithDetails, CreateCompanyLetterInput } from '../types';

interface CompanyLetterManagerProps {
  onBack?: () => void;
}

export default function CompanyLetterManager({ onBack }: CompanyLetterManagerProps = {}) {
  const { data: letters, isLoading } = useCompanyLetters();
  const createMutation = useCreateCompanyLetter();
  const updateMutation = useUpdateCompanyLetter();
  const deleteMutation = useDeleteCompanyLetter();

  const [showForm, setShowForm] = useState(false);
  const [editingLetter, setEditingLetter] = useState<CompanyLetterWithDetails | null>(null);
  const [viewingLetter, setViewingLetter] = useState<CompanyLetterWithDetails | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const handleCreate = async (data: CreateCompanyLetterInput) => {
    try {
      await createMutation.mutateAsync(data);
      setShowForm(false);
    } catch (error) {
      console.error('Error creating company letter:', error);
      alert('Failed to create company letter');
    }
  };

  const handleUpdate = async (data: CreateCompanyLetterInput) => {
    if (!editingLetter) return;
    try {
      await updateMutation.mutateAsync({ id: editingLetter.id, data });
      setEditingLetter(null);
      setShowForm(false);
    } catch (error) {
      console.error('Error updating company letter:', error);
      alert('Failed to update company letter');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this company letter?')) return;
    try {
      await deleteMutation.mutateAsync(id);
    } catch (error) {
      console.error('Error deleting company letter:', error);
      alert('Failed to delete company letter');
    }
  };

  const handleEdit = (letter: CompanyLetterWithDetails) => {
    setEditingLetter(letter);
    setShowForm(true);
  };

  const handleFinalize = async (id: number) => {
    if (!confirm('Are you sure you want to finalize this letter? Finalized letters cannot be edited.')) {
      return;
    }
    try {
      await updateMutation.mutateAsync({ id, data: { status: 'finalized' } });
      alert('Letter finalized successfully!');
    } catch (error) {
      console.error('Error finalizing letter:', error);
      alert('Failed to finalize letter');
    }
  };

  const handleMarkAsSent = async (id: number) => {
    if (!confirm('Mark this letter as sent?')) return;
    try {
      await updateMutation.mutateAsync({ id, data: { status: 'sent' } });
      alert('Letter marked as sent!');
    } catch (error) {
      console.error('Error marking letter as sent:', error);
      alert('Failed to mark letter as sent');
    }
  };

  const handleDownload = async (letter: CompanyLetterWithDetails) => {
    try {
      setDownloadingId(letter.id);

      // Generate PDF blob
      const pdfDoc = <CompanyLetterPDF letter={letter} />;
      const blob = await pdf(pdfDoc).toBlob();

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `Letter_${letter.letterNumber || letter.id}_${letter.recipientName.replace(/\s+/g, '_')}_${new Date(letter.letterDate).toISOString().slice(0, 10).replace(/-/g, '')}.pdf`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading company letter:', error);
      alert('Failed to download company letter');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingLetter(null);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      draft: 'bg-yellow-100 text-yellow-800',
      finalized: 'bg-blue-100 text-blue-800',
      sent: 'bg-green-100 text-green-800',
    };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded ${colors[status as keyof typeof colors]}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  if (showForm) {
    return (
      <CompanyLetterForm
        letter={editingLetter}
        onSubmit={editingLetter ? handleUpdate : handleCreate}
        onCancel={handleCancel}
      />
    );
  }

  if (viewingLetter) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewingLetter(null)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back"
            >
              <ChevronLeft size={24} className="text-gray-700" />
            </button>
            <h2 className="text-2xl font-bold text-gray-900">Company Letter Preview</h2>
          </div>
          <div className="flex gap-2">
            <PDFDownloadLink
              document={<CompanyLetterPDF letter={viewingLetter} />}
              fileName={`Letter_${viewingLetter.letterNumber || viewingLetter.id}_${viewingLetter.recipientName.replace(/\s+/g, '_')}.pdf`}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
            >
              {({ loading }) => (loading ? 'Generating PDF...' : 'Download PDF')}
            </PDFDownloadLink>
          </div>
        </div>

        <div className="prose max-w-none border p-8 rounded bg-gray-50">
          {/* Letter Preview */}
          <div className="bg-white p-12 rounded shadow-sm">
            <div className="text-right text-sm mb-8">
              {viewingLetter.letterNumber && <p className="font-semibold">Ref: {viewingLetter.letterNumber}</p>}
              <p>Date: {formatDate(viewingLetter.letterDate)}</p>
            </div>

            <div className="mb-8">
              <p className="font-semibold">To,</p>
              <p className="font-semibold">{viewingLetter.recipientName}</p>
              <p className="whitespace-pre-line">{viewingLetter.recipientAddress}</p>
              {viewingLetter.recipientCity && (
                <p>
                  {viewingLetter.recipientCity}
                  {viewingLetter.recipientState && `, ${viewingLetter.recipientState}`}
                  {viewingLetter.recipientPincode && ` - ${viewingLetter.recipientPincode}`}
                </p>
              )}
            </div>

            <div className="mb-6">
              <p className="font-semibold">Subject: {viewingLetter.subject}</p>
            </div>

            <div className="mb-6">
              <p className="mb-4">{viewingLetter.greeting},</p>
              <div className="whitespace-pre-line">{viewingLetter.body}</div>
            </div>

            <div className="mt-12">
              <p>{viewingLetter.closing},</p>
              <p className="font-semibold mt-8">For Phoneme Solutions Private Limited</p>
              {viewingLetter.signatories && viewingLetter.signatories.length > 0 && (
                <div className="mt-8 space-y-6">
                  {viewingLetter.signatories.map((sig) => (
                    <div key={sig.id}>
                      <p className="font-semibold">{sig.name}</p>
                      <p className="text-sm">{sig.position}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h1 className="text-3xl font-bold text-gray-900">Company Letters</h1>
          </div>
          <button
            onClick={() => {
              setEditingLetter(null);
              setShowForm(true);
            }}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            Create Company Letter
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
            <p className="mt-4 text-gray-600">Loading company letters...</p>
          </div>
        ) : !letters || letters.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600 text-lg">No company letters found</p>
            <p className="text-gray-500 mt-2">Create your first company letter to get started</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Letter Info
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recipient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {letters.map((letter) => (
                  <tr key={letter.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {letter.letterNumber || `#${letter.id}`}
                      </div>
                      <div className="text-sm text-gray-500">{letter.creatorName}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{letter.recipientName}</div>
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {letter.recipientCity || letter.recipientAddress}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 truncate max-w-xs">{letter.subject}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(letter.letterDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(letter.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setViewingLetter(letter)}
                            className="text-blue-600 hover:text-blue-900 font-medium"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleDownload(letter)}
                            disabled={downloadingId === letter.id}
                            className="text-purple-600 hover:text-purple-900 font-medium disabled:text-gray-400"
                          >
                            {downloadingId === letter.id ? 'Downloading...' : 'Download'}
                          </button>
                        </div>
                        <div className="flex gap-2">
                          {letter.status === 'draft' && (
                            <>
                              <button
                                onClick={() => handleEdit(letter)}
                                className="text-indigo-600 hover:text-indigo-900 font-medium"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleFinalize(letter.id)}
                                className="text-green-600 hover:text-green-900 font-medium"
                              >
                                Finalize
                              </button>
                            </>
                          )}
                          {letter.status === 'finalized' && (
                            <button
                              onClick={() => handleMarkAsSent(letter.id)}
                              className="text-green-600 hover:text-green-900 font-medium"
                            >
                              Mark as Sent
                            </button>
                          )}
                          {letter.status === 'draft' && (
                            <button
                              onClick={() => handleDelete(letter.id)}
                              className="text-red-600 hover:text-red-900 font-medium"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
