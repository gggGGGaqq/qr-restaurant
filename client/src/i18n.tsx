import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MenuCategory, OrderStatus, ServiceRequestType } from "./types";

export type AppLanguage = "ru" | "kk";

const LANGUAGE_STORAGE_KEY = "qr-restaurant-language";

function getLanguageFromUrl(): AppLanguage | null {
  if (typeof window === "undefined") return null;
  const raw = new URL(window.location.href).searchParams.get("lang");
  if (raw === "kk" || raw === "ru") {
    return raw;
  }

  return null;
}

interface Dictionary {
  switcher: {
    label: string;
    russianShort: string;
    kazakhShort: string;
    russianFull: string;
    kazakhFull: string;
  };
  common: {
    retry: string;
    save: string;
    open: string;
    close: string;
    today: string;
    live: string;
    activeShift: string;
    visibleToGuest: string;
    available: string;
    stopList: string;
    noCover: string;
    table: (value: string | number) => string;
    order: (value: string) => string;
    serviceFee: (percent: number) => string;
    totalDue: string;
    subtotal: string;
    commentToDish: (note: string) => string;
    commentToOrder: (note: string) => string;
    timerTitle: string;
    accept: string;
    reject: string;
    complete: string;
    startCooking: string;
    markReady: string;
  };
  categories: Record<MenuCategory, string>;
  orderStatuses: Record<OrderStatus, string>;
  serviceRequestShort: Record<ServiceRequestType, string>;
  serviceRequestLong: Record<ServiceRequestType, string>;
  api: {
    invalidRequest: string;
    notFound: string;
    conflict: string;
    unavailable: string;
    requestFailed: string;
    connectionFailed: string;
    genericActionFailed: string;
    sessionInactive: string;
  };
}

const dictionaries: Record<AppLanguage, Dictionary> = {
  ru: {
    switcher: {
      label: "Язык интерфейса",
      russianShort: "RU",
      kazakhShort: "KZ",
      russianFull: "Русский",
      kazakhFull: "Қазақша",
    },
    common: {
      retry: "Повторить",
      save: "Сохранить",
      open: "Открыть",
      close: "Закрыть",
      today: "Сегодня",
      live: "Live",
      activeShift: "Смена активна",
      visibleToGuest: "Видно гостю",
      available: "Доступно",
      stopList: "Стоп-лист",
      noCover: "Без обложки",
      table: (value: string | number) => `Стол ${value}`,
      order: (value: string) => `Заказ ${value}`,
      serviceFee: (percent: number) => `Обслуживание ${percent}%`,
      totalDue: "К оплате",
      subtotal: "Подытог",
      commentToDish: (note: string) => `Комментарий: ${note}`,
      commentToOrder: (note: string) => `Комментарий к заказу: ${note}`,
      timerTitle: "Время с момента заказа",
      accept: "Принять",
      reject: "Отклонить",
      complete: "Завершить",
      startCooking: "Готовится",
      markReady: "Готово",
    },
    categories: {
      grill: "Гриль",
      hot: "Горячее",
      salad: "Салаты",
      dessert: "Десерты",
      drink: "Напитки",
    } satisfies Record<MenuCategory, string>,
    orderStatuses: {
      NEW: "Новый",
      ACCEPTED: "Принят",
      COOKING: "Готовится",
      READY: "Готов",
      COMPLETED: "Закрыт",
      REJECTED: "Отклонен",
    } satisfies Record<OrderStatus, string>,
    serviceRequestShort: {
      WAITER: "Официант",
      WATER: "Вода",
      BILL: "Счет",
      CLEANUP: "Уборка",
    } satisfies Record<ServiceRequestType, string>,
    serviceRequestLong: {
      WAITER: "Позвать официанта",
      WATER: "Принести воду",
      BILL: "Принести счет",
      CLEANUP: "Убрать стол",
    } satisfies Record<ServiceRequestType, string>,
    api: {
      invalidRequest: "Некорректный запрос.",
      notFound: "Ресурс не найден.",
      conflict: "Конфликт состояния. Обновите страницу и повторите действие.",
      unavailable: "Сервис временно недоступен. Проверьте соединение сервера с базой данных.",
      requestFailed: "Ошибка запроса к серверу.",
      connectionFailed: "Не удается подключиться к серверу. Проверьте, что backend запущен.",
      genericActionFailed: "Не удалось выполнить действие.",
      sessionInactive:
        "Сессия стола уже неактивна. Откройте QR-код заново.",
    },
  },
  kk: {
    switcher: {
      label: "Интерфейс тілі",
      russianShort: "RU",
      kazakhShort: "KZ",
      russianFull: "Русский",
      kazakhFull: "Қазақша",
    },
    common: {
      retry: "Қайталау",
      save: "Сақтау",
      open: "Ашу",
      close: "Жабу",
      today: "Бүгін",
      live: "Тікелей",
      activeShift: "Ауысым белсенді",
      visibleToGuest: "Қонаққа көрінеді",
      available: "Қолжетімді",
      stopList: "Стоп-парақ",
      noCover: "Мұқаба жоқ",
      table: (value: string | number) => `${value}-үстел`,
      order: (value: string) => `Тапсырыс ${value}`,
      serviceFee: (percent: number) => `Қызмет ақысы ${percent}%`,
      totalDue: "Төлеуге",
      subtotal: "Аралық сома",
      commentToDish: (note: string) => `Түсініктеме: ${note}`,
      commentToOrder: (note: string) => `Тапсырысқа түсініктеме: ${note}`,
      timerTitle: "Тапсырыс берілгеннен кейінгі уақыт",
      accept: "Қабылдау",
      reject: "Бас тарту",
      complete: "Аяқтау",
      startCooking: "Дайындалуда",
      markReady: "Дайын",
    },
    categories: {
      grill: "Гриль",
      hot: "Ыстық тағамдар",
      salad: "Салаттар",
      dessert: "Десерттер",
      drink: "Сусындар",
    } satisfies Record<MenuCategory, string>,
    orderStatuses: {
      NEW: "Жаңа",
      ACCEPTED: "Қабылданды",
      COOKING: "Дайындалуда",
      READY: "Дайын",
      COMPLETED: "Жабылды",
      REJECTED: "Қабылданбады",
    } satisfies Record<OrderStatus, string>,
    serviceRequestShort: {
      WAITER: "Даяшы",
      WATER: "Су",
      BILL: "Есеп",
      CLEANUP: "Жинау",
    } satisfies Record<ServiceRequestType, string>,
    serviceRequestLong: {
      WAITER: "Даяшыны шақыру",
      WATER: "Су әкелу",
      BILL: "Есеп әкелу",
      CLEANUP: "Үстелді жинау",
    } satisfies Record<ServiceRequestType, string>,
    api: {
      invalidRequest: "Қате сұрау.",
      notFound: "Ресурс табылмады.",
      conflict: "Күй қайшылығы. Бетті жаңартып, әрекетті қайталаңыз.",
      unavailable: "Қызмет уақытша қолжетімсіз. Сервердің дерекқормен байланысын тексеріңіз.",
      requestFailed: "Серверге сұрау жіберу қатесі.",
      connectionFailed: "Серверге қосылу мүмкін емес. Backend іске қосылғанын тексеріңіз.",
      genericActionFailed: "Әрекетті орындау мүмкін болмады.",
      sessionInactive:
        "Үстел сессиясы енді белсенді емес. QR-кодты қайта ашыңыз.",
    },
  },
};

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  copy: Dictionary;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function getStoredLanguage(): AppLanguage {
  if (typeof window === "undefined") return "ru";
  const override = getLanguageFromUrl();
  if (override) return override;
  const raw = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return raw === "kk" ? "kk" : "ru";
}

export function getDictionary(language: AppLanguage = getStoredLanguage()): Dictionary {
  return dictionaries[language];
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>(() => getStoredLanguage());

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language === "kk" ? "kk" : "ru";
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      copy: dictionaries[language],
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }

  return context;
}
