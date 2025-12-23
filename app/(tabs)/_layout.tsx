// app/(tabs)/_layout.tsx

import React, { useEffect, useMemo, useRef } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Animated, Easing, Platform } from 'react-native';
import { theme } from '../../utils/theme';

function DefisTabIcon({ color, focused }: { color: string; focused: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!focused) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 650,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 650,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [focused, pulse]);

  const style = useMemo(() => {
    const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
    const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.75] });
    return { transform: [{ scale }], opacity };
  }, [pulse]);

  return (
    <Animated.View style={style}>
      <Ionicons
        name={focused ? "flash" : "flash-outline"}
        size={22}
        color={color}
      />
    </Animated.View>
  );
}

export default function TabLayout() {
  return (
    <>
      <Tabs
        initialRouteName="index"
        screenOptions={{
          tabBarActiveTintColor: theme.colors.users.primary,
          tabBarInactiveTintColor: theme.colors.text.tertiary,
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#14141e',
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            paddingBottom: Platform.select({
              ios: 50,
              android: 45,
              web: 30,
            }),
            paddingTop: 8,
            height: Platform.select({
              ios: 120,
              android: 110,
              web: 90,
            }),
            position: 'absolute',
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            marginBottom: Platform.select({
              ios: 6,
              android: 6,
              web: 2,
            }),
          },
          tabBarIconStyle: {
            marginTop: 2,
          },
        }}
      >
        <Tabs.Screen
          name="settings"
          options={{
            // Keep route accessible programmatically, but hide from tab bar and linking.
            href: null,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profil",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "person" : "person-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="index"
          options={{
            title: "Pacte",
            tabBarIcon: ({ color, focused }) => (
              <DefisTabIcon color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            title: "Stats",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons 
                name={focused ? "bar-chart" : "bar-chart-outline"} 
                size={22} 
                color={color} 
              />
            ),
          }}
        />
      </Tabs>
    </>
  );
}