import AsyncStorage from "@react-native-async-storage/async-storage";

export async function saveData<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("Erreur sauvegarde", e);
  }
}

export async function loadData<T>(key: string): Promise<T | null> {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (e) {
    console.error("Erreur chargement", e);
    return null;
  }
}