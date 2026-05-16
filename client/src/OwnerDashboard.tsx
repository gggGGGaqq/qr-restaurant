import { useEffect, useMemo, useState } from "react";
import { BarChart3, BellRing, CircleDollarSign, ReceiptText, Table2 } from "lucide-react";
import { getOwnerSummary } from "./api";
import { DashboardShell } from "./components/DashboardShell";
import { Skeleton } from "./components/Skeleton";
import { localizeMenuItemName } from "./contentTranslations";
import { useLanguage } from "./i18n";
import type { OwnerSummary } from "./types";
import { formatMoney } from "./utils/format";

export function OwnerDashboard() {
  const { language, copy } = useLanguage();
  const [summary, setSummary] = useState<OwnerSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const screenCopy = useMemo(
    () =>
      language === "kk"
        ? {
            title: "Иесі",
            subtitle: "Бүгінгі шолу",
            revenue: "Түсім",
            orders: "Тапсырыстар",
            averageCheck: "Орташа чек",
            activeTables: "Белсенді үстелдер",
            guestRequests: "Қонақ сұраулары",
            popularItems: "Сұраныстағы тағамдар",
            noSales: "Бүгін әзірге сатылым жоқ.",
            quickLinks: "Жылдам сілтемелер",
            menuAndQr: "Мәзір және QR",
            waiter: "Даяшы",
            kitchen: "Ас үй",
            pieces: "дана",
          }
        : {
            title: "Владелец",
            subtitle: "Сводка за сегодня",
            revenue: "Выручка",
            orders: "Заказы",
            averageCheck: "Средний чек",
            activeTables: "Активные столы",
            guestRequests: "Запросы гостей",
            popularItems: "Популярные блюда",
            noSales: "Сегодня пока нет продаж.",
            quickLinks: "Быстрые ссылки",
            menuAndQr: "Меню и QR",
            waiter: "Официант",
            kitchen: "Кухня",
            pieces: "шт.",
          },
    [language],
  );

  useEffect(() => {
    let active = true;
    getOwnerSummary()
      .then((data) => {
        if (active) setSummary(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <DashboardShell
      title={screenCopy.title}
      subtitle={screenCopy.subtitle}
      icon="waiter"
      metaLabel={copy.common.live}
    >
      {loading || !summary ? (
        <div className="loader-stack">
          <Skeleton className="loader-card" />
          <Skeleton className="loader-card" />
        </div>
      ) : (
        <div className="owner-layout">
          <section className="metric-grid owner-metrics">
            <div className="metric-card metric-card--ready">
              <CircleDollarSign size={20} />
              <span>{screenCopy.revenue}</span>
              <strong>{formatMoney(summary.revenueToday, language)}</strong>
            </div>
            <div className="metric-card metric-card--new">
              <ReceiptText size={20} />
              <span>{screenCopy.orders}</span>
              <strong>{summary.ordersToday}</strong>
            </div>
            <div className="metric-card metric-card--active">
              <BarChart3 size={20} />
              <span>{screenCopy.averageCheck}</span>
              <strong>{formatMoney(summary.averageCheck, language)}</strong>
            </div>
            <div className="metric-card">
              <Table2 size={20} />
              <span>{screenCopy.activeTables}</span>
              <strong>{summary.activeTables}</strong>
            </div>
            <div className="metric-card metric-card--active">
              <BellRing size={20} />
              <span>{screenCopy.guestRequests}</span>
              <strong>{summary.openServiceRequests}</strong>
            </div>
          </section>

          <section className="admin-panel">
            <div className="section-title-row">
              <h2>{screenCopy.popularItems}</h2>
              <span>{summary.popularItems.length}</span>
            </div>
            {summary.popularItems.length === 0 ? (
              <p className="empty-state">{screenCopy.noSales}</p>
            ) : (
              <div className="popular-list">
                {summary.popularItems.map((item, index) => (
                  <div key={item.menuItemId}>
                    <strong>{index + 1}</strong>
                    <span>{localizeMenuItemName({ id: item.menuItemId, name: item.name }, language)}</span>
                    <b>
                      {item.qty} {screenCopy.pieces}
                    </b>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="admin-panel">
            <div className="section-title-row">
              <h2>{screenCopy.quickLinks}</h2>
            </div>
            <div className="quick-links">
              <a className="button button-primary" href="/admin">
                {screenCopy.menuAndQr}
              </a>
              <a className="button button-secondary" href="/waiter">
                {screenCopy.waiter}
              </a>
              <a className="button button-secondary" href="/kitchen">
                {screenCopy.kitchen}
              </a>
            </div>
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
