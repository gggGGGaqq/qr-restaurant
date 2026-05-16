import crypto from "node:crypto";
import type { RequestHandler } from "express";
import { HttpError } from "./errors";

export type ProtectedRole = "waiter" | "kitchen" | "admin" | "owner";

interface StoredSession {
  role: ProtectedRole;
  expiresAt: number;
}

interface CreatedSession extends StoredSession {
  token: string;
}

const sessionTtlMs = 1000 * 60 * 60 * 12;

const passwordHashes: Record<ProtectedRole, string> = {
  waiter: "278d9dcb7ac5dd5b47039d40197093e7b7f2a51d20fd0774b6821a48d002887c",
  kitchen: "7779c407d7483527c2b7bd9b2d5353a42a6220f8989d955db8a7b2f227725980",
  admin: "37b951db43191bad5dffae59273c4063d7080438ddf718f229ffddbe5948daa9",
  owner: "5fbdd517df368452cc3f8be653b2d6684b8cc824120aceb8e849724dcaa02819",
};

const sessions = new Map<string, StoredSession>();

function isProtectedRole(value: unknown): value is ProtectedRole {
  return value === "waiter" || value === "kitchen" || value === "admin" || value === "owner";
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function pruneExpiredSessions(now = Date.now()): void {
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(token);
    }
  }
}

function resolveSession(token: string): StoredSession | null {
  pruneExpiredSessions();

  const session = sessions.get(token);
  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  return session;
}

function parseBearerToken(headerValue: string | undefined): string | null {
  if (!headerValue) {
    return null;
  }

  const [scheme, token] = headerValue.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token.trim() || null;
}

export function verifyRolePassword(role: ProtectedRole, password: string): boolean {
  const expectedHash = passwordHashes[role];
  const passwordHash = sha256(password);
  return safeEqual(passwordHash, expectedHash);
}

export function createRoleSession(role: ProtectedRole): CreatedSession {
  pruneExpiredSessions();

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + sessionTtlMs;
  sessions.set(token, { role, expiresAt });

  return {
    token,
    role,
    expiresAt,
  };
}

export function authorizeSocketRole(role: unknown, token: unknown): ProtectedRole | null {
  if (!isProtectedRole(role) || typeof token !== "string") {
    return null;
  }

  const session = resolveSession(token);
  if (!session || session.role !== role) {
    return null;
  }

  return session.role;
}

export function requireRole(...allowedRoles: ProtectedRole[]): RequestHandler {
  return (req, _res, next) => {
    const token = parseBearerToken(req.header("authorization"));
    if (!token) {
      next(new HttpError(401, "Authentication required"));
      return;
    }

    const session = resolveSession(token);
    if (!session) {
      next(new HttpError(401, "Authentication required"));
      return;
    }

    if (!allowedRoles.includes(session.role)) {
      next(new HttpError(403, "Access denied"));
      return;
    }

    next();
  };
}
