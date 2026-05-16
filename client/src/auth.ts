import { getDictionary } from "./i18n";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export type ProtectedRole = "waiter" | "kitchen" | "admin" | "owner";

interface AuthSession {
  token: string;
  role: ProtectedRole;
  expiresAt: number;
}

const authChangedEvent = "qr-restaurant-auth-changed";

function getStorageKey(role: ProtectedRole): string {
  return `qr-restaurant-auth:${role}`;
}

function emitAuthChanged(role: ProtectedRole): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(authChangedEvent, {
      detail: { role },
    }),
  );
}

function readStoredSession(role: ProtectedRole): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(getStorageKey(role));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (
      typeof parsed.token !== "string" ||
      parsed.role !== role ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= Date.now()
    ) {
      clearAuthSession(role);
      return null;
    }

    return {
      token: parsed.token,
      role,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    clearAuthSession(role);
    return null;
  }
}

function storeAuthSession(session: AuthSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(getStorageKey(session.role), JSON.stringify(session));
  emitAuthChanged(session.role);
}

export function subscribeToAuthChanges(listener: EventListener): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(authChangedEvent, listener);
  window.addEventListener("storage", listener);

  return () => {
    window.removeEventListener(authChangedEvent, listener);
    window.removeEventListener("storage", listener);
  };
}

export function hasAuthSession(role: ProtectedRole): boolean {
  return readStoredSession(role) !== null;
}

export function getAuthToken(role: ProtectedRole): string | null {
  return readStoredSession(role)?.token ?? null;
}

export function clearAuthSession(role: ProtectedRole): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(getStorageKey(role));
  emitAuthChanged(role);
}

export async function loginProtectedRole(role: ProtectedRole, password: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role, password }),
    });
  } catch {
    throw new Error(getDictionary().api.connectionFailed);
  }

  const body = (await response.json().catch(() => null)) as
    | { data?: AuthSession; error?: { message?: string } }
    | null;

  if (!response.ok || !body?.data) {
    throw new Error(body?.error?.message ?? "Authentication required.");
  }

  storeAuthSession(body.data);
}
