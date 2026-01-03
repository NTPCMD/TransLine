import React from 'react';

interface InputProps {
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
}

export function Input({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  required = false
}: InputProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[#2E2E2E]">
        {label} {required && <span className="text-[#C62828]">*</span>}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`px-4 py-3 rounded-[12px] border-2 ${
          error ? 'border-[#D32F2F]' : 'border-[#9E9E9E]'
        } focus:outline-none focus:border-[#C62828] transition-colors`}
      />
      {error && <span className="text-[#D32F2F] text-sm">{error}</span>}
    </div>
  );
}
