import React, { useState } from 'react';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { TextArea } from '../components/TextArea';
import { Card } from '../components/Card';
import { ScreenHeader } from '../components/ScreenHeader';
import { Calendar, Upload, X } from 'lucide-react';

interface MedicalAbsenceScreenProps {
  onSubmit: () => void;
  onBack: () => void;
}

export function MedicalAbsenceScreen({ onSubmit, onBack }: MedicalAbsenceScreenProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [certificate, setCertificate] = useState<string>('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCertificate(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const canSubmit = startDate && endDate && reason && certificate;

  return (
    <div className="h-full flex flex-col bg-white">
      <ScreenHeader title="Medical Absence" onBack={onBack} />
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          <div className="bg-[#F2F2F2] p-4 rounded-[12px]">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#9E9E9E]">Status</p>
              <Badge variant={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex-1">
              <label className="text-[#2E2E2E] mb-2 block">
                Start Date <span className="text-[#C62828]">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3 rounded-[12px] border-2 border-[#9E9E9E] focus:outline-none focus:border-[#C62828]"
              />
            </div>
            <div className="flex-1">
              <label className="text-[#2E2E2E] mb-2 block">
                End Date <span className="text-[#C62828]">*</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-3 rounded-[12px] border-2 border-[#9E9E9E] focus:outline-none focus:border-[#C62828]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[#2E2E2E]">
              Reason <span className="text-[#C62828]">*</span>
            </label>
            <input
              type="text"
              placeholder="Brief reason for absence"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="px-4 py-3 rounded-[12px] border-2 border-[#9E9E9E] focus:outline-none focus:border-[#C62828]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[#2E2E2E]">
              Medical Certificate <span className="text-[#C62828]">*</span>
            </label>
            
            {certificate ? (
              <div className="relative">
                <img src={certificate} alt="Certificate" className="w-full rounded-[12px] border-2 border-[#9E9E9E]" />
                <button
                  onClick={() => setCertificate('')}
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
                <p className="text-[#9E9E9E]">Upload certificate</p>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          <TextArea
            label="Additional Note"
            placeholder="Any additional information..."
            value={note}
            onChange={setNote}
            rows={4}
          />
        </div>
      </div>

      <div className="p-4 border-t border-[#F2F2F2] bg-white">
        <Button
          variant="primary"
          fullWidth
          onClick={onSubmit}
          disabled={!canSubmit}
        >
          Submit Medical Absence
        </Button>
      </div>
    </div>
  );
}