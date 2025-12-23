// components/Diamond.tsx

import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

interface DiamondProps {
  color: string;
  size?: number;
  active?: boolean;
}

export function Diamond({ color, size = 65, active = false }: DiamondProps) {
  const ids = useMemo(() => {
    const uid = Math.random().toString(36).slice(2);
    return {
      gradientGem: `gemGradient-${uid}`,
    };
  }, []);

  // No default glow: diamonds should never shine at intermediate states (e.g. 50%).
  // Any future glow should be triggered explicitly and briefly by the parent.
  useEffect(() => {}, [active]);

  if (!active) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} viewBox="-20 -20 90 90">
          <Path
            d="M 25,5 L 45,18 L 37,45 L 13,45 L 5,18 Z"
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="1.5"
          />
        </Svg>
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="-20 -20 90 90">
        <Defs>
          <RadialGradient id={ids.gradientGem} cx="50%" cy="30%">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <Stop offset="55%" stopColor={color} stopOpacity="0.88" />
            <Stop offset="100%" stopColor={color} stopOpacity="1" />
          </RadialGradient>
        </Defs>

        <Path d="M 25,5 L 45,18 L 37,45 L 13,45 L 5,18 Z" fill={`url(#${ids.gradientGem})`} opacity={0.95} />
        <Path d="M 25,5 L 25,25 L 45,18 Z" fill={color} opacity={0.75} />
        <Path d="M 25,5 L 25,25 L 5,18 Z" fill={color} opacity={0.55} />
        <Path d="M 25,25 L 37,45 L 13,45 Z" fill={color} opacity={0.65} />

        <Circle cx="21" cy="12" r="3" fill="#FFFFFF" opacity="0.9" />
        <Circle cx="28" cy="14" r="2.2" fill="#FFFFFF" opacity="0.75" />
        <Circle cx="25" cy="8" r="1.5" fill="#FFFFFF" opacity="0.85" />

        <Path
          d="M 25,5 L 45,18 L 37,45 L 13,45 L 5,18 Z"
          fill="none"
          stroke={color}
          strokeWidth="1"
          opacity="0.75"
        />
      </Svg>
    </View>
  );
}