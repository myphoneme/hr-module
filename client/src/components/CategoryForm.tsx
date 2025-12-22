import { useState, useEffect, useMemo } from 'react';
import { useCreateCategory, useUpdateCategory } from '../hooks/useCategory';
import { useTransactionNatures } from '../hooks/useTransactionNature';
import { useCategoryGroups } from '../hooks/useCategoryGroup';
import type { CategoryWithDetails } from '../types';

interface CategoryFormProps {
  category: CategoryWithDetails | null;
  onClose: () => void;
}

export function CategoryForm({ category, onClose }: CategoryFormProps) {
  const isEditing = !!category;
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const { data: transactionNatures, isLoading: loadingTransactionNatures } = useTransactionNatures();
  const { data: categoryGroups, isLoading: loadingCategoryGroups } = useCategoryGroups();

  const [transactionNatureId, setTransactionNatureId] = useState(
    category?.transaction_nature_id || 0
  );
  const [categoryGroupId, setCategoryGroupId] = useState(category?.category_group_id || 0);
  const [name, setName] = useState(category?.name || '');
  const [error, setError] = useState('');

  // Filter category groups based on selected transaction nature
  const filteredCategoryGroups = useMemo(() => {
    if (!categoryGroups || !transactionNatureId) return [];
    return categoryGroups.filter(cg => cg.transaction_nature_id === transactionNatureId && cg.isActive);
  }, [categoryGroups, transactionNatureId]);

  // Reset category group when transaction nature changes
  useEffect(() => {
    if (!isEditing && transactionNatureId) {
      setCategoryGroupId(0);
    }
  }, [transactionNatureId, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!transactionNatureId) {
      setError('Transaction nature is required');
      return;
    }

    if (!categoryGroupId) {
      setError('Category group is required');
      return;
    }

    if (!name.trim()) {
      setError('Category name is required');
      return;
    }

    try {
      if (isEditing) {
        await updateCategory.mutateAsync({
          id: category.id,
          data: {
            category_group_id: categoryGroupId,
            name: name.trim(),
          },
        });
      } else {
        await createCategory.mutateAsync({
          category_group_id: categoryGroupId,
          name: name.trim(),
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category');
    }
  };

  const isPending = createCategory.isPending || updateCategory.isPending;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="bg-orange-500 text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-lg font-semibold">
            {isEditing ? 'Edit Category' : 'Add Category'}
          </h2>
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
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Transaction Nature Dropdown */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-orange-600 mb-1">
              * Transaction Nature:
            </label>
            <select
              value={transactionNatureId}
              onChange={(e) => setTransactionNatureId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              required
              disabled={loadingTransactionNatures}
            >
              <option value={0}>Select Transaction Nature</option>
              {transactionNatures
                ?.filter(tn => tn.isActive)
                .map(tn => (
                  <option key={tn.id} value={tn.id}>
                    {tn.name}
                  </option>
                ))}
            </select>
            {loadingTransactionNatures && (
              <p className="mt-1 text-xs text-gray-500">Loading transaction natures...</p>
            )}
          </div>

          {/* Category Group Dropdown */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-orange-600 mb-1">
              * Category Group:
            </label>
            <select
              value={categoryGroupId}
              onChange={(e) => setCategoryGroupId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              required
              disabled={!transactionNatureId || loadingCategoryGroups}
            >
              <option value={0}>
                {!transactionNatureId
                  ? 'Select Transaction Nature first'
                  : filteredCategoryGroups.length === 0
                    ? 'No category groups available'
                    : 'Select Category Group'}
              </option>
              {filteredCategoryGroups.map(cg => (
                <option key={cg.id} value={cg.id}>
                  {cg.name}
                </option>
              ))}
            </select>
            {loadingCategoryGroups && (
              <p className="mt-1 text-xs text-gray-500">Loading category groups...</p>
            )}
          </div>

          {/* Category Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-orange-600 mb-1">
              * Category Name:
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Enter category name"
              required
            />
          </div>

          <p className="mb-4 text-sm text-orange-600">* Required fields must be filled out.</p>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-6 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isPending && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              {isEditing ? 'Update' : 'Submit'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
