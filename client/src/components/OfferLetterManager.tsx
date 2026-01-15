import { useState, useEffect } from 'react';
import { PDFDownloadLink, pdf } from '@react-pdf/renderer';
import { useOfferLetters } from '../hooks/useOfferLetters';
import { useRAG } from '../hooks/useRAG';
import { useSignatories } from '../hooks/useSignatories';
import { OfferLetterPDF } from './OfferLetterPDF';
import UploadOfferLetterExtractor from './UploadOfferLetterExtractor';
import type { OfferLetterWithSignatory, CreateOfferLetterInput, SalaryComponent, KRADetail } from '../types';

interface OfferLetterManagerProps {
  onBack?: () => void;
}

type ViewMode = 'list' | 'generate' | 'edit' | 'preview' | 'upload-existing';


export default function OfferLetterManager({ onBack }: OfferLetterManagerProps = {}) {
  const {
    offerLetters,
    isLoading,
    createOfferLetter,
    updateOfferLetter,
    deleteOfferLetter,
    generateOfferLetter,
    isCreating,
  } = useOfferLetters();

  const {
    quickGenerate,
    isQuickGenerating,
    quickGeneratedData,
    resetQuickGeneration,
    stats,
  } = useRAG();

  const { data: signatories } = useSignatories();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingLetter, setEditingLetter] = useState<OfferLetterWithSignatory | null>(null);
  const [editedData, setEditedData] = useState<CreateOfferLetterInput | null>(null);
  const [viewingContent, setViewingContent] = useState<any>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize edited data when RAG generation completes
  useEffect(() => {
    if (quickGeneratedData?.offer_letter?.offer_letter_data) {
      setEditedData({ ...quickGeneratedData.offer_letter.offer_letter_data });
      setViewMode('edit');
    }
  }, [quickGeneratedData]);

  // Initialize edited data when editing existing letter
  useEffect(() => {
    if (editingLetter) {
      // Parse salary_breakdown if it's a string (from DB)
      let salaryBreakdown: SalaryComponent[] = editingLetter.salary_breakdown as unknown as SalaryComponent[];
      if (typeof salaryBreakdown === 'string') {
        try {
          salaryBreakdown = JSON.parse(salaryBreakdown) as SalaryComponent[];
        } catch {
          salaryBreakdown = [];
        }
      }
      if (!Array.isArray(salaryBreakdown)) {
        salaryBreakdown = [];
      }
      
      let kraDetails: KRADetail[] = editingLetter.kra_details as unknown as KRADetail[];
      if (typeof kraDetails === 'string') {
        try {
          kraDetails = JSON.parse(kraDetails) as KRADetail[];
        } catch {
          kraDetails = [];
        }
      }
      if (!Array.isArray(kraDetails)) {
        kraDetails = [];
      }

      setEditedData({
        candidate_name: editingLetter.candidate_name,
        candidate_address: editingLetter.candidate_address,
        designation: editingLetter.designation,
        joining_date: editingLetter.joining_date,
        annual_ctc: editingLetter.annual_ctc,
        salary_breakdown: salaryBreakdown,
        kra_details: kraDetails,
        joining_bonus: editingLetter.joining_bonus,
        offer_valid_till: editingLetter.offer_valid_till,
        letter_date: editingLetter.letter_date, // Added letter_date
        hr_manager_name: editingLetter.hr_manager_name,
        hr_manager_title: editingLetter.hr_manager_title,
        working_location: editingLetter.working_location,
        signatory_id: editingLetter.signatory_id,
        secondary_signatory_id: editingLetter.secondary_signatory_id,
      });
      setViewMode('edit');
    }
  }, [editingLetter]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }

    setError(null);
    try {
      await quickGenerate(file);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleCreate = async () => {
    if (!editedData) return;
    try {
      await createOfferLetter(editedData);
      resetQuickGeneration();
      setEditedData(null);
      setEditingLetter(null);
      setViewMode('list');
    } catch (error: any) {
      console.error('Error creating offer letter:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Unknown error';
      alert(`Failed to create offer letter: ${errorMessage}`);
    }
  };

  const handleUpdate = async () => {
    if (!editingLetter || !editedData) return;
    try {
      await updateOfferLetter(editingLetter.id, editedData);
      setEditingLetter(null);
      setEditedData(null);
      setViewMode('list');
    } catch (error) {
      console.error('Error updating offer letter:', error);
      alert('Failed to update offer letter');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this offer letter?')) return;
    try {
      await deleteOfferLetter(id);
    } catch (error) {
      console.error('Error deleting offer letter:', error);
      alert('Failed to delete offer letter');
    }
  };

  const handleEdit = (letter: OfferLetterWithSignatory) => {
    setEditingLetter(letter);
  };

  const handleView = async (id: number) => {
    try {
      if (viewMode === 'edit' && editingLetter && editedData) {
        await updateOfferLetter(editingLetter.id, editedData);
      }
      const content = await generateOfferLetter(id);
      setViewingContent(content);
      setViewMode('preview');
    } catch (error) {
      console.error('Error generating offer letter:', error);
      alert('Failed to generate offer letter');
    }
  };

  const handleApprove = async (id: number) => {
    if (!confirm('Are you sure you want to approve this offer letter? Approved letters cannot be edited.')) {
      return;
    }
    try {
      await updateOfferLetter(id, { status: 'approved' });
      alert('Offer letter approved successfully!');
    } catch (error: any) {
      console.error('Error approving offer letter:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Unknown error';
      alert(`Failed to approve offer letter: ${errorMessage}`);
    }
  };

  const handleDownload = async (id: number, candidateName: string) => {
    try {
      setDownloadingId(id);
      if (viewMode === 'edit' && editingLetter && editedData) {
        await updateOfferLetter(editingLetter.id, editedData);
      }
      const content = await generateOfferLetter(id);

      // Generate PDF blob
      const pdfDoc = <OfferLetterPDF letterContent={content} />;
      const blob = await pdf(pdfDoc).toBlob();

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `OfferLetter_${candidateName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading offer letter:', error);
      alert('Failed to download offer letter');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCancel = () => {
    setViewMode('list');
    setEditingLetter(null);
    setEditedData(null);
    resetQuickGeneration();
    setViewingContent(null);
  };

  const updateField = (field: keyof CreateOfferLetterInput, value: any) => {
    if (!editedData) return;
    setEditedData({ ...editedData, [field]: value });
  };

  const updateSalaryComponent = (index: number, field: 'component' | 'perMonth', value: string | number) => {
    if (!editedData || !editedData.salary_breakdown) return;
    const newBreakdown = [...editedData.salary_breakdown];

    if (field === 'component') {
      newBreakdown[index] = { ...newBreakdown[index], component: value as string };
    } else {
      const perMonth = value as number;
      newBreakdown[index] = { ...newBreakdown[index], perMonth, annual: perMonth * 12 };
    }

    // Recalculate total CTC
    const totalAnnual = newBreakdown.reduce((sum, item) => sum + (item.annual || 0), 0);
    setEditedData({ ...editedData, salary_breakdown: newBreakdown, annual_ctc: totalAnnual });
  };

  const addSalaryComponent = () => {
    if (!editedData) return;
    const newBreakdown = [...(editedData.salary_breakdown || []), { component: 'New Component', perMonth: 0, annual: 0 }];
    setEditedData({ ...editedData, salary_breakdown: newBreakdown });
  };

  const removeSalaryComponent = (index: number) => {
    if (!editedData || !editedData.salary_breakdown) return;
    const newBreakdown = editedData.salary_breakdown.filter((_, i) => i !== index);
    const totalAnnual = newBreakdown.reduce((sum, item) => sum + (item.annual || 0), 0);
    setEditedData({ ...editedData, salary_breakdown: newBreakdown, annual_ctc: totalAnnual });
  };

  const updateKra = (index: number, value: string) => {
    if (!editedData || !editedData.kra_details) return;
    const newKras = [...editedData.kra_details];
    newKras[index] = { responsibility: value };
    setEditedData({ ...editedData, kra_details: newKras });
  };

  const addKra = () => {
    if (!editedData) return;
    const newKras = [...(editedData.kra_details || []), { responsibility: 'New Responsibility' }];
    setEditedData({ ...editedData, kra_details: newKras });
  };

  const removeKra = (index: number) => {
    if (!editedData || !editedData.kra_details) return;
    const newKras = editedData.kra_details.filter((_, i) => i !== index);
    setEditedData({ ...editedData, kra_details: newKras });
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
      draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded ${colors[status as keyof typeof colors]}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  // Preview View
  if (viewMode === 'preview' && viewingContent) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-5xl mx-auto bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={handleCancel}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Offer Letter Preview</h2>
            </div>
            <PDFDownloadLink
              document={<OfferLetterPDF letterContent={viewingContent} />}
              fileName={`OfferLetter_${viewingContent.to?.replace(/\s+/g, '_') || 'document'}_${Date.now()}.pdf`}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
            >
              {({ loading }) => (loading ? 'Generating PDF...' : 'Download PDF')}
            </PDFDownloadLink>
          </div>

          <div className="prose dark:prose-invert max-w-none">
            {/* Preview content - simplified */}
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold">{viewingContent.header}</h1>
              <p className="text-right text-sm mt-2">{viewingContent.date}</p>
            </div>

            <div className="mb-4">
              <p className="font-semibold">To,</p>
              <p className="font-semibold">{viewingContent.to},</p>
              <p className="whitespace-pre-line">{viewingContent.address}</p>
            </div>

            <p className="font-semibold mb-4">Subject: {viewingContent.subject}</p>

            <p className="font-semibold mb-2">{viewingContent.body?.greeting}</p>
            <p className="font-semibold mb-4">{viewingContent.body?.congratulations}</p>
            <p className="mb-4">{viewingContent.body?.opening}</p>

            {/* Annexure */}
            {viewingContent.annexure && (
              <div className="mt-8">
                <h2 className="text-2xl font-bold text-center mb-6">{viewingContent.annexure.title}</h2>
                <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-700">
                      <th className="border border-gray-300 dark:border-gray-600 px-4 py-2">Component</th>
                      <th className="border border-gray-300 dark:border-gray-600 px-4 py-2">Per Month (Rs.)</th>
                      <th className="border border-gray-300 dark:border-gray-600 px-4 py-2">Annual (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingContent.annexure.table?.map((row: any, index: number) => (
                      <tr key={index}>
                        <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{row.component}</td>
                        <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-right">{row.perMonth?.toLocaleString('en-IN')}</td>
                        <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-right">{row.annual?.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                    <tr className="font-bold bg-gray-100 dark:bg-gray-700">
                      <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">Total</td>
                      <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-right">{viewingContent.annexure.total?.perMonth?.toLocaleString('en-IN')}</td>
                      <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-right">{viewingContent.annexure.total?.annual?.toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Edit/Create View
  if (viewMode === 'edit' && editedData) {
    const isNewLetter = !editingLetter;

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleCancel}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {isNewLetter ? 'Review & Create Offer Letter' : 'Edit Offer Letter'}
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {isNewLetter ? 'Review AI-generated details and make any necessary changes' : 'Update offer letter details'}
                  </p>
                </div>
              </div>
              {quickGeneratedData?.offer_letter?.confidence_scores && isNewLetter && (
                <div className="flex gap-2">
                  {Object.entries(quickGeneratedData.offer_letter.confidence_scores).map(([key, value]) => (
                    <div key={key} className="text-center px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                      <div className={`text-sm font-bold ${
                        (value as number) >= 70 ? 'text-green-500' :
                        (value as number) >= 50 ? 'text-yellow-500' : 'text-red-500'
                      }`}>
                        {value}%
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{key}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Edit Form */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Candidate & Job Info */}
            <div className="space-y-6">
              {/* Candidate Info */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Candidate Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Candidate Name *</label>
                    <input
                      type="text"
                      value={editedData.candidate_name || ''}
                      onChange={(e) => updateField('candidate_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Candidate Address <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={editedData.candidate_address || ''}
                      onChange={(e) => updateField('candidate_address', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                      placeholder="Enter candidate's full address"
                      required
                    />
                    {!editedData.candidate_address && (
                      <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                        Address is required. Please enter the candidate's address.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Designation *</label>
                    <input
                      type="text"
                      value={editedData.designation || ''}
                      onChange={(e) => updateField('designation', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Job Details */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Job Details
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Joining Date *</label>
                      <input
                        type="date"
                        value={editedData.joining_date || ''}
                        onChange={(e) => updateField('joining_date', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Offer Valid Till</label>
                      <input
                        type="date"
                        value={editedData.offer_valid_till || ''}
                        onChange={(e) => updateField('offer_valid_till', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Working Location</label>
                    <input
                      type="text"
                      value={editedData.working_location || ''}
                      onChange={(e) => updateField('working_location', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">HR Manager Name</label>
                      <input
                        type="text"
                        value={editedData.hr_manager_name || ''}
                        onChange={(e) => updateField('hr_manager_name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">HR Manager Title</label>
                      <input
                        type="text"
                        value={editedData.hr_manager_title || ''}
                        onChange={(e) => updateField('hr_manager_title', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Signatories - MANDATORY */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Signatories (Mandatory)
                </h3>
                <div className="p-3 mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    Both HR Manager and Director signatures are <strong>mandatory</strong> for all offer letters.
                  </p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      HR Signatory <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={editedData.signatory_id || ''}
                      onChange={(e) => updateField('signatory_id', e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                      required
                    >
                      <option value="">-- Select HR Signatory --</option>
                      {signatories?.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} - {s.position}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Director Signatory <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={editedData.secondary_signatory_id || ''}
                      onChange={(e) => updateField('secondary_signatory_id', e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                      required
                    >
                      <option value="">-- Select Director Signatory --</option>
                      {signatories?.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} - {s.position}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Salary */}
            <div className="space-y-6">
              {/* Salary Breakdown */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Salary Breakdown
                  </h3>
                  <div className="text-right">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Annual CTC</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      ₹{editedData.annual_ctc?.toLocaleString() || 0}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {(Array.isArray(editedData.salary_breakdown) ? editedData.salary_breakdown : []).map((item, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <input
                        type="text"
                        value={item.component}
                        onChange={(e) => updateSalaryComponent(index, 'component', e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-sm text-gray-900 dark:text-white"
                        placeholder="Component name"
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">₹</span>
                        <input
                          type="number"
                          value={item.perMonth || 0}
                          onChange={(e) => updateSalaryComponent(index, 'perMonth', parseInt(e.target.value) || 0)}
                          className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-sm text-right text-gray-900 dark:text-white"
                        />
                        <span className="text-xs text-gray-500">/mo</span>
                      </div>
                      <span className="text-xs text-gray-500 w-24 text-right">
                        ₹{item.annual?.toLocaleString()}/yr
                      </span>
                      <button
                        onClick={() => removeSalaryComponent(index)}
                        className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={addSalaryComponent}
                    className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-green-500 hover:text-green-500 transition-colors"
                  >
                    + Add Salary Component
                  </button>
                </div>

                {/* Joining Bonus */}
                <div className="mt-4 pt-4 border-t dark:border-gray-700">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Joining Bonus</label>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500">₹</span>
                      <input
                        type="number"
                        value={editedData.joining_bonus || 0}
                        onChange={(e) => updateField('joining_bonus', parseInt(e.target.value) || 0)}
                        className="w-32 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-right text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  Key Responsibility Areas (Annexure B)
                </h3>
                <div className="space-y-3">
                  {(editedData.kra_details || []).map((kra, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <textarea
                        value={kra.responsibility}
                        onChange={(e) => updateKra(index, e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                        placeholder={`Responsibility ${index + 1}`}
                      />
                      <button
                        onClick={() => removeKra(index)}
                        className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addKra}
                    className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-teal-500 hover:text-teal-500 transition-colors"
                  >
                    + Add Responsibility
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
                <div className="flex gap-4">
                  <button
                    onClick={handleCancel}
                    className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  {!isNewLetter && (
                    <button
                      onClick={() => handleView(editingLetter.id)}
                      className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Preview
                    </button>
                  )}
                  <button
                    onClick={isNewLetter ? handleCreate : handleUpdate}
                    disabled={isCreating || !editedData.candidate_name || !editedData.designation || !editedData.joining_date || !editedData.candidate_address || !editedData.signatory_id || !editedData.secondary_signatory_id}
                    className="flex-1 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isCreating ? (
                      <>
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {isNewLetter ? 'Creating...' : 'Updating...'}
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {isNewLetter ? 'Create Offer Letter' : 'Update Offer Letter'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Upload Existing Offer Letter View
  if (viewMode === 'upload-existing') {
    return (
      <UploadOfferLetterExtractor
        onExtracted={(data) => {
          setEditedData(data);
          setViewMode('edit');
        }}
        onCancel={handleCancel}
      />
    );
  }

  // Generate View (Upload Resume)
  if (viewMode === 'generate') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Generate Offer Letter</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Upload a resume to auto-generate offer letter</p>
            </div>
          </div>

          {/* Training docs warning */}
          {(stats?.training.completed || 0) === 0 && (
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
              <div className="flex gap-3">
                <svg className="w-6 h-6 text-yellow-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h3 className="font-medium text-yellow-800 dark:text-yellow-200">No Training Documents</h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    For best results, upload sample offer letters first to train the AI. Go to AI Offer Letters in sidebar.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
              dragOver
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-orange-400 dark:hover:border-orange-500 bg-white dark:bg-gray-800'
            } ${isQuickGenerating ? 'opacity-50 pointer-events-none' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {isQuickGenerating ? (
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-orange-200 dark:border-orange-800 rounded-full"></div>
                  <div className="absolute top-0 left-0 w-20 h-20 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="mt-6 text-lg font-medium text-gray-900 dark:text-white">Analyzing Resume...</p>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Extracting candidate info and generating offer letter
                </p>
              </div>
            ) : (
              <>
                <div className="w-20 h-20 mx-auto bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mb-6">
                  <svg className="w-10 h-10 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Upload Resume PDF
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Drop a resume here and AI will generate a complete offer letter
                </p>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="hidden"
                  id="resume-upload"
                />
                <label
                  htmlFor="resume-upload"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg cursor-pointer transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Select Resume PDF
                </label>
              </>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* How it works */}
          <div className="mt-8 grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-xl">
              <div className="w-10 h-10 mx-auto bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-3">
                <span className="text-blue-600 dark:text-blue-400 font-bold">1</span>
              </div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-1">Upload Resume</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Drop any resume PDF</p>
            </div>
            <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-xl">
              <div className="w-10 h-10 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-3">
                <span className="text-green-600 dark:text-green-400 font-bold">2</span>
              </div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-1">Review & Edit</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Adjust any details</p>
            </div>
            <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-xl">
              <div className="w-10 h-10 mx-auto bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-3">
                <span className="text-purple-600 dark:text-purple-400 font-bold">3</span>
              </div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-1">Create & Download</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Get your PDF</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // List View (Default)
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Offer Letters</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Generate and manage offer letters</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setViewMode('upload-existing')}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2 font-medium shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload Existing Letter
            </button>
            <button
              onClick={() => setViewMode('generate')}
              className="px-5 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 flex items-center gap-2 font-medium shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Generate from Resume
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading offer letters...</p>
          </div>
        ) : offerLetters.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700">
            <div className="w-20 h-20 mx-auto bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No offer letters yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Upload a resume to generate your first offer letter</p>
            <button
              onClick={() => setViewMode('generate')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Generate from Resume
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Candidate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Designation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Joining Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Annual CTC
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {offerLetters.map((letter) => (
                  <tr key={letter.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{letter.candidate_name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{letter.creator_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {letter.designation}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {formatDate(letter.joining_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600 dark:text-green-400">
                      ₹{letter.annual_ctc.toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(letter.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleView(letter.id)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          title="View"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDownload(letter.id, letter.candidate_name)}
                          disabled={downloadingId === letter.id}
                          className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 disabled:opacity-50"
                          title="Download PDF"
                        >
                          {downloadingId === letter.id ? (
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          )}
                        </button>
                        {letter.status !== 'approved' && (
                          <>
                            <button
                              onClick={() => handleEdit(letter)}
                              className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                              title="Edit"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            {letter.status === 'draft' && (
                              <button
                                onClick={() => handleApprove(letter.id)}
                                className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                                title="Approve"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(letter.id)}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                              title="Delete"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
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
