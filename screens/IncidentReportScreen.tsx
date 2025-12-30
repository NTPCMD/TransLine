import React, { useState } from 'react';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { TextArea } from '../components/TextArea';
import { Card } from '../components/Card';
import { ScreenHeader } from '../components/ScreenHeader';
import { AlertTriangle, Upload, X, Phone } from 'lucide-react';

interface IncidentReportScreenProps {
  onSubmit: () => void;
  onBack: () => void;
}

const categories = ['Breakdown', 'Accident', 'Flat Tyre', 'Mechanical', 'Other'];

export function IncidentReportScreen({ onSubmit, onBack }: IncidentReportScreenProps) {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

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

  const canSubmit = selectedCategory && description.trim();

  return (
    <div className="h-full flex flex-col bg-white">
      <ScreenHeader title="Report an Issue" onBack={onBack} />
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          <div className="bg-[#FFEBEE] border-l-4 border-[#D32F2F] p-4 rounded-lg">
            <p className="text-sm text-[#2E2E2E]">
              This notifies operations immediately.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-[#2E2E2E]">
              Category <span className="text-[#C62828]">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map(category => (
                <Chip
                  key={category}
                  label={category}
                  selected={selectedCategory === category}
                  onClick={() => setSelectedCategory(category)}
                />
              ))}
            </div>
          </div>

          <TextArea
            label="Description"
            placeholder="Describe what happened..."
            value={description}
            onChange={setDescription}
            rows={6}
            required
          />

          <div className="flex flex-col gap-2">
            <label className="text-[#2E2E2E]">Photos</label>
            
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

          <div className="bg-[#FFF3E0] border-l-4 border-[#FFA726] p-4 rounded-lg">
            <h3 className="mb-3">Emergency Contact</h3>
            <p className="text-sm text-[#9E9E9E] mb-2">Company emergency line</p>
            <p className="mb-3">1800 EMERGENCY</p>
            <Button variant="outline" fullWidth>
              <div className="flex items-center justify-center gap-2 text-[#D32F2F]">
                <Phone size={20} />
                Call Now
              </div>
            </Button>
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
          Send Alert
        </Button>
      </div>
    </div>
  );
}