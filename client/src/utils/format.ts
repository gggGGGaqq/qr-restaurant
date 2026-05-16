import type { AppLanguage } from "../i18n";
import { getStoredLanguage } from "../i18n";

export function formatMoney(value: number, language: AppLanguage = getStoredLanguage()): string {
  return new Intl.NumberFormat(language === "kk" ? "kk-KZ" : "ru-KZ", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatOrderAge(
  createdAt: string,
  now: number,
  language: AppLanguage = getStoredLanguage(),
): string {
  const seconds = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000));
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
