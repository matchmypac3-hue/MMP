import { Platform } from 'react-native';
import { healthLinkService } from './healthLinkService';
import { healthService, HealthProvider } from './healthService';
import { activityService } from './activityService';
import type { Activity } from '../types/Activity';

type ImportedSummary = {
  provider: HealthProvider;
  imported: number;
  skipped: number;
  failed: number;
  from: string;
  to: string;
};

type AppleWorkoutSample = {
  activityId?: number;
  activityName?: string;
  distance?: number; // miles per docs
  calories?: number;
  tracked?: boolean;
  sourceId?: string;
  sourceName?: string;
  device?: string;
  start?: string;
  end?: string;
};

type HealthConnectExerciseSession = {
  startTime: string;
  endTime: string;
  exerciseType?: string;
  title?: string;
  metadata?: { id?: string };
};

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

const milesToKm = (miles: number) => miles * 1.609344;

const minutesBetween = (startIso: string, endIso: string) => {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const diff = Math.max(0, end - start);
  return Math.max(1, Math.round(diff / 60000));
};

const clampString = (v: unknown, max = 100) => {
  const s = typeof v === 'string' ? v : '';
  return s.length > max ? s.slice(0, max) : s;
};

const mapToActivityType = (name?: string): 'running' | 'cycling' | 'walking' | 'swimming' | 'workout' | 'yoga' => {
  const n = (name || '').toLowerCase();
  if (n.includes('run')) return 'running';
  if (n.includes('cycl')) return 'cycling';
  if (n.includes('walk')) return 'walking';
  if (n.includes('swim')) return 'swimming';
  if (n.includes('yoga')) return 'yoga';
  return 'workout';
};

const ensureNativeReady = async (provider: HealthProvider) => {
  const available = await healthService.isNativeAvailable(provider);
  if (!available) {
    const label = provider === 'appleHealth' ? 'Apple Health' : 'Health Connect';
    throw new Error(
      `${label} n'est pas disponible dans cette app build. ` +
        `Il faut un build EAS (dev/production) avec modules natifs.`
    );
  }
};

const readAppleWorkouts = async (fromIso: string, toIso: string): Promise<AppleWorkoutSample[]> => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const AppleHealthKit = require('react-native-health')?.default ?? require('react-native-health');

  const permissions = {
    permissions: {
      read: [AppleHealthKit.Constants.Permissions.Workout],
      write: [],
    },
  };

  await new Promise<void>((resolve, reject) => {
    AppleHealthKit.initHealthKit(permissions, (err: any) => {
      if (err) return reject(err);
      resolve();
    });
  });

  const options = {
    startDate: fromIso,
    endDate: toIso,
    type: 'Workout',
  };

  const results = await new Promise<AppleWorkoutSample[]>((resolve, reject) => {
    AppleHealthKit.getSamples(options, (err: any, samples: AppleWorkoutSample[]) => {
      if (err) return reject(err);
      resolve(Array.isArray(samples) ? samples : []);
    });
  });

  return results;
};

const readHealthConnectExerciseSessions = async (
  fromIso: string,
  toIso: string,
): Promise<HealthConnectExerciseSession[]> => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const HC = require('react-native-health-connect');
  const {
    getSdkStatus,
    SdkAvailabilityStatus,
    initialize,
    openHealthConnectDataManagement,
    openHealthConnectSettings,
    requestPermission,
    readRecords,
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

  // Preflight: if Health Connect provider is missing/outdated, avoid calling initialize()
  // (some device/provider combos can crash natively).
  try {
    const status: number | undefined =
      typeof getSdkStatus === 'function' ? await getSdkStatus(HEALTH_CONNECT_PROVIDER_PACKAGE) : undefined;
    if (status === SdkAvailabilityStatus?.SDK_UNAVAILABLE) {
      openHealthConnectUiBestEffort();
      throw new Error(
        withDevDetails(
          "[HC_SDK_UNAVAILABLE] Health Connect n'est pas disponible sur cet appareil. " +
            "Installe/active Health Connect puis réessaie.",
          { sdkStatus: status },
        ),
      );
    }
    if (status === SdkAvailabilityStatus?.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      openHealthConnectUiBestEffort();
      throw new Error(
        withDevDetails(
          "[HC_UPDATE_REQUIRED] Health Connect doit être mis à jour. " +
            "Ouvre le Play Store et mets à jour Health Connect, puis réessaie.",
          { sdkStatus: status },
        ),
      );
    }
  } catch (e: any) {
    openHealthConnectUiBestEffort();
    // Bubble up a readable error for the UI
    throw new Error(
      withDevDetails(e?.message || "[HC_SDK_STATUS_FAILED] Health Connect indisponible.", {
        rawMessage: e?.message,
      }),
    );
  }

  let ok = false;
  try {
    ok = await initialize();
  } catch (e: any) {
    throw new Error(
      withDevDetails(
        e?.message ||
          "[HC_INIT_FAILED] Impossible d'initialiser Health Connect. Vérifie que Health Connect est installé et à jour.",
        { rawMessage: e?.message },
      ),
    );
  }

  if (!ok) {
    throw new Error(
      "[HC_INIT_FALSE] Health Connect n'a pas pu s'initialiser. Vérifie l'installation/les mises à jour, puis réessaie.",
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
          "[HC_PERMISSION_DENIED] Accès Health Connect refusé. " +
            "Relance Sync et accepte la demande d'accès à 'Exercice' (READ_EXERCISE). " +
            "Si tu veux le faire manuellement: Santé Connect → Autorisations des applications → (cette app) → Autorisations. " +
            "Note: certaines versions n'affichent une app dans la liste qu'après une première demande acceptée.",
          { granted },
        ),
      );
    }
  } catch (e: any) {
    throw new Error(
      withDevDetails(
        e?.message ||
          "[HC_PERMISSION_REQUEST_FAILED] Permissions Health Connect refusées/échouées. Relance Sync et accepte l'accès à 'Exercice' (READ_EXERCISE), puis réessaie.",
        { rawMessage: e?.message },
      ),
    );
  }

  let response: any;
  try {
    response = await readRecords('ExerciseSession', {
      timeRangeFilter: {
        operator: 'between',
        startTime: fromIso,
        endTime: toIso,
      },
    });
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.includes('android.permission.health.READ_EXERCISE') || msg.includes('READ_EXERCISE')) {
      throw new Error(
        withDevDetails(
          "[HC_READ_PERMISSION_MISSING] Permission manquante pour lire les activités. " +
            "Relance Sync et accepte l'accès à 'Exercice' (READ_EXERCISE). " +
            "Ou: Santé Connect → Autorisations des applications → (cette app) → Autorise 'Exercice'.",
          { rawMessage: e?.message },
        ),
      );
    }

    throw new Error(
      withDevDetails(e?.message || "[HC_READ_FAILED] Lecture Health Connect impossible.", {
        rawMessage: e?.message,
      }),
    );
  }

  const items = response?.records ?? response?.result ?? [];
  return Array.isArray(items) ? items : [];
};

export const healthImportService = {
  /**
   * Manual sync action.
   * - Imports workout sessions since lastSyncAt (or last 7 days on first run)
   * - Creates activities with externalId to dedup
   * - Updates lastSyncAt
   */
  syncNow: async (options?: { provider?: HealthProvider }): Promise<ImportedSummary> => {
    const provider = options?.provider ?? (Platform.OS === 'ios' ? 'appleHealth' : 'healthConnect');

    await ensureNativeReady(provider);

    const status = await healthLinkService.getHealthStatus();
    const providerStatus = provider === 'appleHealth' ? status.appleHealth : status.healthConnect;

    if (!providerStatus?.linked) {
      throw new Error('Compte non lié. Connecte d\'abord depuis l\'écran de connexion.');
    }

    const to = new Date();
    const from = providerStatus?.lastSyncAt ? new Date(providerStatus.lastSyncAt) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const fromIso = from.toISOString();
    const toIso = to.toISOString();

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    if (provider === 'appleHealth') {
      const samples = await readAppleWorkouts(fromIso, toIso);

      for (const s of samples) {
        const start = s.start;
        const end = s.end;
        if (!start || !end) {
          skipped++;
          continue;
        }

        const activityType = mapToActivityType(s.activityName);
        const duration = minutesBetween(start, end);
        const distanceKm = typeof s.distance === 'number' ? milesToKm(s.distance) : undefined;

        // Our API requires distance for running/cycling/walking/swimming.
        if ((activityType === 'running' || activityType === 'cycling' || activityType === 'walking' || activityType === 'swimming') && !distanceKm) {
          // Keep it as a workout instead of failing validation.
          // This preserves the imported session without breaking the API contract.
        }

        const typeForApi =
          (activityType === 'running' || activityType === 'cycling' || activityType === 'walking' || activityType === 'swimming') && distanceKm
            ? activityType
            : 'workout';

        const externalId = `apple:${clampString(s.sourceId, 80)}:${start}:${end}:${String(s.activityId ?? '')}:${String(s.distance ?? '')}`;

        try {
          await activityService.addActivity(
            {
              type: typeForApi,
              title: typeForApi === 'workout' ? `Apple Health • ${s.activityName || 'Workout'}` : `Apple Health • ${typeForApi}`,
              duration,
              date: start,
              startTime: start,
              endTime: end,
              source: 'tracked',
              ...(distanceKm ? { distance: Number(distanceKm.toFixed(3)) } : {}),
              externalSource: 'appleHealth',
              externalId,
            } satisfies Omit<Activity, 'id' | '_id'>,
            'token-not-used',
          );
          imported++;
        } catch {
          failed++;
        }
      }
    } else {
      // Android Health Connect import (minimal): create a generic workout per exercise session.
      const sessions = await readHealthConnectExerciseSessions(fromIso, toIso);

      for (const s of sessions) {
        const start = s.startTime;
        const end = s.endTime;
        if (!start || !end) {
          skipped++;
          continue;
        }

        const duration = minutesBetween(start, end);
        const externalId = s?.metadata?.id ? `hc:${s.metadata.id}` : `hc:${start}:${end}:${clampString(s.exerciseType, 50)}`;
        const title = `Health Connect • ${s.exerciseType || 'Workout'}`;

        try {
          await activityService.addActivity(
            {
              type: 'workout',
              title,
              duration,
              date: start,
              startTime: start,
              endTime: end,
              source: 'tracked',
              externalSource: 'healthConnect',
              externalId,
            } satisfies Omit<Activity, 'id' | '_id'>,
            'token-not-used',
          );
          imported++;
        } catch {
          failed++;
        }
      }
    }

    await healthLinkService.updateHealthStatus({
      provider,
      lastSyncAt: toIso,
    });

    return { provider, imported, skipped, failed, from: fromIso, to: toIso };
  },

  /**
   * Auto-import if the server flag is enabled.
   * This is intended to run in the background after login.
   */
  autoImportIfEnabled: async (): Promise<ImportedSummary | null> => {
    const provider: HealthProvider = Platform.OS === 'ios' ? 'appleHealth' : 'healthConnect';

    const status = await healthLinkService.getHealthStatus();
    const providerStatus = provider === 'appleHealth' ? status.appleHealth : status.healthConnect;

    if (!providerStatus?.linked || !providerStatus?.autoImport) {
      return null;
    }

    // If the native module isn't available (Expo Go), skip silently.
    const available = await healthService.isNativeAvailable(provider);
    if (!available) return null;

    return healthImportService.syncNow({ provider });
  },
};
