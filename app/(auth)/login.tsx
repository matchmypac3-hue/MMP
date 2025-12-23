// app/(auth)/login.tsx

import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  Alert, 
  TouchableOpacity, 
  Platform, 
  ScrollView,
  ActivityIndicator 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { GradientText } from '../../components/GradientText';
import { theme } from '../../utils/theme';
import { healthService } from '../../services/healthService';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading } = useAuth();

  const handleConnectHealth = async () => {
    try {
      const provider = Platform.OS === 'ios' ? 'appleHealth' : 'healthConnect';
      await healthService.prepareLink({ provider, autoImport: true });
      Alert.alert(
        'Connexion santé prête',
        "Autorisation effectuée. On finalisera le lien après ta connexion.",
      );
    } catch (error: any) {
      Alert.alert('Impossible de connecter', error?.message || 'Erreur');
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    try {
      await login(email.trim(), password);
    } catch (error: any) {
      Alert.alert('Erreur de connexion', error?.message || 'Veuillez vérifier vos identifiants.');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo texte seul */}
        <View style={styles.logoSection}>
          <GradientText 
            colors={theme.gradients.countdown} 
            style={styles.appName}
          >
            Match My Pace
          </GradientText>
        </View>

        {/* Formulaire */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Connexion</Text>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color={theme.colors.text.muted} />
              <TextInput
                style={styles.input}
                placeholder="votre@email.com"
                placeholderTextColor={theme.colors.text.muted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Mot de passe</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={theme.colors.text.muted} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={theme.colors.text.muted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons 
                  name={showPassword ? "eye-outline" : "eye-off-outline"} 
                  size={20} 
                  color={theme.colors.text.muted} 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Bouton connexion */}
          <TouchableOpacity 
            style={styles.submitButton} 
            onPress={handleLogin} 
            disabled={isLoading}
          >
            <LinearGradient
              colors={isLoading ? ([theme.colors.bg.input, theme.colors.bg.input] as const) : theme.gradients.countdown}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.submitGradient}
            >
              {isLoading ? (
                <ActivityIndicator color={theme.colors.bg.primary} />
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={20} color={theme.colors.bg.primary} />
                  <Text style={styles.submitButtonText}>Se connecter</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Lien inscription */}
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity style={styles.linkButton}>
              <Text style={styles.linkText}>
                Pas encore de compte ?{' '}
                <Text style={styles.linkTextBold}>S’inscrire</Text>
              </Text>
            </TouchableOpacity>
          </Link>

          {/* Health linking (optional) */}
          <TouchableOpacity
            style={styles.healthButton}
            onPress={handleConnectHealth}
            disabled={isLoading}
          >
            <Text style={styles.healthButtonText}>
              {Platform.OS === 'ios' ? 'Connecter Apple Health' : 'Connecter Health Connect'}
            </Text>
            <Text style={styles.healthHelperText}>
              Optionnel — tu peux toujours ajouter manuellement.
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg.primary,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingVertical: 60,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  appName: {
    fontSize: 42,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 1,
  },
  formCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.colors.bg.card,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 24,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 54,
    backgroundColor: theme.colors.bg.input,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  submitButton: {
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  submitGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '700',
  },
  linkButton: {
    marginTop: 20,
    paddingVertical: 8,
  },
  linkText: {
    color: theme.colors.text.secondary,
    textAlign: 'center',
    fontSize: 15,
  },
  linkTextBold: {
    color: theme.colors.users.primary,
    fontWeight: '700',
  },
  healthButton: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg.input,
  },
  healthButtonText: {
    color: theme.colors.text.primary,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
  },
  healthHelperText: {
    marginTop: 6,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    fontSize: 12,
  },
});