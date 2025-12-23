// app/users.tsx

import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  ActivityIndicator, 
  Alert, 
  TouchableOpacity,
  TextInput 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { getAllUsers } from '../services/userService';
import { theme } from '../utils/theme';

interface User {
  _id: string;
  username?: string;
  email: string;
}

export default function UserListScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const fetchedUsers = await getAllUsers();
        setUsers(fetchedUsers);
        setFilteredUsers(fetchedUsers);
      } catch {
        Alert.alert('Erreur', 'Impossible de récupérer la liste des utilisateurs.');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const q = searchQuery.toLowerCase();
      const filtered = users.filter(user => 
        (user.username || '').toLowerCase().includes(q) || user.email.toLowerCase().includes(q)
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const getUserLabel = (u: User) => u.username || u.email;
  const getUserInitial = (u: User) => (getUserLabel(u).charAt(0) || 'U').toUpperCase();

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen 
          options={{ 
            title: "Utilisateurs",
            headerStyle: { backgroundColor: theme.colors.bg.primary },
            headerTintColor: theme.colors.text.primary,
          }} 
        />
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={theme.colors.users.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: "Utilisateurs",
          headerStyle: { backgroundColor: theme.colors.bg.primary },
          headerTintColor: theme.colors.text.primary,
        }} 
      />

      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="people-outline" size={28} color={theme.colors.users.primary} />
          <Text style={styles.headerTitle}>Utilisateurs ({filteredUsers.length})</Text>
        </View>

        {/* Barre de recherche */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color={theme.colors.text.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher par pseudo..."
            placeholderTextColor={theme.colors.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={theme.colors.text.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Liste */}
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.userItem} activeOpacity={0.7}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.userAvatar}
              >
                <Text style={styles.userAvatarText}>{getUserInitial(item)}</Text>
              </LinearGradient>
              <View style={styles.userInfo}>
                <Text style={styles.userEmail}>{getUserLabel(item)}</Text>
                <Text style={styles.userId}>ID: {item._id.slice(-8)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.text.muted} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color={theme.colors.text.tertiary} />
              <Text style={styles.emptyText}>Aucun utilisateur trouvé</Text>
              {searchQuery && (
                <Text style={styles.emptySubtext}>Essayez une autre recherche</Text>
              )}
            </View>
          )}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg.primary,
  },
  safeArea: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: theme.colors.text.secondary,
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.bg.input,
    marginHorizontal: 20,
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bg.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  userInfo: {
    flex: 1,
  },
  userEmail: {
    fontSize: 16,
    color: theme.colors.text.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  userId: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: theme.colors.text.tertiary,
    marginTop: 4,
  },
});