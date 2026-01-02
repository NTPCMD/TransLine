import React, { useState } from 'react';
import { Button } from '../components/Button';
import { ScreenHeader } from '../components/ScreenHeader';
import { Camera, Upload, X, MapPin, Clock } from 'lucide-react';

interface ReadingsAndPhotosScreenProps {
  onContinue: (
    reading: string,
    photo: string
  ) => void;
  onBack: () => void;
}

export function ReadingsAndPhotosScreen({ onContinue, onBack }: ReadingsAndPhotosScreenProps) {
  const [odometerReading, setOdometerReading] = useState('');
  const [odometerPhoto, setOdometerPhoto] = useState('');

  const odometerFileRef = React.useRef<HTMLInputElement>(null);

  const handleOdometerFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setOdometerPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getCurrentDateTime = () => {
    const now = new Date();
    return now.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const canSubmit = odometerReading && odometerPhoto;

  return (
    <div className="h-full flex flex-col bg-white">
      <ScreenHeader title="Odometer Reading" onBack={onBack} />
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-6">
          {/* Odometer Section */}
          <div className="flex flex-col gap-3">
            <h3>Odometer</h3>
            
            <input
              type="number"
              placeholder="Enter odometer reading"
              value={odometerReading}
              onChange={(e) => setOdometerReading(e.target.value)}
              className="px-4 py-3 rounded-[12px] border-2 border-[#9E9E9E] focus:outline-none focus:border-[#C62828]"
            />

            {odometerPhoto ? (
              <div className="relative bg-[#F2F2F2] rounded-[12px] overflow-hidden">
                <img src={odometerPhoto} alt="Odometer" className="w-full h-auto" />
                <div className="absolute top-3 left-3 bg-black bg-opacity-60 text-white px-3 py-2 rounded-lg text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock size={14} />
                    {getCurrentDateTime()}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                    GPS Active
                  </div>
                </div>
                <button
                  onClick={() => setOdometerPhoto('')}
                  className="absolute top-3 right-3 bg-white rounded-full p-2 shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                >
                  <X size={18} className="text-[#2E2E2E]" />
                </button>
              </div>
            ) : (
              <div className="bg-[#F2F2F2] rounded-[12px] aspect-[4/3] flex flex-col items-center justify-center gap-3">
                <Camera size={48} className="text-[#9E9E9E]" />
                <p className="text-[#9E9E9E] text-sm">No photo captured</p>
              </div>
            )}

            <input
              ref={odometerFileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleOdometerFileSelect}
              className="hidden"
            />

            <div className="flex gap-2">
              <Button
                variant="primary"
                fullWidth
                onClick={() => odometerFileRef.current?.click()}
              >
                <div className="flex items-center justify-center gap-2">
                  <Camera size={18} />
                  {odometerPhoto ? 'Retake Photo' : 'Capture Photo'}
                </div>
              </Button>
              <Button
                variant="outline"
                onClick={() => odometerFileRef.current?.click()}
              >
                <Upload size={18} />
              </Button>
            </div>
          </div>

          <div className="h-px bg-[#9E9E9E]" />

          {/* Auto-captured Info */}
          <div className="bg-[#F2F2F2] p-4 rounded-[12px]">
            <p className="text-sm mb-3">Auto-captured Information</p>
            <div className="flex flex-col gap-2 text-sm text-[#9E9E9E]">
              <div className="flex items-center gap-2">
                <Clock size={16} />
                <span>{getCurrentDateTime()}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-green-500" />
                <span>GPS: 33.8688° S, 151.2093° E</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-[#F2F2F2] bg-white">
        <Button
          variant="primary"
          fullWidth
          onClick={() => onContinue(
            odometerReading,
            odometerPhoto
          )}
          disabled={!canSubmit}
        >
          Submit Readings
        </Button>
      </div>
    </div>
  );
}