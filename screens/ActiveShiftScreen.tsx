import React, { useState, useEffect } from 'react';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { ScreenHeader } from '../components/ScreenHeader';
import { Clock, MapPin, RefreshCw, AlertTriangle, Coffee, Fuel, MessageSquare, FileText, Menu } from 'lucide-react';

interface ActiveShiftScreenProps {
  shiftStartTime: Date | null;
  onBreak: () => void;
  onFuelLog: () => void;
  onIncident: () => void;
  onSendNote: () => void;
  onEndShift: () => void;
  onShiftDetails: () => void;
  onMedicalAbsence: () => void;
  onAnnouncements: () => void;
  onOperationsAlerts: () => void;
  onComponents: () => void;
  onMaintenanceLog: () => void;
}

export function ActiveShiftScreen({
  shiftStartTime,
  onBreak,
  onFuelLog,
  onIncident,
  onSendNote,
  onEndShift,
  onShiftDetails,
  onMedicalAbsence,
  onAnnouncements,
  onOperationsAlerts,
  onComponents,
  onMaintenanceLog
}: ActiveShiftScreenProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getShiftDuration = () => {
    if (!shiftStartTime) return '0h 0m';
    const diff = currentTime.getTime() - shiftStartTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="h-full flex flex-col bg-white relative">
      <div className="bg-[#C62828] text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-white rounded-full animate-pulse"></span>
            <span>ON SHIFT</span>
          </div>
        </div>
        <button onClick={() => setShowMenu(!showMenu)} className="text-white">
          <Menu size={24} />
        </button>
      </div>

      {showMenu && (
        <div className="absolute top-16 right-4 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.1)] rounded-[12px] z-50 overflow-hidden">
          <button
            onClick={() => {
              setShowMenu(false);
              onAnnouncements();
            }}
            className="w-full px-6 py-3 text-left hover:bg-[#F2F2F2] transition-colors border-b border-[#F2F2F2]"
          >
            Announcements
          </button>
          <button
            onClick={() => {
              setShowMenu(false);
              onMaintenanceLog();
            }}
            className="w-full px-6 py-3 text-left hover:bg-[#F2F2F2] transition-colors border-b border-[#F2F2F2]"
          >
            Vehicle Maintenance Log
          </button>
          <button
            onClick={() => {
              setShowMenu(false);
              onMedicalAbsence();
            }}
            className="w-full px-6 py-3 text-left hover:bg-[#F2F2F2] transition-colors border-b border-[#F2F2F2]"
          >
            Medical Absence
          </button>
          <button
            onClick={() => {
              setShowMenu(false);
              onOperationsAlerts();
            }}
            className="w-full px-6 py-3 text-left hover:bg-[#F2F2F2] transition-colors border-b border-[#F2F2F2]"
          >
            Operations Alerts
          </button>
          <button
            onClick={() => {
              setShowMenu(false);
              onComponents();
            }}
            className="w-full px-6 py-3 text-left hover:bg-[#F2F2F2] transition-colors"
          >
            Components Library
          </button>
        </div>
      )}

      <div className="p-4 bg-[#F2F2F2] border-b border-[#9E9E9E]">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-[#9E9E9E] text-sm mb-1">
              <Clock size={16} />
              <span>Duration</span>
            </div>
            <p>{getShiftDuration()}</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-[#9E9E9E] text-sm mb-1">
              <MapPin size={16} />
              <span>GPS</span>
            </div>
            <p className="flex items-center justify-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Active
            </p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-[#9E9E9E] text-sm mb-1">
              <RefreshCw size={16} />
              <span>Sync</span>
            </div>
            <p className="text-sm">Just now</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
        <div className="bg-[#F2F2F2] rounded-[12px] aspect-video flex items-center justify-center">
          <div className="text-center text-[#9E9E9E]">
            <MapPin size={48} className="mx-auto mb-2" />
            <p>Map View Placeholder</p>
          </div>
        </div>

        <Button
          variant="primary"
          fullWidth
          onClick={onIncident}
        >
          <div className="flex items-center justify-center gap-2">
            <AlertTriangle size={20} />
            Something Gone Wrong
          </div>
        </Button>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onBreak}>
            <div className="flex items-center justify-center gap-2">
              <Coffee size={20} />
              Break
            </div>
          </Button>
          <Button variant="outline" onClick={onFuelLog}>
            <div className="flex items-center justify-center gap-2">
              <Fuel size={20} />
              Fuel Log
            </div>
          </Button>
          <Button variant="outline" onClick={onSendNote}>
            <div className="flex items-center justify-center gap-2">
              <MessageSquare size={20} />
              Send Note
            </div>
          </Button>
          <Button variant="outline" onClick={onShiftDetails}>
            <div className="flex items-center justify-center gap-2">
              <FileText size={20} />
              Shift Details
            </div>
          </Button>
        </div>

        <div className="mt-auto">
          <Button variant="secondary" fullWidth onClick={onEndShift}>
            Log Off
          </Button>
        </div>
      </div>
    </div>
  );
}