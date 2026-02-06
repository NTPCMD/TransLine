import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DrawerScreenProps as DrawerProps } from '@react-navigation/drawer';

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  VehicleAssignment: undefined;
  DriverDeclaration: undefined;
  StartShift: undefined;
  PreStartChecklist: undefined;
  WaitForInstruction: undefined;
  ReadingsAndPhotos: undefined;
  Main: undefined;
  ActiveShift: undefined;
  ShiftDetails: undefined;
  BreakControl: undefined;
  FuelLog: undefined;
  IncidentReport: undefined;
  SendNote: undefined;
  EndShift: undefined;
  MedicalAbsence: undefined;
  Announcements: undefined;
  OperationsAlerts: undefined;
  ComponentsLibrary: undefined;
  VehicleMaintenanceLog: undefined;
  OfflineQueue: undefined;
  Profile: undefined;
  ShiftHistory: undefined;
  OdometerCapture: {
    kind?: 'start' | 'mid' | 'end';
    shiftId?: string;
    onComplete?: (odometerValue: number, photoUri: string) => void;
    onCancel?: () => void;
  } | undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type DrawerScreenProps<T extends keyof RootStackParamList> = DrawerProps<
  RootStackParamList,
  T
>;
