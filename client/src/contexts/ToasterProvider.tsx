import React, { createContext, useContext, ReactNode } from 'react';
import { useToaster } from '../hooks/useToaster';
import { Toaster } from '../components/Toaster';

interface ToasterContextType {
  toasts: { id: number; message: string; type: 'success' | 'error' | 'info' }[];
  toast: (message: string, type?: 'success' | 'error' | 'info') => void;
  setToasts: React.Dispatch<React.SetStateAction<{ id: number; message: string; type: 'success' | 'error' | 'info' }[]>>;
}

const ToasterContext = createContext<ToasterContextType | null>(null);

export const ToasterProvider = ({ children }: { children: ReactNode }) => {
  const { toasts, toast, setToasts } = useToaster();

  return (
    <ToasterContext.Provider value={{ toasts, toast, setToasts }}>
      {children}
      <Toaster />
    </ToasterContext.Provider>
  );
};

export const useToasts = () => {
  const context = useContext(ToasterContext);
  if (!context) {
    throw new Error('useToasts must be used within a ToasterProvider');
  }
  return context;
};
