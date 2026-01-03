import React from 'react';

interface TextAreaProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  required?: boolean;
}

export function TextArea({
  label,
  placeholder,
  value,
  onChange,
  rows = 4,
  required = false
}: TextAreaProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[#2E2E2E]">
        {label} {required && <span className="text-[#C62828]">*</span>}
      </label>
      <textarea
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="px-4 py-3 rounded-[12px] border-2 border-[#9E9E9E] focus:outline-none focus:border-[#C62828] transition-colors resize-none"
      />
    </div>
  );
}
