import React, { useEffect } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { fetchDriverContext } from '../lib/driverSession';
import { supabase } from '../lib/supabase';
import type { ScreenProps } from '../types/navigation';

export default function SplashScreen(props: ScreenProps<'Splash'>) {
  const { navigation } = props;
  useEffect(() => {
    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data?.session?.user?.id ?? null;
      if (userId) {
        const driverContext = await fetchDriverContext(userId);
        if (driverContext.driver) {
          const { data: activeShift } = await supabase
            .from('shifts')
            .select('*')
            .eq('driver_id', driverContext.driver.id)
            .eq('status', 'active')
            .maybeSingle();

          if (activeShift) {
            navigation.replace('ActiveShift');
            return;
          }

          navigation.replace('Dashboard');
          return;
        }

        await supabase.auth.signOut();
      }
      navigation.replace('Login');
    };
    const timer = setTimeout(() => {
      bootstrap();
    }, 1200);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/transline-logo.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>Transline</Text>
      <Text style={styles.subtitle}>Compliance in motion</Text>
      <ActivityIndicator color="#C62828" style={styles.loader} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  logo: {
    width: 240,
    height: 140,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    color: '#6B7280',
    marginTop: 4,
  },
  loader: {
    marginTop: 20,
  },
});
