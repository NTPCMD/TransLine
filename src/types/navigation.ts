import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  DriverDeclaration: undefined;
  StartShift: undefined;
  PreStartChecklist: undefined;
  WaitForInstruction: undefined;
  ReadingsAndPhotos: undefined;
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
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
