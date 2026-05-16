import { Languages } from "lucide-react";
import { useLanguage } from "../i18n";

export function LanguageSwitcher() {
  const { language, setLanguage, copy } = useLanguage();

  return (
    <div className="language-switcher" role="group" aria-label={copy.switcher.label} title={copy.switcher.label}>
      <div className="language-switcher__icon" aria-hidden="true">
        <Languages size={15} />
      </div>
      <button
        type="button"
        className={`language-switcher__option ${language === "ru" ? "is-active" : ""}`}
        onClick={() => setLanguage("ru")}
        title={copy.switcher.russianFull}
        aria-pressed={language === "ru"}
      >
        <span className="language-switcher__code">{copy.switcher.russianShort}</span>
        <span className="language-switcher__label">{copy.switcher.russianFull}</span>
      </button>
      <button
        type="button"
        className={`language-switcher__option ${language === "kk" ? "is-active" : ""}`}
        onClick={() => setLanguage("kk")}
        title={copy.switcher.kazakhFull}
        aria-pressed={language === "kk"}
      >
        <span className="language-switcher__code">{copy.switcher.kazakhShort}</span>
        <span className="language-switcher__label">{copy.switcher.kazakhFull}</span>
      </button>
    </div>
  );
}
