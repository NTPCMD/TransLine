import React from 'react';
import { Camera, Upload, X } from 'lucide-react';
import { Button } from './Button';

interface PhotoCaptureProps {
  title: string;
  onCapture: (photoData: string) => void;
  capturedPhoto?: string;
  showNumericInput?: boolean;
  numericValue?: string;
  onNumericChange?: (value: string) => void;
}

export function PhotoCapture({
  title,
  onCapture,
  capturedPhoto,
  showNumericInput,
  numericValue,
  onNumericChange
}: PhotoCaptureProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [showOverlay, setShowOverlay] = React.useState(true);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onCapture(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getCurrentDateTime = () => {
    const now = new Date();
    return now.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <h2>{title}</h2>
      
      <div className="relative bg-[#F2F2F2] rounded-[12px] overflow-hidden aspect-[4/3]">
        {capturedPhoto ? (
          <div className="relative w-full h-full">
            <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover" />
            {showOverlay && (
              <div className="absolute top-4 left-4 bg-black bg-opacity-60 text-white px-3 py-2 rounded-lg text-sm">
                <div>{getCurrentDateTime()}</div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  GPS Active
                </div>
              </div>
            )}
            <button
              onClick={() => onCapture('')}
              className="absolute top-4 right-4 bg-white rounded-full p-2 shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
            >
              <X size={20} className="text-[#2E2E2E]" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="text-[#9E9E9E]">
              <Camera size={64} />
            </div>
            <p className="text-[#9E9E9E]">No photo captured</p>
          </div>
        )}
      </div>

      {showNumericInput && (
        <input
          type="number"
          placeholder="Enter reading (optional)"
          value={numericValue}
          onChange={(e) => onNumericChange?.(e.target.value)}
          className="px-4 py-3 rounded-[12px] border-2 border-[#9E9E9E] focus:outline-none focus:border-[#C62828]"
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex gap-2">
        <Button
          variant="primary"
          fullWidth
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex items-center justify-center gap-2">
            <Camera size={20} />
            {capturedPhoto ? 'Retake Photo' : 'Capture Photo'}
          </div>
        </Button>
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={20} />
        </Button>
      </div>
    </div>
  );
}
