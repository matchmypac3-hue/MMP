// app/_layout.tsx

import { Slot, useRouter, useSegments } from "expo-router";
import { ActivityProvider } from "../context/ActivityContext";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { ChallengeProvider } from "../context/ChallengeContext";
import { PartnerProvider, usePartner } from "../context/PartnerContext";
import { useEffect } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { theme } from "../utils/theme";

const InitialLayout = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { loading: partnerLoading, hasSelectedSlot } = usePartner();
  // With Expo Router typed routes, `useSegments()` can be strongly typed (and too narrow)
  // for our guard checks. We only need runtime segment strings here.
  const segments = useSegments() as unknown as string[];
  const router = useRouter();

  useEffect(() => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('🔎 [Guard] state', {
        isAuthenticated,
        isLoading,
        partnerLoading,
        hasSelectedSlot,
        segments,
      });
    }

    if (isLoading || partnerLoading) return;

    // On native, segments can be empty on startup; treat it as a root route.
    const isRootRoute = segments.length === 0;

    // On web, group names like "(auth)" can be omitted from segments.
    const isAuthRoute =
      segments[0] === "(auth)" || segments.includes("login") || segments.includes("register");
    const inPartnerSelection =
      segments[0] === "partner-selection" || segments[0] === "partner-selection-select";

    const needsPartnerSelection = isAuthenticated && !hasSelectedSlot;

    if (!isAuthenticated && (!isAuthRoute || isRootRoute)) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('🔀 [Guard] redirect -> / (auth) / login');
      }
      router.replace("/(auth)/login");
    } else if (needsPartnerSelection && !inPartnerSelection) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('🔀 [Guard] redirect -> /partner-selection');
      }
      // Force slot selection on first-time setup.
      router.replace("/partner-selection");
    } else if (isAuthenticated && (isAuthRoute || isRootRoute) && !needsPartnerSelection) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('🔀 [Guard] redirect -> /(tabs)');
      }
      // User is authenticated but still on login/register screens.
      router.replace("/(tabs)");
    } else if (isAuthenticated && inPartnerSelection) {
      // User is on setup screens, just stay there
      return;
    } else if (isAuthenticated && !inPartnerSelection && !isAuthRoute) {
      // User is on app screens (tabs, etc), OK
      return;
    }
  }, [isAuthenticated, isLoading, partnerLoading, segments, hasSelectedSlot, router]);

  // Important: do NOT unmount <Slot /> during loading, otherwise auth forms lose their local state
  // (email/password reset while the user types).
  const showLoader = isLoading || partnerLoading;

  return (
    <View style={{ flex: 1 }}>
      <Slot />

      {showLoader && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.colors.bg.primary,
          }}
        >
          <ActivityIndicator size="large" color={theme.colors.users.primary} />
          <Text style={{ color: theme.colors.text.high, marginTop: 20 }}>Chargement...</Text>
        </View>
      )}
    </View>
  );
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <PartnerProvider>
        <ChallengeProvider>
          <ActivityProvider>
            <InitialLayout />
          </ActivityProvider>
        </ChallengeProvider>
      </PartnerProvider>
    </AuthProvider>
  );
}