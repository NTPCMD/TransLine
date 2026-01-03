import React from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Card } from '../components/Card';
import { Truck, Calendar, Droplet, Gauge, Circle } from 'lucide-react';

interface VehicleMaintenanceLogScreenProps {
  vehicle: { registration: string; type: string; depot: string };
  onBack: () => void;
}

export function VehicleMaintenanceLogScreen({ vehicle, onBack }: VehicleMaintenanceLogScreenProps) {
  // Mock data - in real app would come from backend
  const maintenanceData = {
    lastServiceDate: '15 Dec 2024',
    nextServiceDue: '15 Mar 2025',
    nextServiceKm: '125,000 km',
    lastFuelled: '28 Dec 2024',
    lastFuelAmount: '180 L',
    tyresLastChecked: '01 Dec 2024',
    oilLastChanged: '15 Dec 2024',
    generalNotes: 'All systems operating normally. Minor windscreen chip reported and repaired on 10 Dec 2024.'
  };

  const statusItems = [
    { label: 'Service Status', value: 'Current', status: 'ok', icon: Circle },
    { label: 'Oil Level', value: 'Normal', status: 'ok', icon: Droplet },
    { label: 'Tyre Condition', value: 'Good', status: 'ok', icon: Circle },
  ];

  return (
    <div className="h-full flex flex-col bg-white">
      <ScreenHeader title="Vehicle Maintenance Log" onBack={onBack} />
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          {/* Vehicle Info */}
          <Card>
            <div className="flex items-start gap-3">
              <div className="bg-[#F2F2F2] p-2 rounded-lg">
                <Truck className="text-[#C62828]" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="mb-2">Vehicle Information</h3>
                <div className="flex flex-col gap-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#9E9E9E]">Registration</span>
                    <span className="text-[#2E2E2E]">{vehicle.registration}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9E9E9E]">Vehicle Type</span>
                    <span className="text-[#2E2E2E]">{vehicle.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9E9E9E]">Depot</span>
                    <span className="text-[#2E2E2E]">{vehicle.depot}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Service Information */}
          <Card>
            <div className="flex items-start gap-3 mb-4">
              <div className="bg-[#E8F5E9] p-2 rounded-lg">
                <Calendar className="text-[#66BB6A]" size={20} />
              </div>
              <div className="flex-1">
                <h3 className="mb-3">Service Schedule</h3>
                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#9E9E9E]">Last Service</span>
                    <span className="text-[#2E2E2E]">{maintenanceData.lastServiceDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9E9E9E]">Next Service Due</span>
                    <span className="text-[#2E2E2E]">{maintenanceData.nextServiceDue}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9E9E9E]">Next Service (km)</span>
                    <span className="text-[#2E2E2E]">{maintenanceData.nextServiceKm}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Fuel Information */}
          <Card>
            <div className="flex items-start gap-3 mb-4">
              <div className="bg-[#FFF3E0] p-2 rounded-lg">
                <Droplet className="text-[#FFA726]" size={20} />
              </div>
              <div className="flex-1">
                <h3 className="mb-3">Fuel Log</h3>
                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#9E9E9E]">Last Fuelled</span>
                    <span className="text-[#2E2E2E]">{maintenanceData.lastFuelled}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9E9E9E]">Amount</span>
                    <span className="text-[#2E2E2E]">{maintenanceData.lastFuelAmount}</span>
                  </div>
                </div>
                <div className="mt-3 bg-[#E3F2FD] p-3 rounded-lg">
                  <p className="text-xs text-[#2E2E2E]">
                    Auto-updated from fuel log submissions
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Maintenance History */}
          <Card>
            <div className="flex items-start gap-3 mb-4">
              <div className="bg-[#F2F2F2] p-2 rounded-lg">
                <Gauge className="text-[#C62828]" size={20} />
              </div>
              <div className="flex-1">
                <h3 className="mb-3">Maintenance History</h3>
                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#9E9E9E]">Tyres Last Checked</span>
                    <span className="text-[#2E2E2E]">{maintenanceData.tyresLastChecked}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9E9E9E]">Oil Last Changed</span>
                    <span className="text-[#2E2E2E]">{maintenanceData.oilLastChanged}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Status Indicators */}
          <Card>
            <h3 className="mb-3">Current Status</h3>
            <div className="flex flex-col gap-2">
              {statusItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={index} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <Icon 
                        size={16} 
                        className={item.status === 'ok' ? 'text-[#66BB6A]' : 'text-[#FFA726]'}
                        fill={item.status === 'ok' ? '#66BB6A' : '#FFA726'}
                      />
                      <span className="text-sm text-[#2E2E2E]">{item.label}</span>
                    </div>
                    <span className="text-sm text-[#2E2E2E]">{item.value}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* General Notes */}
          <Card>
            <h3 className="mb-3">General Maintenance Notes</h3>
            <p className="text-sm text-[#9E9E9E]">
              {maintenanceData.generalNotes}
            </p>
          </Card>

          {/* Read-only Notice */}
          <div className="bg-[#FFF3E0] border-l-4 border-[#FFA726] p-4 rounded-lg">
            <p className="text-sm text-[#2E2E2E]">
              This maintenance log is view-only for drivers. All updates are managed by operations and auto-populated from your shift activities.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
