// components/GradientText.tsx

import React from 'react';
import { Text, Platform, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { LinearGradientProps } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';

interface GradientTextProps {
  children: string;
  colors: LinearGradientProps['colors'];
  style?: any;
}

export function GradientText({ children, colors, style }: GradientTextProps) {
  if (Platform.OS === 'web') {
    // ⭐ Sur Web : utiliser CSS gradient.
    // Note: React Native Web only forwards a subset of CSS props reliably.
    // If background-clip isn't supported, fall back to a solid color to avoid "big colored squares".
    const primary = String(colors?.[0] ?? '#ffffff');
    const secondary = String(colors?.[1] ?? primary);

    const canUseGradientText =
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      (CSS.supports('-webkit-background-clip', 'text') || CSS.supports('background-clip', 'text'));

    if (!canUseGradientText) {
      return <Text style={[style, { color: primary }]}>{children}</Text>;
    }

    return (
      <Text
        style={[
          style,
          {
            // Use backgroundImage instead of "background" (more consistently forwarded by RN-web).
            backgroundImage: `linear-gradient(135deg, ${primary}, ${secondary})`,
            // Make the background apply only to the glyphs.
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            // Ensure the text itself doesn't paint over the gradient.
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
            // Helps ensure the background is measured to the text run.
            display: 'inline-block',
          } as any,
        ]}
      >
        {children}
      </Text>
    );
  }

  // ⭐ Sur iOS/Android : utiliser MaskedView
  return (
    <MaskedView
      maskElement={
        <Text style={[style, styles.mask]}>{children}</Text>
      }
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <Text style={[style, styles.transparent]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

const styles = StyleSheet.create({
  mask: {
    backgroundColor: 'transparent',
  },
  gradient: {
    paddingHorizontal: 8,
  },
  transparent: {
    opacity: 0,
  },
});