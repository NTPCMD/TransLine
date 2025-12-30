import React, { useState } from 'react';
import { Button } from '../components/Button';
import { TextArea } from '../components/TextArea';
import { Card } from '../components/Card';
import { Modal } from '../components/Modal';
import { ScreenHeader } from '../components/ScreenHeader';
import { Clock, Upload, X } from 'lucide-react';

interface EndShiftScreenProps {
  shiftStartTime: Date | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function EndShiftScreen({ shiftStartTime, onConfirm, onCancel }: EndShiftScreenProps) {
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotos(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const getShiftSummary = () => {
    const now = new Date();
    const start = shiftStartTime || now;
    const duration = now.getTime() - start.getTime();
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

    return {
      startTime: start.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      endTime: now.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      duration: `${hours}h ${minutes}m`
    };
  };

  const summary = getShiftSummary();

  return (
    <div className="h-full flex flex-col bg-white">
      <ScreenHeader title="End Shift" onBack={onCancel} />
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          <Card>
            <h3 className="mb-4">Shift Summary</h3>
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <Clock className="text-[#9E9E9E] mt-1" size={18} />
                <div className="flex-1">
                  <p className="text-sm text-[#9E9E9E]">Start</p>
                  <p>{summary.startTime}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="text-[#9E9E9E] mt-1" size={18} />
                <div className="flex-1">
                  <p className="text-sm text-[#9E9E9E]">End</p>
                  <p>{summary.endTime}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="text-[#9E9E9E] mt-1" size={18} />
                <div className="flex-1">
                  <p className="text-sm text-[#9E9E9E]">Duration</p>
                  <p>{summary.duration}</p>
                </div>
              </div>
            </div>
          </Card>

          <TextArea
            label="Notes (Optional)"
            placeholder="Add any notes about your shift..."
            value={notes}
            onChange={setNotes}
            rows={4}
          />

          <div className="flex flex-col gap-2">
            <label className="text-[#2E2E2E]">Photos (Optional)</label>
            
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, index) => (
                  <div key={index} className="relative aspect-square">
                    <img src={photo} alt={`Photo ${index + 1}`} className="w-full h-full object-cover rounded-lg" />
                    <button
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 bg-white rounded-full p-1 shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                    >
                      <X size={16} className="text-[#2E2E2E]" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#9E9E9E] rounded-[12px] p-6 flex flex-col items-center gap-2 hover:border-[#C62828] transition-colors"
            >
              <Upload className="text-[#9E9E9E]" size={24} />
              <p className="text-[#9E9E9E] text-sm">Add photos</p>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-[#F2F2F2] bg-white">
        <Button
          variant="primary"
          fullWidth
          onClick={() => setShowConfirmModal(true)}
        >
          End Shift
        </Button>
      </div>

      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm End Shift"
        actions={
          <>
            <Button variant="outline" fullWidth onClick={() => setShowConfirmModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" fullWidth onClick={onConfirm}>
              Confirm
            </Button>
          </>
        }
      >
        <p>Are you sure you want to end your shift?</p>
        <p className="text-[#9E9E9E] text-sm mt-2">
          Duration: {summary.duration}
        </p>
      </Modal>
    </div>
  );
}