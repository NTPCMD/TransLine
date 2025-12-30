import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  action?: React.ReactNode;
}

export function ScreenHeader({ title, onBack, action }: ScreenHeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 border-b border-[#F2F2F2] bg-white sticky top-0 z-10">
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="text-[#2E2E2E] hover:text-[#C62828] transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
        )}
        <h1>{title}</h1>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
