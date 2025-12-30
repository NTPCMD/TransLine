import React, { useState } from 'react';
import { Button } from '../components/Button';
import { ScreenHeader } from '../components/ScreenHeader';
import { AlertTriangle } from 'lucide-react';

interface DriverDeclarationScreenProps {
  onAccept: () => void;
}

export function DriverDeclarationScreen({ onAccept }: DriverDeclarationScreenProps) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="h-full flex flex-col bg-white">
      <ScreenHeader title="Driver Declaration" />
      
      <div className="flex-1 flex flex-col justify-between p-6">
        <div className="flex flex-col gap-6">
          <div className="bg-[#FFF3E0] border-l-4 border-[#FFA726] p-4 rounded-lg flex gap-3">
            <AlertTriangle className="text-[#FFA726] flex-shrink-0" size={24} />
            <div>
              <p className="text-[#2E2E2E]">
                I confirm I am fit for duty, not under the influence of drugs or alcohol, 
                and medically safe to operate this vehicle.
              </p>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 w-5 h-5 accent-[#C62828] cursor-pointer"
            />
            <span className="text-[#2E2E2E]">
              I agree to the above declaration
            </span>
          </label>

          <div className="bg-[#F2F2F2] p-4 rounded-[12px]">
            <p className="text-sm text-[#9E9E9E]">
              This declaration is logged with date and time.
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          fullWidth
          onClick={onAccept}
          disabled={!agreed}
        >
          Agree & Continue
        </Button>
      </div>
    </div>
  );
}
