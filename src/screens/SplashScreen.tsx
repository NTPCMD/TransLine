import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { ScreenProps } from '../types/navigation';

export default function SplashScreen({ navigation }: ScreenProps<'Splash'>) {
  useEffect(() => {
    const timer = setTimeout(() => navigation.replace('Login'), 1200);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.logo}> 
        <Text style={styles.logoText}>T</Text>
      </View>
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
    width: 96,
    height: 96,
    borderRadius: 18,
    backgroundColor: '#C62828',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
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
