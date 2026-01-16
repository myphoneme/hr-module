import React from 'react';
import { useToaster } from '../hooks/useToaster';

export const Toaster: React.FC = () => {
  const { toasts } = useToaster();

  return (
    <div className="toaster-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
};
