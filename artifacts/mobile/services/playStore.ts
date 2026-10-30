/** AsyncStorage as a KeyValueStore, for the /play games' small local settings. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KeyValueStore } from './publicGames/kvStore';

export const playStore: KeyValueStore = {
  getItem: key => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};
