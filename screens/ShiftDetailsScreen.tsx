import React from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ScreenHeader } from '../components/ScreenHeader';
import { Truck, Clock, MapPin, CheckCircle, XCircle, Camera, Fuel, MessageSquare, AlertTriangle, Download } from 'lucide-react';

interface ShiftDetailsScreenProps {
  vehicle: { registration: string; type: string; depot: string };
  shiftStartTime: Date | null;
  odometerReading: string;
  odometerPhoto: string;
  onBack: () => void;
}

export function ShiftDetailsScreen({
  vehicle,
  shiftStartTime,
  odometerReading,
  odometerPhoto,
  onBack
}: ShiftDetailsScreenProps) {
  const getShiftDuration = () => {
    if (!shiftStartTime) return '0h 0m';
    const now = new Date();
    const diff = now.getTime() - shiftStartTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const formatTime = (date: Date | null) => {
    if (!date) return '--';
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Mock data for comprehensive shift details
  const checklistSummary = {
    total: 13,
    passed: 11,
    failed: 2,
    failedItems: ['Tyre pressure - Front left low', 'Windscreen - Small chip noted']
  };

  const breakSummary = {
    totalTime: 25,
    maxAllowed: 30
  };

  const fuelLogs = [
    {
      id: '1',
      station: 'Shell Parramatta',
      litres: 85,
      cost: 142.50,
      time: '11:30 AM',
      hasReceipt: true
    }
  ];

  const notesSent = [
    {
      id: '1',
      category: 'Maintenance',
      message: 'Windscreen chip needs attention',
      time: '10:15 AM',
      urgent: false
    }
  ];

  const incidents: any[] = [];

  const allPhotos = [
    { id: '1', label: 'Odometer', photo: odometerPhoto }
  ].filter(p => p.photo);

  return (
    <div className="h-full flex flex-col bg-white">
      <ScreenHeader title="Shift Details" onBack={onBack} />
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4 pb-4">
          {/* Driver & Vehicle Info */}
          <Card>
            <div className="flex items-start gap-3 mb-4">
              <div className="bg-[#F2F2F2] p-2 rounded-lg">
                <Truck className="text-[#C62828]" size={20} />
              </div>
              <div className="flex-1">
                <h3 className="mb-1">Vehicle Details</h3>
                <p className="text-sm text-[#9E9E9E]">{vehicle.registration}</p>
                <p className="text-sm text-[#9E9E9E]">{vehicle.type}</p>
                <p className="text-sm text-[#9E9E9E]">{vehicle.depot}</p>
              </div>
            </div>
          </Card>

          {/* Shift Times */}
          <Card>
            <div className="flex items-start gap-3 mb-4">
              <div className="bg-[#F2F2F2] p-2 rounded-lg">
                <Clock className="text-[#C62828]" size={20} />
              </div>
              <div className="flex-1">
                <h3 className="mb-3">Shift Times</h3>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#9E9E9E]">Start</span>
                    <span>{formatTime(shiftStartTime)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#9E9E9E]">Duration</span>
                    <span>{getShiftDuration()}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* GPS Summary */}
          <Card>
            <div className="flex items-start gap-3 mb-4">
              <div className="bg-[#F2F2F2] p-2 rounded-lg">
                <MapPin className="text-green-500" size={20} />
              </div>
              <div className="flex-1">
                <h3 className="mb-2">GPS Summary</h3>
                <div className="bg-[#F2F2F2] rounded-lg aspect-video flex items-center justify-center">
                  <div className="text-center text-[#9E9E9E]">
                    <MapPin size={32} className="mx-auto mb-2" />
                    <p className="text-sm">Map Snapshot Placeholder</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Checklist Summary */}
          <Card>
            <h3 className="mb-3">Checklist Summary</h3>
            <div className="flex gap-4 mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="text-[#66BB6A]" size={18} />
                <span className="text-sm">{checklistSummary.passed} Passed</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="text-[#D32F2F]" size={18} />
                <span className="text-sm">{checklistSummary.failed} Failed</span>
              </div>
            </div>
            {checklistSummary.failedItems.length > 0 && (
              <div className="bg-[#FFEBEE] border-l-4 border-[#D32F2F] p-3 rounded-lg">
                <p className="text-sm mb-2">Failed Items:</p>
                {checklistSummary.failedItems.map((item, idx) => (
                  <p key={idx} className="text-sm text-[#2E2E2E]">• {item}</p>
                ))}
              </div>
            )}
          </Card>

          {/* Readings Summary */}
          <Card>
            <h3 className="mb-3">Readings Summary</h3>
            <div className="flex flex-col gap-3">
              <div className="flex justify-between text-sm">
                <span className="text-[#9E9E9E]">Odometer</span>
                <span>{odometerReading || '--'} km</span>
              </div>
            </div>
          </Card>

          {/* Photo Gallery */}
          {allPhotos.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Camera className="text-[#C62828]" size={20} />
                <h3>Photo Gallery</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {allPhotos.map(photo => (
                  <div key={photo.id} className="flex flex-col gap-1">
                    <img 
                      src={photo.photo} 
                      alt={photo.label} 
                      className="w-full aspect-square object-cover rounded-lg border border-[#9E9E9E]"
                    />
                    <p className="text-xs text-[#9E9E9E]">{photo.label}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Break Summary */}
          <Card>
            <h3 className="mb-3">Break Summary</h3>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#9E9E9E]">Total break time</span>
                <span>{breakSummary.totalTime} minutes</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#9E9E9E]">Max allowed</span>
                <span>{breakSummary.maxAllowed} minutes</span>
              </div>
              <div className="w-full bg-[#F2F2F2] rounded-full h-2 mt-2">
                <div 
                  className="bg-[#C62828] h-2 rounded-full"
                  style={{ width: `${(breakSummary.totalTime / breakSummary.maxAllowed) * 100}%` }}
                />
              </div>
            </div>
          </Card>

          {/* Fuel Logs Summary */}
          {fuelLogs.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Fuel className="text-[#C62828]" size={20} />
                <h3>Fuel Logs</h3>
              </div>
              {fuelLogs.map(log => (
                <div key={log.id} className="bg-[#F2F2F2] p-3 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">{log.station}</span>
                    <span className="text-sm text-[#9E9E9E]">{log.time}</span>
                  </div>
                  <div className="flex justify-between text-sm text-[#9E9E9E]">
                    <span>{log.litres}L</span>
                    <span>${log.cost.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </Card>
          )}

          {/* Notes Sent */}
          {notesSent.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="text-[#C62828]" size={20} />
                <h3>Notes Sent</h3>
              </div>
              {notesSent.map(note => (
                <div key={note.id} className="bg-[#F2F2F2] p-3 rounded-lg mb-2">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">{note.category}</span>
                    <span className="text-xs text-[#9E9E9E]">{note.time}</span>
                  </div>
                  <p className="text-sm text-[#9E9E9E]">{note.message}</p>
                </div>
              ))}
            </Card>
          )}

          {/* Incidents */}
          {incidents.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="text-[#D32F2F]" size={20} />
                <h3>Incidents</h3>
              </div>
              {incidents.map(incident => (
                <div key={incident.id} className="bg-[#FFEBEE] p-3 rounded-lg mb-2">
                  <p className="text-sm">{incident.description}</p>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-[#F2F2F2] bg-white flex flex-col gap-2">
        <Button variant="primary" fullWidth onClick={onBack}>
          Back to Active Shift
        </Button>
        <Button variant="outline" fullWidth>
          <div className="flex items-center justify-center gap-2">
            <Download size={18} />
            Download / Share
          </div>
        </Button>
      </div>
    </div>
  );
}