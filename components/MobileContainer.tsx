import React from 'react';

interface MobileContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function MobileContainer({ children, className = '' }: MobileContainerProps) {
  return (
    <div className="min-h-screen bg-[#F2F2F2] flex items-center justify-center p-4">
      <div className={`w-full max-w-[390px] h-[844px] bg-white overflow-y-auto shadow-[0_2px_12px_rgba(0,0,0,0.1)] ${className}`}>
        {children}
      </div>
    </div>
  );
}
