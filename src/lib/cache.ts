/**
 * Caché de lectura en localStorage. NUNCA es fuente de verdad: Supabase lo es.
 * Se reescribe en cada lectura/escritura exitosa y se usa como fallback offline.
 */
import type {
  Filament,
  InventoryItem,
  Printer,
  Project,
  UserSettings,
} from "./types";

type Envelope<T> = { data: T; savedAt: number };

const isBrowser = () => typeof window !== "undefined";

function read<T>(key: string): Envelope<T> | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (!parsed || typeof parsed.savedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function write<T>(key: string, data: T): void {
  if (!isBrowser()) return;
  try {
    const envelope: Envelope<T> = { data, savedAt: Date.now() };
    window.localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // cuota llena o storage deshabilitado: la caché es opcional, seguimos.
  }
}

function remove(key: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // no-op
  }
}

const settingsKey = (userId: string) => `settings_cache:${userId}`;
const filamentsKey = (userId: string) => `filaments_cache:${userId}`;
const printersKey = (userId: string) => `printers_cache:${userId}`;
const inventoryKey = (userId: string) => `inventory_cache:${userId}`;
const projectsKey = (userId: string) => `projects_cache:${userId}`;
const draftKey = (userId: string) => `calc_draft:${userId}`;

export const settingsCache = {
  get: (userId: string) => read<UserSettings>(settingsKey(userId)),
  set: (userId: string, data: UserSettings) => write(settingsKey(userId), data),
  clear: (userId: string) => remove(settingsKey(userId)),
};

export const filamentsCache = {
  get: (userId: string) => read<Filament[]>(filamentsKey(userId)),
  set: (userId: string, data: Filament[]) => write(filamentsKey(userId), data),
  clear: (userId: string) => remove(filamentsKey(userId)),
};

export const printersCache = {
  get: (userId: string) => read<Printer[]>(printersKey(userId)),
  set: (userId: string, data: Printer[]) => write(printersKey(userId), data),
  clear: (userId: string) => remove(printersKey(userId)),
};

export const inventoryCache = {
  get: (userId: string) => read<InventoryItem[]>(inventoryKey(userId)),
  set: (userId: string, data: InventoryItem[]) =>
    write(inventoryKey(userId), data),
  clear: (userId: string) => remove(inventoryKey(userId)),
};

export const projectsCache = {
  get: (userId: string) => read<Project[]>(projectsKey(userId)),
  set: (userId: string, data: Project[]) => write(projectsKey(userId), data),
  clear: (userId: string) => remove(projectsKey(userId)),
};

export function getDraft<T>(userId: string): T | null {
  return read<T>(draftKey(userId))?.data ?? null;
}

export function setDraft<T>(userId: string, data: T): void {
  write(draftKey(userId), data);
}

export function clearDraft(userId: string): void {
  remove(draftKey(userId));
}

/** Limpia toda la caché local del usuario (usar al cerrar sesión). */
export function clearAllCache(userId: string): void {
  settingsCache.clear(userId);
  filamentsCache.clear(userId);
  printersCache.clear(userId);
  inventoryCache.clear(userId);
  projectsCache.clear(userId);
  clearDraft(userId);
}
