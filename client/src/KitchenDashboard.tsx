import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ChefHat, Flame, Inbox } from "lucide-react";
import { listKitchenOrderHistory, listKitchenOrders, normalizeOrder, orderAction } from "./api";
import { DashboardShell } from "./components/DashboardShell";
import { OrderCard } from "./components/OrderCard";
import { Skeleton } from "./components/Skeleton";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { useOrders } from "./hooks/useOrders";
import { useTick } from "./hooks/useTick";
import { useLanguage } from "./i18n";
import { createOrderSocket } from "./socket";
import type { Order } from "./types";

const kitchenStatuses = ["ACCEPTED", "COOKING"] as const;

export function KitchenDashboard() {
  const nowTimestamp = useTick(15000);
  const isOnline = useNetworkStatus();
  const { orders, replaceAll, upsertIfStatus } = useOrders();
  const { language, copy } = useLanguage();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyBusyId, setHistoryBusyId] = useState<string | null>(null);
  const historySyncInFlightRef = useRef(false);
  const historyOpenRef = useRef(false);
  const isMountedRef = useRef(true);

  const screenCopy = useMemo(
    () =>
      language === "kk"
        ? {
          title: "Ас үй",
          subtitle: "Қабылданған тапсырыстар",
          metaLabel: copy.common.activeShift,
          loadError: "Ас үй тапсырыстарын жүктеу мүмкін болмады.",
          offline: "Желі жоқ. Әрекеттер жіберілмеуі мүмкін.",
          reconnecting: "Сервермен байланыс қайта орнатылып жатыр...",
          summary: "Ас үй шолуы",
          waiting: "Күтуде",
          cooking: "Дайындалуда",
          total: "Барлығы",
          waitingStart: "Басталуын күтуде",
          noOrders: "Ас үйге арналған тапсырыстар жоқ.",
          nothingCooking: "Қазір ештеңе дайындалып жатқан жоқ.",
          kitchenNotice: (tableNumber: string) => `Ас үйге жаңа тапсырыс: ${tableNumber}-үстел`,
          history: "Тарих",
          showHistory: "Тарихты ашу",
          hideHistory: "Тарихты жабу",
          historyEmpty: "Дайын немесе жабылған тапсырыстар жоқ.",
          restoreOrder: "Дайындауға қайтару",
          restoredNotice: (orderId: string) => `Тапсырыс ${orderId.slice(0, 8)} қайта дайындалуда`,
        }
        : {
          title: "Кухня",
          subtitle: "Принятые заказы",
          metaLabel: copy.common.activeShift,
          loadError: "Не удалось загрузить заказы кухни.",
          offline: "Нет сети. Действия могут не отправиться.",
          reconnecting: "Подключение к серверу восстанавливается...",
          summary: "Сводка кухни",
          waiting: "Ожидают",
          cooking: "Готовятся",
          total: "Всего",
          waitingStart: "Ожидают старта",
          noOrders: "Нет заказов для кухни.",
          nothingCooking: "Сейчас ничего не готовится.",
          kitchenNotice: (tableNumber: string) => `Новый заказ на кухню: стол ${tableNumber}`,
          history: "История",
          showHistory: "Открыть историю",
          hideHistory: "Закрыть историю",
          historyEmpty: "Готовых или закрытых заказов пока нет.",
          restoreOrder: "Вернуть в готовку",
          restoredNotice: (orderId: string) => `Заказ ${orderId.slice(0, 8)} снова в готовке`,
        },
    [copy.common.activeShift, language],
  );

  const syncHistory = useCallback(
    async (options: { showLoader?: boolean } = {}) => {
      if (historySyncInFlightRef.current) return;
      historySyncInFlightRef.current = true;

      if (options.showLoader) {
        setHistoryLoading(true);
      }

      try {
        const historyData = await listKitchenOrderHistory();
        if (!isMountedRef.current) return;
        setHistoryOrders(historyData);
      } catch {
        if (!isMountedRef.current) return;
        setError(screenCopy.loadError);
      } finally {
        historySyncInFlightRef.current = false;
        if (isMountedRef.current && options.showLoader) {
          setHistoryLoading(false);
        }
      }
    },
    [screenCopy.loadError],
  );

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    historyOpenRef.current = historyOpen;
    if (historyOpen) {
      void syncHistory({ showLoader: true });
    }
  }, [historyOpen, syncHistory]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    listKitchenOrders()
      .then((data) => {
        if (!active) return;
        replaceAll(data);
        setError(null);
      })
      .catch(() => {
        if (active) setError(screenCopy.loadError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const socket = createOrderSocket({ role: "kitchen" });
    setSocketConnected(socket.connected);

    socket.on("connect", () => {
      setSocketConnected(true);
      setReconnecting(false);
    });
    socket.on("disconnect", () => {
      setSocketConnected(false);
    });
    socket.io.on("reconnect_attempt", () => {
      setReconnecting(true);
    });
    socket.io.on("reconnect", () => {
      setReconnecting(false);
      setSocketConnected(true);
    });

    socket.on("order_accepted", (rawOrder) => {
      const order = normalizeOrder(rawOrder);
      upsertIfStatus(order, [...kitchenStatuses]);
      setNotice(screenCopy.kitchenNotice(order.tableNumber));
    });
    socket.on("order_updated", (rawOrder) => {
      upsertIfStatus(normalizeOrder(rawOrder), [...kitchenStatuses]);
      if (historyOpenRef.current) {
        void syncHistory();
      }
    });

    return () => {
      active = false;
      socket.disconnect();
    };
  }, [replaceAll, screenCopy, syncHistory, upsertIfStatus]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const grouped = useMemo(
    () => ({
      accepted: orders.filter((order) => order.status === "ACCEPTED"),
      cooking: orders.filter((order) => order.status === "COOKING"),
    }),
    [orders],
  );

  async function runAction(order: Order, action: "cooking" | "ready") {
    setBusyId(order.id);
    try {
      upsertIfStatus(await orderAction(order.id, action), [...kitchenStatuses]);
      if (historyOpenRef.current) {
        void syncHistory();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function restoreHistoryOrder(order: Order) {
    if (order.status !== "READY") return;

    setHistoryBusyId(order.id);
    try {
      const restored = await orderAction(order.id, "reopen-cooking");
      upsertIfStatus(restored, [...kitchenStatuses]);
      setHistoryOrders((current) => current.filter((item) => item.id !== restored.id));
      setNotice(screenCopy.restoredNotice(restored.id));
      void syncHistory();
    } finally {
      setHistoryBusyId(null);
    }
  }

  return (
    <DashboardShell
      title={screenCopy.title}
      subtitle={screenCopy.subtitle}
      icon="kitchen"
      metaLabel={screenCopy.metaLabel}
      notice={notice}
    >
      {(!isOnline || (!socketConnected && reconnecting)) && (
        <p className="warning-banner">
          <AlertCircle size={16} />
          <span>{!isOnline ? screenCopy.offline : screenCopy.reconnecting}</span>
        </p>
      )}

      {error && <p className="error-state">{error}</p>}

      <section className="metric-grid metric-grid--kitchen" aria-label={screenCopy.summary}>
        <div className="metric-card metric-card--new">
          <Inbox size={18} />
          <span>{screenCopy.waiting}</span>
          <strong>{grouped.accepted.length}</strong>
        </div>
        <div className="metric-card metric-card--active">
          <Flame size={18} />
          <span>{screenCopy.cooking}</span>
          <strong>{grouped.cooking.length}</strong>
        </div>
        <div className="metric-card metric-card--ready">
          <ChefHat size={18} />
          <span>{screenCopy.total}</span>
          <strong>{orders.length}</strong>
        </div>
      </section>

      <section className="order-history-section">
        <div className="section-title-row">
          <h2>{screenCopy.history}</h2>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => setHistoryOpen((current) => !current)}
          >
            {historyOpen ? screenCopy.hideHistory : screenCopy.showHistory}
          </button>
        </div>

        {historyOpen && (
          historyLoading ? (
            <Skeleton className="dashboard-skeleton" />
          ) : historyOrders.length === 0 ? (
            <p className="empty-state">{screenCopy.historyEmpty}</p>
          ) : (
            <div className="order-history-grid">
              {historyOrders.map((order) => (
                <div className={historyBusyId === order.id ? "is-busy" : ""} key={order.id}>
                  <OrderCard
                    order={order}
                    variant="kitchen"
                    restoreLabel={screenCopy.restoreOrder}
                    onRestore={order.status === "READY" ? (next) => void restoreHistoryOrder(next) : undefined}
                  />
                </div>
              ))}
            </div>
          )
        )}
      </section>

      {loading ? (
        <section className="dashboard-columns kitchen-columns">
          <div className="dashboard-column">
            <h2>{screenCopy.waitingStart}</h2>
            <Skeleton className="dashboard-skeleton" />
            <Skeleton className="dashboard-skeleton" />
          </div>
          <div className="dashboard-column">
            <h2>{screenCopy.cooking}</h2>
            <Skeleton className="dashboard-skeleton" />
            <Skeleton className="dashboard-skeleton" />
          </div>
        </section>
      ) : (
        <section className="dashboard-columns kitchen-columns">
          <div className="dashboard-column">
            <div className="dashboard-column__title">
              <h2>{screenCopy.waitingStart}</h2>
              <span>{grouped.accepted.length}</span>
            </div>
            {grouped.accepted.length === 0 ? (
              <p className="empty-state">{screenCopy.noOrders}</p>
            ) : (
              <div className="order-stack">
                <AnimatePresence initial={false}>
                  {grouped.accepted.map((order) => (
                    <motion.div className={busyId === order.id ? "is-busy" : ""} key={order.id} layout>
                      <OrderCard
                        order={order}
                        variant="kitchen"
                        showTimer
                        nowTimestamp={nowTimestamp}
                        onCooking={(next) => void runAction(next, "cooking")}
                        onReady={(next) => void runAction(next, "ready")}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          <div className="dashboard-column">
            <div className="dashboard-column__title">
              <h2>{screenCopy.cooking}</h2>
              <span>{grouped.cooking.length}</span>
            </div>
            {grouped.cooking.length === 0 ? (
              <p className="empty-state">{screenCopy.nothingCooking}</p>
            ) : (
              <div className="order-stack">
                <AnimatePresence initial={false}>
                  {grouped.cooking.map((order) => (
                    <motion.div className={busyId === order.id ? "is-busy" : ""} key={order.id} layout>
                      <OrderCard
                        order={order}
                        variant="kitchen"
                        showTimer
                        nowTimestamp={nowTimestamp}
                        onReady={(next) => void runAction(next, "ready")}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </section>
      )}
    </DashboardShell>
  );
}
