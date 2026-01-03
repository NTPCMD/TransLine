import React, { useState } from 'react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { ScreenHeader } from '../components/ScreenHeader';
import { Upload, X, MapPin, Clock } from 'lucide-react';

interface FuelLogScreenProps {
  onSubmit: () => void;
  onBack: () => void;
}

export function FuelLogScreen({ onSubmit, onBack }: FuelLogScreenProps) {
  const [station, setStation] = useState('');
  const [litres, setLitres] = useState('');
  const [cost, setCost] = useState('');
  const [receipt, setReceipt] = useState<string>('');

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceipt(reader.result as string);
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

  const canSubmit = station && litres && cost && receipt;

  return (
    <div className="h-full flex flex-col bg-white">
      <ScreenHeader title="Fuel Log" onBack={onBack} />
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          <Input
            label="Station Name"
            placeholder="e.g. Shell Parramatta"
            value={station}
            onChange={setStation}
            required
          />

          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                label="Litres"
                type="number"
                placeholder="0"
                value={litres}
                onChange={setLitres}
                required
              />
            </div>
            <div className="flex-1">
              <Input
                label="Cost ($)"
                type="number"
                placeholder="0.00"
                value={cost}
                onChange={setCost}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[#2E2E2E]">
              Receipt Photo <span className="text-[#C62828]">*</span>
            </label>
            
            {receipt ? (
              <div className="relative">
                <img src={receipt} alt="Receipt" className="w-full rounded-[12px] border-2 border-[#9E9E9E]" />
                <button
                  onClick={() => setReceipt('')}
                  className="absolute top-2 right-2 bg-white rounded-full p-2 shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                >
                  <X size={20} className="text-[#2E2E2E]" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#9E9E9E] rounded-[12px] p-8 flex flex-col items-center gap-2 hover:border-[#C62828] transition-colors"
              >
                <Upload className="text-[#9E9E9E]" size={32} />
                <p className="text-[#9E9E9E]">Upload receipt</p>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          <div className="bg-[#F2F2F2] p-4 rounded-[12px]">
            <p className="text-sm mb-3 text-[#9E9E9E]">Auto-captured</p>
            <div className="flex flex-col gap-2 text-sm text-[#9E9E9E]">
              <div className="flex items-center gap-2">
                <Clock size={16} />
                <span>{getCurrentDateTime()}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-green-500" />
                <span>GPS Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-[#F2F2F2] bg-white">
        <Button
          variant="primary"
          fullWidth
          onClick={onSubmit}
          disabled={!canSubmit}
        >
          Submit Fuel Log
        </Button>
      </div>
    </div>
  );
}