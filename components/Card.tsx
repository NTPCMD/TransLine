import React from 'react';

interface CardProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function Card({ children, onClick, className = '' }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-[#9E9E9E] rounded-[12px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.1)] ${
        onClick ? 'cursor-pointer hover:border-[#C62828] transition-colors' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
