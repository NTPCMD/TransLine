import React from 'react';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'text';
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
  fullWidth?: boolean;
}

export function Button({ 
  variant = 'primary', 
  children, 
  onClick, 
  disabled = false,
  className = '',
  type = 'button',
  fullWidth = false
}: ButtonProps) {
  const baseStyles = 'px-6 py-3 rounded-[12px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-[#C62828] text-white hover:bg-[#B71C1C] active:bg-[#A01414] shadow-[0_2px_8px_rgba(0,0,0,0.08)]',
    secondary: 'bg-[#9E9E9E] text-white hover:bg-[#757575] active:bg-[#616161]',
    outline: 'bg-white border-2 border-[#9E9E9E] text-[#2E2E2E] hover:border-[#757575] active:bg-[#F2F2F2]',
    text: 'bg-transparent text-[#9E9E9E] hover:text-[#757575] active:text-[#616161]'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {children}
    </button>
  );
}
