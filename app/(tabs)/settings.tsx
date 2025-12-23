// app/(tabs)/settings.tsx

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { showMessage } from '../../utils/dialogs';
import { theme } from '../../utils/theme';
import { updateMyUsername } from '../../services/userService';
import { isValidUsername, normalizeUsername } from '../../utils/username';
import { healthLinkService, type HealthStatus } from '../../services/healthLinkService';
import { healthImportService } from '../../services/healthImportService';

export default function SettingsScreen() {
  const { user, token, reloadUser, logout } = useAuth();
  const [usernameInput, setUsernameInput] = useState(user?.username || '');
  const [savingUsername, setSavingUsername] = useState(false);

  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [savingHealth, setSavingHealth] = useState(false);
  const [syncingHealth, setSyncingHealth] = useState(false);

  const healthProvider = Platform.OS === 'ios' ? 'appleHealth' : 'healthConnect';

  const handleSaveUsername = async () => {
    if (!token) {
      showMessage({ title: 'Erreur', message: 'Non authentifié' });
      return;
    }

    const normalized = normalizeUsername(usernameInput);
    if (!isValidUsername(normalized)) {
      showMessage({ title: 'Erreur', message: 'Pseudo invalide (3-20 caractères, lettres/chiffres/_)' });
      return;
    }

    try {
      setSavingUsername(true);
      await updateMyUsername(token, normalized);
      await reloadUser();
      showMessage({ title: '✅', message: 'Pseudo mis à jour.' });
    } catch (e: any) {
      showMessage({ title: 'Erreur', message: e?.message || 'Impossible de mettre à jour le pseudo' });
    } finally {
      setSavingUsername(false);
    }
  };

  const loadHealthStatus = useCallback(async () => {
    try {
      setLoadingHealth(true);
      const status = await healthLinkService.getHealthStatus();
      setHealthStatus(status);
    } catch {
      setHealthStatus(null);
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  const providerStatus = healthProvider === 'appleHealth' ? healthStatus?.appleHealth : healthStatus?.healthConnect;
  const isHealthLinked = Boolean(providerStatus?.linked);
  const isAutoImportOn = Boolean(providerStatus?.autoImport);
  const lastSyncAt = providerStatus?.lastSyncAt;

  const handleToggleAutoImport = async () => {
    try {
      setSavingHealth(true);
      const updated = await healthLinkService.updateHealthStatus({
        provider: healthProvider as any,
        autoImport: !isAutoImportOn,
      });
      setHealthStatus(updated);
    } catch (e: any) {
      showMessage({ title: 'Erreur', message: e?.message || 'Impossible de modifier' });
    } finally {
      setSavingHealth(false);
    }
  };

  const handleSyncNow = async () => {
    try {
      setSyncingHealth(true);
      const summary = await healthImportService.syncNow({ provider: healthProvider as any });
      await loadHealthStatus();
      showMessage({
        title: '✅',
        message: `Sync terminé: ${summary.imported} importées, ${summary.skipped} ignorées, ${summary.failed} erreurs.`,
      });
    } catch (e: any) {
      showMessage({ title: 'Erreur', message: e?.message || 'Impossible de synchroniser' });
    } finally {
      setSyncingHealth(false);
    }
  };

  const isBusy = Boolean(savingUsername || savingHealth || syncingHealth || loadingHealth);

  useEffect(() => {
    // Settings screen is a good place to refresh the health status.
    loadHealthStatus();
  }, [loadHealthStatus]);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollInner}>
          <View style={styles.header}>
            <View>
              <View style={styles.headerTitleRow}>
                <Ionicons name="settings-outline" size={22} color={theme.colors.text.high} />
                <Text style={styles.title}>Paramètres</Text>
              </View>
              <Text style={styles.subtitle}>Compte, santé et préférences.</Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Pseudo</Text>
          </View>
          <View style={styles.usernameCard}>
            <Text style={styles.usernameHint}>
              {user?.username
                ? `Pseudo actuel : ${user.username}`
                : 'Ajoute un pseudo pour être trouvable par les autres.'}
            </Text>

            <View style={styles.usernameRow}>
              <View style={styles.usernameInputWrap}>
                <Ionicons name="at-outline" size={18} color={theme.colors.text.muted} />
                <TextInput
                  style={styles.usernameInput}
                  placeholder="pseudo"
                  placeholderTextColor={theme.colors.text.muted}
                  value={usernameInput}
                  onChangeText={setUsernameInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity
                style={[styles.usernameSaveBtn, savingUsername && styles.usernameSaveBtnDisabled]}
                onPress={handleSaveUsername}
                disabled={savingUsername}
              >
                {savingUsername ? (
                  <ActivityIndicator color={theme.colors.text.high} />
                ) : (
                  <Text style={styles.usernameSaveText}>{user?.username ? 'Modifier' : 'Ajouter'}</Text>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.usernameRules}>3-20 caractères • lettres/chiffres/_</Text>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Santé</Text>
            {loadingHealth && <ActivityIndicator color={theme.colors.users.primary} />}
          </View>

          <View style={styles.usernameCard}>
            <Text style={styles.usernameHint}>
              {Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect'}
            </Text>

            <Text style={styles.usernameRules}>
              {isHealthLinked
                ? `Statut : lié${lastSyncAt ? ` • Dernier sync: ${new Date(lastSyncAt).toLocaleString()}` : ''}`
                : 'Statut : non lié (connecte depuis l\'écran de connexion)'}
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.usernameSaveBtn, (!isHealthLinked || savingHealth) && styles.usernameSaveBtnDisabled]}
                onPress={handleToggleAutoImport}
                disabled={!isHealthLinked || savingHealth}
              >
                {savingHealth ? (
                  <ActivityIndicator color={theme.colors.text.high} />
                ) : (
                  <Text style={styles.usernameSaveText}>{isAutoImportOn ? 'Auto-import : ON' : 'Auto-import : OFF'}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.usernameSaveBtn, (!isHealthLinked || syncingHealth) && styles.usernameSaveBtnDisabled]}
                onPress={handleSyncNow}
                disabled={!isHealthLinked || syncingHealth}
              >
                {syncingHealth ? (
                  <ActivityIndicator color={theme.colors.text.high} />
                ) : (
                  <Text style={styles.usernameSaveText}>Sync maintenant</Text>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.usernameRules}>L’ajout manuel reste toujours possible.</Text>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Compte</Text>
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={logout} disabled={isBusy}>
            <Ionicons name="log-out-outline" size={18} color={theme.colors.error} />
            <Text style={styles.logoutText}>Déconnexion</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  content: { flex: 1 },
  scrollInner: {
    padding: 20,
    paddingBottom: Platform.select({ ios: 160, android: 150, web: 120, default: 140 }),
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '800', color: theme.colors.text.high },
  subtitle: { marginTop: 6, fontSize: 13, color: theme.colors.text.secondary, maxWidth: '75%' },

  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 14,
  },
  sectionLabel: {
    color: theme.colors.text.secondary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  usernameCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bg.elevated,
    marginBottom: 12,
  },
  usernameHint: {
    color: theme.colors.text.secondary,
    fontWeight: '600',
    fontSize: 12,
    marginBottom: 10,
  },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  usernameInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bg.input,
  },
  usernameInput: { flex: 1, color: theme.colors.text.high, fontWeight: '700' },
  usernameSaveBtn: {
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bg.cardSecondary,
  },
  usernameSaveBtnDisabled: { opacity: 0.7 },
  usernameSaveText: { color: theme.colors.text.high, fontWeight: '900', fontSize: 13 },
  usernameRules: {
    marginTop: 10,
    color: theme.colors.text.muted,
    fontSize: 11,
    fontWeight: '700',
  },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: `${theme.colors.error}1f`,
    borderWidth: 1,
    borderColor: `${theme.colors.error}66`,
    marginBottom: 24,
  },
  logoutText: { color: theme.colors.error, fontWeight: '800', fontSize: 13 },

});
