import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
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

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

function MainDrawer() {
  return (
    <Drawer.Navigator initialRouteName="ActiveShift" screenOptions={{ headerShown: false }}>
      <Drawer.Screen name="ActiveShift" component={require('./src/screens/ActiveShiftScreen').default} />
      <Drawer.Screen name="ShiftDetails" component={require('./src/screens/ShiftDetailsScreen').default} />
      <Drawer.Screen name="FuelLog" component={require('./src/screens/FuelLogScreen').default} />
      <Drawer.Screen name="IncidentReport" component={require('./src/screens/IncidentReportScreen').default} />
      <Drawer.Screen name="SendNote" component={require('./src/screens/SendNoteScreen').default} />
      <Drawer.Screen name="MedicalAbsence" component={require('./src/screens/MedicalAbsenceScreen').default} />
      <Drawer.Screen name="Announcements" component={require('./src/screens/AnnouncementsScreen').default} />
      <Drawer.Screen name="VehicleMaintenanceLog" component={require('./src/screens/VehicleMaintenanceLogScreen').default} />
    </Drawer.Navigator>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="DriverDeclaration" component={DriverDeclarationScreen} />
          <Stack.Screen name="StartShift" component={StartShiftScreen} />
          <Stack.Screen name="PreStartChecklist" component={PreStartChecklistScreen} />
          <Stack.Screen name="WaitForInstruction" component={WaitForInstructionScreen} />
          <Stack.Screen name="ReadingsAndPhotos" component={ReadingsAndPhotosScreen} />
          <Stack.Screen name="Main" component={MainDrawer} />
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
  );
}