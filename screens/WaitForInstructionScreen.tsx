import React from 'react';
import { Card } from '../components/Card';
import { AlertTriangle, Clock, Phone, MessageSquare } from 'lucide-react';
import { Button } from '../components/Button';

interface WaitForInstructionScreenProps {
  onContactSupport: () => void;
  onSendNote: () => void;
}

export function WaitForInstructionScreen({ onContactSupport, onSendNote }: WaitForInstructionScreenProps) {
  return (
    <div className="h-full flex flex-col bg-white">
      <div className="bg-[#D32F2F] text-white p-6 text-center">
        <AlertTriangle size={48} className="mx-auto mb-4" />
        <h2 className="text-white mb-2">Safety Issue Reported</h2>
        <p className="text-white opacity-90">Please wait for further instruction</p>
      </div>
      
      <div className="flex-1 flex flex-col p-4 gap-4">
        <Card>
          <div className="flex items-start gap-3 mb-4">
            <div className="bg-[#FFEBEE] p-2 rounded-lg">
              <AlertTriangle className="text-[#D32F2F]" size={20} />
            </div>
            <div className="flex-1">
              <h3 className="mb-2">Critical Safety Issue Detected</h3>
              <p className="text-sm text-[#9E9E9E]">
                A critical vehicle safety issue has been detected. Operations have been notified.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start gap-3 mb-4">
            <div className="bg-[#F2F2F2] p-2 rounded-lg">
              <Clock className="text-[#C62828]" size={20} />
            </div>
            <div className="flex-1">
              <h3 className="mb-2">What Happens Next?</h3>
              <ul className="flex flex-col gap-2 text-sm text-[#9E9E9E]">
                <li>• Operations has been notified</li>
                <li>• A supervisor will contact you shortly</li>
                <li>• Do not attempt to drive the vehicle</li>
                <li>• Remain at your current location</li>
              </ul>
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-3">
          <Button variant="primary" fullWidth onClick={onContactSupport}>
            <div className="flex items-center justify-center gap-2">
              <Phone size={20} />
              Call Operations
            </div>
          </Button>
          
          <Button variant="outline" fullWidth onClick={onSendNote}>
            <div className="flex items-center justify-center gap-2">
              <MessageSquare size={20} />
              Send Note
            </div>
          </Button>
        </div>

        <div className="bg-[#E3F2FD] border-l-4 border-[#2196F3] p-4 rounded-lg">
          <p className="text-sm text-[#2E2E2E]">
            This is a safety measure to ensure all vehicles meet compliance standards before beginning shift operations.
          </p>
        </div>
      </div>
    </div>
  );
}