import { Bell, ChefHat, Settings2, Utensils } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "./LanguageSwitcher";

interface DashboardShellProps {
  title: string;
  subtitle?: string;
  icon: "waiter" | "kitchen" | "admin";
  metaLabel?: string;
  notice?: string | null;
  className?: string;
  children: ReactNode;
}

export function DashboardShell({
  title,
  subtitle,
  icon,
  metaLabel,
  notice,
  className,
  children,
}: DashboardShellProps) {
  const Icon = icon === "kitchen" ? ChefHat : icon === "admin" ? Settings2 : Utensils;

  return (
    <main className={`app-shell dashboard-shell ${className ?? ""}`.trim()}>
      <header className="dashboard-header">
        <div className="dashboard-header__copy">
          {subtitle && <p className="eyebrow">{subtitle}</p>}
          <h1>{title}</h1>
        </div>
        <div className="dashboard-header__meta">
          <LanguageSwitcher />
          {metaLabel && <span className="soft-pill">{metaLabel}</span>}
          <div className="dashboard-icon" aria-hidden="true">
            <Icon size={24} />
          </div>
        </div>
      </header>

      <AnimatePresence mode="popLayout">
        {notice && (
          <motion.div
            key={notice}
            className="notice"
            role="status"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            <Bell size={18} />
            <span>{notice}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {children}
    </main>
  );
}
