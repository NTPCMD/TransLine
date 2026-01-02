import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStateProvider } from './src/state/AppStateContext';
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import DriverDeclarationScreen from './src/screens/DriverDeclarationScreen';
import StartShiftScreen from './src/screens/StartShiftScreen';
import PreStartChecklistScreen from './src/screens/PreStartChecklistScreen';
import WaitForInstructionScreen from './src/screens/WaitForInstructionScreen';
import ReadingsAndPhotosScreen from './src/screens/ReadingsAndPhotosScreen';
import ActiveShiftScreen from './src/screens/ActiveShiftScreen';
import ShiftDetailsScreen from './src/screens/ShiftDetailsScreen';
import BreakControlScreen from './src/screens/BreakControlScreen';
import FuelLogScreen from './src/screens/FuelLogScreen';
import IncidentReportScreen from './src/screens/IncidentReportScreen';
import SendNoteScreen from './src/screens/SendNoteScreen';
import EndShiftScreen from './src/screens/EndShiftScreen';
import MedicalAbsenceScreen from './src/screens/MedicalAbsenceScreen';
import AnnouncementsScreen from './src/screens/AnnouncementsScreen';
import OperationsAlertsScreen from './src/screens/OperationsAlertsScreen';
import ComponentsLibraryScreen from './src/screens/ComponentsLibraryScreen';
import VehicleMaintenanceLogScreen from './src/screens/VehicleMaintenanceLogScreen';
import type { RootStackParamList } from './src/types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Splash">
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="DriverDeclaration" component={DriverDeclarationScreen} />
            <Stack.Screen name="StartShift" component={StartShiftScreen} />
            <Stack.Screen name="PreStartChecklist" component={PreStartChecklistScreen} />
            <Stack.Screen name="WaitForInstruction" component={WaitForInstructionScreen} />
            <Stack.Screen name="ReadingsAndPhotos" component={ReadingsAndPhotosScreen} />
            <Stack.Screen name="ActiveShift" component={ActiveShiftScreen} />
            <Stack.Screen name="ShiftDetails" component={ShiftDetailsScreen} />
            <Stack.Screen name="BreakControl" component={BreakControlScreen} />
            <Stack.Screen name="FuelLog" component={FuelLogScreen} />
            <Stack.Screen name="IncidentReport" component={IncidentReportScreen} />
            <Stack.Screen name="SendNote" component={SendNoteScreen} />
            <Stack.Screen name="EndShift" component={EndShiftScreen} />
            <Stack.Screen name="MedicalAbsence" component={MedicalAbsenceScreen} />
            <Stack.Screen name="Announcements" component={AnnouncementsScreen} />
            <Stack.Screen name="OperationsAlerts" component={OperationsAlertsScreen} />
            <Stack.Screen name="ComponentsLibrary" component={ComponentsLibraryScreen} />
            <Stack.Screen name="VehicleMaintenanceLog" component={VehicleMaintenanceLogScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
