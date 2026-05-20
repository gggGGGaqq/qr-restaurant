import { Languages } from "lucide-react";
import { useLanguage } from "../i18n";

export function LanguageSwitcher() {
  const { language, setLanguage, copy } = useLanguage();
  const nextLanguage = language === "ru" ? "kk" : "ru";
  const currentShort = language === "ru" ? copy.switcher.russianShort : copy.switcher.kazakhShort;
  const nextFull = nextLanguage === "ru" ? copy.switcher.russianFull : copy.switcher.kazakhFull;

  return (
    <button
      type="button"
      className="language-switcher"
      onClick={() => setLanguage(nextLanguage)}
      aria-label={`${copy.switcher.label}: ${nextFull}`}
      title={nextFull}
    >
      <span className="language-switcher__icon" aria-hidden="true">
        <Languages size={15} />
      </span>
      <span className="language-switcher__code">{currentShort}</span>
    </button>
  );
}
