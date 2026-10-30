/** The two calls the /play games need from a key-value store. AsyncStorage satisfies it; tests pass a Map. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
