import React, { createContext, useContext, useState } from 'react';

export interface VehicleInfo {
  registration: string;
  type: string;
  depot: string;
}

export interface AppState {
  isLoggedIn: boolean;
  declarationAccepted: boolean;
  assignedVehicle: VehicleInfo | null;
  shiftStarted: boolean;
  checklistCompleted: boolean;
  odometerReading: string;
  odometerPhoto: string;
  shiftStartTime: Date | null;
  onBreak: boolean;
}

interface AppStateContextValue {
  state: AppState;
  updateAppState: (updates: Partial<AppState>) => void;
  resetShift: () => void;
}

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

const initialState: AppState = {
  isLoggedIn: false,
  declarationAccepted: false,
  assignedVehicle: null,
  shiftStarted: false,
  checklistCompleted: false,
  odometerReading: '',
  odometerPhoto: '',
  shiftStartTime: null,
  onBreak: false,
};

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);

  const updateAppState = (updates: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const resetShift = () => {
    setState(prev => ({
      ...initialState,
      isLoggedIn: prev.isLoggedIn,
      declarationAccepted: prev.declarationAccepted,
    }));
  };

  return (
    <AppStateContext.Provider value={{ state, updateAppState, resetShift }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}
