import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BellRing,
  CheckCircle2,
  Clock3,
  Droplets,
  Inbox,
  Sparkles,
  WalletCards,
} from "lucide-react";
import {
  completeServiceRequest,
  listWaiterOrderHistory,
  listWaiterOrders,
  listWaiterServiceRequests,
  normalizeOrder,
  normalizeServiceRequest,
  orderAction,
} from "./api";
import { DashboardShell } from "./components/DashboardShell";
import { OrderCard } from "./components/OrderCard";
import { Skeleton } from "./components/Skeleton";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { useOrders } from "./hooks/useOrders";
import { useTick } from "./hooks/useTick";
import { useLanguage } from "./i18n";
import { createOrderSocket } from "./socket";
import type { Order, ServiceRequest, ServiceRequestType } from "./types";

const serviceIcons: Record<ServiceRequestType, typeof BellRing> = {
  WAITER: BellRing,
  WATER: Droplets,
  BILL: WalletCards,
  CLEANUP: Sparkles,
};

type WaiterLane = "incoming" | "active" | "ready";

export function WaiterDashboard() {
  const nowTimestamp = useTick(1000);
  const isOnline = useNetworkStatus();
  const { orders, replaceAll, upsert } = useOrders();
  const { language, copy } = useLanguage();
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [serviceBusyId, setServiceBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [mobileLane, setMobileLane] = useState<WaiterLane>("incoming");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyBusyId, setHistoryBusyId] = useState<string | null>(null);
  const syncInFlightRef = useRef(false);
  const historySyncInFlightRef = useRef(false);
  const historyOpenRef = useRef(false);
  const isMountedRef = useRef(true);

  const screenCopy = useMemo(
    () =>
      language === "kk"
        ? {
          title: "Даяшы",
          subtitle: "Тапсырыстар кезегі",
          loadError: "Даяшы панелін жүктеу мүмкін болмады.",
          offline: "Желі жоқ. Әрекеттер жіберілмеуі мүмкін.",
          reconnecting: "Сервермен байланыс қайта орнатылып жатыр...",
          summaryLabel: "Тапсырыстар шолуы",
          newOrders: "Жаңа",
          activeOrders: "Жұмыста",
          readyOrders: "Дайын",
          serviceQueue: "Қонақ сұраулары",
          noRequests: "Қонақтардан белсенді сұраулар жоқ.",
          done: "Дайын",
          newOrderNotice: (tableNumber: string) => `Жаңа тапсырыс: ${tableNumber}-үстел`,
          readyNotice: (orderId: string, tableNumber: string) =>
            `Тапсырыс ${orderId.slice(0, 8)} ${tableNumber}-үстелге дайын`,
          serviceNotice: (label: string, tableNumber: string) => `${label}: ${tableNumber}-үстел`,
          loadingNew: "Жаңа",
          loadingActive: "Жұмыста",
          loadingReady: "Дайын",
          noNew: "Жаңа тапсырыстар жоқ.",
          noActive: "Белсенді тапсырыстар жоқ.",
          readyToServe: "Беруге дайын",
          noReady: "Дайын тапсырыстар жоқ.",
          history: "Тарих",
          showHistory: "Тарихты ашу",
          hideHistory: "Тарихты жабу",
          historyEmpty: "Жабылған немесе қайтарылған тапсырыстар жоқ.",
          restoreOrder: "Қайтару",
          restoredNotice: (orderId: string) => `Тапсырыс ${orderId.slice(0, 8)} қайта ашылды`,
        }
        : {
          title: "Официант",
          subtitle: "Очередь заказов",
          loadError: "Не удалось загрузить панель официанта.",
          offline: "Нет сети. Действия могут не отправиться.",
          reconnecting: "Подключение к серверу восстанавливается...",
          summaryLabel: "Сводка заказов",
          newOrders: "Новые",
          activeOrders: "В работе",
          readyOrders: "Готовы",
          serviceQueue: "Запросы гостей",
          noRequests: "Нет активных запросов от гостей.",
          done: "Готово",
          newOrderNotice: (tableNumber: string) => `Новый заказ: стол ${tableNumber}`,
          readyNotice: (orderId: string, tableNumber: string) =>
            `Заказ ${orderId.slice(0, 8)} готов для стола ${tableNumber}`,
          serviceNotice: (label: string, tableNumber: string) => `${label}: стол ${tableNumber}`,
          loadingNew: "Новые",
          loadingActive: "В работе",
          loadingReady: "Готово",
          noNew: "Новых заказов нет.",
          noActive: "Активных заказов нет.",
          readyToServe: "Готово к подаче",
          noReady: "Готовых заказов нет.",
          history: "История",
          showHistory: "Открыть историю",
          hideHistory: "Закрыть историю",
          historyEmpty: "Закрытых или отклоненных заказов пока нет.",
          restoreOrder: "Вернуть",
          restoredNotice: (orderId: string) => `Заказ ${orderId.slice(0, 8)} снова открыт`,
        },
    [copy.serviceRequestLong, language],
  );

  const syncHistory = useCallback(
    async (options: { showLoader?: boolean } = {}) => {
      if (historySyncInFlightRef.current) return;
      historySyncInFlightRef.current = true;

      if (options.showLoader) {
        setHistoryLoading(true);
      }

      try {
        const historyData = await listWaiterOrderHistory();
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

  const syncDashboard = useCallback(
    async (options: { showLoader?: boolean } = {}) => {
      if (syncInFlightRef.current) return;
      syncInFlightRef.current = true;

      if (options.showLoader) {
        setLoading(true);
      }

      try {
        const [orderData, requestData] = await Promise.all([listWaiterOrders(), listWaiterServiceRequests()]);
        if (!isMountedRef.current) return;
        replaceAll(orderData);
        setServiceRequests(requestData);
        setError(null);
      } catch {
        if (!isMountedRef.current) return;
        setError(screenCopy.loadError);
      } finally {
        syncInFlightRef.current = false;
        if (isMountedRef.current && options.showLoader) {
          setLoading(false);
        }
      }
    },
    [replaceAll, screenCopy.loadError],
  );

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void syncDashboard({ showLoader: true });
  }, [syncDashboard]);

  useEffect(() => {
    const handleOnline = () => {
      void syncDashboard();
    };
    const handleFocus = () => {
      void syncDashboard();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncDashboard();
      }
    };
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void syncDashboard();
      }
    }, 30000);

    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [syncDashboard]);

  useEffect(() => {
    historyOpenRef.current = historyOpen;
    if (historyOpen) {
      void syncHistory({ showLoader: true });
    }
  }, [historyOpen, syncHistory]);

  useEffect(() => {
    const socket = createOrderSocket({ role: "waiter" });
    setSocketConnected(socket.connected);

    socket.on("connect", () => {
      setSocketConnected(true);
      setReconnecting(false);
      void syncDashboard();
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
      void syncDashboard();
    });

    socket.on("order_created", (rawOrder) => {
      const order = normalizeOrder(rawOrder);
      upsert(order);
      setNotice(screenCopy.newOrderNotice(order.tableNumber));
    });
    socket.on("order_updated", (rawOrder) => {
      upsert(normalizeOrder(rawOrder));
      void syncDashboard();
      if (historyOpenRef.current) {
        void syncHistory();
      }
    });
    socket.on("order_ready", (rawOrder) => {
      const order = normalizeOrder(rawOrder);
      upsert(order);
      setNotice(screenCopy.readyNotice(order.id, order.tableNumber));
      if (historyOpenRef.current) {
        void syncHistory();
      }
    });
    socket.on("service_request_created", (rawRequest) => {
      const request = normalizeServiceRequest(rawRequest);
      setServiceRequests((current) => [request, ...current.filter((item) => item.id !== request.id)]);
      setNotice(screenCopy.serviceNotice(copy.serviceRequestLong[request.type], request.tableNumber));
    });
    socket.on("service_request_updated", (rawRequest) => {
      const request = normalizeServiceRequest(rawRequest);
      setServiceRequests((current) =>
        request.status === "OPEN"
          ? [request, ...current.filter((item) => item.id !== request.id)]
          : current.filter((item) => item.id !== request.id),
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [copy.serviceRequestLong, screenCopy, syncDashboard, syncHistory, upsert]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const grouped = useMemo(
    () => ({
      incoming: orders.filter((order) => order.status === "NEW"),
      active: orders.filter((order) => order.status === "ACCEPTED" || order.status === "COOKING"),
      ready: orders.filter((order) => order.status === "READY"),
    }),
    [orders],
  );

  const orderTabs = useMemo(
    () => [
      { id: "incoming" as const, label: screenCopy.newOrders, count: grouped.incoming.length },
      { id: "active" as const, label: screenCopy.activeOrders, count: grouped.active.length },
      { id: "ready" as const, label: screenCopy.readyToServe, count: grouped.ready.length },
    ],
    [grouped.active.length, grouped.incoming.length, grouped.ready.length, screenCopy.activeOrders, screenCopy.newOrders, screenCopy.readyToServe],
  );

  useEffect(() => {
    if (mobileLane === "incoming" && grouped.incoming.length > 0) return;
    if (mobileLane === "active" && grouped.active.length > 0) return;
    if (mobileLane === "ready" && grouped.ready.length > 0) return;

    const nextLane = orderTabs.find((tab) => tab.count > 0)?.id ?? "incoming";
    if (nextLane !== mobileLane) {
      setMobileLane(nextLane);
    }
  }, [grouped.active.length, grouped.incoming.length, grouped.ready.length, mobileLane, orderTabs]);

  async function runAction(order: Order, action: "accept" | "reject" | "complete") {
    setBusyId(order.id);
    try {
      upsert(await orderAction(order.id, action));
      if (historyOpenRef.current) {
        void syncHistory();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function restoreHistoryOrder(order: Order) {
    const action = order.status === "REJECTED" ? "reopen-new" : order.status === "COMPLETED" ? "reopen-ready" : null;
    if (!action) return;

    setHistoryBusyId(order.id);
    try {
      const restored = await orderAction(order.id, action);
      upsert(restored);
      setHistoryOrders((current) => current.filter((item) => item.id !== restored.id));
      setNotice(screenCopy.restoredNotice(restored.id));
      void syncDashboard();
      void syncHistory();
    } finally {
      setHistoryBusyId(null);
    }
  }

  async function finishServiceRequest(request: ServiceRequest) {
    setServiceBusyId(request.id);
    try {
      const next = await completeServiceRequest(request.id);
      setServiceRequests((current) => current.filter((item) => item.id !== next.id));
    } finally {
      setServiceBusyId(null);
    }
  }

  return (
    <DashboardShell
      title={screenCopy.title}
      icon="waiter"
      notice={notice}
      animateNotice={false}
    >
      {(!isOnline || (!socketConnected && reconnecting)) && (
        <p className="warning-banner">
          <AlertCircle size={16} />
          <span>{!isOnline ? screenCopy.offline : screenCopy.reconnecting}</span>
        </p>
      )}

      {error && <p className="error-state">{error}</p>}

      <section className="metric-grid" aria-label={screenCopy.summaryLabel}>
        <div className="metric-card metric-card--new">
          <Inbox size={18} />
          <span>{screenCopy.newOrders}</span>
          <strong>{grouped.incoming.length}</strong>
        </div>
        <div className="metric-card metric-card--active">
          <Clock3 size={18} />
          <span>{screenCopy.activeOrders}</span>
          <strong>{grouped.active.length}</strong>
        </div>
        <div className="metric-card metric-card--ready">
          <CheckCircle2 size={18} />
          <span>{screenCopy.readyOrders}</span>
          <strong>{grouped.ready.length}</strong>
        </div>
      </section>

      <section className="service-queue">
        <div className="section-title-row">
          <h2>{screenCopy.serviceQueue}</h2>
          <span>{serviceRequests.length}</span>
        </div>
        {serviceRequests.length === 0 ? (
          <p className="empty-state">{screenCopy.noRequests}</p>
        ) : (
          <div className="service-request-grid">
            {serviceRequests.map((request) => {
              const Icon = serviceIcons[request.type];
              return (
                <article
                  key={request.id}
                  className={`service-request-card ${serviceBusyId === request.id ? "is-busy" : ""}`}
                >
                  <Icon size={20} />
                  <div>
                    <p className="eyebrow">{copy.common.table(request.tableNumber)}</p>
                    <h3>{copy.serviceRequestLong[request.type]}</h3>
                    {request.note && <p>{request.note}</p>}
                  </div>
                  <button className="button button-primary" type="button" onClick={() => void finishServiceRequest(request)}>
                    {screenCopy.done}
                  </button>
                </article>
              );
            })}
          </div>
        )}
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
                    variant="waiter"
                    restoreLabel={screenCopy.restoreOrder}
                    onRestore={(next) => void restoreHistoryOrder(next)}
                  />
                </div>
              ))}
            </div>
          )
        )}
      </section>

      <section className="waiter-mobile-tabs" aria-label={screenCopy.summaryLabel}>
        {orderTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={mobileLane === tab.id ? "is-active" : ""}
            onClick={() => setMobileLane(tab.id)}
          >
            <span>{tab.label}</span>
            <strong>{tab.count}</strong>
          </button>
        ))}
      </section>

      {loading ? (
        <section className="dashboard-columns dashboard-columns--waiter">
          <div className={`dashboard-column waiter-lane ${mobileLane === "incoming" ? "is-mobile-active" : ""}`}>
            <h2>{screenCopy.loadingNew}</h2>
            <Skeleton className="dashboard-skeleton" />
            <Skeleton className="dashboard-skeleton" />
          </div>
          <div className={`dashboard-column waiter-lane ${mobileLane === "active" ? "is-mobile-active" : ""}`}>
            <h2>{screenCopy.loadingActive}</h2>
            <Skeleton className="dashboard-skeleton" />
          </div>
          <div className={`dashboard-column waiter-lane ${mobileLane === "ready" ? "is-mobile-active" : ""}`}>
            <h2>{screenCopy.loadingReady}</h2>
            <Skeleton className="dashboard-skeleton" />
          </div>
        </section>
      ) : (
        <section className="dashboard-columns dashboard-columns--waiter">
          <div className={`dashboard-column waiter-lane ${mobileLane === "incoming" ? "is-mobile-active" : ""}`}>
            <div className="dashboard-column__title">
              <h2>{screenCopy.newOrders}</h2>
              <span>{grouped.incoming.length}</span>
            </div>
            {grouped.incoming.length === 0 ? (
              <p className="empty-state">{screenCopy.noNew}</p>
            ) : (
              <div className="order-stack">
                {grouped.incoming.map((order) => (
                  <div className={busyId === order.id ? "is-busy" : ""} key={order.id}>
                    <OrderCard
                      order={order}
                      variant="waiter"
                      showTimer
                      nowTimestamp={nowTimestamp}
                      onAccept={(next) => void runAction(next, "accept")}
                      onReject={(next) => void runAction(next, "reject")}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`dashboard-column waiter-lane ${mobileLane === "active" ? "is-mobile-active" : ""}`}>
            <div className="dashboard-column__title">
              <h2>{screenCopy.activeOrders}</h2>
              <span>{grouped.active.length}</span>
            </div>
            {grouped.active.length === 0 ? (
              <p className="empty-state">{screenCopy.noActive}</p>
            ) : (
              <div className="order-stack">
                {grouped.active.map((order) => (
                  <div className={busyId === order.id ? "is-busy" : ""} key={order.id}>
                    <OrderCard order={order} variant="waiter" showTimer nowTimestamp={nowTimestamp} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`dashboard-column waiter-lane ${mobileLane === "ready" ? "is-mobile-active" : ""}`}>
            <div className="dashboard-column__title">
              <h2>{screenCopy.readyToServe}</h2>
              <span>{grouped.ready.length}</span>
            </div>
            {grouped.ready.length === 0 ? (
              <p className="empty-state">{screenCopy.noReady}</p>
            ) : (
              <div className="order-stack">
                {grouped.ready.map((order) => (
                  <div className={busyId === order.id ? "is-busy" : ""} key={order.id}>
                    <OrderCard
                      order={order}
                      variant="waiter"
                      showTimer
                      nowTimestamp={nowTimestamp}
                      onComplete={(next) => void runAction(next, "complete")}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </DashboardShell>
  );
}
