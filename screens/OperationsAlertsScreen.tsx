import React from 'react';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { ScreenHeader } from '../components/ScreenHeader';
import { AlertTriangle, MapPin } from 'lucide-react';

interface Alert {
  id: string;
  driver: string;
  vehicle: string;
  type: 'breakdown' | 'accident' | 'incident';
  time: string;
  location: string;
}

interface OperationsAlertsScreenProps {
  onBack: () => void;
}

const mockAlerts: Alert[] = [
  {
    id: '1',
    driver: 'John Smith',
    vehicle: 'ABC-123',
    type: 'breakdown',
    time: '2:15 PM',
    location: 'M4 Motorway, Parramatta'
  },
  {
    id: '2',
    driver: 'Sarah Johnson',
    vehicle: 'XYZ-789',
    type: 'incident',
    time: '1:45 PM',
    location: 'Sydney Depot'
  },
  {
    id: '3',
    driver: 'Mike Brown',
    vehicle: 'DEF-456',
    type: 'accident',
    time: '12:30 PM',
    location: 'Pacific Highway, Hornsby'
  }
];

export function OperationsAlertsScreen({ onBack }: OperationsAlertsScreenProps) {
  const getAlertIcon = (type: string) => {
    return <AlertTriangle className="text-[#D32F2F]" size={20} />;
  };

  const getAlertLabel = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <ScreenHeader title="Operations Alerts" onBack={onBack} />
      
      <div className="bg-[#FFF3E0] border-l-4 border-[#FFA726] p-4">
        <p className="text-sm text-[#2E2E2E]">
          This is a read-only preview of operations alerts. Real-time updates managed by operations team.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-3">
          {mockAlerts.map(alert => (
            <Card key={alert.id}>
              <div className="flex items-start gap-3">
                <div className="bg-[#FFEBEE] p-2 rounded-lg">
                  {getAlertIcon(alert.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3>{alert.driver}</h3>
                      <p className="text-sm text-[#9E9E9E]">{alert.vehicle}</p>
                    </div>
                    <Badge variant="issue">{getAlertLabel(alert.type)}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#9E9E9E] mb-2">
                    <MapPin size={14} />
                    <span>{alert.location}</span>
                  </div>
                  <p className="text-xs text-[#9E9E9E]">{alert.time}</p>
                  <button className="mt-3 text-[#C62828] text-sm hover:underline">
                    Open Map
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
