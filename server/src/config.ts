import dotenv from "dotenv";

dotenv.config();

function envNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const sessionTimeoutMinutes = Math.min(
  120,
  Math.max(60, envNumber("SESSION_TIMEOUT_MINUTES", 90)),
);

export const config = {
  port: envNumber("PORT", 4000),
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
  sessionTimeoutMinutes,
  database: {
    host: process.env.DB_HOST ?? "localhost",
    port: envNumber("DB_PORT", 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "qr_restaurant",
    connectionLimit: envNumber("DB_CONNECTION_LIMIT", 10),
  },
};
