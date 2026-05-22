import { startTransition, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ChefHat,
  CircleDollarSign,
  CalendarDays,
  Clock3,
  Flame,
  ReceiptText,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Table2,
  TimerReset,
  Utensils,
} from "lucide-react";
import { getOwnerAnalyticsDashboard } from "./api";
import { DashboardShell } from "./components/DashboardShell";
import { Skeleton } from "./components/Skeleton";
import { localizeMenuItemName } from "./contentTranslations";
import { useLanguage, type AppLanguage } from "./i18n";
import type {
  MenuCategory,
  OrderStatus,
  OwnerAnalyticsCategoryMetric,
  OwnerAnalyticsComparison,
  OwnerAnalyticsDashboardData,
  OwnerAnalyticsDishMetric,
  OwnerAnalyticsRangePreset,
  OwnerAnalyticsSalesPoint,
  OwnerAnalyticsTableMetric,
} from "./types";
import { formatMoney } from "./utils/format";

const rangeOptions: OwnerAnalyticsRangePreset[] = [
  "today",
  "yesterday",
  "last7days",
  "last30days",
  "this_month",
  "previous_month",
  "custom",
];

const ownerCategoryOptions: Array<MenuCategory | "all"> = ["all", "grill", "hot", "salad", "dessert", "drink"];
const ownerStatusOptions: Array<OrderStatus | "all"> = [
  "all",
  "NEW",
  "ACCEPTED",
  "COOKING",
  "READY",
  "COMPLETED",
  "REJECTED",
];

function getDateInputValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase("ru-RU");
}

function formatNumber(value: number, language: AppLanguage): string {
  return new Intl.NumberFormat(language === "kk" ? "kk-KZ" : "ru-RU", {
    maximumFractionDigits: 1,
  })
    .format(value)
    .replace(/[\u00A0\u202F]/g, " ");
}

function formatPercent(value: number | null, language: AppLanguage): string {
  if (value === null) return "—";
  return `${formatNumber(value, language)}%`;
}

function formatDuration(seconds: number | null, language: AppLanguage): string {
  if (seconds === null) return "—";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} ${language === "kk" ? "мин" : "мин"}`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return `${hours} ${language === "kk" ? "сағ" : "ч"} ${restMinutes} мин`;
}

function formatPeriodLabel(period: string, language: AppLanguage): string {
  const locale = language === "kk" ? "kk-KZ" : "ru-RU";
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" }).format(
      new Date(`${period}T00:00:00`),
    );
  }

  if (/^\d{4}-\d{2}$/.test(period)) {
    return new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit" }).format(
      new Date(`${period}-01T00:00:00`),
    );
  }

  return period.replace("-W", " W");
}

function rangeLabel(range: OwnerAnalyticsRangePreset, language: AppLanguage): string {
  const labels: Record<AppLanguage, Record<OwnerAnalyticsRangePreset, string>> = {
    ru: {
      today: "Сегодня",
      yesterday: "Вчера",
      last7days: "7 дней",
      last30days: "30 дней",
      this_month: "Этот месяц",
      previous_month: "Прошлый месяц",
      custom: "Период",
    },
    kk: {
      today: "Бүгін",
      yesterday: "Кеше",
      last7days: "7 күн",
      last30days: "30 күн",
      this_month: "Осы ай",
      previous_month: "Өткен ай",
      custom: "Кезең",
    },
  };

  return labels[language][range];
}

function changeLabel(comparison: OwnerAnalyticsComparison, language: AppLanguage): string {
  if (comparison.previous.total === 0) {
    return comparison.current.total > 0
      ? language === "kk" ? "жаңа сатылым" : "новые продажи"
      : language === "kk" ? "өзгеріс жоқ" : "без изменений";
  }

  const sign = comparison.changePercent !== null && comparison.changePercent > 0 ? "+" : "";
  return `${sign}${formatPercent(comparison.changePercent, language)}`;
}

interface KpiCardProps {
  title: string;
  value: string;
  note?: string;
  icon: ReactNode;
  tone?: "primary" | "success" | "warning" | "danger";
}

function KpiCard({ title, value, note, icon, tone = "primary" }: KpiCardProps) {
  return (
    <article className={`owner-kpi-card owner-kpi-card--${tone}`}>
      <div className="owner-kpi-card__icon">{icon}</div>
      <div className="owner-kpi-card__copy">
        <span>{title}</span>
        <strong>{value}</strong>
        {note && <p>{note}</p>}
      </div>
    </article>
  );
}

interface ChartDatum {
  label: string;
  value: number;
  meta?: string;
}

interface BarChartProps {
  title: string;
  subtitle?: string;
  data: ChartDatum[];
  emptyLabel: string;
  formatValue: (value: number) => string;
  compact?: boolean;
}

function BarChart({ title, subtitle, data, emptyLabel, formatValue, compact = false }: BarChartProps) {
  const maxValue = Math.max(...data.map((item) => item.value), 0);
  const hasData = data.some((item) => item.value > 0);

  return (
    <section className={`owner-chart-card ${compact ? "owner-chart-card--compact" : ""}`}>
      <div className="section-title-row">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="eyebrow">{subtitle}</p>}
        </div>
      </div>
      {!hasData ? (
        <p className="empty-state">{emptyLabel}</p>
      ) : (
        <div className="owner-bar-chart" role="list">
          {data.map((item) => {
            const height = maxValue > 0 ? Math.max(8, (item.value / maxValue) * 100) : 0;
            return (
              <div className="owner-bar-chart__item" role="listitem" key={item.label}>
                <div className="owner-bar-chart__track">
                  <span style={{ "--bar-height": `${height}%` } as CSSProperties} />
                </div>
                <strong>{item.label}</strong>
                <em>{formatValue(item.value)}</em>
                {item.meta && <small>{item.meta}</small>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

interface ProgressRow {
  label: string;
  value: number;
  valueLabel?: string;
  detail?: string;
}

function ProgressList({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: ProgressRow[];
  emptyLabel: string;
}) {
  const maxValue = Math.max(...rows.map((row) => row.value), 0);
  const hasRows = rows.some((row) => row.value > 0);

  return (
    <section className="owner-panel">
      <div className="section-title-row">
        <h2>{title}</h2>
      </div>
      {!hasRows ? (
        <p className="empty-state">{emptyLabel}</p>
      ) : (
        <div className="owner-progress-list">
          {rows.map((row) => (
            <div className="owner-progress-row" key={row.label}>
              <div>
                <strong>{row.label}</strong>
                {row.detail && <span>{row.detail}</span>}
              </div>
              <b>{row.valueLabel ?? row.value}</b>
              <i>
                <span style={{ width: `${maxValue > 0 ? (row.value / maxValue) * 100 : 0}%` }} />
              </i>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ComparisonCard({
  title,
  comparison,
  language,
}: {
  title: string;
  comparison: OwnerAnalyticsComparison;
  language: AppLanguage;
}) {
  const isPositive = comparison.change > 0;
  const isNegative = comparison.change < 0;

  return (
    <article className={`owner-comparison-card ${isPositive ? "is-positive" : ""} ${isNegative ? "is-negative" : ""}`}>
      <div>
        <span>{title}</span>
        <strong>{formatMoney(comparison.current.total, language)}</strong>
      </div>
      <p>
        {isPositive ? <ArrowUpRight size={16} /> : isNegative ? <ArrowDownRight size={16} /> : <Activity size={16} />}
        <span>{changeLabel(comparison, language)}</span>
      </p>
    </article>
  );
}

function DishList({
  title,
  dishes,
  emptyLabel,
  language,
}: {
  title: string;
  dishes: OwnerAnalyticsDishMetric[];
  emptyLabel: string;
  language: AppLanguage;
}) {
  return (
    <section className="owner-panel">
      <div className="section-title-row">
        <h2>{title}</h2>
        <span>{dishes.length}</span>
      </div>
      {dishes.length === 0 ? (
        <p className="empty-state">{emptyLabel}</p>
      ) : (
        <div className="owner-dish-list">
          {dishes.slice(0, 6).map((dish, index) => (
            <article className="owner-dish-row" key={dish.menuItemId}>
              <strong>{index + 1}</strong>
              <div>
                <span>{localizeMenuItemName({ id: dish.menuItemId, name: dish.name }, language)}</span>
                <small>
                  {formatNumber(dish.qty, language)} {language === "kk" ? "дана" : "шт."} ·{" "}
                  {formatMoney(dish.revenue, language)}
                </small>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function DishMetricTable({
  title,
  dishes,
  emptyLabel,
  language,
  valueLabel,
  categoryLabels,
}: {
  title: string;
  dishes: OwnerAnalyticsDishMetric[];
  emptyLabel: string;
  language: AppLanguage;
  valueLabel: string;
  categoryLabels: Record<MenuCategory, string>;
}) {
  return (
    <section className="owner-panel owner-panel--span-2">
      <div className="section-title-row">
        <h2>{title}</h2>
        <span>{dishes.length}</span>
      </div>
      {dishes.length === 0 ? (
        <p className="empty-state">{emptyLabel}</p>
      ) : (
        <div className="owner-data-table owner-data-table--dishes">
          <div className="owner-data-table__head">
            <span>#</span>
            <span>{language === "kk" ? "Тағам" : "Блюдо"}</span>
            <span>{language === "kk" ? "Санат" : "Категория"}</span>
            <span>{language === "kk" ? "Саны" : "Кол-во"}</span>
            <span>{language === "kk" ? "Тапсырыс" : "Заказы"}</span>
            <span>{valueLabel}</span>
          </div>
          {dishes.slice(0, 12).map((dish, index) => (
            <article className="owner-data-row" key={dish.menuItemId}>
              <span className="owner-data-row__rank">{index + 1}</span>
              <div className="owner-data-row__main">
                <b>{localizeMenuItemName({ id: dish.menuItemId, name: dish.name }, language)}</b>
                <small>{dish.active ? (language === "kk" ? "Қолжетімді" : "Доступно") : (language === "kk" ? "Стоп-парақ" : "Стоп-лист")}</small>
              </div>
              <span data-label={language === "kk" ? "Санат" : "Категория"}>{categoryLabels[dish.category]}</span>
              <span data-label={language === "kk" ? "Саны" : "Кол-во"}>{formatNumber(dish.qty, language)}</span>
              <span data-label={language === "kk" ? "Тапсырыс" : "Заказы"}>{formatNumber(dish.orders, language)}</span>
              <strong data-label={valueLabel}>{formatMoney(dish.revenue, language)}</strong>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function NeverOrderedList({
  title,
  items,
  emptyLabel,
  language,
  categoryLabels,
}: {
  title: string;
  items: OwnerAnalyticsDashboardData["menu"]["itemsNeverOrdered"];
  emptyLabel: string;
  language: AppLanguage;
  categoryLabels: Record<MenuCategory, string>;
}) {
  return (
    <section className="owner-panel">
      <div className="section-title-row">
        <h2>{title}</h2>
        <span>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="empty-state">{emptyLabel}</p>
      ) : (
        <div className="owner-compact-card-list">
          {items.slice(0, 10).map((item) => (
            <article className="owner-compact-card" key={item.menuItemId}>
              <div className="owner-compact-card__mark">
                {localizeMenuItemName({ id: item.menuItemId, name: item.name }, language).slice(0, 1)}
              </div>
              <div>
                <strong>{localizeMenuItemName({ id: item.menuItemId, name: item.name }, language)}</strong>
                <span>
                  {categoryLabels[item.category]} · {formatMoney(item.price, language)}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function CategorySummaryCards({
  profitable,
  ordered,
  language,
  labels,
  categoryLabels,
}: {
  profitable: OwnerAnalyticsCategoryMetric | null;
  ordered: OwnerAnalyticsCategoryMetric | null;
  language: AppLanguage;
  labels: {
    mostProfitableCategory: string;
    mostOrderedCategory: string;
    revenue: string;
    orders: string;
  };
  categoryLabels: Record<MenuCategory, string>;
}) {
  return (
    <section className="owner-category-highlight-grid">
      <KpiCard
        title={labels.mostProfitableCategory}
        value={profitable ? formatMoney(profitable.revenue, language) : "—"}
        note={profitable ? `${categoryLabels[profitable.category]} · ${labels.revenue}` : undefined}
        icon={<CircleDollarSign size={20} />}
        tone="success"
      />
      <KpiCard
        title={labels.mostOrderedCategory}
        value={ordered ? formatNumber(ordered.orders, language) : "—"}
        note={ordered ? `${categoryLabels[ordered.category]} · ${labels.orders}` : undefined}
        icon={<ReceiptText size={20} />}
      />
    </section>
  );
}

function TableAnalyticsList({
  title,
  tables,
  emptyLabel,
  language,
}: {
  title: string;
  tables: OwnerAnalyticsTableMetric[];
  emptyLabel: string;
  language: AppLanguage;
}) {
  return (
    <section className="owner-panel owner-panel--span-2">
      <div className="section-title-row">
        <h2>{title}</h2>
        <span>{tables.length}</span>
      </div>
      {tables.length === 0 ? (
        <p className="empty-state">{emptyLabel}</p>
      ) : (
        <div className="owner-data-table owner-data-table--tables">
          <div className="owner-data-table__head">
            <span>{language === "kk" ? "Үстел" : "Стол"}</span>
            <span>{language === "kk" ? "Тапсырыс" : "Заказы"}</span>
            <span>{language === "kk" ? "Түсім" : "Выручка"}</span>
            <span>{language === "kk" ? "Орташа чек" : "Средний чек"}</span>
            <span>{language === "kk" ? "Бас тарту" : "Отказы"}</span>
          </div>
          {tables.slice(0, 14).map((table) => (
            <article className="owner-data-row" key={table.tableId}>
              <div className="owner-data-row__main">
                <b>{language === "kk" ? `${table.tableNumber}-үстел` : `Стол ${table.tableNumber}`}</b>
                <small>{table.billableOrders} {language === "kk" ? "төленетін" : "оплачиваемых"}</small>
              </div>
              <span data-label={language === "kk" ? "Тапсырыс" : "Заказы"}>{formatNumber(table.totalOrders, language)}</span>
              <strong data-label={language === "kk" ? "Түсім" : "Выручка"}>{formatMoney(table.revenue, language)}</strong>
              <span data-label={language === "kk" ? "Орташа чек" : "Средний чек"}>{formatMoney(table.averageOrderValue, language)}</span>
              <span data-label={language === "kk" ? "Бас тарту" : "Отказы"}>{formatNumber(table.rejectedOrders, language)}</span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function OwnerDashboard() {
  const { language, copy } = useLanguage();
  const today = useMemo(() => getDateInputValue(), []);
  const [range, setRange] = useState<OwnerAnalyticsRangePreset>("today");
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const [dashboard, setDashboard] = useState<OwnerAnalyticsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [dishSearch, setDishSearch] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<MenuCategory | "all">("all");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");

  const screenCopy = useMemo(
    () =>
      language === "kk"
        ? {
            title: "Иесі",
            subtitle: "Мейрамхана аналитикасы",
            filters: "Кезең",
            customFrom: "Бастап",
            customTo: "Дейін",
            refresh: "Жаңарту",
            loading: "Деректер жүктелуде",
            empty: "Таңдалған кезеңде тапсырыстар жоқ.",
            noChartData: "Бұл кезеңде сатылым деректері жоқ.",
            noMenuData: "Бұл кезеңде тағам сатылымы жоқ.",
            noTableData: "Бұл кезеңде үстелдер бойынша жеткілікті дерек жоқ.",
            retry: "Қайталау",
            advancedFilters: "Нақтылау",
            dishSearch: "Тағам іздеу",
            tableSearch: "Үстел іздеу",
            allCategories: "Барлық санат",
            allStatuses: "Барлық статус",
            totalRevenue: "Жалпы түсім",
            revenueToday: "Бүгінгі түсім",
            revenueThisWeek: "Апта түсімі",
            revenueThisMonth: "Ай түсімі",
            totalOrders: "Барлық тапсырыс",
            ordersToday: "Бүгінгі тапсырыс",
            averageOrder: "Орташа чек",
            rejectedOrders: "Бас тартылған",
            activeOrders: "Қазір белсенді",
            completedOrders: "Аяқталған",
            serviceFee: "Қызмет ақысы",
            mostPopular: "Ең танымал",
            leastPopular: "Сирек сатылған",
            none: "Дерек жоқ",
            salesDay: "Күндер бойынша түсім",
            salesWeek: "Апталар бойынша түсім",
            salesMonth: "Айлар бойынша түсім",
            comparisons: "Салыстыру",
            todayVsYesterday: "Бүгін / кеше",
            weekVsWeek: "Осы апта / өткен апта",
            monthVsMonth: "Осы ай / өткен ай",
            ordersByStatus: "Статустар",
            ordersByHour: "Сағаттар бойынша тапсырыс",
            peakHours: "Жүктеме уақыты",
            averageOrdersPerDay: "Күніне орташа",
            processingTime: "Орташа өңдеу",
            acceptanceTime: "Қабылдау уақыты",
            kitchenTime: "Асүй уақыты",
            rejectedPercent: "Бас тарту үлесі",
            topDishes: "Топ тағамдар",
            slowDishes: "Аз сатылған тағамдар",
            dishRevenue: "Тағамдар түсімі",
            dishQuantity: "Сатылған саны",
            categoryRevenue: "Санаттар түсімі",
            categoryAnalytics: "Санат аналитикасы",
            mostProfitableCategory: "Ең табысты санат",
            mostOrderedCategory: "Ең көп тапсырыс санаты",
            ordersByCategory: "Санат бойынша тапсырыс",
            averagePriceByCategory: "Санаттың орташа бағасы",
            categoryOrderDistribution: "Тапсырыс үлесі",
            availability: "Мәзір қолжетімділігі",
            activeItems: "Қолжетімді позициялар",
            inactiveItems: "Стоп-парақта",
            neverOrdered: "Әлі тапсырыс болмаған",
            tableAnalytics: "Үстелдер аналитикасы",
            revenueByTable: "Үстелдер түсімі",
            ordersByTable: "Үстел тапсырыстары",
            averageByTable: "Үстел бойынша орташа чек",
            mostActiveTables: "Ең белсенді үстелдер",
            tablesWithRejectedOrders: "Бас тартуы бар үстелдер",
            activeSessions: "Белсенді сессиялар",
            operations: "Операциялық жағдай",
            waiting: "Официант күтуде",
            inKitchen: "Асүйде",
            ready: "Дайын",
            serviceRequests: "Ашық өтініштер",
            completedToday: "Бүгін аяқталды",
            rejectedToday: "Бүгін бас тартылды",
            bottleneck: "Тар орын",
            bottleneckNone: "Жүктеме қалыпты",
            items: "позиция",
            orders: "тапсырыс",
          }
        : {
            title: "Владелец",
            subtitle: "Аналитика ресторана",
            filters: "Период",
            customFrom: "С даты",
            customTo: "По дату",
            refresh: "Обновить",
            loading: "Загружаем данные",
            empty: "В выбранном периоде пока нет заказов.",
            noChartData: "За этот период нет данных по продажам.",
            noMenuData: "За этот период нет продаж по блюдам.",
            noTableData: "За этот период пока недостаточно данных по столам.",
            retry: "Повторить",
            advancedFilters: "Фильтры аналитики",
            dishSearch: "Поиск блюда",
            tableSearch: "Поиск стола",
            allCategories: "Все категории",
            allStatuses: "Все статусы",
            totalRevenue: "Общая выручка",
            revenueToday: "Выручка сегодня",
            revenueThisWeek: "Выручка за неделю",
            revenueThisMonth: "Выручка за месяц",
            totalOrders: "Всего заказов",
            ordersToday: "Заказы сегодня",
            averageOrder: "Средний чек",
            rejectedOrders: "Отменено/отклонено",
            activeOrders: "Активные сейчас",
            completedOrders: "Завершено",
            serviceFee: "Сервисный сбор",
            mostPopular: "Самое популярное",
            leastPopular: "Реже продается",
            none: "Нет данных",
            salesDay: "Выручка по дням",
            salesWeek: "Выручка по неделям",
            salesMonth: "Выручка по месяцам",
            comparisons: "Сравнение",
            todayVsYesterday: "Сегодня / вчера",
            weekVsWeek: "Эта неделя / прошлая",
            monthVsMonth: "Этот месяц / прошлый",
            ordersByStatus: "Статусы заказов",
            ordersByHour: "Заказы по часам",
            peakHours: "Пиковые часы",
            averageOrdersPerDay: "Среднее в день",
            processingTime: "Средняя обработка",
            acceptanceTime: "До принятия",
            kitchenTime: "На кухне",
            rejectedPercent: "Доля отказов",
            topDishes: "Топ блюд",
            slowDishes: "Слабые позиции",
            dishRevenue: "Выручка по блюдам",
            dishQuantity: "Продано по блюдам",
            categoryRevenue: "Выручка по категориям",
            categoryAnalytics: "Аналитика категорий",
            mostProfitableCategory: "Самая прибыльная категория",
            mostOrderedCategory: "Самая заказываемая категория",
            ordersByCategory: "Заказы по категориям",
            averagePriceByCategory: "Средняя цена категории",
            categoryOrderDistribution: "Распределение заказов",
            availability: "Доступность меню",
            activeItems: "Активные позиции",
            inactiveItems: "В стоп-листе",
            neverOrdered: "Ни разу не заказали",
            tableAnalytics: "Аналитика столов",
            revenueByTable: "Выручка по столам",
            ordersByTable: "Заказы по столам",
            averageByTable: "Средний чек по столам",
            mostActiveTables: "Самые активные столы",
            tablesWithRejectedOrders: "Столы с отказами",
            activeSessions: "Активные сессии",
            operations: "Операционная картина",
            waiting: "Ждут официанта",
            inKitchen: "На кухне",
            ready: "Готовы к подаче",
            serviceRequests: "Открытые запросы",
            completedToday: "Завершено сегодня",
            rejectedToday: "Отклонено сегодня",
            bottleneck: "Узкое место",
            bottleneckNone: "Нагрузка в норме",
            items: "позиций",
            orders: "заказов",
          },
    [language],
  );

  const analyticsParams = useMemo(
    () => ({
      range,
      from: range === "custom" ? customFrom : undefined,
      to: range === "custom" ? customTo : undefined,
    }),
    [customFrom, customTo, range],
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setErrorMessage(null);

    getOwnerAnalyticsDashboard(analyticsParams, controller.signal)
      .then((data) => {
        setDashboard(data);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMessage(error instanceof Error ? error.message : copy.api.requestFailed);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [analyticsParams, copy.api.requestFailed, reloadKey]);

  const summary = dashboard?.summary;
  const sales = dashboard?.sales;
  const orders = dashboard?.orders;
  const menu = dashboard?.menu;
  const tables = dashboard?.tables;
  const operations = dashboard?.operations;
  const hasOrders = Boolean(summary && summary.totalOrders > 0);

  const dailyChartData = useMemo(
    () =>
      sales?.revenueByDay.map((point) => ({
        label: formatPeriodLabel(point.period, language),
        value: point.revenue,
        meta: `${point.orders} ${screenCopy.orders}`,
      })) ?? [],
    [language, sales?.revenueByDay, screenCopy.orders],
  );

  const weeklyChartData = useMemo(
    () =>
      sales?.revenueByWeek.map((point) => ({
        label: formatPeriodLabel(point.period, language),
        value: point.revenue,
        meta: `${point.orders} ${screenCopy.orders}`,
      })) ?? [],
    [language, sales?.revenueByWeek, screenCopy.orders],
  );

  const monthlyChartData = useMemo(
    () =>
      sales?.revenueByMonth.map((point) => ({
        label: formatPeriodLabel(point.period, language),
        value: point.revenue,
        meta: `${point.orders} ${screenCopy.orders}`,
      })) ?? [],
    [language, sales?.revenueByMonth, screenCopy.orders],
  );

  const orderHourData = useMemo(
    () =>
      orders?.ordersByHour.map((item) => ({
        label: String(item.hour).padStart(2, "0"),
        value: item.count,
      })) ?? [],
    [orders?.ordersByHour],
  );

  const filteredStatusRows = useMemo(
    () =>
      orders?.ordersByStatus
        .filter((item) => statusFilter === "all" || item.status === statusFilter)
        .map((item) => ({
          label: copy.orderStatuses[item.status],
          value: item.count,
        })) ?? [],
    [copy.orderStatuses, orders?.ordersByStatus, statusFilter],
  );

  const filteredCategoryMetrics = useMemo(
    () => menu?.revenueByCategory.filter((item) => categoryFilter === "all" || item.category === categoryFilter) ?? [],
    [categoryFilter, menu?.revenueByCategory],
  );

  const filteredCategoryRows = useMemo(
    () =>
      filteredCategoryMetrics.map((item) => ({
        label: copy.categories[item.category],
        value: item.revenue,
        valueLabel: formatMoney(item.revenue, language),
        detail: `${item.orders} ${screenCopy.orders} · ${formatMoney(item.revenue, language)}`,
      })),
    [copy.categories, filteredCategoryMetrics, language, screenCopy.orders],
  );

  const ordersByCategoryRows = useMemo(
    () =>
      filteredCategoryMetrics.map((item) => ({
        label: copy.categories[item.category],
        value: item.orders,
        valueLabel: formatNumber(item.orders, language),
        detail: `${formatMoney(item.revenue, language)}`,
      })),
    [copy.categories, filteredCategoryMetrics, language],
  );

  const averagePriceByCategoryRows = useMemo(
    () =>
      filteredCategoryMetrics.map((item) => ({
        label: copy.categories[item.category],
        value: item.averageMenuPrice ?? 0,
        valueLabel: item.averageMenuPrice === null ? "—" : formatMoney(item.averageMenuPrice, language),
        detail: `${item.activeItems} ${screenCopy.items}`,
      })),
    [copy.categories, filteredCategoryMetrics, language, screenCopy.items],
  );

  const mostProfitableCategory = useMemo(
    () =>
      filteredCategoryMetrics
        .filter((item) => item.revenue > 0)
        .sort((left, right) => right.revenue - left.revenue)[0] ?? null,
    [filteredCategoryMetrics],
  );

  const mostOrderedCategory = useMemo(
    () =>
      filteredCategoryMetrics
        .filter((item) => item.orders > 0)
        .sort((left, right) => right.orders - left.orders)[0] ?? null,
    [filteredCategoryMetrics],
  );

  const filteredRevenueDishes = useMemo(() => {
    const query = normalizeSearch(dishSearch);
    return (
      menu?.revenueByDish.filter((dish) => {
        const matchesCategory = categoryFilter === "all" || dish.category === categoryFilter;
        const matchesSearch =
          !query ||
          normalizeSearch(dish.name).includes(query) ||
          normalizeSearch(localizeMenuItemName({ id: dish.menuItemId, name: dish.name }, language)).includes(query);
        return matchesCategory && matchesSearch;
      }) ?? []
    );
  }, [categoryFilter, dishSearch, language, menu?.revenueByDish]);

  const filteredQuantityDishes = useMemo(() => {
    const query = normalizeSearch(dishSearch);
    return (
      menu?.quantitySoldByDish.filter((dish) => {
        const matchesCategory = categoryFilter === "all" || dish.category === categoryFilter;
        const matchesSearch =
          !query ||
          normalizeSearch(dish.name).includes(query) ||
          normalizeSearch(localizeMenuItemName({ id: dish.menuItemId, name: dish.name }, language)).includes(query);
        return matchesCategory && matchesSearch;
      }) ?? []
    );
  }, [categoryFilter, dishSearch, language, menu?.quantitySoldByDish]);

  const filteredNeverOrdered = useMemo(() => {
    const query = normalizeSearch(dishSearch);
    return (
      menu?.itemsNeverOrdered.filter((item) => {
        const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
        const matchesSearch =
          !query ||
          normalizeSearch(item.name).includes(query) ||
          normalizeSearch(localizeMenuItemName({ id: item.menuItemId, name: item.name }, language)).includes(query);
        return matchesCategory && matchesSearch;
      }) ?? []
    );
  }, [categoryFilter, dishSearch, language, menu?.itemsNeverOrdered]);

  const filteredTables = useMemo(() => {
    const query = normalizeSearch(tableSearch);
    return (
      tables?.tables.filter((table) => !query || normalizeSearch(table.tableNumber).includes(query)) ?? []
    );
  }, [tableSearch, tables?.tables]);

  const tableRevenueRows = useMemo(
    () =>
      filteredTables.map((table) => ({
        label: language === "kk" ? `${table.tableNumber}-үстел` : `Стол ${table.tableNumber}`,
        value: table.revenue,
        valueLabel: formatMoney(table.revenue, language),
        detail: `${table.totalOrders} ${screenCopy.orders}`,
      })),
    [filteredTables, language, screenCopy.orders],
  );

  const tableOrderRows = useMemo(
    () =>
      filteredTables.map((table) => ({
        label: language === "kk" ? `${table.tableNumber}-үстел` : `Стол ${table.tableNumber}`,
        value: table.totalOrders,
        valueLabel: formatNumber(table.totalOrders, language),
        detail: formatMoney(table.revenue, language),
      })),
    [filteredTables, language],
  );

  const tableAverageRows = useMemo(
    () =>
      filteredTables.map((table) => ({
        label: language === "kk" ? `${table.tableNumber}-үстел` : `Стол ${table.tableNumber}`,
        value: table.averageOrderValue,
        valueLabel: formatMoney(table.averageOrderValue, language),
        detail: `${table.billableOrders} ${screenCopy.orders}`,
      })),
    [filteredTables, language, screenCopy.orders],
  );

  const filteredMostActiveTables = useMemo(() => {
    const ids = new Set(filteredTables.map((table) => table.tableId));
    return tables?.mostActiveTables.filter((table) => ids.has(table.tableId)) ?? [];
  }, [filteredTables, tables?.mostActiveTables]);

  const filteredRejectedTables = useMemo(() => {
    const ids = new Set(filteredTables.map((table) => table.tableId));
    return tables?.tablesWithRejectedOrders.filter((table) => ids.has(table.tableId)) ?? [];
  }, [filteredTables, tables?.tablesWithRejectedOrders]);

  const filteredActiveSessions = useMemo(() => {
    const query = normalizeSearch(tableSearch);
    return (
      tables?.currentActiveSessions.filter((session) => !query || normalizeSearch(session.tableNumber).includes(query)) ?? []
    );
  }, [tableSearch, tables?.currentActiveSessions]);

  function selectRange(nextRange: OwnerAnalyticsRangePreset) {
    startTransition(() => {
      setRange(nextRange);
    });
  }

  return (
    <DashboardShell
      className="owner-shell"
      title={screenCopy.title}
      subtitle={screenCopy.subtitle}
      icon="admin"
      metaLabel={copy.common.live}
    >
      <section className="owner-filter-panel" aria-label={screenCopy.filters}>
        <div className="owner-filter-panel__head">
          <div>
            <p className="eyebrow">{screenCopy.filters}</p>
            <strong>{rangeLabel(range, language)}</strong>
          </div>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            disabled={loading}
          >
            <RefreshCw size={17} />
            {screenCopy.refresh}
          </button>
        </div>

        <div className="owner-range-scroll">
          {rangeOptions.map((option) => (
            <button
              className={`admin-tab ${range === option ? "is-active" : ""}`}
              type="button"
              key={option}
              onClick={() => selectRange(option)}
              disabled={loading && range === option}
            >
              {rangeLabel(option, language)}
            </button>
          ))}
        </div>

        {range === "custom" && (
          <div className="owner-custom-range">
            <label className="admin-field">
              <span>{screenCopy.customFrom}</span>
              <input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
            </label>
            <label className="admin-field">
              <span>{screenCopy.customTo}</span>
              <input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
            </label>
          </div>
        )}

        <div className="owner-insight-filters" aria-label={screenCopy.advancedFilters}>
          <div className="owner-filter-title">
            <SlidersHorizontal size={17} />
            <strong>{screenCopy.advancedFilters}</strong>
          </div>
          <label className="owner-search-field">
            <Search size={16} />
            <input
              type="search"
              value={dishSearch}
              onChange={(event) => setDishSearch(event.target.value)}
              placeholder={screenCopy.dishSearch}
            />
          </label>
          <label className="owner-search-field">
            <Table2 size={16} />
            <input
              type="search"
              value={tableSearch}
              onChange={(event) => setTableSearch(event.target.value)}
              placeholder={screenCopy.tableSearch}
            />
          </label>
          <label className="owner-select-field">
            <span>{screenCopy.categoryAnalytics}</span>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as MenuCategory | "all")}>
              {ownerCategoryOptions.map((category) => (
                <option value={category} key={category}>
                  {category === "all" ? screenCopy.allCategories : copy.categories[category]}
                </option>
              ))}
            </select>
          </label>
          <label className="owner-select-field">
            <span>{screenCopy.ordersByStatus}</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as OrderStatus | "all")}>
              {ownerStatusOptions.map((status) => (
                <option value={status} key={status}>
                  {status === "all" ? screenCopy.allStatuses : copy.orderStatuses[status]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {errorMessage && (
        <div className="error-state">
          <span>{errorMessage}</span>
          <button className="button button-secondary" type="button" onClick={() => setReloadKey((value) => value + 1)}>
            {screenCopy.retry}
          </button>
        </div>
      )}

      {loading && !dashboard ? (
        <div className="owner-dashboard-grid">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton className="owner-skeleton-card" key={index} />
          ))}
        </div>
      ) : dashboard && summary && sales && orders && menu && tables && operations ? (
        <div className={`owner-dashboard ${loading ? "is-refreshing" : ""}`} aria-busy={loading}>
          {loading && <span className="owner-refresh-pill">{screenCopy.loading}</span>}
          {!hasOrders && <p className="empty-state owner-empty-banner">{screenCopy.empty}</p>}

          <section className="owner-kpi-grid owner-kpi-grid--primary" aria-label="KPI">
            <KpiCard
              title={screenCopy.totalRevenue}
              value={formatMoney(summary.totalRevenue, language)}
              note={`${summary.billableOrders} ${screenCopy.orders}`}
              icon={<CircleDollarSign size={21} />}
              tone="success"
            />
            <KpiCard
              title={screenCopy.revenueToday}
              value={formatMoney(summary.revenueToday, language)}
              icon={<CalendarDays size={21} />}
            />
            <KpiCard
              title={screenCopy.totalOrders}
              value={formatNumber(summary.totalOrders, language)}
              icon={<ReceiptText size={21} />}
            />
            <KpiCard
              title={screenCopy.averageOrder}
              value={formatMoney(summary.averageOrderValue, language)}
              icon={<Activity size={21} />}
            />
            <KpiCard
              title={screenCopy.rejectedOrders}
              value={formatNumber(summary.cancelledOrRejectedOrders, language)}
              note={formatPercent(orders.rejectedOrderPercentage, language)}
              icon={<AlertTriangle size={21} />}
              tone="danger"
            />
            <KpiCard
              title={screenCopy.activeOrders}
              value={formatNumber(summary.activeOrdersNow, language)}
              icon={<Flame size={21} />}
              tone="warning"
            />
            <KpiCard
              title={screenCopy.completedOrders}
              value={formatNumber(summary.completedOrders, language)}
              icon={<TimerReset size={21} />}
              tone="success"
            />
            <KpiCard
              title={screenCopy.mostPopular}
              value={
                summary.mostPopularDish
                  ? localizeMenuItemName({ id: summary.mostPopularDish.menuItemId, name: summary.mostPopularDish.name }, language)
                  : screenCopy.none
              }
              note={summary.mostPopularDish ? `${formatNumber(summary.mostPopularDish.qty, language)} ${screenCopy.items}` : undefined}
              icon={<Utensils size={21} />}
            />
          </section>

          <section className="owner-main-analytics" aria-label={screenCopy.salesDay}>
            <div className="owner-main-column">
              <BarChart
                title={screenCopy.salesDay}
                subtitle={rangeLabel(range, language)}
                data={dailyChartData}
                emptyLabel={screenCopy.noChartData}
                formatValue={(value) => formatMoney(value, language)}
              />
              <div className="owner-chart-pair">
                <ProgressList
                  title={screenCopy.categoryRevenue}
                  rows={filteredCategoryRows}
                  emptyLabel={screenCopy.noMenuData}
                />
                <ProgressList
                  title={screenCopy.ordersByCategory}
                  rows={ordersByCategoryRows}
                  emptyLabel={screenCopy.noMenuData}
                />
              </div>
              <BarChart
                compact
                title={screenCopy.ordersByHour}
                data={orderHourData}
                emptyLabel={screenCopy.empty}
                formatValue={(value) => formatNumber(value, language)}
              />
            </div>
            <aside className="owner-sidebar-column">
              <section className="owner-panel">
                <div className="section-title-row">
                  <h2>{screenCopy.comparisons}</h2>
                </div>
                <div className="owner-comparison-grid">
                  <ComparisonCard title={screenCopy.todayVsYesterday} comparison={sales.todayVsYesterday} language={language} />
                  <ComparisonCard title={screenCopy.weekVsWeek} comparison={sales.thisWeekVsPreviousWeek} language={language} />
                  <ComparisonCard title={screenCopy.monthVsMonth} comparison={sales.thisMonthVsPreviousMonth} language={language} />
                </div>
              </section>
              <section className="owner-panel owner-panel--compact">
                <div className="section-title-row">
                  <h2>{screenCopy.totalRevenue}</h2>
                </div>
                <div className="owner-stat-list owner-stat-list--single">
                  <div>
                    <span>{screenCopy.revenueThisWeek}</span>
                    <strong>{formatMoney(summary.revenueThisWeek, language)}</strong>
                  </div>
                  <div>
                    <span>{screenCopy.revenueThisMonth}</span>
                    <strong>{formatMoney(summary.revenueThisMonth, language)}</strong>
                  </div>
                  <div>
                    <span>{screenCopy.ordersToday}</span>
                    <strong>{formatNumber(summary.ordersToday, language)}</strong>
                  </div>
                  <div>
                    <span>{screenCopy.serviceFee}</span>
                    <strong>{formatMoney(summary.serviceFeeTotal, language)}</strong>
                  </div>
                  <div>
                    <span>{screenCopy.leastPopular}</span>
                    <strong>
                      {summary.leastPopularDish
                        ? localizeMenuItemName({ id: summary.leastPopularDish.menuItemId, name: summary.leastPopularDish.name }, language)
                        : screenCopy.none}
                    </strong>
                  </div>
                </div>
              </section>
              <section className="owner-panel owner-panel--compact">
                <div className="section-title-row">
                  <h2>{screenCopy.peakHours}</h2>
                </div>
                <div className="owner-stat-list owner-stat-list--single">
                  <div>
                    <span>{screenCopy.averageOrdersPerDay}</span>
                    <strong>{formatNumber(orders.averageOrdersPerDay, language)}</strong>
                  </div>
                  <div>
                    <span>{screenCopy.processingTime}</span>
                    <strong>{formatDuration(orders.averageProcessingSeconds, language)}</strong>
                  </div>
                  <div>
                    <span>{screenCopy.acceptanceTime}</span>
                    <strong>{formatDuration(orders.averageAcceptanceSeconds, language)}</strong>
                  </div>
                  <div>
                    <span>{screenCopy.kitchenTime}</span>
                    <strong>{formatDuration(orders.averageKitchenPreparationSeconds, language)}</strong>
                  </div>
                  <div>
                    <span>{screenCopy.rejectedPercent}</span>
                    <strong>{formatPercent(orders.rejectedOrderPercentage, language)}</strong>
                  </div>
                </div>
                <div className="owner-peak-hours">
                  {orders.peakHours.length === 0 ? (
                    <p className="empty-state">{screenCopy.empty}</p>
                  ) : (
                    orders.peakHours.map((item) => (
                      <span className="soft-pill" key={item.hour}>
                        {String(item.hour).padStart(2, "0")}:00 В· {item.count}
                      </span>
                    ))
                  )}
                </div>
              </section>
              <BarChart
                compact
                title={screenCopy.salesWeek}
                data={weeklyChartData}
                emptyLabel={screenCopy.noChartData}
                formatValue={(value) => formatMoney(value, language)}
              />
              <BarChart
                compact
                title={screenCopy.salesMonth}
                data={monthlyChartData}
                emptyLabel={screenCopy.noChartData}
                formatValue={(value) => formatMoney(value, language)}
              />
              <DishList
                title={screenCopy.topDishes}
                dishes={menu.topSellingDishes}
                emptyLabel={screenCopy.noMenuData}
                language={language}
              />
              <DishList
                title={screenCopy.slowDishes}
                dishes={menu.worstSellingDishes}
                emptyLabel={screenCopy.noMenuData}
                language={language}
              />
              <NeverOrderedList
                title={screenCopy.neverOrdered}
                items={filteredNeverOrdered}
                emptyLabel={screenCopy.noMenuData}
                language={language}
                categoryLabels={copy.categories}
              />
            </aside>
          </section>

          <section className="owner-section-grid owner-section-grid--orders">
            <ProgressList
              title={screenCopy.ordersByStatus}
              rows={filteredStatusRows}
              emptyLabel={screenCopy.empty}
            />
            <section className="owner-panel owner-panel--duplicate">
              <div className="section-title-row">
                <h2>{screenCopy.peakHours}</h2>
              </div>
              <div className="owner-stat-list">
                <div>
                  <span>{screenCopy.averageOrdersPerDay}</span>
                  <strong>{formatNumber(orders.averageOrdersPerDay, language)}</strong>
                </div>
                <div>
                  <span>{screenCopy.processingTime}</span>
                  <strong>{formatDuration(orders.averageProcessingSeconds, language)}</strong>
                </div>
                <div>
                  <span>{screenCopy.acceptanceTime}</span>
                  <strong>{formatDuration(orders.averageAcceptanceSeconds, language)}</strong>
                </div>
                <div>
                  <span>{screenCopy.kitchenTime}</span>
                  <strong>{formatDuration(orders.averageKitchenPreparationSeconds, language)}</strong>
                </div>
                <div>
                  <span>{screenCopy.rejectedPercent}</span>
                  <strong>{formatPercent(orders.rejectedOrderPercentage, language)}</strong>
                </div>
              </div>
              <div className="owner-peak-hours">
                {orders.peakHours.length === 0 ? (
                  <p className="empty-state">{screenCopy.empty}</p>
                ) : (
                  orders.peakHours.map((item) => (
                    <span className="soft-pill" key={item.hour}>
                      {String(item.hour).padStart(2, "0")}:00 · {item.count}
                    </span>
                  ))
                )}
              </div>
            </section>
          </section>

          <section className="owner-section-heading">
            <div>
              <p className="eyebrow">{screenCopy.categoryAnalytics}</p>
              <h2>{screenCopy.categoryRevenue}</h2>
            </div>
          </section>

          <CategorySummaryCards
            profitable={mostProfitableCategory}
            ordered={mostOrderedCategory}
            language={language}
            labels={{
              mostProfitableCategory: screenCopy.mostProfitableCategory,
              mostOrderedCategory: screenCopy.mostOrderedCategory,
              revenue: screenCopy.categoryRevenue,
              orders: screenCopy.orders,
            }}
            categoryLabels={copy.categories}
          />

          <section className="owner-section-grid">
            <ProgressList
              title={screenCopy.categoryRevenue}
              rows={filteredCategoryRows}
              emptyLabel={screenCopy.noMenuData}
            />
            <ProgressList
              title={screenCopy.ordersByCategory}
              rows={ordersByCategoryRows}
              emptyLabel={screenCopy.noMenuData}
            />
            <ProgressList
              title={screenCopy.averagePriceByCategory}
              rows={averagePriceByCategoryRows}
              emptyLabel={screenCopy.noMenuData}
            />
          </section>

          <section className="owner-section-heading">
            <div>
              <p className="eyebrow">{screenCopy.dishRevenue}</p>
              <h2>{screenCopy.topDishes}</h2>
            </div>
          </section>

          <section className="owner-section-grid owner-section-grid--advanced">
            <DishMetricTable
              title={screenCopy.dishRevenue}
              dishes={filteredRevenueDishes}
              emptyLabel={screenCopy.noMenuData}
              language={language}
              valueLabel={screenCopy.totalRevenue}
              categoryLabels={copy.categories}
            />
            <DishMetricTable
              title={screenCopy.dishQuantity}
              dishes={filteredQuantityDishes}
              emptyLabel={screenCopy.noMenuData}
              language={language}
              valueLabel={screenCopy.totalRevenue}
              categoryLabels={copy.categories}
            />
            <section className="owner-panel">
              <div className="section-title-row">
                <h2>{screenCopy.availability}</h2>
              </div>
              <div className="owner-stat-list">
                <div>
                  <span>{screenCopy.activeItems}</span>
                  <strong>{formatNumber(menu.availabilitySummary.activeItems, language)}</strong>
                </div>
                <div>
                  <span>{screenCopy.inactiveItems}</span>
                  <strong>{formatNumber(menu.availabilitySummary.inactiveItems, language)}</strong>
                </div>
                <div>
                  <span>{screenCopy.items}</span>
                  <strong>{formatNumber(menu.availabilitySummary.totalItems, language)}</strong>
                </div>
              </div>
            </section>
          </section>

          <section className="owner-section-heading">
            <div>
              <p className="eyebrow">{screenCopy.tableAnalytics}</p>
              <h2>{screenCopy.revenueByTable}</h2>
            </div>
          </section>

          <section className="owner-section-grid">
            <ProgressList
              title={screenCopy.revenueByTable}
              rows={tableRevenueRows}
              emptyLabel={screenCopy.noTableData}
            />
            <ProgressList
              title={screenCopy.ordersByTable}
              rows={tableOrderRows}
              emptyLabel={screenCopy.noTableData}
            />
            <ProgressList
              title={screenCopy.averageByTable}
              rows={tableAverageRows}
              emptyLabel={screenCopy.noTableData}
            />
          </section>

          <section className="owner-section-grid owner-section-grid--advanced">
            <TableAnalyticsList
              title={screenCopy.mostActiveTables}
              tables={filteredMostActiveTables}
              emptyLabel={screenCopy.noTableData}
              language={language}
            />
            <TableAnalyticsList
              title={screenCopy.tablesWithRejectedOrders}
              tables={filteredRejectedTables}
              emptyLabel={screenCopy.noTableData}
              language={language}
            />
            <section className="owner-panel">
              <div className="section-title-row">
                <h2>{screenCopy.activeSessions}</h2>
                <span>{filteredActiveSessions.length}</span>
              </div>
              {filteredActiveSessions.length === 0 ? (
                <p className="empty-state">{screenCopy.noTableData}</p>
              ) : (
                <div className="owner-compact-card-list">
                  {filteredActiveSessions.slice(0, 10).map((session) => (
                    <article className="owner-compact-card" key={session.sessionId}>
                      <div className="owner-compact-card__mark">
                        <Table2 size={16} />
                      </div>
                      <div>
                        <strong>{language === "kk" ? `${session.tableNumber}-үстел` : `Стол ${session.tableNumber}`}</strong>
                        <span>{new Date(session.lastActivity).toLocaleString(language === "kk" ? "kk-KZ" : "ru-RU")}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>

          <section className="owner-section-grid owner-section-grid--ops">
            <section className="owner-panel">
              <div className="section-title-row">
                <h2>{screenCopy.operations}</h2>
              </div>
              <div className="owner-operation-grid">
                <KpiCard title={screenCopy.activeOrders} value={formatNumber(operations.currentActiveOrders, language)} icon={<Activity size={20} />} />
                <KpiCard title={screenCopy.waiting} value={formatNumber(operations.waitingForWaiterConfirmation, language)} icon={<Clock3 size={20} />} tone="warning" />
                <KpiCard title={screenCopy.inKitchen} value={formatNumber(operations.ordersInKitchen, language)} icon={<ChefHat size={20} />} />
                <KpiCard title={screenCopy.ready} value={formatNumber(operations.readyToServe, language)} icon={<Flame size={20} />} tone="success" />
                <KpiCard title={screenCopy.serviceRequests} value={formatNumber(operations.openServiceRequests, language)} icon={<Sparkles size={20} />} />
                <KpiCard title={screenCopy.completedToday} value={formatNumber(operations.completedToday, language)} icon={<TimerReset size={20} />} tone="success" />
                <KpiCard title={screenCopy.rejectedToday} value={formatNumber(operations.rejectedToday, language)} icon={<AlertTriangle size={20} />} tone="danger" />
              </div>
            </section>
            <section className={`owner-panel owner-bottleneck owner-bottleneck--${operations.bottleneck.level}`}>
              <div className="section-title-row">
                <h2>{screenCopy.bottleneck}</h2>
                <span>{operations.bottleneck.level}</span>
              </div>
              <strong>{operations.bottleneck.reasons.length ? operations.bottleneck.reasons.join(", ") : screenCopy.bottleneckNone}</strong>
              <p>
                {screenCopy.kitchenTime}: {formatDuration(operations.bottleneck.averageKitchenPreparationSeconds, language)}
              </p>
            </section>
            <section className="owner-panel">
              <div className="section-title-row">
                <h2>{screenCopy.availability}</h2>
              </div>
              <div className="owner-stat-list">
                <div>
                  <span>{copy.common.available}</span>
                  <strong>{formatNumber(menu.availabilitySummary.activeItems, language)}</strong>
                </div>
                <div>
                  <span>{copy.common.stopList}</span>
                  <strong>{formatNumber(menu.availabilitySummary.inactiveItems, language)}</strong>
                </div>
                <div>
                  <span>{screenCopy.neverOrdered}</span>
                  <strong>{formatNumber(menu.itemsNeverOrdered.length, language)}</strong>
                </div>
              </div>
            </section>
          </section>
        </div>
      ) : null}
    </DashboardShell>
  );
}
