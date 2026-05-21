import type { AppLanguage } from "../i18n";
import { getStoredLanguage } from "../i18n";

export function formatMoney(value: number, language: AppLanguage = getStoredLanguage()): string {
  return new Intl.NumberFormat(language === "kk" ? "kk-KZ" : "ru-KZ", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(value);
}

export function parseOrderTimestamp(value: string, now = Date.now()): number {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return now;

  if (timestamp > now + 60000 && value.endsWith("Z")) {
    const localTimestamp = new Date(value.slice(0, -1)).getTime();
    if (Number.isFinite(localTimestamp) && Math.abs(localTimestamp - now) < Math.abs(timestamp - now)) {
      return localTimestamp;
    }
  }

  return timestamp;
}

export function formatOrderAge(
  createdAt: string,
  now: number,
  language: AppLanguage = getStoredLanguage(),
): string {
  const seconds = Math.max(0, Math.floor((now - parseOrderTimestamp(createdAt, now)) / 1000));
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;

  if (minutes === 0) {
    return `${restSeconds} сек`;
  }

  if (minutes < 60) {
    return `${minutes} мин`;
  }

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return `${hours} ${language === "kk" ? "сағ" : "ч"} ${restMinutes} мин`;
}
