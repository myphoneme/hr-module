import { useState } from 'react';
import { useCreateTransactionNature, useUpdateTransactionNature } from '../hooks/useTransactionNature';
import type { TransactionNature } from '../types';

interface TransactionNatureFormProps {
  transactionNature: TransactionNature | null;
  onClose: () => void;
}

export function TransactionNatureForm({ transactionNature, onClose }: TransactionNatureFormProps) {
  const isEditing = !!transactionNature;
  const createTransactionNature = useCreateTransactionNature();
  const updateTransactionNature = useUpdateTransactionNature();

  const [name, setName] = useState(transactionNature?.name || '');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Transaction nature name is required');
      return;
    }

    try {
      if (isEditing) {
        await updateTransactionNature.mutateAsync({
          id: transactionNature.id,
          data: { name: name.trim() },
        });
      } else {
        await createTransactionNature.mutateAsync({ name: name.trim() });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save transaction nature');
    }
  };

  const isPending = createTransactionNature.isPending || updateTransactionNature.isPending;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="bg-orange-500 text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-lg font-semibold">
            {isEditing ? 'Edit Transaction Nature' : 'Add Transaction Nature'}
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

          <div className="mb-4">
            <label className="block text-sm font-medium text-orange-600 mb-1">
              * Transaction Nature Name:
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Enter transaction nature name"
              required
              autoFocus
            />
          </div>

          <p className="mb-4 text-sm text-orange-600">* Required field must be filled out.</p>

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
