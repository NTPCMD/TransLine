import React from 'react';

interface BadgeProps {
  variant: 'on-shift' | 'failed' | 'issue' | 'pending' | 'approved' | 'rejected' | 'unread';
  children: React.ReactNode;
}

export function Badge({ variant, children }: BadgeProps) {
  const variants = {
    'on-shift': 'bg-[#C62828] text-white',
    'failed': 'bg-[#D32F2F] text-white',
    'issue': 'bg-[#D32F2F] text-white',
    'pending': 'bg-[#FFA726] text-white',
    'approved': 'bg-[#66BB6A] text-white',
    'rejected': 'bg-[#D32F2F] text-white',
    'unread': 'bg-[#C62828] text-white'
  };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${variants[variant]}`}>
      {children}
    </span>
  );
}
