import { useState, useRef } from 'react';
import { useLetterheads } from '../hooks/useLetterheads';
import type { Letterhead, CreateLetterheadInput } from '../api/letterheads';
import { API_ORIGIN } from '../config/api';

interface LetterheadManagerProps {
  onBack?: () => void;
}

type ViewMode = 'list' | 'create' | 'edit';

export default function LetterheadManager({ onBack }: LetterheadManagerProps) {
  const {
    letterheads,
    isLoading,
    createLetterhead,
    updateLetterhead,
    deleteLetterhead,
    setDefaultLetterhead,
    isCreating,
    isUpdating,
    isSettingDefault,
  } = useLetterheads();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingLetterhead, setEditingLetterhead] = useState<Letterhead | null>(null);
  const [formData, setFormData] = useState<Partial<CreateLetterheadInput>>({});
  const [previewImages, setPreviewImages] = useState<{
    header?: string;
    footer?: string;
    logo?: string;
  }>({});

  const headerInputRef = useRef<HTMLInputElement>(null);
  const footerInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleCreate = () => {
    setFormData({
      name: '',
      description: '',
      company_name: '',
      company_address: '',
      company_contact: '',
      company_email: '',
      company_website: '',
      company_cin: '',
      company_gstin: '',
      is_default: false,
    });
    setPreviewImages({});
    setEditingLetterhead(null);
    setViewMode('create');
  };

  const handleEdit = (letterhead: Letterhead) => {
    setFormData({
      name: letterhead.name,
      description: letterhead.description || '',
      company_name: letterhead.company_name || '',
      company_address: letterhead.company_address || '',
      company_contact: letterhead.company_contact || '',
      company_email: letterhead.company_email || '',
      company_website: letterhead.company_website || '',
      company_cin: letterhead.company_cin || '',
      company_gstin: letterhead.company_gstin || '',
      is_default: letterhead.is_default,
    });
    setPreviewImages({
      header: letterhead.header_image ? `${API_ORIGIN}/uploads/letterheads/${letterhead.header_image}` : undefined,
      footer: letterhead.footer_image ? `${API_ORIGIN}/uploads/letterheads/${letterhead.footer_image}` : undefined,
      logo: letterhead.logo_image ? `${API_ORIGIN}/uploads/letterheads/${letterhead.logo_image}` : undefined,
    });
    setEditingLetterhead(letterhead);
    setViewMode('edit');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this letterhead?')) return;
    try {
      await deleteLetterhead(id);
    } catch (error) {
      console.error('Error deleting letterhead:', error);
      alert('Failed to delete letterhead');
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      await setDefaultLetterhead(id);
    } catch (error) {
      console.error('Error setting default:', error);
      alert('Failed to set as default');
    }
  };

  const handleImageChange = (type: 'header' | 'footer' | 'logo', file: File | null) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImages(prev => ({ ...prev, [type]: reader.result as string }));
      };
      reader.readAsDataURL(file);
      setFormData(prev => ({
        ...prev,
        [`${type}_image`]: file,
      }));
    }
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      alert('Name is required');
      return;
    }

    try {
      if (editingLetterhead) {
        await updateLetterhead(editingLetterhead.id, formData);
      } else {
        await createLetterhead(formData as CreateLetterheadInput);
      }
      setViewMode('list');
      setFormData({});
      setPreviewImages({});
      setEditingLetterhead(null);
    } catch (error: any) {
      console.error('Error saving letterhead:', error);
      alert(`Failed to save: ${error.message}`);
    }
  };

  const handleCancel = () => {
    setViewMode('list');
    setFormData({});
    setPreviewImages({});
    setEditingLetterhead(null);
  };

  // Form View
  if (viewMode === 'create' || viewMode === 'edit') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {editingLetterhead ? 'Edit Letterhead' : 'Create Letterhead'}
            </h1>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Basic Info */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Basic Information</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Letterhead Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., Main Company Letterhead"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Description of this letterhead"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={formData.company_name || ''}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Company Address
                  </label>
                  <textarea
                    value={formData.company_address || ''}
                    onChange={(e) => setFormData({ ...formData, company_address: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Contact
                    </label>
                    <input
                      type="text"
                      value={formData.company_contact || ''}
                      onChange={(e) => setFormData({ ...formData, company_contact: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.company_email || ''}
                      onChange={(e) => setFormData({ ...formData, company_email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Website
                  </label>
                  <input
                    type="text"
                    value={formData.company_website || ''}
                    onChange={(e) => setFormData({ ...formData, company_website: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      CIN
                    </label>
                    <input
                      type="text"
                      value={formData.company_cin || ''}
                      onChange={(e) => setFormData({ ...formData, company_cin: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      GSTIN
                    </label>
                    <input
                      type="text"
                      value={formData.company_gstin || ''}
                      onChange={(e) => setFormData({ ...formData, company_gstin: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_default"
                    checked={formData.is_default || false}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <label htmlFor="is_default" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Set as default letterhead
                  </label>
                </div>
              </div>

              {/* Right Column - Image Uploads */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Images</h3>

                {/* Header Image */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Header Image (Full Width Letterhead Top)
                  </label>
                  <input
                    ref={headerInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange('header', e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <div
                    onClick={() => headerInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 cursor-pointer hover:border-orange-500 transition-colors"
                  >
                    {previewImages.header ? (
                      <img src={previewImages.header} alt="Header preview" className="max-h-32 mx-auto" />
                    ) : (
                      <div className="text-center text-gray-500 dark:text-gray-400">
                        <svg className="w-10 h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm">Click to upload header image</p>
                        <p className="text-xs text-gray-400">Recommended: 800x100px</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Logo Image */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Logo Image
                  </label>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange('logo', e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <div
                    onClick={() => logoInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 cursor-pointer hover:border-orange-500 transition-colors"
                  >
                    {previewImages.logo ? (
                      <img src={previewImages.logo} alt="Logo preview" className="max-h-24 mx-auto" />
                    ) : (
                      <div className="text-center text-gray-500 dark:text-gray-400">
                        <svg className="w-10 h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm">Click to upload logo</p>
                        <p className="text-xs text-gray-400">Recommended: 200x80px</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Image */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Footer Image (Full Width Letterhead Bottom)
                  </label>
                  <input
                    ref={footerInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange('footer', e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <div
                    onClick={() => footerInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 cursor-pointer hover:border-orange-500 transition-colors"
                  >
                    {previewImages.footer ? (
                      <img src={previewImages.footer} alt="Footer preview" className="max-h-24 mx-auto" />
                    ) : (
                      <div className="text-center text-gray-500 dark:text-gray-400">
                        <svg className="w-10 h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm">Click to upload footer image</p>
                        <p className="text-xs text-gray-400">Recommended: 800x60px</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 mt-6 pt-6 border-t dark:border-gray-700">
              <button
                onClick={handleCancel}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isCreating || isUpdating}
                className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
              >
                {(isCreating || isUpdating) && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {editingLetterhead ? 'Update Letterhead' : 'Create Letterhead'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Letterheads</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Manage company letterheads for documents</p>
            </div>
          </div>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Letterhead
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading letterheads...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && letterheads.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700">
            <div className="w-20 h-20 mx-auto bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No letterheads yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Create your first letterhead to use in offer letters</p>
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Letterhead
            </button>
          </div>
        )}

        {/* Letterhead Grid */}
        {!isLoading && letterheads.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {letterheads.map((letterhead) => (
              <div
                key={letterhead.id}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden ${
                  letterhead.is_default ? 'ring-2 ring-orange-500' : ''
                }`}
              >
                {/* Preview */}
                <div className="h-40 bg-gray-100 dark:bg-gray-700 relative">
                  {letterhead.header_image ? (
                    <img
                      src={`${API_ORIGIN}/uploads/letterheads/${letterhead.header_image}`}
                      alt="Header"
                      className="w-full h-full object-contain"
                    />
                  ) : letterhead.logo_image ? (
                    <div className="flex items-center justify-center h-full">
                      <img
                        src={`${API_ORIGIN}/uploads/letterheads/${letterhead.logo_image}`}
                        alt="Logo"
                        className="max-h-24 max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  {letterhead.is_default && (
                    <span className="absolute top-2 right-2 px-2 py-1 bg-orange-500 text-white text-xs font-medium rounded">
                      Default
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{letterhead.name}</h3>
                  {letterhead.company_name && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{letterhead.company_name}</p>
                  )}
                  {letterhead.description && (
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 truncate">{letterhead.description}</p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t dark:border-gray-700">
                    <button
                      onClick={() => handleEdit(letterhead)}
                      className="flex-1 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                    >
                      Edit
                    </button>
                    {!letterhead.is_default && (
                      <button
                        onClick={() => handleSetDefault(letterhead.id)}
                        disabled={isSettingDefault}
                        className="flex-1 px-3 py-2 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg disabled:opacity-50"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(letterhead.id)}
                      className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
