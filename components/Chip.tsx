import React from 'react';

interface ChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
}

export function Chip({ label, selected = false, onClick }: ChipProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full border-2 transition-all ${
        selected
          ? 'bg-[#C62828] border-[#C62828] text-white'
          : 'bg-white border-[#9E9E9E] text-[#2E2E2E] hover:border-[#C62828]'
      }`}
    >
      {label}
    </button>
  );
}
