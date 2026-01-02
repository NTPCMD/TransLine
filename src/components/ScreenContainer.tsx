import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

interface ScreenContainerProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}

export default function ScreenContainer({ title, subtitle, children }: ScreenContainerProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerArea}>
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoText}>T</Text>
          </View>
          <View>
            <Text style={styles.brand}>Transline</Text>
            <Text style={styles.tagline}>Compliance in motion</Text>
          </View>
        </View>
        {title && <Text style={styles.title}>{title}</Text>}
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        <View style={styles.content}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  headerArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  logoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#C62828',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  brand: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  tagline: {
    color: '#6B7280',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 6,
    color: '#111827',
  },
  subtitle: {
    color: '#4B5563',
    marginBottom: 12,
  },
  content: {
    gap: 12,
  },
});
