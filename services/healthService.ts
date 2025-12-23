import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type HealthProvider = 'appleHealth' | 'healthConnect';

export type HealthLinkPending = {
  provider: HealthProvider;
  autoImport: boolean;
  permissions?: string[];
  preparedAt: string; // ISO
};

const PENDING_KEY = 'healthLinkPending';
const HEALTH_CONNECT_PROVIDER_PACKAGE = 'com.google.android.apps.healthdata';

const withDevDetails = (base: string, details?: Record<string, unknown>) => {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return base;
  if (!details || Object.keys(details).length === 0) return base;
  try {
    return `${base}\n\n[debug] ${JSON.stringify(details)}`;
  } catch {
    return base;
  }
};

const getDefaultProvider = (): HealthProvider => {
  return Platform.OS === 'ios' ? 'appleHealth' : 'healthConnect';
};

const safeJsonParse = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const healthService = {
  getDefaultProvider,

  /**
   * Try to check whether the native module is present in the current runtime.
   * In Expo Go (no custom native modules), this will usually be false.
   */
  isNativeAvailable: async (provider?: HealthProvider): Promise<boolean> => {
    const effectiveProvider = provider ?? getDefaultProvider();
    try {
      if (effectiveProvider === 'appleHealth') {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const AppleHealthKit = require('react-native-health')?.default ?? require('react-native-health');
        return Boolean(AppleHealthKit);
      }

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const HealthConnect = require('react-native-health-connect');
      return Boolean(HealthConnect);
    } catch {
      return false;
    }
  },

  /**
   * Prepare the link by requesting permissions on-device and storing a pending payload.
   * The actual server linking happens after login/register.
   */
  prepareLink: async (options?: { provider?: HealthProvider; autoImport?: boolean }) => {
    const provider = options?.provider ?? getDefaultProvider();
    const autoImport = options?.autoImport ?? true;

    const nativeAvailable = await healthService.isNativeAvailable(provider);
    if (!nativeAvailable) {
      const label = provider === 'appleHealth' ? 'Apple Health' : 'Health Connect';
      throw new Error(
        `${label} n'est pas disponible dans cette app build. ` +
          `Il faut un build EAS (dev/production) avec modules natifs (pas Expo Go).`,
      );
    }

    // Request permissions right away (so the user can accept/deny while on the auth screen).
    let permissions: string[] = [];

    if (provider === 'appleHealth') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const AppleHealthKit = require('react-native-health')?.default ?? require('react-native-health');

      const available = await new Promise<boolean>((resolve) => {
        try {
          if (typeof AppleHealthKit?.isAvailable !== 'function') return resolve(true);
          AppleHealthKit.isAvailable((err: any, ok: boolean) => {
            if (err) return resolve(false);
            resolve(Boolean(ok));
          });
        } catch {
          resolve(false);
        }
      });

      if (!available) {
        throw new Error("Apple Health n'est pas disponible sur cet appareil.");
      }

      const initOptions = {
        permissions: {
          read: [AppleHealthKit.Constants.Permissions.Workout],
          write: [],
        },
      };

      await new Promise<void>((resolve, reject) => {
        AppleHealthKit.initHealthKit(initOptions, (err: any) => {
          if (err) return reject(err);
          resolve();
        });
      });

      permissions = ['Workout:read'];
    } else {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const HC = require('react-native-health-connect');
      const {
        getSdkStatus,
        SdkAvailabilityStatus,
        initialize,
        requestPermission,
        openHealthConnectDataManagement,
        openHealthConnectSettings,
      } = HC;

      const openHealthConnectUiBestEffort = () => {
        try {
          const doOpen = () => {
            try {
              if (typeof openHealthConnectSettings === 'function') {
                openHealthConnectSettings();
                return;
              }

              if (typeof openHealthConnectDataManagement === 'function') {
                openHealthConnectDataManagement(HEALTH_CONNECT_PROVIDER_PACKAGE);
                return;
              }
            } catch {
              // best-effort
            }
          };

          // Give the UI a moment to show the error message before switching apps.
          setTimeout(doOpen, 250);
        } catch {
          // best-effort
        }
      };

      try {
        const status: number | undefined =
          typeof getSdkStatus === 'function' ? await getSdkStatus(HEALTH_CONNECT_PROVIDER_PACKAGE) : undefined;

        if (status === SdkAvailabilityStatus?.SDK_UNAVAILABLE) {
          openHealthConnectUiBestEffort();
          throw new Error(
            withDevDetails(
              "[HC_SDK_UNAVAILABLE] Health Connect n'est pas disponible. Installe/active l'app Health Connect puis réessaie.",
              { sdkStatus: status },
            ),
          );
        }

        if (status === SdkAvailabilityStatus?.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
          openHealthConnectUiBestEffort();
          throw new Error(
            withDevDetails(
              "[HC_UPDATE_REQUIRED] Health Connect doit être mis à jour. Mets à jour Health Connect puis réessaie.",
              { sdkStatus: status },
            ),
          );
        }
      } catch (e: any) {
        openHealthConnectUiBestEffort();
        throw new Error(
          withDevDetails(
            e?.message || '[HC_SDK_STATUS_FAILED] Health Connect indisponible.',
            { rawMessage: e?.message },
          ),
        );
      }

      let ok = false;
      try {
        ok = await initialize();
      } catch (e: any) {
        throw new Error(
          withDevDetails(
            e?.message ||
              "[HC_INIT_FAILED] Impossible d'initialiser Health Connect. Vérifie l'installation/les mises à jour.",
            { rawMessage: e?.message },
          ),
        );
      }

      if (!ok) {
        throw new Error(
          "[HC_INIT_FALSE] Health Connect n'a pas pu s'initialiser. Vérifie l'installation/les mises à jour puis réessaie.",
        );
      }

      try {
        const granted = await requestPermission([{ accessType: 'read', recordType: 'ExerciseSession' }]);
        const hasExerciseRead = Array.isArray(granted)
          ? granted.some(
              (p: any) =>
                p?.accessType === 'read' &&
                (p?.recordType === 'ExerciseSession' || p?.recordType === 'ExerciseSessionRecord'),
            )
          : false;

        if (!hasExerciseRead) {
          throw new Error(
            withDevDetails(
              "[HC_PERMISSION_DENIED] Accès Health Connect refusé. Relance et accepte la demande d'accès à 'Exercice' (READ_EXERCISE), puis réessaie.",
              { granted },
            ),
          );
        }

        permissions = ['ExerciseSession:read'];
      } catch (e: any) {
        throw new Error(
          withDevDetails(
            e?.message ||
              "[HC_PERMISSION_REQUEST_FAILED] Permissions Health Connect refusées/échouées. Relance et accepte l'accès à 'Exercice' (READ_EXERCISE), puis réessaie.",
            { rawMessage: e?.message },
          ),
        );
      }
    }

    const pending: HealthLinkPending = {
      provider,
      autoImport,
      permissions,
      preparedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    return pending;
  },

  getPendingLink: async (): Promise<HealthLinkPending | null> => {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    return safeJsonParse<HealthLinkPending>(raw);
  },

  clearPendingLink: async (): Promise<void> => {
    await AsyncStorage.removeItem(PENDING_KEY);
  },
};
