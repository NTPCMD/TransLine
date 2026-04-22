import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppStateProvider } from './src/state/AppStateContext';
import { DriverProvider, useDriver } from './src/state/DriverContext';
import { AssignmentProvider } from './src/state/AssignmentContext';
import { ActiveShiftProvider } from './src/state/ActiveShiftContext';

const BUILD_STAMP = 'APP BUILD: transline-driver-fullflow-2026-02-02';

import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import VehicleAssignmentScreen from './src/screens/VehicleAssignmentScreen';
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
import OfflineQueueScreen from './src/screens/OfflineQueueScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ShiftHistoryScreen from './src/screens/ShiftHistoryScreen';
import OdometerCaptureScreen from './src/screens/OdometerCaptureScreen';

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

function MainDrawer() {
  return (
    <Drawer.Navigator initialRouteName="Dashboard" screenOptions={{ headerShown: false }}>
      <Drawer.Screen name="Dashboard" component={DashboardScreen as any} />
      <Drawer.Screen name="ActiveShift" component={ActiveShiftScreen as any} />
      <Drawer.Screen name="ShiftDetails" component={ShiftDetailsScreen as any} />
      <Drawer.Screen name="FuelLog" component={FuelLogScreen as any} />
      <Drawer.Screen name="IncidentReport" component={IncidentReportScreen as any} />
      <Drawer.Screen name="SendNote" component={SendNoteScreen as any} />
      <Drawer.Screen name="MedicalAbsence" component={MedicalAbsenceScreen as any} />
      <Drawer.Screen name="Announcements" component={AnnouncementsScreen as any} />
      <Drawer.Screen name="VehicleMaintenanceLog" component={VehicleMaintenanceLogScreen as any} />
      <Drawer.Screen
        name="OfflineQueue"
        component={OfflineQueueScreen}
        options={{ title: 'Offline Queue' }}
      />
      <Drawer.Screen name="Profile" component={ProfileScreen as any} options={{ title: 'Profile' }} />
      <Drawer.Screen
        name="ShiftHistory"
        component={ShiftHistoryScreen as any}
        options={{ title: 'Shift History' }}
      />
    </Drawer.Navigator>
  );
}

function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen as any} />
      <Stack.Screen name="Login" component={LoginScreen as any} />
      <Stack.Screen name="Dashboard" component={DashboardScreen as any} />
      <Stack.Screen name="VehicleAssignment" component={VehicleAssignmentScreen as any} />
      <Stack.Screen name="DriverDeclaration" component={DriverDeclarationScreen as any} />
      <Stack.Screen name="StartShift" component={StartShiftScreen as any} />
      <Stack.Screen name="PreStartChecklist" component={PreStartChecklistScreen as any} />
      <Stack.Screen name="WaitForInstruction" component={WaitForInstructionScreen as any} />
      <Stack.Screen name="ReadingsAndPhotos" component={ReadingsAndPhotosScreen as any} />
      <Stack.Screen name="Main" component={MainDrawer} />
      <Stack.Screen name="ActiveShift" component={ActiveShiftScreen as any} />
      <Stack.Screen name="ShiftDetails" component={ShiftDetailsScreen as any} />
      <Stack.Screen name="BreakControl" component={BreakControlScreen as any} />
      <Stack.Screen name="FuelLog" component={FuelLogScreen as any} />
      <Stack.Screen name="IncidentReport" component={IncidentReportScreen as any} />
      <Stack.Screen name="SendNote" component={SendNoteScreen as any} />
      <Stack.Screen name="EndShift" component={EndShiftScreen as any} />
      <Stack.Screen name="MedicalAbsence" component={MedicalAbsenceScreen as any} />
      <Stack.Screen name="Announcements" component={AnnouncementsScreen as any} />
      <Stack.Screen name="OperationsAlerts" component={OperationsAlertsScreen as any} />
      <Stack.Screen name="ComponentsLibrary" component={ComponentsLibraryScreen as any} />
      <Stack.Screen name="VehicleMaintenanceLog" component={VehicleMaintenanceLogScreen as any} />
      <Stack.Screen name="OfflineQueue" component={OfflineQueueScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen as any} />
      <Stack.Screen name="ShiftHistory" component={ShiftHistoryScreen as any} />
      <Stack.Screen name="OdometerCapture" component={OdometerCaptureScreen} />
    </Stack.Navigator>
  );
}

function AppContent() {
  const { authUserId, currentDriver, currentProfile } = useDriver();

  return (
    <ActiveShiftProvider
      driverId={currentDriver?.id ?? currentProfile?.id ?? currentDriver?.profile_id ?? authUserId ?? null}
    >
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </ActiveShiftProvider>
  );
}

export default function App() {
  useEffect(() => {
    console.log(BUILD_STAMP);
  }, []);

  return (
    <View style={{ flex: 1, position: 'relative' }}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <DriverProvider>
          <AssignmentProvider>
            <AppStateProvider>
              <AppContent />
            </AppStateProvider>
          </AssignmentProvider>
        </DriverProvider>
      </GestureHandlerRootView>
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          paddingHorizontal: 10,
          paddingVertical: 4,
          zIndex: 9999,
        }}
      >
        <Text style={{ color: '#0f0', fontSize: 10, fontFamily: 'monospace' }}>
          {BUILD_STAMP}
        </Text>
      </View>
    </View>
  );
}
