import 'react-native-url-polyfill/auto';
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AppStateProvider } from './src/state/AppStateContext';
import { DriverProvider, useDriver } from './src/state/DriverContext';
import { AssignmentProvider } from './src/state/AssignmentContext';
import { ActiveShiftProvider } from './src/state/ActiveShiftContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { isSupabaseConfigured } from './src/lib/supabase';

const BUILD_STAMP = 'APP BUILD: transline-driver v2.0.1 (2026-06-22) offline+gps';

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
import EndShiftScreen from './src/screens/EndShiftScreen';
import ComponentsLibraryScreen from './src/screens/ComponentsLibraryScreen';
import OfflineQueueScreen from './src/screens/OfflineQueueScreen';
import OdometerCaptureScreen from './src/screens/OdometerCaptureScreen';
import ChecklistApprovalScreen from './src/screens/ChecklistApprovalScreen';

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

const getActiveRouteName = (state: any): string | undefined => {
  const route = state?.routes?.[state.index ?? 0];
  if (!route) return undefined;
  if (route.state) return getActiveRouteName(route.state);
  return route.name;
};

function MainDrawer() {
  return (
    <Drawer.Navigator initialRouteName="Dashboard" screenOptions={{ headerShown: false }}>
      <Drawer.Screen name="Dashboard" component={DashboardScreen as any} />
      <Drawer.Screen name="ActiveShift" component={ActiveShiftScreen as any} />
      <Drawer.Screen name="ShiftDetails" component={ShiftDetailsScreen as any} />
      <Drawer.Screen name="FuelLog" component={FuelLogScreen as any} />
      <Drawer.Screen name="IncidentReport" component={IncidentReportScreen as any} />
      <Drawer.Screen
        name="OfflineQueue"
        component={OfflineQueueScreen}
        options={{ title: 'Offline Queue' }}
      />
    </Drawer.Navigator>
  );
}

function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        animationDuration: 180,
      }}
    >
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
      <Stack.Screen name="EndShift" component={EndShiftScreen as any} />
      {/* Menu pages removed on 2026-05-30: Announcements, Medical Absence,
          Vehicle Maintenance, Profile, Operations Alerts. Re-register routes
          here if these screens are needed again in the future. */}
      <Stack.Screen name="ComponentsLibrary" component={ComponentsLibraryScreen as any} />
      <Stack.Screen name="OfflineQueue" component={OfflineQueueScreen} />
      <Stack.Screen name="OdometerCapture" component={OdometerCaptureScreen} />
      <Stack.Screen name="ChecklistApproval" component={ChecklistApprovalScreen as any} />
    </Stack.Navigator>
  );
}

function AppContent() {
  const { currentDriver } = useDriver();
  const navigationRef = useNavigationContainerRef();
  const previousRouteRef = useRef<string | undefined>(undefined);
  const { width } = useWindowDimensions();

  const sweepX = useSharedValue(-320);
  const sweepOpacity = useSharedValue(0);
  const transitionMaskOpacity = useSharedValue(0);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweepX.value }],
    opacity: sweepOpacity.value,
  }));

  const transitionMaskStyle = useAnimatedStyle(() => ({
    opacity: transitionMaskOpacity.value,
  }));

  const playTruckTransition = useCallback(() => {
    const panelWidth = Math.max(width * 0.72, 280);
    sweepX.value = -panelWidth;
    sweepOpacity.value = 1;
    transitionMaskOpacity.value = 1;

    sweepX.value = withTiming(width, {
      duration: 3000,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
    sweepOpacity.value = withTiming(0, {
      duration: 3000,
      easing: Easing.linear,
    });
    transitionMaskOpacity.value = withTiming(0, {
      duration: 3000,
      easing: Easing.linear,
    });
  }, [sweepOpacity, sweepX, transitionMaskOpacity, width]);

  return (
    <ActiveShiftProvider
      driverId={currentDriver?.id ?? null}
    >
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          previousRouteRef.current = getActiveRouteName(navigationRef.getRootState());
        }}
        onStateChange={(state) => {
          const currentRoute = getActiveRouteName(state);
          if (!currentRoute) return;

          if (previousRouteRef.current && previousRouteRef.current !== currentRoute) {
            playTruckTransition();
          }

          previousRouteRef.current = currentRoute;
        }}
      >
        <RootNavigator />
      </NavigationContainer>

      <Animated.View
        pointerEvents="none"
        style={[styles.transitionMask, transitionMaskStyle]}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.transitionSweep,
          { width: Math.max(width * 0.72, 280) },
          sweepStyle,
        ]}
      >
        <View style={styles.truckMark}>
          <View style={styles.truckCab} />
          <View style={styles.truckBody} />
          <View style={styles.truckWheelRow}>
            <View style={styles.truckWheel} />
            <View style={styles.truckWheel} />
            <View style={styles.truckWheel} />
          </View>
        </View>
        <Text style={styles.transitionText}>TRANSLINE</Text>
      </Animated.View>
    </ActiveShiftProvider>
  );
}

export default function App() {
  useEffect(() => {
    console.log(BUILD_STAMP);
  }, []);

  return (
    <View style={{ flex: 1, position: 'relative' }}>
      <ErrorBoundary>
        {isSupabaseConfigured ? (
          <GestureHandlerRootView style={{ flex: 1 }}>
            <DriverProvider>
              <AssignmentProvider>
                <AppStateProvider>
                  <AppContent />
                </AppStateProvider>
              </AssignmentProvider>
            </DriverProvider>
          </GestureHandlerRootView>
        ) : (
          <View style={styles.configError}>
            <Text style={styles.configErrorTitle}>App configuration missing</Text>
            <Text style={styles.configErrorText}>
              The app could not find its Supabase connection settings, so it can't start. This is a
              build configuration problem, not something you did. Please contact support.
            </Text>
          </View>
        )}
      </ErrorBoundary>
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

const styles = StyleSheet.create({
  configError: {
    flex: 1,
    backgroundColor: '#0F0F0F',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  configErrorTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  configErrorText: {
    color: '#D1D5DB',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  transitionMask: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#C62828',
    zIndex: 4900,
  },
  transitionSweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#C62828',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5000,
  },
  transitionText: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 1.4,
    fontSize: 14,
    marginTop: 12,
  },
  truckMark: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  truckCab: {
    width: 28,
    height: 14,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: '#FFFFFF',
    marginRight: 42,
  },
  truckBody: {
    width: 88,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginTop: 2,
  },
  truckWheelRow: {
    width: 88,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 4,
  },
  truckWheel: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1F2937',
  },
});
