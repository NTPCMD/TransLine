import React, { useEffect } from 'react';
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { TIMING_MED, SPRING_ENTER, COLORS } from '../lib/animations';

interface ScreenContainerProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}

export default function ScreenContainer({ title, subtitle, children }: ScreenContainerProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(14);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 260 });
    translateY.value = withSpring(0, SPRING_ENTER);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={animStyle}>
          <View style={styles.headerArea}>
            <Image source={require('../../assets/transline-logo.png')} style={styles.logoImage} resizeMode="contain" />
            <View>
              <Text style={styles.brand}>Transline</Text>
              <Text style={styles.tagline}>Compliance in motion</Text>
            </View>
          </View>
          {title && <Text style={styles.title}>{title}</Text>}
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          <View style={styles.content}>{children}</View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  headerArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  logoImage: {
    width: 88,
    height: 56,
  },
  brand: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.4,
  },
  tagline: {
    color: COLORS.textMuted,
    fontSize: 13,
    letterSpacing: 0.1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: COLORS.textSecondary,
    marginBottom: 18,
    fontSize: 14,
  },
  content: {
    gap: 12,
  },
});
