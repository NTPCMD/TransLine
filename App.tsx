import React, { useState, useEffect } from 'react';
import { MobileContainer } from './components/MobileContainer';
import { Loader2 } from 'lucide-react';

// Screen imports
import { LoginScreen } from './screens/LoginScreen';
import { DriverDeclarationScreen } from './screens/DriverDeclarationScreen';
import { StartShiftScreen } from './screens/StartShiftScreen';
import { PreStartChecklistScreen } from './screens/PreStartChecklistScreen';
import { WaitForInstructionScreen } from './screens/WaitForInstructionScreen';
import { ReadingsAndPhotosScreen } from './screens/ReadingsAndPhotosScreen';
import { ActiveShiftScreen } from './screens/ActiveShiftScreen';
import { ShiftDetailsScreen } from './screens/ShiftDetailsScreen';
import { BreakControlScreen } from './screens/BreakControlScreen';
import { FuelLogScreen } from './screens/FuelLogScreen';
import { IncidentReportScreen } from './screens/IncidentReportScreen';
import { SendNoteScreen } from './screens/SendNoteScreen';
import { EndShiftScreen } from './screens/EndShiftScreen';
import { MedicalAbsenceScreen } from './screens/MedicalAbsenceScreen';
import { AnnouncementsScreen } from './screens/AnnouncementsScreen';
import { OperationsAlertsScreen } from './screens/OperationsAlertsScreen';
import { ComponentsLibraryScreen } from './screens/ComponentsLibraryScreen';
import { VehicleMaintenanceLogScreen } from './screens/VehicleMaintenanceLogScreen';

export type Screen = 
  | 'splash'
  | 'login'
  | 'declaration'
  | 'start-shift'
  | 'pre-start-checklist'
  | 'wait-instruction'
  | 'readings-photos'
  | 'active-shift'
  | 'shift-details'
  | 'break'
  | 'fuel-log'
  | 'incident'
  | 'send-note'
  | 'end-shift'
  | 'medical-absence'
  | 'announcements'
  | 'operations-alerts'
  | 'components'
  | 'maintenance-log';

export interface AppState {
  isLoggedIn: boolean;
  declarationAccepted: boolean;
  assignedVehicle: { registration: string; type: string; depot: string };
  shiftStarted: boolean;
  checklistCompleted: boolean;
  odometerReading: string;
  odometerPhoto: string;
  shiftStartTime: Date | null;
  onBreak: boolean;
}

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const [appState, setAppState] = useState<AppState>({
    isLoggedIn: false,
    declarationAccepted: false,
    assignedVehicle: { registration: '', type: '', depot: '' },
    shiftStarted: false,
    checklistCompleted: false,
    odometerReading: '',
    odometerPhoto: '',
    shiftStartTime: null,
    onBreak: false
  });

  // Splash screen timeout
  useEffect(() => {
    if (currentScreen === 'splash') {
      const timer = setTimeout(() => {
        setCurrentScreen('login');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentScreen]);

  const navigate = (screen: Screen) => {
    setCurrentScreen(screen);
  };

  const updateAppState = (updates: Partial<AppState>) => {
    setAppState(prev => ({ ...prev, ...updates }));
  };

  // Splash Screen
  if (currentScreen === 'splash') {
    return (
      <MobileContainer>
        <div className="h-full flex flex-col items-center justify-center gap-4 bg-white">
          {/* Logo Placeholder - Will determine app theme */}
          <div className="w-32 h-32 bg-[#C62828] rounded-[12px] flex items-center justify-center mb-4">
            <span className="text-white text-4xl">T</span>
          </div>
          <h1 className="text-4xl">Transline</h1>
          <p className="text-[#9E9E9E]">Compliance in motion</p>
          <Loader2 className="animate-spin text-[#C62828] mt-8" size={32} />
        </div>
      </MobileContainer>
    );
  }

  // Render current screen
  const renderScreen = () => {
    switch (currentScreen) {
      case 'login':
        return <LoginScreen onLogin={() => {
          updateAppState({ isLoggedIn: true });
          navigate('declaration');
        }} />;
      
      case 'declaration':
        return <DriverDeclarationScreen onAccept={() => {
          // Auto-assign vehicle when declaration is accepted
          updateAppState({ 
            declarationAccepted: true,
            assignedVehicle: { 
              registration: 'ABC-123', 
              type: 'Rigid Truck', 
              depot: 'Sydney Depot' 
            }
          });
          navigate('start-shift');
        }} />;
      
      case 'start-shift':
        return <StartShiftScreen
          vehicle={appState.assignedVehicle}
          onStartShift={() => navigate('pre-start-checklist')}
          onCancel={() => navigate('login')}
        />;
      
      case 'pre-start-checklist':
        return <PreStartChecklistScreen
          onSubmit={(hasFails) => {
            if (hasFails) {
              navigate('wait-instruction');
            } else {
              navigate('readings-photos');
            }
          }}
          onBack={() => navigate('start-shift')}
        />;
      
      case 'wait-instruction':
        return <WaitForInstructionScreen
          onContactSupport={() => {
            // In real app, this would initiate a phone call
            alert('Calling Operations Centre...');
          }}
          onSendNote={() => navigate('send-note')}
        />;
      
      case 'readings-photos':
        return <ReadingsAndPhotosScreen
          onContinue={(reading, photo) => {
            updateAppState({ 
              odometerReading: reading,
              odometerPhoto: photo,
              shiftStarted: true,
              shiftStartTime: new Date()
            });
            navigate('active-shift');
          }}
          onBack={() => navigate('pre-start-checklist')}
        />;
      
      case 'active-shift':
        return <ActiveShiftScreen
          shiftStartTime={appState.shiftStartTime}
          onBreak={() => navigate('break')}
          onFuelLog={() => navigate('fuel-log')}
          onIncident={() => navigate('incident')}
          onSendNote={() => navigate('send-note')}
          onEndShift={() => navigate('end-shift')}
          onShiftDetails={() => navigate('shift-details')}
          onMedicalAbsence={() => navigate('medical-absence')}
          onAnnouncements={() => navigate('announcements')}
          onOperationsAlerts={() => navigate('operations-alerts')}
          onComponents={() => navigate('components')}
          onMaintenanceLog={() => navigate('maintenance-log')}
        />;
      
      case 'shift-details':
        return <ShiftDetailsScreen
          vehicle={appState.assignedVehicle}
          shiftStartTime={appState.shiftStartTime}
          odometerReading={appState.odometerReading}
          odometerPhoto={appState.odometerPhoto}
          onBack={() => navigate('active-shift')}
        />;      
      case 'break':
        return <BreakControlScreen
          onClose={() => navigate('active-shift')}
        />;
      
      case 'fuel-log':
        return <FuelLogScreen
          onSubmit={() => navigate('active-shift')}
          onBack={() => navigate('active-shift')}
        />;
      
      case 'incident':
        return <IncidentReportScreen
          onSubmit={() => navigate('active-shift')}
          onBack={() => navigate('active-shift')}
        />;
      
      case 'send-note':
        return <SendNoteScreen
          onSubmit={() => navigate('active-shift')}
          onBack={() => navigate('active-shift')}
        />;
      
      case 'end-shift':
        return <EndShiftScreen
          shiftStartTime={appState.shiftStartTime}
          onConfirm={() => {
            updateAppState({
              shiftStarted: false,
              shiftStartTime: null,
              assignedVehicle: { registration: '', type: '', depot: '' },
              checklistCompleted: false
            });
            navigate('login');
          }}
          onCancel={() => navigate('active-shift')}
        />;
      
      case 'medical-absence':
        return <MedicalAbsenceScreen
          onSubmit={() => navigate('active-shift')}
          onBack={() => navigate('active-shift')}
        />;
      
      case 'announcements':
        return <AnnouncementsScreen
          onBack={() => navigate('active-shift')}
        />;
      
      case 'operations-alerts':
        return <OperationsAlertsScreen
          onBack={() => navigate('active-shift')}
        />;
      
      case 'components':
        return <ComponentsLibraryScreen
          onBack={() => navigate('active-shift')}
        />;
      
      case 'maintenance-log':
        return <VehicleMaintenanceLogScreen
          vehicle={appState.assignedVehicle}
          onBack={() => navigate('active-shift')}
        />;
      
      default:
        return <LoginScreen onLogin={() => navigate('declaration')} />;
    }
  };

  return (
    <MobileContainer>
      {renderScreen()}
    </MobileContainer>
  );
}

export default App;