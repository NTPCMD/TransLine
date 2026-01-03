import React, { useState } from 'react';
import { Button } from '../components/Button';
import { TextArea } from '../components/TextArea';
import { ScreenHeader } from '../components/ScreenHeader';
import { Upload, X } from 'lucide-react';

interface SendNoteScreenProps {
  onSubmit: () => void;
  onBack: () => void;
}

const categories = ['General', 'Maintenance', 'Safety', 'Delivery', 'Other'];

export function SendNoteScreen({ onSubmit, onBack }: SendNoteScreenProps) {
  const [category, setCategory] = useState('General');
  const [message, setMessage] = useState('');
  const [urgent, setUrgent] = useState(false);
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

  const canSubmit = message.trim();

  return (
    <div className="h-full flex flex-col bg-white">
      <ScreenHeader title="Send Note" onBack={onBack} />
      
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[#2E2E2E]">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-4 py-3 rounded-[12px] border-2 border-[#9E9E9E] focus:outline-none focus:border-[#C62828] bg-white"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <TextArea
            label="Message"
            placeholder="Type your message to operations..."
            value={message}
            onChange={setMessage}
            rows={8}
            required
          />

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={urgent}
              onChange={(e) => setUrgent(e.target.checked)}
              className="w-5 h-5 accent-[#C62828] cursor-pointer"
            />
            <span className="text-[#2E2E2E]">Mark as urgent</span>
          </label>

          <div className="flex flex-col gap-2">
            <label className="text-[#2E2E2E]">Photo Attachments</label>
            
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, index) => (
                  <div key={index} className="relative aspect-square">
                    <img src={photo} alt={`Attachment ${index + 1}`} className="w-full h-full object-cover rounded-lg" />
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
          onClick={onSubmit}
          disabled={!canSubmit}
        >
          Send Note
        </Button>
      </div>
    </div>
  );
}
