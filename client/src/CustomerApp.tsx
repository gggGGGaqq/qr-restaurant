import { type CSSProperties, type FormEvent, Fragment, memo, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  BellRing,
  CheckCircle2,
  Droplets,
  Minus,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  Sparkles,
  Utensils,
  WalletCards,
  X,
} from "lucide-react";
import {
  ApiError,
  createServiceRequest,
  createSession,
  getSession,
  getSettings,
  listMenu,
  listSessionOrders,
  normalizeOrder,
  normalizeServiceRequest,
  normalizeSettings,
  placeOrder,
} from "./api";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { OrderCard } from "./components/OrderCard";
import { Skeleton } from "./components/Skeleton";
import {
  localizeMenuItemDescription,
  localizeMenuItemName,
  localizeModifierName,
} from "./contentTranslations";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { useLanguage } from "./i18n";
import { menuCategories } from "./menu";
import { createOrderSocket } from "./socket";
import type {
  MenuCategory,
  MenuItem,
  Order,
  RestaurantSettings,
  ServiceRequestType,
  TableSession,
} from "./types";
import { formatMoney } from "./utils/format";

interface CategoryMeta {
  id: MenuCategory;
  label: string;
}

interface CartLine {
  id: string;
  menuItemId: number;
  qty: number;
  modifierIds: number[];
  note: string;
}

interface LocalizedModifierView {
  id: number;
  name: string;
  priceDelta: number;
}

interface LocalizedMenuItemView {
  source: MenuItem;
  id: number;
  categoryId: MenuCategory;
  name: string;
  description: string | null;
  modifiers: LocalizedModifierView[];
  searchText: string;
  defaultImage: string;
}

type CartItemView = CartLine & {
  item: LocalizedMenuItemView;
  modifiers: LocalizedModifierView[];
  unitTotal: number;
  lineTotal: number;
};

type CustomerRoute =
  | { kind: "entry" }
  | { kind: "table"; tableId: string }
  | { kind: "session"; sessionId: string };

const defaultSettings: RestaurantSettings = {
  name: "Demo Bistro",
  accentColor: "#2f6f5e",
  coverImage: null,
  serviceRate: 0.1,
};

const menuImageByItemId: Record<number, string> = {
  1: "/menu/steak-bowl.jpg",
  2: "/menu/lemon-chicken.jpg",
  3: "/menu/mushroom-risotto.jpg",
  4: "/menu/burrata-salad.jpg",
  5: "/menu/chocolate-tart.jpg",
  6: "/menu/citrus-sparkling.jpg",
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createFoodPlaceholder(name: string): string {
  const label = escapeXml((name || "Dish").slice(0, 26));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><rect width="1200" height="900" fill="#eef3ef"/><path d="M0 760c190-120 380-148 570-84s402 56 630-24v248H0z" fill="#d8e6df"/><circle cx="880" cy="290" r="190" fill="#cddfd5"/><circle cx="880" cy="290" r="128" fill="#f8faf7"/><path d="M760 290h240" stroke="#92ad9c" stroke-width="18" stroke-linecap="round"/><text x="76" y="725" fill="#26332d" font-family="Segoe UI, Arial, sans-serif" font-size="58" font-weight="700">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function getCustomerRouteFromUrl(): CustomerRoute {
  const sessionMatch = window.location.pathname.match(/^\/session\/([0-9a-fA-F-]{36})\/?$/);
  if (sessionMatch?.[1]) {
    return { kind: "session", sessionId: sessionMatch[1] };
  }

  const pathMatch = window.location.pathname.match(/^\/table\/([a-zA-Z0-9_-]{1,128})\/?$/);
  const query = new URLSearchParams(window.location.search);
  const value = pathMatch?.[1] ?? query.get("table_token");
  const tableId = value?.trim();

  return tableId ? { kind: "table", tableId } : { kind: "entry" };
}

function isCustomerRouteOpen(route: CustomerRoute): boolean {
  return route.kind !== "entry";
}

function replaceWithSessionUrl(sessionId: string): void {
  const sessionPath = `/session/${encodeURIComponent(sessionId)}`;
  if (window.location.pathname !== sessionPath) {
    window.history.replaceState({}, "", sessionPath);
  }
}

function cartKey(menuItemId: number, modifierIds: number[], note: string) {
  return `${menuItemId}:${[...modifierIds].sort((a, b) => a - b).join(".")}:${note.trim()}`;
}

const sectionMotion = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.26, ease: "easeOut" },
  },
};

const cardMotion = {
  hidden: { opacity: 0, y: 12 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: index * 0.025,
      duration: 0.26,
      ease: "easeOut",
    },
  }),
};

function sameIdSet(left: number[], right: number[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

interface CustomerMenuCardProps {
  item: LocalizedMenuItemView;
  itemQty: number;
  selectedModifierIds: number[];
  selectedTotal: number;
  imageSrc: string;
  defaultDescription: string;
  modifierAriaLabel: string;
  addLabel: string;
  language: "ru" | "kk";
  animationIndex: number;
  onToggleModifier: (menuItemId: number, modifierId: number) => void;
  onAdd: (menuItemId: number) => void;
  onImageError: (itemId: number) => void;
}

const CustomerMenuCard = memo(
  function CustomerMenuCard({
    item,
    itemQty,
    selectedModifierIds,
    selectedTotal,
    imageSrc,
    defaultDescription,
    modifierAriaLabel,
    addLabel,
    language,
    animationIndex,
    onToggleModifier,
    onAdd,
    onImageError,
  }: CustomerMenuCardProps) {
    return (
      <motion.article
        custom={animationIndex}
        variants={cardMotion}
        initial="hidden"
        animate="visible"
        className="menu-card"
        data-cart-count={itemQty}
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.99 }}
      >
        <div className="menu-card__image-wrap">
          <img
            src={imageSrc}
            alt={item.name}
            loading="lazy"
            onError={() => onImageError(item.id)}
          />
        </div>

        <div className="menu-card__body">
          <div>
            <h3>{item.name}</h3>
            <p>{item.description ?? defaultDescription}</p>
          </div>

          {item.modifiers.length > 0 && (
            <div className="modifier-row" aria-label={modifierAriaLabel}>
              {item.modifiers.map((modifier) => {
                const isSelected = selectedModifierIds.includes(modifier.id);
                return (
                  <button
                    key={modifier.id}
                    type="button"
                    className={isSelected ? "is-selected" : ""}
                    onClick={() => onToggleModifier(item.id, modifier.id)}
                  >
                    {modifier.name}
                    {modifier.priceDelta > 0 && <span>+{formatMoney(modifier.priceDelta, language)}</span>}
                  </button>
                );
              })}
            </div>
          )}

          <div className="menu-card__footer">
            <strong>{formatMoney(selectedTotal, language)}</strong>
            <motion.button
              type="button"
              className="button button-primary menu-card__add"
              whileTap={{ scale: 0.97 }}
              onClick={() => onAdd(item.id)}
            >
              <Plus size={16} strokeWidth={2.5} /> {addLabel}
            </motion.button>
          </div>
        </div>
      </motion.article>
    );
  },
  (prev, next) =>
    prev.item === next.item &&
    prev.itemQty === next.itemQty &&
    prev.selectedTotal === next.selectedTotal &&
    prev.imageSrc === next.imageSrc &&
    prev.defaultDescription === next.defaultDescription &&
    prev.modifierAriaLabel === next.modifierAriaLabel &&
    prev.addLabel === next.addLabel &&
    prev.language === next.language &&
    sameIdSet(prev.selectedModifierIds, next.selectedModifierIds),
);

export function CustomerApp() {
  const isOnline = useNetworkStatus();
  const { language, copy } = useLanguage();
  const [settings, setSettings] = useState<RestaurantSettings>(defaultSettings);
  const [entryTableToken, setEntryTableToken] = useState("");
  const [customerRoute, setCustomerRoute] = useState<CustomerRoute>(() => getCustomerRouteFromUrl());
  const [session, setSession] = useState<TableSession | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<number, number[]>>({});
  const [orderNote, setOrderNote] = useState("");
  const [loading, setLoading] = useState(() => isCustomerRouteOpen(getCustomerRouteFromUrl()));
  const [placing, setPlacing] = useState(false);
  const [serviceBusy, setServiceBusy] = useState<ServiceRequestType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<MenuCategory>("hot");
  const [cartOpen, setCartOpen] = useState(false);
  const [lastActionText, setLastActionText] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const hasTableContext = isCustomerRouteOpen(customerRoute);

  const screenCopy = useMemo(
    () =>
      language === "kk"
        ? {
            tableMenu: "Үстел мәзірі",
            entryHint: "QR-код сілтемесін ашыңыз немесе үстел кодын енгізіңіз.",
            tableCode: "Үстел коды",
            insertQrCode: "QR кодын енгізіңіз",
            open: copy.common.open,
            addedToCart: "Себетке қосылды",
            orderReadyNotice: (orderCode: string) => `Тапсырыс ${orderCode} дайын`,
            serviceProcessed: "Даяшы сұрауды орындады",
            latestReady: "Соңғысы: дайын",
            latestInProgress: "Соңғысы: жұмыста",
            offline: "Желі жоқ. Тапсырыстар мен мәртебелер кейінірек жаңаруы мүмкін.",
            reconnecting: "Сервермен байланыс қайта орнатылып жатыр...",
            todayInMenu: "Бүгінгі мәзір",
            intro: "Тағамдарды таңдаңыз, қалауларыңызды қосыңыз, ас үй тапсырысты бірден алады",
            positions: (count: number) => `${count} тағам`,
            serviceLabel: (percent: number) => `${percent}% сервис`,
            serviceRequestsAria: "Сервис сұраулары",
            searchPlaceholder: "Тағамды табу",
            clearSearch: "Іздеуді тазарту",
            categoriesAria: "Мәзір санаттары",
            noMenuResults: "Мұндай сұраныс бойынша тағам табылмады.",
            defaultDescription: "Ас үйдің фирмалық тағамы.",
            modifiersAria: (name: string) => `${name} модификаторлары`,
            add: "Қосу",
            addMore: (qty: number) => `Тағы (${qty})`,
            yourOrders: "Сіздің тапсырыстарыңыз",
            noOrders: "Әзірге тапсырыс жоқ. Бір отырыс ішінде бірнеше тапсырыс жасауға болады.",
            openCart: "Себетті ашу",
            cart: "Себет",
            cartCaption: (count: number) => `${count} орын`,
            closeCart: "Себетті жабу",
            dishNotePlaceholder:
              "Тағамға түсініктеме: пиязсыз, аллергия бар, кейінірек әкеліңіз",
            orderNotePlaceholder: "Барлық тапсырысқа ортақ түсініктеме",
            submitOrder: "Тапсырысты рәсімдеу",
            sending: "Жіберілуде...",
            orderSent: "Тапсырыс даяшыға жіберілді",
            requestSent: (label: string) => `Сұрау жіберілді: ${label}`,
            retry: copy.common.retry,
          }
        : {
            tableMenu: "Меню стола",
            entryHint: "Откройте ссылку из QR-кода или вставьте код стола.",
            tableCode: "Код стола",
            insertQrCode: "Вставьте код из QR",
            open: copy.common.open,
            addedToCart: "Добавлено в корзину",
            orderReadyNotice: (orderCode: string) => `Заказ ${orderCode} готов`,
            serviceProcessed: "Официант обработал запрос",
            latestReady: "Последний: готов",
            latestInProgress: "Последний: в работе",
            offline: "Нет сети. Заказы и статусы могут обновляться позже.",
            reconnecting: "Подключение к серверу восстанавливается...",
            todayInMenu: "Сегодня в меню",
            intro: "Выберите блюда, добавьте пожелания, а кухня получит заказ сразу",
            positions: (count: number) => `${count} позиций`,
            serviceLabel: (percent: number) => `${percent}% сервис`,
            serviceRequestsAria: "Сервисные запросы",
            searchPlaceholder: "Найти блюдо",
            clearSearch: "Очистить поиск",
            categoriesAria: "Категории меню",
            noMenuResults: "По такому запросу блюд не найдено.",
            defaultDescription: "Фирменное блюдо кухни.",
            modifiersAria: (name: string) => `Модификаторы ${name}`,
            add: "Добавить",
            addMore: (qty: number) => `Еще (${qty})`,
            yourOrders: "Ваши заказы",
            noOrders: "Заказов пока нет. Можно делать несколько заказов в течение одной посадки.",
            openCart: "Открыть корзину",
            cart: "Корзина",
            cartCaption: (count: number) => `${count} позиц.`,
            closeCart: "Закрыть корзину",
            dishNotePlaceholder:
              "Комментарий к блюду: без лука, аллергия, подать позже",
            orderNotePlaceholder: "Комментарий ко всему заказу",
            submitOrder: "Оформить заказ",
            sending: "Отправка...",
            orderSent: "Заказ отправлен официанту",
            requestSent: (label: string) => `Запрос отправлен: ${label}`,
            retry: copy.common.retry,
          },
    [copy.common.open, copy.common.retry, language],
  );

  const categoryMeta = useMemo<CategoryMeta[]>(
    () => menuCategories.map((id) => ({ id, label: copy.categories[id] })),
    [copy.categories],
  );

  const serviceActions = useMemo(
    () => [
      { type: "WAITER" as const, label: copy.serviceRequestShort.WAITER, icon: BellRing },
      { type: "WATER" as const, label: copy.serviceRequestShort.WATER, icon: Droplets },
      { type: "BILL" as const, label: copy.serviceRequestShort.BILL, icon: WalletCards },
      { type: "CLEANUP" as const, label: copy.serviceRequestShort.CLEANUP, icon: Sparkles },
    ],
    [copy.serviceRequestShort],
  );

  const shellStyle = {
    "--primary": settings.accentColor,
    "--primary-dark": settings.accentColor,
  } as CSSProperties;
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const localizedMenu = useMemo<LocalizedMenuItemView[]>(
    () =>
      menu.map((item) => {
        const name = localizeMenuItemName(item, language);
        const description = localizeMenuItemDescription(item, language);
        const modifiers = item.modifiers.map((modifier) => ({
          id: modifier.id,
          name: localizeModifierName(modifier, language),
          priceDelta: modifier.priceDelta,
        }));

        return {
          source: item,
          id: item.id,
          categoryId: item.category,
          name,
          description,
          modifiers,
          searchText: `${name} ${description ?? ""} ${modifiers.map((modifier) => modifier.name).join(" ")}`.toLowerCase(),
          defaultImage:
            item.image && item.image.trim().length > 0
              ? item.image
              : menuImageByItemId[item.id] ?? createFoodPlaceholder(name),
        };
      }),
    [language, menu],
  );

  const menuById = useMemo(
    () => new Map(localizedMenu.map((item) => [item.id, item])),
    [localizedMenu],
  );

  const filteredItems = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    if (!query) return localizedMenu;
    return localizedMenu.filter((item) => item.searchText.includes(query));
  }, [deferredSearchQuery, localizedMenu]);

  const groupedMenu = useMemo(
    () =>
      categoryMeta
        .map((category) => ({
          ...category,
          items: filteredItems.filter((item) => item.categoryId === category.id),
        }))
        .filter((group) => group.items.length > 0),
    [categoryMeta, filteredItems],
  );

  const categoryCounts = useMemo(
    () =>
      categoryMeta.map((category) => ({
        ...category,
        count: localizedMenu.filter((item) => item.categoryId === category.id).length,
      })),
    [categoryMeta, localizedMenu],
  );

  const cartItems = useMemo(
    () =>
      cart
        .map((line) => {
          const item = menuById.get(line.menuItemId);
          if (!item) return null;
          const modifiers = item.modifiers.filter((modifier) => line.modifierIds.includes(modifier.id));
          const unitTotal = item.source.price + modifiers.reduce((sum, modifier) => sum + modifier.priceDelta, 0);
          return { ...line, item, modifiers, unitTotal, lineTotal: unitTotal * line.qty };
        })
        .filter((item): item is CartItemView => Boolean(item)),
    [cart, menuById],
  );

  const cartQtyByItemId = useMemo(() => {
    const next: Record<number, number> = {};
    for (const line of cart) {
      next[line.menuItemId] = (next[line.menuItemId] ?? 0) + line.qty;
    }
    return next;
  }, [cart]);

  const selectedTotalByItemId = useMemo(() => {
    const totals: Record<number, number> = {};
    for (const item of localizedMenu) {
      const selected = selectedModifiers[item.id] ?? [];
      totals[item.id] =
        item.source.price +
        item.modifiers.reduce(
          (sum, modifier) => (selected.includes(modifier.id) ? sum + modifier.priceDelta : sum),
          0,
        );
    }
    return totals;
  }, [localizedMenu, selectedModifiers]);

  const resolvedImageById = useMemo(() => {
    const images: Record<number, string> = {};
    for (const item of localizedMenu) {
      images[item.id] = failedImages[item.id] ? createFoodPlaceholder(item.name) : item.defaultImage;
    }
    return images;
  }, [failedImages, localizedMenu]);

  const cartSubtotal = useMemo(
    () => cartItems.reduce((sum, line) => sum + line.lineTotal, 0),
    [cartItems],
  );
  const serviceFee = cartSubtotal * settings.serviceRate;
  const cartTotal = cartSubtotal + serviceFee;
  const cartCount = useMemo(
    () => cart.reduce((sum, line) => sum + line.qty, 0),
    [cart],
  );
  const latestOrder = orders[0];

  function formatError(errorValue: unknown): string {
    if (errorValue instanceof ApiError) return errorValue.message;
    return copy.api.genericActionFailed;
  }

  function markImageFailed(itemId: number) {
    setFailedImages((current) => (current[itemId] ? current : { ...current, [itemId]: true }));
  }

  async function reloadMenuAndSettings() {
    const [nextSettings, nextMenu] = await Promise.all([getSettings(), listMenu()]);
    setSettings(nextSettings);
    setMenu(nextMenu);
  }

  useEffect(() => {
    const handlePopState = () => setCustomerRoute(getCustomerRouteFromUrl());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (customerRoute.kind === "entry") {
      setSession(null);
      setMenu([]);
      setOrders([]);
      setError(null);
      setLoading(false);
      getSettings().then(setSettings).catch(() => undefined);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    const sessionRequest =
      customerRoute.kind === "table"
        ? createSession(customerRoute.tableId)
        : getSession(customerRoute.sessionId);

    Promise.all([getSettings(), sessionRequest, listMenu()])
      .then(async ([nextSettings, nextSession, menuItems]) => {
        if (!active) return;
        if (nextSession.status !== "ACTIVE") {
          throw new ApiError(copy.api.sessionInactive, 409);
        }

        const sessionOrders = await listSessionOrders(nextSession.id);
        if (!active) return;

        if (customerRoute.kind === "table") {
          replaceWithSessionUrl(nextSession.id);
        }

        setSettings(nextSettings);
        setSession(nextSession);
        setMenu(menuItems);
        setOrders(sessionOrders);
        if (menuItems.length > 0) {
          setActiveCategory(menuItems[0].category);
        }
      })
      .catch((requestError) => {
        if (active) setError(formatError(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [copy.api.sessionInactive, customerRoute]);

  useEffect(() => {
    if (!session) return;

    const socket = createOrderSocket({ sessionId: session.id });
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
    socket.on("order_updated", (rawOrder) => {
      const order = normalizeOrder(rawOrder);
      if (order.sessionId !== session.id) return;
      setOrders((current) => {
        const exists = current.some((item) => item.id === order.id);
        return exists
          ? current.map((item) => (item.id === order.id ? order : item))
          : [order, ...current];
      });
    });
    socket.on("order_ready", (rawOrder) => {
      const order = normalizeOrder(rawOrder);
      if (order.sessionId !== session.id) return;
      setOrders((current) => current.map((item) => (item.id === order.id ? order : item)));
      setLastActionText(screenCopy.orderReadyNotice(order.id.slice(0, 8)));
    });
    socket.on("service_request_updated", (rawRequest) => {
      const request = normalizeServiceRequest(rawRequest);
      if (request.sessionId === session.id && request.status === "DONE") {
        setLastActionText(screenCopy.serviceProcessed);
      }
    });
    socket.on("menu_updated", () => {
      void reloadMenuAndSettings();
    });
    socket.on("settings_updated", (nextSettings) => {
      setSettings(normalizeSettings(nextSettings));
    });

    return () => {
      socket.disconnect();
    };
  }, [screenCopy, session]);

  useEffect(() => {
    if (!lastActionText) return;
    const timer = window.setTimeout(() => setLastActionText(null), 2200);
    return () => window.clearTimeout(timer);
  }, [lastActionText]);

  useEffect(() => {
    if (groupedMenu.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const nextCategory = visible[0].target.getAttribute("data-category") as MenuCategory | null;
          if (nextCategory) setActiveCategory(nextCategory);
        }
      },
      { rootMargin: "-32% 0px -52% 0px", threshold: [0.16, 0.4, 0.7] },
    );

    groupedMenu.forEach((group) => {
      const node = sectionRefs.current[group.id];
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, [groupedMenu]);

  function toggleModifier(menuItemId: number, modifierId: number) {
    setSelectedModifiers((current) => {
      const selected = current[menuItemId] ?? [];
      const next = selected.includes(modifierId)
        ? selected.filter((id) => id !== modifierId)
        : [...selected, modifierId];
      return { ...current, [menuItemId]: next };
    });
  }

  function addOne(menuItemId: number) {
    const modifierIds = selectedModifiers[menuItemId] ?? [];
    const key = cartKey(menuItemId, modifierIds, "");

    setCart((current) => {
      const existing = current.find((line) => cartKey(line.menuItemId, line.modifierIds, line.note) === key);
      if (existing) {
        return current.map((line) => (line.id === existing.id ? { ...line, qty: line.qty + 1 } : line));
      }
      return [
        ...current,
        {
          id: crypto.randomUUID(),
          menuItemId,
          qty: 1,
          modifierIds,
          note: "",
        },
      ];
    });
    setLastActionText(screenCopy.addedToCart);
  }

  function changeLineQty(lineId: string, delta: number) {
    setCart((current) =>
      current
        .map((line) => (line.id === lineId ? { ...line, qty: Math.max(0, line.qty + delta) } : line))
        .filter((line) => line.qty > 0),
    );
  }

  function changeLineNote(lineId: string, note: string) {
    setCart((current) => current.map((line) => (line.id === lineId ? { ...line, note } : line)));
  }

  function scrollToCategory(id: MenuCategory) {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveCategory(id);
  }

  async function submitOrder() {
    if (!session || cartItems.length === 0 || placing) return;

    setPlacing(true);
    setError(null);

    try {
      const order = await placeOrder({
        orderId: crypto.randomUUID(),
        tableId: session.tableId,
        sessionId: session.id,
        note: orderNote.trim() || null,
        items: cartItems.map((line) => ({
          menuItemId: line.menuItemId,
          qty: line.qty,
          note: line.note.trim() || null,
          modifierIds: line.modifierIds,
        })),
      });
      setOrders((current) => [order, ...current.filter((item) => item.id !== order.id)]);
      setCart([]);
      setOrderNote("");
      setCartOpen(false);
      setLastActionText(screenCopy.orderSent);
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setPlacing(false);
    }
  }

  async function callService(type: ServiceRequestType) {
    if (!session || serviceBusy) return;
    setServiceBusy(type);
    try {
      await createServiceRequest({
        tableId: session.tableId,
        sessionId: session.id,
        type,
      });
      setLastActionText(screenCopy.requestSent(copy.serviceRequestShort[type]));
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setServiceBusy(null);
    }
  }

  function submitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const tableId = entryTableToken.trim();
    if (tableId.length === 0) return;
    window.history.pushState({}, "", `/table/${encodeURIComponent(tableId)}`);
    setCustomerRoute({ kind: "table", tableId });
  }

  if (!hasTableContext) {
    return (
      <main className="app-shell customer-shell entry-shell" style={shellStyle}>
        <motion.section
          className="entry-panel"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="entry-panel__head">
            <div className="brand-mark" aria-hidden="true">
              <Utensils size={26} />
            </div>
            <LanguageSwitcher />
          </div>

          <div className="entry-copy">
            <p className="eyebrow">{settings.name}</p>
            <h1>{screenCopy.tableMenu}</h1>
            <p>{screenCopy.entryHint}</p>
          </div>

          <form className="entry-form" onSubmit={submitEntry}>
            <label htmlFor="table-token">{screenCopy.tableCode}</label>
            <div className="entry-input-row">
              <input
                id="table-token"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={entryTableToken}
                onChange={(event) => setEntryTableToken(event.target.value)}
                placeholder={screenCopy.insertQrCode}
              />
              <motion.button className="button button-primary" type="submit" whileTap={{ scale: 0.98 }}>
                {screenCopy.open}
              </motion.button>
            </div>
          </form>
        </motion.section>
      </main>
    );
  }

  const cartPortal = hasTableContext ? (
    <Fragment>
      <AnimatePresence mode="sync">
        {cartCount > 0 && (
          <motion.button
            key="cart-fab"
            className="cart-fab"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ type: "tween", duration: 0.08, ease: "easeOut" }}
            whileTap={{ scale: 0.96, transition: { type: "tween", duration: 0.08 } }}
            onClick={() => setCartOpen(true)}
            aria-label={screenCopy.openCart}
            title={screenCopy.openCart}
          >
            <ShoppingBag size={22} />
            <div className="cart-fab__copy">
              <strong>{screenCopy.cart}</strong>
              <span>{screenCopy.cartCaption(cartCount)}</span>
            </div>
            <span className="cart-fab__badge">{cartCount}</span>
            <span className="cart-fab__total">{formatMoney(cartTotal, language)}</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div
              className="cart-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCartOpen(false)}
            />
            <motion.aside
              className="cart-sheet"
              initial={{ y: "100%", opacity: 0.9 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0.9 }}
              transition={{ type: "spring", damping: 30, stiffness: 240, mass: 0.8 }}
            >
              <header>
                <div>
                  <p className="eyebrow">{copy.common.table(session?.tableNumber ?? "...")}</p>
                  <h3>{screenCopy.cart}</h3>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setCartOpen(false)}
                  aria-label={screenCopy.closeCart}
                  title={copy.common.close}
                >
                  <X size={18} />
                </button>
              </header>

              <div className="cart-sheet__items">
                {cartItems.map((line) => (
                  <div key={line.id} className="cart-sheet__item cart-sheet__item--rich">
                    <img
                      src={resolvedImageById[line.item.id]}
                      alt={line.item.name}
                      loading="lazy"
                      onError={() => markImageFailed(line.item.id)}
                    />
                    <div className="cart-sheet__item-copy">
                      <h4>{line.item.name}</h4>
                      <p>
                        {formatMoney(line.unitTotal, language)} x {line.qty}
                      </p>
                      {line.modifiers.length > 0 && (
                        <small>{line.modifiers.map((modifier) => modifier.name).join(", ")}</small>
                      )}
                    </div>
                    <div className="qty-control">
                      <button type="button" onClick={() => changeLineQty(line.id, -1)} aria-label="-" title="-">
                        <Minus size={16} />
                      </button>
                      <span>{line.qty}</span>
                      <button type="button" onClick={() => changeLineQty(line.id, 1)} aria-label="+" title="+">
                        <Plus size={16} />
                      </button>
                    </div>
                    <textarea
                      value={line.note}
                      onChange={(event) => changeLineNote(line.id, event.target.value)}
                      placeholder={screenCopy.dishNotePlaceholder}
                      maxLength={300}
                    />
                  </div>
                ))}
              </div>

              <footer>
                <textarea
                  className="order-note-input"
                  value={orderNote}
                  onChange={(event) => setOrderNote(event.target.value)}
                  placeholder={screenCopy.orderNotePlaceholder}
                  maxLength={500}
                />
                <div className="cart-sheet__summary-line">
                  <span>{copy.common.subtotal}</span>
                  <strong>{formatMoney(cartSubtotal, language)}</strong>
                </div>
                <div className="cart-sheet__summary-line">
                  <span>{copy.common.serviceFee(Math.round(settings.serviceRate * 100))}</span>
                  <strong>{formatMoney(serviceFee, language)}</strong>
                </div>
                <div className="cart-sheet__summary-total">
                  <span>{copy.common.totalDue}</span>
                  <strong>{formatMoney(cartTotal, language)}</strong>
                </div>
                <button
                  className="button button-primary button-wide"
                  onClick={submitOrder}
                  disabled={placing || !isOnline}
                >
                  {placing ? screenCopy.sending : screenCopy.submitOrder}
                </button>
              </footer>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </Fragment>
  ) : null;

  return (
    <>
      <main className="app-shell customer-shell" style={shellStyle}>
        <header className="customer-header">
          <div>
            <p className="eyebrow">{copy.common.table(session?.tableNumber ?? "...")}</p>
            <h1>{settings.name}</h1>
          </div>
          <div className="customer-header__aside">
            <LanguageSwitcher />
            {latestOrder && (
              <div className="order-mini-status">
                <CheckCircle2 size={16} />
                <span>{latestOrder.status === "READY" ? screenCopy.latestReady : screenCopy.latestInProgress}</span>
              </div>
            )}
          </div>
        </header>

        {(!isOnline || reconnecting || !socketConnected) && (
          <div className="warning-banner" role="status">
            <AlertCircle size={16} />
            <span>{!isOnline ? screenCopy.offline : screenCopy.reconnecting}</span>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {lastActionText && (
            <motion.div
              key={lastActionText}
              className="floating-toast"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
            >
              <Sparkles size={16} />
              <span>{lastActionText}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {loading && (
          <section className="menu-grid">
            <Skeleton className="menu-skeleton" />
            <Skeleton className="menu-skeleton" />
            <Skeleton className="menu-skeleton" />
            <Skeleton className="menu-skeleton" />
          </section>
        )}

        {error && (
          <div className="error-state">
            <p>{error}</p>
            <button className="button button-secondary" type="button" onClick={() => window.location.reload()}>
              {screenCopy.retry}
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            <section className="menu-intro">
              <div>
                <p className="eyebrow">{screenCopy.todayInMenu}</p>
                <h2>{screenCopy.intro}</h2>
              </div>
              <div className="intro-metrics" aria-label={screenCopy.todayInMenu}>
                <span>{screenCopy.positions(menu.length)}</span>
                <span>{screenCopy.serviceLabel(Math.round(settings.serviceRate * 100))}</span>
              </div>
            </section>

            <section className="service-actions" aria-label={screenCopy.serviceRequestsAria}>
              {serviceActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.type}
                    type="button"
                    onClick={() => void callService(action.type)}
                    disabled={serviceBusy !== null || !isOnline}
                  >
                    <Icon size={18} />
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </section>

            <div className="menu-toolbar">
              <label className="search-box" htmlFor="menu-search">
                <Search size={18} />
                <input
                  id="menu-search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={screenCopy.searchPlaceholder}
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery("")} aria-label={screenCopy.clearSearch} title={screenCopy.clearSearch}>
                    <X size={16} />
                  </button>
                )}
              </label>
            </div>

            <nav className="category-nav" aria-label={screenCopy.categoriesAria}>
              {categoryCounts
                .filter((category) => category.count > 0)
                .map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={`category-chip ${activeCategory === category.id ? "is-active" : ""}`}
                    onClick={() => scrollToCategory(category.id)}
                  >
                    <span>{category.label}</span>
                    <strong>{category.count}</strong>
                  </button>
                ))}
            </nav>

            {groupedMenu.length === 0 ? (
              <div className="empty-state">
                <ReceiptText size={22} />
                <p>{screenCopy.noMenuResults}</p>
              </div>
            ) : (
              <div className="menu-sections">
                {groupedMenu.map((group) => (
                  <motion.section
                    key={group.id}
                    className="menu-section"
                    data-category={group.id}
                    variants={sectionMotion}
                    initial="hidden"
                    animate="visible"
                    ref={(node) => {
                      sectionRefs.current[group.id] = node;
                    }}
                  >
                    <h2>{group.label}</h2>
                    <div className="menu-grid">
                {group.items.map((item, index) => {
                        const selected = selectedModifiers[item.id] ?? [];
                        const itemQty = cartQtyByItemId[item.id] ?? 0;
                        const selectedTotal = selectedTotalByItemId[item.id] ?? item.source.price;
                        const imageSrc = resolvedImageById[item.id];

                        return (
                          <CustomerMenuCard
                            key={item.id}
                            item={item}
                            itemQty={itemQty}
                            selectedModifierIds={selected}
                            selectedTotal={selectedTotal}
                            imageSrc={imageSrc}
                            defaultDescription={screenCopy.defaultDescription}
                            modifierAriaLabel={screenCopy.modifiersAria(item.name)}
                            addLabel={itemQty > 0 ? screenCopy.addMore(itemQty) : screenCopy.add}
                            language={language}
                            animationIndex={index}
                            onToggleModifier={toggleModifier}
                            onAdd={addOne}
                            onImageError={markImageFailed}
                          />
                        );
                      })}
                    </div>
                  </motion.section>
                ))}
              </div>
            )}

            <section className="orders-section">
              <div className="section-title-row">
                <h2>{screenCopy.yourOrders}</h2>
                <span>{orders.length}</span>
              </div>
              {orders.length === 0 ? (
                <div className="empty-state">
                  <ReceiptText size={22} />
                  <p>{screenCopy.noOrders}</p>
                </div>
              ) : (
                <div className="order-stack">
                  <AnimatePresence initial={false}>
                    {orders.map((order) => (
                      <OrderCard key={order.id} order={order} />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </section>
          </>
        )}
      </main>
      {cartPortal ? createPortal(cartPortal, document.body) : null}
    </>
  );
}
