import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePartner } from '../context/PartnerContext';
import { useAuth } from '../context/AuthContext';
import { showMessage } from '../utils/dialogs';
import { theme } from '../utils/theme';

type Slot = 'p1' | 'p2' | 'solo';

export default function PartnerSelectionScreen() {
  const router = useRouter();
  const { partnerLinks, incomingInvites, activeSlot, switchSlot, loading, hasSelectedSlot } = usePartner();
  const { user, logout } = useAuth();
  const [switchingSolo, setSwitchingSolo] = useState(false);

  const p1Link = partnerLinks.find((l) => l.slot === 'p1');
  const p2Link = partnerLinks.find((l) => l.slot === 'p2');

  const invitesBySlot = useMemo(() => {
    const p1 = (incomingInvites || []).filter((i) => i.slot === 'p1' && i.status === 'pending');
    const p2 = (incomingInvites || []).filter((i) => i.slot === 'p2' && i.status === 'pending');
    return { p1, p2 };
  }, [incomingInvites]);

  const slotSubtitle = (slot: Slot) => {
    if (slot === 'solo') return 'Solo actif sans partenaire.';

    const link = slot === 'p1' ? p1Link : p2Link;
    const slotInvites = slot === 'p1' ? invitesBySlot.p1 : invitesBySlot.p2;

    if (slotInvites.length > 0) return 'Invitation reçue';

    if (!link) return 'Partenaire manquant';

    const partnerUsername = (link.partner as any)?.username;
    const email = link.partner?.email;
    const name = partnerUsername || (email ? email.split('@')[0] : 'Partenaire');
    return link.status === 'pending' ? `${name} • invitation en attente` : `${name} • confirmé`;
  };

  const slotState = (slot: Slot) => {
    if (slot === 'solo') return { kind: 'solo' as const };

    const link = slot === 'p1' ? p1Link : p2Link;
    const slotInvites = slot === 'p1' ? invitesBySlot.p1 : invitesBySlot.p2;

    if (slotInvites.length > 0) return { kind: 'incoming' as const };
    if (!link) return { kind: 'missing' as const };
    if (link.status === 'pending') return { kind: 'pending' as const };
    return { kind: 'confirmed' as const };
  };

  const slotPrimaryCta = (slot: Slot) => {
    const active = isActive(slot);
    if (slot === 'solo') return { label: active ? 'Actif' : 'Activer', action: 'activate' as const };

    const state = slotState(slot);
    if (active) return { label: 'Configurer', action: 'manage' as const };

    if (state.kind === 'confirmed') return { label: 'Activer', action: 'activate' as const };
    return { label: 'Configurer', action: 'manage' as const };
  };

  const badgeForSlot = (slot: Slot) => {
    if (slot === 'solo') {
      return { label: 'Mode solo', color: theme.colors.text.secondary, borderColor: theme.colors.borderSubtle };
    }

    const state = slotState(slot);
    switch (state.kind) {
      case 'missing':
        return { label: 'Partenaire manquant', color: theme.colors.error, borderColor: theme.colors.error };
      case 'pending':
        return { label: 'Invitation en attente', color: theme.colors.warning, borderColor: theme.colors.warning };
      case 'incoming':
        return { label: 'Invitation reçue', color: theme.colors.warning, borderColor: theme.colors.warning };
      case 'confirmed':
      default:
        return { label: 'Prêt', color: theme.colors.success, borderColor: theme.colors.success };
    }
  };

  const handleActivateSlot = async (slot: Slot) => {
    if (slot === 'solo') {
      try {
        setSwitchingSolo(true);
        await switchSlot('solo');
        router.replace('/(tabs)/profile');
      } catch (e: any) {
        showMessage({ title: 'Erreur', message: e?.message || 'Impossible de passer en solo' });
      } finally {
        setSwitchingSolo(false);
      }
      return;
    }

    const link = slot === 'p1' ? p1Link : p2Link;
    if (link?.status === 'confirmed') {
      try {
        await switchSlot(slot);
        router.replace('/(tabs)/profile');
      } catch (e: any) {
        showMessage({ title: 'Erreur', message: e?.message || 'Impossible de changer de slot' });
      }
      return;
    }

    // Slot non configuré ou en attente -> aller gérer les invites/partenaires
    router.push({ pathname: '/partner-selection-select', params: { slot } } as any);
  };

  const isBusy = loading || switchingSolo;

  const isActive = (slot: Slot) => activeSlot === slot;

  const featuredSlot: Slot = (activeSlot === 'p2' ? 'p2' : 'p1');

  const orderedSlots = useMemo(() => {
    const all: Slot[] = ['p1', 'p2', 'solo'];
    return all.sort((a, b) => ((a === activeSlot) === (b === activeSlot) ? 0 : a === activeSlot ? -1 : 1));
  }, [activeSlot]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollInner}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Partenaires & slot actif</Text>
            <Text style={styles.subtitle}>Sélectionne ton mode actif.</Text>
          </View>

          {hasSelectedSlot && (
            <TouchableOpacity
              style={styles.backToApp}
              disabled={isBusy}
              onPress={() => router.replace('/(tabs)/profile')}
            >
              <Ionicons name="arrow-back" size={16} color={theme.colors.text.high} />
              <Text style={styles.backToAppText}>Retour</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>{(user?.username || user?.email)?.[0]?.toUpperCase?.() ?? '?'}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileTitle}>Compte</Text>
            <Text style={styles.profileSub}>{`Mode actif : ${activeSlot.toUpperCase()}`}</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Mode actif</Text>
          {isBusy && <ActivityIndicator color={theme.colors.users.primary} />}
        </View>

        <View style={styles.cardsGrid}>
          {orderedSlots.map((slot) => {
            const color = slot === 'p2' ? theme.colors.users.secondary : theme.colors.users.primary;
            const link = slot === 'p1' ? p1Link : slot === 'p2' ? p2Link : null;
            const subtitle = slotSubtitle(slot);
            const badge = badgeForSlot(slot);
            const cta = slotPrimaryCta(slot);
            const isCompact = slot === 'p2' && !isActive(slot) && !link && (invitesBySlot.p2 || []).length === 0;
            const state = slotState(slot);
            const isSolo = slot === 'solo';
            const isFeatured = !isSolo && slot === featuredSlot;
            const slotAccent = isSolo ? theme.colors.accent.action : color;

            const cardBorderColor =
              state.kind === 'pending' || state.kind === 'incoming'
                ? theme.colors.warning
                : isActive(slot)
                  ? slotAccent
                  : theme.colors.borderSubtle;

            return (
              <TouchableOpacity
                key={slot}
                style={[styles.card, { borderColor: cardBorderColor }, isCompact && styles.cardCompact]}
                disabled={isBusy}
                onPress={() => {
                  if (cta.action === 'manage') {
                    if (slot === 'p1' || slot === 'p2') {
                      router.push({ pathname: '/partner-selection-select', params: { slot } } as any);
                    }
                    return;
                  }
                  if (slot === 'solo' && isActive(slot)) return;
                  handleActivateSlot(slot);
                }}
              >
                <View
                  style={[
                    styles.cardBody,
                    isFeatured && styles.cardBodyFeatured,
                    !isFeatured && !isSolo && styles.cardBodyStandard,
                    isSolo && styles.cardBodySolo,
                  ]}
                >
                  <View style={styles.cardRow}>
                    <View style={styles.cardLeft}>
                      <Text style={[styles.cardTitle, slot === 'solo' && styles.soloTitle]}>{slot.toUpperCase()}</Text>
                      {!isCompact && (
                        <Text style={[styles.cardText, slot === 'solo' && styles.soloText]}>{subtitle}</Text>
                      )}
                      <View style={[styles.badge, { borderColor: badge.borderColor }]}>
                        <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                        {isActive(slot) && <Text style={styles.badgeActive}>Actif</Text>}
                      </View>
                    </View>
                    <View style={styles.cta}>
                      <Text style={styles.ctaText}>{cta.label}</Text>
                      {cta.label !== 'Actif' && (
                        <Ionicons name="chevron-forward" size={18} color={theme.colors.text.high} />
                      )}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.logoutBtnFull} onPress={logout} disabled={isBusy}>
          <Ionicons name="log-out-outline" size={18} color={theme.colors.error} />
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  content: { flex: 1 },
  scrollInner: { padding: 20, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    backToApp: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: theme.colors.bg.elevated,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    backToAppText: {
      color: theme.colors.text.high,
      fontWeight: '900',
      fontSize: 13,
    },
  title: { fontSize: 24, fontWeight: '800', color: theme.colors.text.high },
  subtitle: { marginTop: 6, fontSize: 13, color: theme.colors.text.secondary, maxWidth: '75%' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: `${theme.colors.error}1f`, borderWidth: 1, borderColor: `${theme.colors.error}66` },
  logoutBtnFull: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, backgroundColor: `${theme.colors.error}1f`, borderWidth: 1, borderColor: `${theme.colors.error}66`, marginTop: 16 },
  logoutText: { color: theme.colors.error, fontWeight: '700', fontSize: 13 },
  profileCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.colors.borderSubtle, backgroundColor: theme.colors.bg.elevated, marginBottom: 16 },
  profileAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: theme.colors.users.primary, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  profileAvatarText: { color: '#000', fontSize: 24, fontWeight: '800' },
  profileInfo: { flex: 1 },
  profileTitle: { color: theme.colors.text.high, fontSize: 15, fontWeight: '800' },
  profileSub: { color: theme.colors.text.secondary, marginTop: 4, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 8 },
  sectionLabel: { color: theme.colors.text.secondary, fontSize: 13, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  cardsGrid: { gap: 12 },
  card: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.borderSubtle },
  cardBody: { backgroundColor: theme.colors.bg.elevated },
  cardBodyFeatured: { padding: 18, minHeight: 112 },
  cardBodyStandard: { padding: 16, minHeight: 96 },
  cardBodySolo: { padding: 12, minHeight: 84 },
  cardCompact: { opacity: 0.92 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardLeft: { flex: 1, gap: 6 },
  cardTitle: { fontSize: 18, fontWeight: '900', color: theme.colors.text.high },
  cardText: { fontSize: 13, lineHeight: 18, color: theme.colors.text.secondary, fontWeight: '600' },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, backgroundColor: theme.colors.bg.elevated },
  badgeText: { fontWeight: '800', fontSize: 12 },
  badgeActive: { color: theme.colors.text.high, fontWeight: '800', fontSize: 12 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: theme.colors.bg.elevated, borderWidth: 1, borderColor: theme.colors.borderSubtle },
  ctaText: { color: theme.colors.text.high, fontWeight: '900', fontSize: 13 },
  soloCard: { backgroundColor: theme.colors.bg.elevated },
  soloTitle: { color: theme.colors.text.high },
  soloText: { color: theme.colors.text.secondary },
});
