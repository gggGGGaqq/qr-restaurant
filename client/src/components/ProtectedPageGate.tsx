import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { LockKeyhole } from "lucide-react";
import {
  clearAuthSession,
  hasAuthSession,
  type ProtectedRole,
  loginProtectedRole,
  subscribeToAuthChanges,
} from "../auth";
import { useLanguage } from "../i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";

const roleMeta: Record<
  ProtectedRole,
  {
    title: string;
    hint: string;
  }
> = {
  waiter: {
    title: "Waiter Dashboard",
    hint: "Access to live orders, guest requests, and ready dishes requires a password.",
  },
  kitchen: {
    title: "Kitchen Dashboard",
    hint: "Accepted and active kitchen orders are available only after password sign-in.",
  },
  admin: {
    title: "Admin Panel",
    hint: "Menu management, QR tables, and branding settings are protected by a password.",
  },
  owner: {
    title: "Owner Dashboard",
    hint: "Revenue, service load, and daily summary are available only after sign-in.",
  },
};

export function ProtectedPageGate({
  role,
  children,
}: {
  role: ProtectedRole;
  children: ReactNode;
}) {
  const { language } = useLanguage();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(() => hasAuthSession(role));

  const buttonLabel = useMemo(
    () =>
      language === "kk"
        ? {
            submit: "Kiru",
            loading: "Tekserilude...",
            password: "Qupiyasoz",
            secure: "Qorgalgan bet",
            note: "Ruksat osy brauzer betinde gana saqtalady.",
          }
        : {
            submit: "Unlock page",
            loading: "Checking...",
            password: "Password",
            secure: "Protected page",
            note: "Access is stored only in this browser tab.",
          },
    [language],
  );

  useEffect(() => {
    setAuthorized(hasAuthSession(role));
    setError(null);
  }, [role]);

  useEffect(() => {
    const sync = () => {
      setAuthorized(hasAuthSession(role));
      setError(null);
    };

    return subscribeToAuthChanges(sync);
  }, [role]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await loginProtectedRole(role, password);
      setPassword("");
      setAuthorized(true);
    } catch (submitError) {
      clearAuthSession(role);
      setAuthorized(false);
      setError(
        submitError instanceof Error ? submitError.message : "Unable to open the protected page.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (authorized) {
    return <>{children}</>;
  }

  const meta = roleMeta[role];

  return (
    <main className="entry-shell protected-entry-shell">
      <motion.section
        className="entry-panel protected-entry-panel"
        initial={{ opacity: 0, y: 18, filter: "blur(12px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
      >
        <div className="entry-panel__head">
          <div className="entry-copy">
            <div className="brand-mark">
              <LockKeyhole size={22} />
            </div>
            <div>
              <p className="eyebrow">{buttonLabel.secure}</p>
              <h1>{meta.title}</h1>
              <p>{meta.hint}</p>
            </div>
          </div>
          <LanguageSwitcher />
        </div>

        <form className="entry-form" onSubmit={handleSubmit}>
          <label htmlFor={`page-password-${role}`}>{buttonLabel.password}</label>
          <input
            id={`page-password-${role}`}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            placeholder={buttonLabel.password}
            disabled={submitting}
          />

          {error && <p className="error-state">{error}</p>}

          <button
            className="button button-primary button-wide"
            type="submit"
            disabled={submitting || password.trim().length === 0}
          >
            {submitting ? buttonLabel.loading : buttonLabel.submit}
          </button>
        </form>

        <p className="protected-entry-note">{buttonLabel.note}</p>
      </motion.section>
    </main>
  );
}
