import React from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ScreenHeader } from '../components/ScreenHeader';
import { Clock, Truck, MapPin, Check } from 'lucide-react';

interface StartShiftScreenProps {
  vehicle: any;
  onStartShift: () => void;
  onCancel: () => void;
}

export function StartShiftScreen({ vehicle, onStartShift, onCancel }: StartShiftScreenProps) {
  const currentTime = new Date().toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="h-full flex flex-col bg-white">
      <ScreenHeader title="Start Shift" onBack={onCancel} />
      
      <div className="flex-1 flex flex-col p-4 gap-4">
        <div className="bg-[#E3F2FD] border-l-4 border-[#2196F3] p-4 rounded-lg">
          <p className="text-sm text-[#2E2E2E]">
            Vehicle has been automatically assigned to you.
          </p>
        </div>

        <Card>
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="bg-[#F2F2F2] p-2 rounded-lg">
                <Truck className="text-[#C62828]" size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm text-[#9E9E9E]">Assigned Vehicle</p>
                <h3>{vehicle?.registration || 'ABC-123'}</h3>
                <p className="text-sm text-[#9E9E9E]">{vehicle?.type || 'Rigid Truck'}</p>
                <p className="text-sm text-[#9E9E9E]">{vehicle?.depot || 'Sydney Depot'}</p>
              </div>
            </div>

            <div className="h-px bg-[#F2F2F2]" />

            <div className="flex items-start gap-3">
              <div className="bg-[#F2F2F2] p-2 rounded-lg">
                <Clock className="text-[#C62828]" size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm text-[#9E9E9E]">Start Time</p>
                <p>{currentTime}</p>
              </div>
            </div>

            <div className="h-px bg-[#F2F2F2]" />

            <div className="flex items-start gap-3">
              <div className="bg-[#F2F2F2] p-2 rounded-lg">
                <MapPin className="text-green-500" size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm text-[#9E9E9E]">GPS Status</p>
                <p className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Active
                </p>
              </div>
            </div>
          </div>
        </Card>

        <div className="bg-[#FFF3E0] border-l-4 border-[#FFA726] p-4 rounded-lg">
          <p className="text-sm text-[#2E2E2E]">
            Next: Complete pre-start vehicle checklist
          </p>
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <Button variant="primary" fullWidth onClick={onStartShift}>
            Start Shift
          </Button>
          <Button variant="secondary" fullWidth onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}