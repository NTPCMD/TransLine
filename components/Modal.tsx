import React from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children, actions }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[12px] max-w-md w-full max-h-[80vh] overflow-y-auto shadow-[0_2px_12px_rgba(0,0,0,0.1)]">
        <div className="flex items-center justify-between p-4 border-b border-[#F2F2F2]">
          <h3>{title}</h3>
          <button onClick={onClose} className="text-[#9E9E9E] hover:text-[#2E2E2E]">
            <X size={24} />
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
        {actions && (
          <div className="p-4 border-t border-[#F2F2F2] flex gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
