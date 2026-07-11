/**
 * Local (demo-mode) API key store.
 *
 * Falls back to localStorage when Convex is not deployed,
 * so users can still generate and manage API keys in the preview.
 */

interface LocalApiKey {
  id: string;
  label: string;
  key: string;
  createdAt: number;
  lastUsedAt?: number;
  isActive: boolean;
}

const STORAGE_KEY = "observeai-local-api-keys";

function generateKey(): string {
  const prefix = "sk-observeai-";
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return prefix + result;
}

function getKeys(): LocalApiKey[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveKeys(keys: LocalApiKey[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function listLocalKeys(): LocalApiKey[] {
  return getKeys();
}

export function generateLocalKey(label: string): LocalApiKey {
  const keys = getKeys();
  const newKey: LocalApiKey = {
    id: `local-${Date.now()}`,
    label,
    key: generateKey(),
    createdAt: Date.now(),
    isActive: true,
  };
  keys.push(newKey);
  saveKeys(keys);
  return newKey;
}

export function revokeLocalKey(id: string): void {
  const keys = getKeys().map((k) =>
    k.id === id ? { ...k, isActive: false } : k,
  );
  saveKeys(keys);
}

export type { LocalApiKey };