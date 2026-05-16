import { type FormEvent, type ReactNode, useDeferredValue, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import QRCode from "qrcode";
import {
  Copy,
  Download,
  ExternalLink,
  Image,
  LayoutDashboard,
  Palette,
  Plus,
  Power,
  QrCode,
  Save,
  Search,
  Settings2,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import {
  createMenuItem,
  createMenuModifier,
  createTable,
  getSettings,
  listAdminMenu,
  listTables,
  updateMenuItem,
  updateMenuModifier,
  updateSettings,
  updateTable,
} from "./api";
import { DashboardShell } from "./components/DashboardShell";
import { Skeleton } from "./components/Skeleton";
import { useLanguage } from "./i18n";
import { menuCategories } from "./menu";
import type { MenuCategory, MenuItem, MenuModifier, RestaurantSettings, Table } from "./types";
import { formatMoney } from "./utils/format";

type AdminTab = "overview" | "menu" | "tables" | "branding";
type MenuStatusFilter = "all" | "active" | "inactive";
type MenuSort = "active-first" | "name" | "price-high" | "price-low";
type MenuCategoryFilter = "all" | MenuCategory;

const defaultSettings: RestaurantSettings = {
  name: "Demo Bistro",
  accentColor: "#2f6f5e",
  coverImage: null,
  serviceRate: 0.1,
};

function toDbMoney(value: number): number {
  return value >= 1000 ? value / 1000 : value;
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const node = document.createElement("textarea");
  node.value = value;
  node.setAttribute("readonly", "true");
  node.style.position = "absolute";
  node.style.left = "-9999px";
  document.body.appendChild(node);
  node.select();
  document.execCommand("copy");
  document.body.removeChild(node);
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="admin-summary-card">
      <div className="admin-summary-card__icon">{icon}</div>
      <div className="admin-summary-card__copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{detail}</p>
      </div>
    </article>
  );
}

function ModifierEditor({
  modifier,
  language,
  labels,
  onSave,
}: {
  modifier: MenuModifier;
  language: "ru" | "kk";
  labels: {
    modifierName: string;
    surcharge: string;
    sortOrder: string;
    moveToStopList: string;
    restore: string;
    saving: string;
    save: string;
  };
  onSave: (
    modifierId: number,
    input: Partial<Pick<MenuModifier, "name" | "priceDelta" | "active" | "sortOrder">>,
  ) => Promise<void>;
}) {
  const [draft, setDraft] = useState({
    name: modifier.name,
    priceDelta: String(modifier.priceDelta),
    sortOrder: String(modifier.sortOrder),
    active: modifier.active,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft({
      name: modifier.name,
      priceDelta: String(modifier.priceDelta),
      sortOrder: String(modifier.sortOrder),
      active: modifier.active,
    });
  }, [modifier]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(modifier.id, {
        name: draft.name.trim(),
        priceDelta: toDbMoney(Number(draft.priceDelta || 0)),
        sortOrder: Number(draft.sortOrder || 0),
        active: draft.active,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`admin-modifier-card ${draft.active ? "" : "is-disabled"}`}>
      <div className="admin-modifier-card__grid">
        <label className="admin-field">
          <span>{labels.modifierName}</span>
          <input
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          />
        </label>
        <label className="admin-field">
          <span>{labels.surcharge}</span>
          <input
            type="number"
            min="0"
            value={draft.priceDelta}
            onChange={(event) => setDraft((current) => ({ ...current, priceDelta: event.target.value }))}
          />
        </label>
        <label className="admin-field">
          <span>{labels.sortOrder}</span>
          <input
            type="number"
            min="0"
            value={draft.sortOrder}
            onChange={(event) => setDraft((current) => ({ ...current, sortOrder: event.target.value }))}
          />
        </label>
      </div>
      <div className="admin-modifier-card__actions">
        <button
          className={`button ${draft.active ? "button-secondary" : "button-primary"}`}
          type="button"
          onClick={() => setDraft((current) => ({ ...current, active: !current.active }))}
        >
          <Power size={16} />
          {draft.active ? labels.moveToStopList : labels.restore}
        </button>
        <button className="button button-primary" type="button" onClick={() => void handleSave()} disabled={saving}>
          <Save size={16} />
          {saving ? labels.saving : labels.save}
        </button>
      </div>
      <p className="admin-helper-text">{formatMoney(modifier.priceDelta, language)}</p>
    </div>
  );
}

function MenuItemCard({
  item,
  language,
  categoryOptions,
  labels,
  onSave,
  onDuplicate,
  onCreateModifier,
  onSaveModifier,
}: {
  item: MenuItem;
  language: "ru" | "kk";
  categoryOptions: Array<{ id: MenuCategory; label: string }>;
  labels: {
    category: string;
    itemName: string;
    price: string;
    image: string;
    description: string;
    noCover: string;
    stopListLabel: string;
    modifiers: string;
    noModifiers: string;
    newModifier: string;
    surcharge: string;
    sortOrder: string;
    availableNow: string;
    createCopy: string;
    copying: string;
    save: string;
    saving: string;
    moveToStopList: string;
    restore: string;
    modifierPlaceholder: string;
    descriptionPlaceholder: string;
    imagePlaceholder: string;
    availableToggle: string;
    addModifier: string;
    addingModifier: string;
    modifierName: string;
  };
  onSave: (
    id: number,
    input: Partial<Pick<MenuItem, "category" | "name" | "price" | "description" | "image" | "active">>,
  ) => Promise<void>;
  onDuplicate: (item: MenuItem) => Promise<void>;
  onCreateModifier: (
    menuItemId: number,
    input: Pick<MenuModifier, "name" | "priceDelta" | "active" | "sortOrder">,
  ) => Promise<void>;
  onSaveModifier: (
    modifierId: number,
    input: Partial<Pick<MenuModifier, "name" | "priceDelta" | "active" | "sortOrder">>,
  ) => Promise<void>;
}) {
  const [draft, setDraft] = useState({
    category: item.category,
    name: item.name,
    price: String(item.price),
    description: item.description ?? "",
    image: item.image ?? "",
    active: item.active,
  });
  const [newModifier, setNewModifier] = useState({
    name: "",
    priceDelta: "",
    sortOrder: String(item.modifiers.length + 1),
    active: true,
  });
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [creatingModifier, setCreatingModifier] = useState(false);

  useEffect(() => {
    setDraft({
      category: item.category,
      name: item.name,
      price: String(item.price),
      description: item.description ?? "",
      image: item.image ?? "",
      active: item.active,
    });
    setNewModifier((current) => ({
      ...current,
      sortOrder: String(item.modifiers.length + 1),
    }));
  }, [item]);

  async function saveItem() {
    setSaving(true);
    try {
      await onSave(item.id, {
        category: draft.category,
        name: draft.name.trim(),
        price: toDbMoney(Number(draft.price || 0)),
        description: draft.description.trim() || null,
        image: draft.image.trim() || null,
        active: draft.active,
      });
    } finally {
      setSaving(false);
    }
  }

  async function duplicateItem() {
    setDuplicating(true);
    try {
      await onDuplicate(item);
    } finally {
      setDuplicating(false);
    }
  }

  async function submitModifier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingModifier(true);
    try {
      await onCreateModifier(item.id, {
        name: newModifier.name.trim(),
        priceDelta: toDbMoney(Number(newModifier.priceDelta || 0)),
        sortOrder: Number(newModifier.sortOrder || item.modifiers.length + 1),
        active: newModifier.active,
      });
      setNewModifier({
        name: "",
        priceDelta: "",
        sortOrder: String(item.modifiers.length + 2),
        active: true,
      });
    } finally {
      setCreatingModifier(false);
    }
  }

  return (
    <motion.article className={`admin-item-card ${draft.active ? "" : "is-disabled"}`} layout>
      <div className="admin-item-card__preview">
        {draft.image ? (
          <img src={draft.image} alt={draft.name} />
        ) : (
          <div className="admin-item-card__placeholder">
            <Image size={28} />
            <span>{labels.noCover}</span>
          </div>
        )}
      </div>

      <div className="admin-item-card__body">
        <div className="admin-item-card__header">
          <div>
            <p className="eyebrow">{categoryOptions.find((option) => option.id === item.category)?.label ?? item.category}</p>
            <h3>{item.name}</h3>
          </div>
          <span className={`admin-status-pill ${draft.active ? "is-active" : "is-muted"}`}>
            {draft.active ? labels.availableToggle : labels.stopListLabel}
          </span>
        </div>

        <div className="admin-form-grid admin-form-grid--item">
          <label className="admin-field">
            <span>{labels.category}</span>
            <select
              value={draft.category}
              onChange={(event) =>
                setDraft((current) => ({ ...current, category: event.target.value as MenuCategory }))
              }
            >
              {categoryOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>{labels.price}</span>
            <input
              type="number"
              min="0"
              value={draft.price}
              onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))}
            />
          </label>
          <label className="admin-field admin-field--span-2">
            <span>{labels.itemName}</span>
            <input
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label className="admin-field admin-field--span-2">
            <span>{labels.image}</span>
            <input
              value={draft.image}
              onChange={(event) => setDraft((current) => ({ ...current, image: event.target.value }))}
              placeholder={labels.imagePlaceholder}
            />
          </label>
          <label className="admin-field admin-field--span-2">
            <span>{labels.description}</span>
            <textarea
              value={draft.description}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              placeholder={labels.descriptionPlaceholder}
            />
          </label>
        </div>

        <div className="admin-item-card__actions">
          <button
            className={`button ${draft.active ? "button-secondary" : "button-primary"}`}
            type="button"
            onClick={() => setDraft((current) => ({ ...current, active: !current.active }))}
          >
            <Power size={16} />
            {draft.active ? labels.moveToStopList : labels.restore}
          </button>
          <button className="button button-secondary" type="button" onClick={() => void duplicateItem()} disabled={duplicating}>
            <Copy size={16} />
            {duplicating ? labels.copying : labels.createCopy}
          </button>
          <button className="button button-primary" type="button" onClick={() => void saveItem()} disabled={saving}>
            <Save size={16} />
            {saving ? labels.saving : labels.save}
          </button>
        </div>

        <section className="admin-modifier-section">
          <div className="section-title-row">
            <h3>{labels.modifiers}</h3>
            <span>{item.modifiers.length}</span>
          </div>

          {item.modifiers.length > 0 ? (
            <div className="admin-modifier-list-grid">
              {item.modifiers.map((modifier) => (
                <ModifierEditor
                  key={modifier.id}
                  modifier={modifier}
                  language={language}
                  labels={{
                    modifierName: labels.modifierName,
                    surcharge: labels.surcharge,
                    sortOrder: labels.sortOrder,
                    moveToStopList: labels.moveToStopList,
                    restore: labels.restore,
                    saving: labels.saving,
                    save: labels.save,
                  }}
                  onSave={onSaveModifier}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">{labels.noModifiers}</div>
          )}

          <form className="admin-inline-form" onSubmit={submitModifier}>
            <label className="admin-field">
              <span>{labels.newModifier}</span>
              <input
                value={newModifier.name}
                onChange={(event) => setNewModifier((current) => ({ ...current, name: event.target.value }))}
                placeholder={labels.modifierPlaceholder}
              />
            </label>
            <label className="admin-field">
              <span>{labels.surcharge}</span>
              <input
                type="number"
                min="0"
                value={newModifier.priceDelta}
                onChange={(event) => setNewModifier((current) => ({ ...current, priceDelta: event.target.value }))}
              />
            </label>
            <label className="admin-field">
              <span>{labels.sortOrder}</span>
              <input
                type="number"
                min="0"
                value={newModifier.sortOrder}
                onChange={(event) => setNewModifier((current) => ({ ...current, sortOrder: event.target.value }))}
              />
            </label>
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={newModifier.active}
                onChange={(event) => setNewModifier((current) => ({ ...current, active: event.target.checked }))}
              />
              <span>{labels.availableToggle}</span>
            </label>
            <button className="button button-primary" type="submit" disabled={creatingModifier}>
              <Plus size={16} />
              {creatingModifier ? labels.addingModifier : labels.addModifier}
            </button>
          </form>
        </section>
      </div>
    </motion.article>
  );
}

function TableCard({
  table,
  qrCode,
  entryUrl,
  labels,
  onSave,
  onCopyLink,
}: {
  table: Table;
  qrCode?: string;
  entryUrl: string;
  labels: {
    guestEntry: string;
    tableNumber: string;
    guestEntryHint: string;
    copyLink: string;
    openLink: string;
    downloadQr: string;
    saveTable: string;
    saving: string;
  };
  onSave: (id: number, input: Partial<Pick<Table, "number">>) => Promise<void>;
  onCopyLink: (url: string) => Promise<void>;
}) {
  const [number, setNumber] = useState(table.number);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNumber(table.number);
  }, [table.number]);

  async function saveTableNumber() {
    setSaving(true);
    try {
      await onSave(table.id, { number: number.trim() });
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.article className="admin-table-card" layout>
      <div className="admin-table-card__qr">
        {qrCode ? <img src={qrCode} alt={`QR ${table.number}`} /> : <Skeleton className="admin-table-card__qr-skeleton" />}
      </div>

      <div className="admin-table-card__body">
        <div className="admin-table-card__header">
          <div>
            <p className="eyebrow">{labels.guestEntry}</p>
            <h3>{table.number}</h3>
          </div>
          <span className="soft-pill">ID {table.id}</span>
        </div>

        <label className="admin-field">
          <span>{labels.tableNumber}</span>
          <input value={number} onChange={(event) => setNumber(event.target.value)} />
        </label>

        <p className="admin-helper-text">{labels.guestEntryHint}</p>

        <div className="admin-table-card__actions">
          <button className="button button-secondary" type="button" onClick={() => void onCopyLink(entryUrl)}>
            <Copy size={16} />
            {labels.copyLink}
          </button>
          <a className="button button-secondary" href={entryUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={16} />
            {labels.openLink}
          </a>
          {qrCode && (
            <a className="button button-primary" href={qrCode} download={`table-${table.number}-qr.png`}>
              <Download size={16} />
              {labels.downloadQr}
            </a>
          )}
          <button className="button button-primary" type="button" onClick={() => void saveTableNumber()} disabled={saving}>
            <Save size={16} />
            {saving ? labels.saving : labels.saveTable}
          </button>
        </div>
      </div>
    </motion.article>
  );
}

export function AdminDashboard() {
  const { language, copy } = useLanguage();
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings>(defaultSettings);
  const [qrCodes, setQrCodes] = useState<Record<number, string>>({});
  const [newItem, setNewItem] = useState({
    category: "hot" as MenuCategory,
    name: "",
    price: "",
    description: "",
    image: "",
    active: true,
  });
  const [newTableNumber, setNewTableNumber] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [creatingItem, setCreatingItem] = useState(false);
  const [creatingTable, setCreatingTable] = useState(false);
  const [currentTab, setCurrentTab] = useState<AdminTab>("overview");
  const [menuStatusFilter, setMenuStatusFilter] = useState<MenuStatusFilter>("all");
  const [menuCategoryFilter, setMenuCategoryFilter] = useState<MenuCategoryFilter>("all");
  const [menuSort, setMenuSort] = useState<MenuSort>("active-first");
  const [search, setSearch] = useState("");

  const deferredSearch = useDeferredValue(search);
  const baseUrl = useMemo(() => window.location.origin, []);

  const categoryOptions = useMemo(
    () => menuCategories.map((category) => ({ id: category, label: copy.categories[category] })),
    [copy.categories],
  );

  const screenCopy = useMemo(
    () =>
      language === "kk"
        ? {
            title: "Әкімші панелі",
            subtitle: "Мәзір, үстелдер, QR және бренд",
            menuCount: (count: number) => `${count} тағам`,
            genericError: "Әрекетті орындау мүмкін болмады.",
            savedSettings: "Мейрамхана баптаулары сақталды.",
            copiedLink: "Сілтеме көшірілді.",
            menuItemSaved: (name: string) => `"${name}" тағамы жаңартылды.`,
            menuItemCopied: (name: string) => `"${name}" көшірмесі стоп-парақта жасалды.`,
            modifierAdded: (name: string) => `"${name}" модификаторы қосылды.`,
            modifierSaved: (name: string) => `"${name}" модификаторы сақталды.`,
            itemAdded: (name: string) => `"${name}" тағамы қосылды.`,
            tableCreated: (name: string) => `${name} үстелі құрылды.`,
            tableSaved: (name: string) => `${name} үстелі жаңартылды.`,
            overview: "Шолу",
            menu: "Мәзір",
            tables: "Үстелдер және QR",
            branding: "Бренд",
            summaryMenu: "Мәзірдегі тағамдар",
            summaryMenuDetail: (count: number) => `${count} тағам қонаққа қазір қолжетімді`,
            summaryStopList: "Стоп-парақ",
            summaryStopListDetail: "Қажет болса, тағамды тез қайтара аласыз",
            summaryModifiers: "Модификаторлар",
            summaryModifiersDetail: "Өлшемдер, қоспалар, тұздықтар және басқа опциялар",
            summaryTables: "Үстелдер",
            summaryTablesDetail: "Әр QR қонақты кездейсоқ сессияға апарады",
            quickActions: "Жылдам әрекеттер",
            improveNow: "Қазір не жақсартуға болады",
            refreshScreen: "Экранды жаңарту",
            editMenu: "Мәзірді өңдеу",
            manageTables: "Үстелдерді басқару",
            setupBrand: "Брендті баптау",
            itemsWithoutPhotos: "фотосыз тағам",
            itemsStopList: "стоп-парақтағы тағам",
            tablesInSystem: "жүйедегі үстел",
            newEntities: "Жаңа элементтер",
            newMenuItem: "Жаңа мәзір тағамы",
            newTable: "Жаңа үстел",
            category: "Санат",
            itemName: "Тағам атауы",
            price: "Баға, ₸",
            image: "Фото сілтемесі",
            description: "Сипаттама",
            imagePlaceholder: "https://...",
            descriptionPlaceholder: "Құрамы мен ерекшелігін қысқаша жазыңыз",
            activateForGuests: "Қонақтарға бірден көрсету",
            createItem: "Тағам қосу",
            creatingItem: "Құрылып жатыр...",
            tableNumber: "Үстел нөмірі",
            tableNumberPlaceholder: "Мысалы: VIP-3 немесе 12",
            tableHint:
              "Құрылғаннан кейін үстел QR бөлімінде бірден пайда болады. Қонақ QR-ды ашады, ал жүйе оны кездейсоқ сессия адресіне жібереді.",
            createTable: "Үстел қосу",
            creatingTable: "Құрылып жатыр...",
            searchPlaceholder: "Атау, сипаттама немесе модификатор бойынша іздеу",
            all: "Барлығы",
            active: "Белсенді",
            inactive: "Стоп-парақ",
            sort: "Сұрыптау",
            sortActiveFirst: "Алдымен белсенді",
            sortName: "Атауы бойынша",
            sortPriceHigh: "Алдымен қымбат",
            sortPriceLow: "Алдымен арзан",
            categoryFilter: "Санат сүзгісі",
            foundItems: (filtered: number, total: number) => `${filtered} / ${total} тағам табылды`,
            noItems: "Бұл сүзгі бойынша ештеңе табылмады.",
            guestEntry: "Қонақтың кіру сілтемесі",
            guestEntryHint:
              "Басып шығару үшін `/table/...` кіру сілтемесін пайдаланыңыз. Қонақ кіргеннен кейін адрес кездейсоқ сессия URL-іне ауысады.",
            copyLink: "Сілтемені көшіру",
            downloadQr: "QR жүктеу",
            saveTable: "Үстелді сақтау",
            saving: "Сақталуда...",
            brandSettings: "Бренд және баптаулар",
            restaurantName: "Мейрамхана атауы",
            accentColor: "Акцент түсі",
            serviceRate: "Сервис ақысы, %",
            coverImage: "Мәзір мұқабасы",
            saveBrand: "Брендті сақтау",
            preview: "Алдын ала қарау",
            visibleToGuest: copy.common.visibleToGuest,
            previewHint: (percent: number) =>
              `Сервис ақысы ${percent}%. Акцент түсі QR мен негізгі батырмаларда қолданылады.`,
            createCopy: "Көшірме жасау",
            copying: "Көшірілуде...",
            save: copy.common.save,
            moveToStopList: "Стоп-параққа",
            restore: "Қайтару",
            noCover: copy.common.noCover,
            noModifiers: "Мұнда әлі модификатор жоқ. Өлшем, тұздық немесе қоспа қосуға болады.",
            modifiers: "Модификаторлар",
            newModifier: "Жаңа модификатор",
            modifierName: "Модификатор атауы",
            modifierPlaceholder: "Мысалы: extra cheese",
            surcharge: "Үстеме ақы, ₸",
            sortOrder: "Реті",
            availableNow: copy.common.available,
            addModifier: "Модификатор қосу",
            addingModifier: "Қосылуда...",
            categoryPreview: "Санат",
          }
        : {
            title: "Админка",
            subtitle: "Меню, столы, QR и бренд",
            menuCount: (count: number) => `${count} позиций`,
            genericError: "Не удалось выполнить действие.",
            savedSettings: "Настройки ресторана сохранены.",
            copiedLink: "Ссылка скопирована.",
            menuItemSaved: (name: string) => `Позиция "${name}" обновлена.`,
            menuItemCopied: (name: string) => `Создана копия "${name}" в стоп-листе.`,
            modifierAdded: (name: string) => `Модификатор "${name}" добавлен.`,
            modifierSaved: (name: string) => `Модификатор "${name}" сохранен.`,
            itemAdded: (name: string) => `Позиция "${name}" добавлена.`,
            tableCreated: (name: string) => `Стол ${name} создан.`,
            tableSaved: (name: string) => `Стол ${name} обновлен.`,
            overview: "Обзор",
            menu: "Меню",
            tables: "Столы и QR",
            branding: "Бренд",
            summaryMenu: "Позиции меню",
            summaryMenuDetail: (count: number) => `${count} доступны гостю прямо сейчас`,
            summaryStopList: "Стоп-лист",
            summaryStopListDetail: "Можно быстро вернуть позиции в продажу",
            summaryModifiers: "Модификаторы",
            summaryModifiersDetail: "Размеры, добавки, соусы и прочие опции",
            summaryTables: "Столы",
            summaryTablesDetail: "Каждый QR открывает входную ссылку и переводит гостя в случайную сессию",
            quickActions: "Быстрые действия",
            improveNow: "Что улучшить сейчас",
            refreshScreen: "Обновить экран",
            editMenu: "Править меню",
            manageTables: "Управлять столами",
            setupBrand: "Настроить бренд",
            itemsWithoutPhotos: "позиций без фото",
            itemsStopList: "позиций в стоп-листе",
            tablesInSystem: "столов в системе",
            newEntities: "Новые элементы",
            newMenuItem: "Новая позиция меню",
            newTable: "Новый стол",
            category: "Категория",
            itemName: "Название блюда",
            price: "Цена, ₸",
            image: "Ссылка на фото",
            description: "Описание",
            imagePlaceholder: "https://...",
            descriptionPlaceholder: "Коротко расскажите, что внутри и чем блюдо выделяется",
            activateForGuests: "Сразу показывать гостям",
            createItem: "Добавить позицию",
            creatingItem: "Создаем...",
            tableNumber: "Номер стола",
            tableNumberPlaceholder: "Например: VIP-3 или 12",
            tableHint:
              "После создания стол сразу появится в разделе QR. Гость откроет QR, а система переведет его на случайный адрес сессии.",
            createTable: "Добавить стол",
            creatingTable: "Создаем...",
            searchPlaceholder: "Искать по названию, описанию или модификаторам",
            all: "Все",
            active: "Активные",
            inactive: "Стоп-лист",
            sort: "Сортировка",
            sortActiveFirst: "Сначала активные",
            sortName: "По названию",
            sortPriceHigh: "Сначала дорогие",
            sortPriceLow: "Сначала дешевые",
            categoryFilter: "Фильтр по категории",
            foundItems: (filtered: number, total: number) => `Найдено ${filtered} из ${total} позиций`,
            noItems: "По текущему фильтру ничего не найдено.",
            guestEntry: "Входная ссылка гостя",
            guestEntryHint:
              "Для печати используйте входные ссылки `/table/...`. После входа адрес гостя меняется на случайный URL сессии.",
            copyLink: "Копировать ссылку",
            downloadQr: "Скачать QR",
            saveTable: "Сохранить стол",
            saving: "Сохраняем...",
            brandSettings: "Бренд и настройки",
            restaurantName: "Название ресторана",
            accentColor: "Акцентный цвет",
            serviceRate: "Сервисный сбор, %",
            coverImage: "Обложка меню",
            saveBrand: "Сохранить бренд",
            preview: "Предпросмотр",
            visibleToGuest: copy.common.visibleToGuest,
            previewHint: (percent: number) =>
              `Сервисный сбор ${percent}%. Акцентный цвет используется в QR и на ключевых кнопках.`,
            createCopy: "Создать копию",
            copying: "Копируем...",
            save: copy.common.save,
            moveToStopList: "В стоп-лист",
            restore: "Вернуть",
            noCover: copy.common.noCover,
            noModifiers: "Пока нет модификаторов. Можно добавить размер, соус или добавки.",
            modifiers: "Модификаторы",
            newModifier: "Новый модификатор",
            modifierName: "Название модификатора",
            modifierPlaceholder: "Например: extra cheese",
            surcharge: "Доплата, ₸",
            sortOrder: "Порядок",
            availableNow: copy.common.available,
            addModifier: "Добавить модификатор",
            addingModifier: "Добавляем...",
            categoryPreview: "Категория",
          },
    [copy.common.available, copy.common.noCover, copy.common.save, copy.common.visibleToGuest, language],
  );

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeoutId = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    let active = true;

    Promise.all(
      tables.map(async (table) => {
        const dataUrl = await QRCode.toDataURL(`${baseUrl}/table/${table.id}`, {
          margin: 1,
          width: 320,
          color: {
            dark: settings.accentColor,
            light: "#ffffff",
          },
        });

        return [table.id, dataUrl] as const;
      }),
    )
      .then((entries) => {
        if (active) setQrCodes(Object.fromEntries(entries));
      })
      .catch(() => {
        if (active) setQrCodes({});
      });

    return () => {
      active = false;
    };
  }, [baseUrl, settings.accentColor, tables]);

  const menuMetrics = useMemo(() => {
    const activeItems = menu.filter((item) => item.active).length;
    const inactiveItems = menu.length - activeItems;
    const itemsWithoutImage = menu.filter((item) => !item.image).length;
    const modifierCount = menu.reduce((sum, item) => sum + item.modifiers.length, 0);

    return {
      activeItems,
      inactiveItems,
      itemsWithoutImage,
      modifierCount,
    };
  }, [menu]);

  const filteredMenu = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();

    return [...menu]
      .filter((item) => {
        const matchesStatus =
          menuStatusFilter === "all"
            ? true
            : menuStatusFilter === "active"
              ? item.active
              : !item.active;
        const matchesCategory = menuCategoryFilter === "all" || item.category === menuCategoryFilter;

        if (!matchesStatus || !matchesCategory) return false;
        if (!query) return true;

        const haystack = [item.name, item.description ?? "", ...item.modifiers.map((modifier) => modifier.name)]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
      .sort((left, right) => {
        if (menuSort === "name") return left.name.localeCompare(right.name, language === "kk" ? "kk" : "ru");
        if (menuSort === "price-high") return right.price - left.price;
        if (menuSort === "price-low") return left.price - right.price;
        if (left.active !== right.active) return Number(right.active) - Number(left.active);
        return left.name.localeCompare(right.name, language === "kk" ? "kk" : "ru");
      });
  }, [deferredSearch, language, menu, menuCategoryFilter, menuSort, menuStatusFilter]);

  async function loadDashboard() {
    setLoading(true);
    setErrorMessage(null);

    try {
      const [menuData, tableData, settingsData] = await Promise.all([
        listAdminMenu(),
        listTables(),
        getSettings(),
      ]);

      setMenu(menuData);
      setTables(tableData);
      setSettings(settingsData);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : screenCopy.genericError);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setSavingSettings(true);
    setErrorMessage(null);

    try {
      const updated = await updateSettings(settings);
      setSettings(updated);
      setNotice(screenCopy.savedSettings);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : screenCopy.genericError);
    } finally {
      setSavingSettings(false);
    }
  }

  async function saveMenuItem(
    id: number,
    input: Partial<Pick<MenuItem, "category" | "name" | "price" | "description" | "image" | "active">>,
  ) {
    setErrorMessage(null);

    try {
      const updated = await updateMenuItem(id, input);
      setMenu((current) => current.map((item) => (item.id === id ? updated : item)));
      setNotice(screenCopy.menuItemSaved(updated.name));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : screenCopy.genericError);
      throw error;
    }
  }

  async function duplicateMenuItem(item: MenuItem) {
    setErrorMessage(null);

    try {
      const suffix = language === "kk" ? " (көшірме)" : " (копия)";
      const created = await createMenuItem({
        category: item.category,
        name: `${item.name}${suffix}`.slice(0, 120),
        price: toDbMoney(item.price),
        description: item.description,
        image: item.image,
        active: false,
      });

      if (item.modifiers.length > 0) {
        for (const modifier of item.modifiers) {
          await createMenuModifier(created.id, {
            name: modifier.name,
            priceDelta: toDbMoney(modifier.priceDelta),
            active: modifier.active,
            sortOrder: modifier.sortOrder,
          });
        }

        setMenu(await listAdminMenu());
      } else {
        setMenu((current) => [created, ...current]);
      }

      setNotice(screenCopy.menuItemCopied(item.name));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : screenCopy.genericError);
      throw error;
    }
  }

  async function createModifierForItem(
    menuItemId: number,
    input: Pick<MenuModifier, "name" | "priceDelta" | "active" | "sortOrder">,
  ) {
    setErrorMessage(null);

    try {
      const created = await createMenuModifier(menuItemId, input);
      setMenu((current) =>
        current.map((item) =>
          item.id === menuItemId
            ? {
                ...item,
                modifiers: [...item.modifiers, created].sort((left, right) =>
                  left.sortOrder === right.sortOrder ? left.id - right.id : left.sortOrder - right.sortOrder,
                ),
              }
            : item,
        ),
      );
      setNotice(screenCopy.modifierAdded(created.name));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : screenCopy.genericError);
      throw error;
    }
  }

  async function saveModifier(
    modifierId: number,
    input: Partial<Pick<MenuModifier, "name" | "priceDelta" | "active" | "sortOrder">>,
  ) {
    setErrorMessage(null);

    try {
      const updated = await updateMenuModifier(modifierId, input);
      setMenu((current) =>
        current.map((item) =>
          item.id === updated.menuItemId
            ? {
                ...item,
                modifiers: item.modifiers
                  .map((modifier) => (modifier.id === modifierId ? updated : modifier))
                  .sort((left, right) =>
                    left.sortOrder === right.sortOrder ? left.id - right.id : left.sortOrder - right.sortOrder,
                  ),
              }
            : item,
        ),
      );
      setNotice(screenCopy.modifierSaved(updated.name));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : screenCopy.genericError);
      throw error;
    }
  }

  async function submitNewItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingItem(true);
    setErrorMessage(null);

    try {
      const created = await createMenuItem({
        category: newItem.category,
        name: newItem.name.trim(),
        price: toDbMoney(Number(newItem.price || 0)),
        description: newItem.description.trim() || null,
        image: newItem.image.trim() || null,
        active: newItem.active,
      });

      setMenu((current) => [created, ...current]);
      setNewItem({
        category: "hot",
        name: "",
        price: "",
        description: "",
        image: "",
        active: true,
      });
      setNotice(screenCopy.itemAdded(created.name));
      setCurrentTab("menu");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : screenCopy.genericError);
    } finally {
      setCreatingItem(false);
    }
  }

  async function submitNewTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingTable(true);
    setErrorMessage(null);

    try {
      const created = await createTable({ number: newTableNumber.trim() });
      setTables((current) => [...current, created].sort((left, right) => left.number.localeCompare(right.number)));
      setNewTableNumber("");
      setNotice(screenCopy.tableCreated(created.number));
      setCurrentTab("tables");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : screenCopy.genericError);
    } finally {
      setCreatingTable(false);
    }
  }

  async function saveTableNumber(id: number, input: Partial<Pick<Table, "number">>) {
    setErrorMessage(null);

    try {
      const updated = await updateTable(id, input);
      setTables((current) => current.map((table) => (table.id === id ? updated : table)));
      setNotice(screenCopy.tableSaved(updated.number));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : screenCopy.genericError);
      throw error;
    }
  }

  async function handleCopyLink(url: string) {
    setErrorMessage(null);

    try {
      await copyText(url);
      setNotice(screenCopy.copiedLink);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : screenCopy.genericError);
    }
  }

  const tabs: Array<{ id: AdminTab; label: string; icon: ReactNode }> = [
    { id: "overview", label: screenCopy.overview, icon: <LayoutDashboard size={16} /> },
    { id: "menu", label: screenCopy.menu, icon: <UtensilsCrossed size={16} /> },
    { id: "tables", label: screenCopy.tables, icon: <QrCode size={16} /> },
    { id: "branding", label: screenCopy.branding, icon: <Palette size={16} /> },
  ];

  return (
    <DashboardShell
      title={screenCopy.title}
      subtitle={screenCopy.subtitle}
      icon="waiter"
      metaLabel={screenCopy.menuCount(menu.length)}
      notice={notice}
    >
      {errorMessage && (
        <div className="error-state">
          <span>{errorMessage}</span>
          <button className="button button-secondary" type="button" onClick={() => void loadDashboard()}>
            {copy.common.retry}
          </button>
        </div>
      )}

      {loading ? (
        <div className="loader-stack">
          <Skeleton className="loader-card" />
          <Skeleton className="loader-card" />
          <Skeleton className="loader-card" />
        </div>
      ) : (
        <div className="admin-workspace">
          <section className="admin-summary-grid">
            <MetricCard
              icon={<Store size={18} />}
              label={screenCopy.summaryMenu}
              value={String(menu.length)}
              detail={screenCopy.summaryMenuDetail(menuMetrics.activeItems)}
            />
            <MetricCard
              icon={<Power size={18} />}
              label={screenCopy.summaryStopList}
              value={String(menuMetrics.inactiveItems)}
              detail={screenCopy.summaryStopListDetail}
            />
            <MetricCard
              icon={<Settings2 size={18} />}
              label={screenCopy.summaryModifiers}
              value={String(menuMetrics.modifierCount)}
              detail={screenCopy.summaryModifiersDetail}
            />
            <MetricCard
              icon={<QrCode size={18} />}
              label={screenCopy.summaryTables}
              value={String(tables.length)}
              detail={screenCopy.summaryTablesDetail}
            />
          </section>

          <section className="admin-tabbar" aria-label={screenCopy.title}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`admin-tab ${currentTab === tab.id ? "is-active" : ""}`}
                onClick={() => setCurrentTab(tab.id)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </section>

          {currentTab === "overview" && (
            <div className="admin-overview-grid">
              <section className="admin-panel admin-panel--dense">
                <div className="section-title-row">
                  <h2>{screenCopy.quickActions}</h2>
                  <span>4</span>
                </div>
                <div className="admin-quick-actions">
                  <button className="button button-primary" type="button" onClick={() => setCurrentTab("menu")}>
                    <UtensilsCrossed size={16} />
                    {screenCopy.editMenu}
                  </button>
                  <button className="button button-secondary" type="button" onClick={() => setCurrentTab("tables")}>
                    <QrCode size={16} />
                    {screenCopy.manageTables}
                  </button>
                  <button className="button button-secondary" type="button" onClick={() => setCurrentTab("branding")}>
                    <Palette size={16} />
                    {screenCopy.setupBrand}
                  </button>
                  <button className="button button-secondary" type="button" onClick={() => void loadDashboard()}>
                    <Save size={16} />
                    {screenCopy.refreshScreen}
                  </button>
                </div>
              </section>

              <section className="admin-panel admin-panel--dense">
                <div className="section-title-row">
                  <h2>{screenCopy.improveNow}</h2>
                  <span>3</span>
                </div>
                <div className="admin-insight-list">
                  <div>
                    <strong>{menuMetrics.itemsWithoutImage}</strong>
                    <p>{screenCopy.itemsWithoutPhotos}</p>
                  </div>
                  <div>
                    <strong>{menuMetrics.inactiveItems}</strong>
                    <p>{screenCopy.itemsStopList}</p>
                  </div>
                  <div>
                    <strong>{tables.length}</strong>
                    <p>{screenCopy.tablesInSystem}</p>
                  </div>
                </div>
              </section>

              <section className="admin-panel admin-panel--dense admin-panel--span-2">
                <div className="section-title-row">
                  <h2>{screenCopy.newEntities}</h2>
                  <Plus size={18} />
                </div>
                <div className="admin-two-column">
                  <form className="admin-creation-card" onSubmit={submitNewItem}>
                    <div className="section-title-row">
                      <h3>{screenCopy.newMenuItem}</h3>
                      <span>{screenCopy.menu}</span>
                    </div>
                    <div className="admin-form-grid admin-form-grid--item">
                      <label className="admin-field">
                        <span>{screenCopy.category}</span>
                        <select
                          value={newItem.category}
                          onChange={(event) =>
                            setNewItem((current) => ({ ...current, category: event.target.value as MenuCategory }))
                          }
                        >
                          {categoryOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="admin-field">
                        <span>{screenCopy.price}</span>
                        <input
                          type="number"
                          min="0"
                          value={newItem.price}
                          onChange={(event) => setNewItem((current) => ({ ...current, price: event.target.value }))}
                        />
                      </label>
                      <label className="admin-field admin-field--span-2">
                        <span>{screenCopy.itemName}</span>
                        <input
                          value={newItem.name}
                          onChange={(event) => setNewItem((current) => ({ ...current, name: event.target.value }))}
                        />
                      </label>
                      <label className="admin-field admin-field--span-2">
                        <span>{screenCopy.image}</span>
                        <input
                          value={newItem.image}
                          onChange={(event) => setNewItem((current) => ({ ...current, image: event.target.value }))}
                          placeholder={screenCopy.imagePlaceholder}
                        />
                      </label>
                      <label className="admin-field admin-field--span-2">
                        <span>{screenCopy.description}</span>
                        <textarea
                          value={newItem.description}
                          onChange={(event) =>
                            setNewItem((current) => ({ ...current, description: event.target.value }))
                          }
                          placeholder={screenCopy.descriptionPlaceholder}
                        />
                      </label>
                    </div>
                    <label className="admin-checkbox">
                      <input
                        type="checkbox"
                        checked={newItem.active}
                        onChange={(event) => setNewItem((current) => ({ ...current, active: event.target.checked }))}
                      />
                      <span>{screenCopy.activateForGuests}</span>
                    </label>
                    <button className="button button-primary" type="submit" disabled={creatingItem}>
                      <Plus size={16} />
                      {creatingItem ? screenCopy.creatingItem : screenCopy.createItem}
                    </button>
                  </form>

                  <form className="admin-creation-card" onSubmit={submitNewTable}>
                    <div className="section-title-row">
                      <h3>{screenCopy.newTable}</h3>
                      <span>QR</span>
                    </div>
                    <label className="admin-field">
                      <span>{screenCopy.tableNumber}</span>
                      <input
                        value={newTableNumber}
                        onChange={(event) => setNewTableNumber(event.target.value)}
                        placeholder={screenCopy.tableNumberPlaceholder}
                      />
                    </label>
                    <p className="admin-helper-text">{screenCopy.tableHint}</p>
                    <button className="button button-primary" type="submit" disabled={creatingTable}>
                      <Plus size={16} />
                      {creatingTable ? screenCopy.creatingTable : screenCopy.createTable}
                    </button>
                  </form>
                </div>
              </section>
            </div>
          )}

          {currentTab === "menu" && (
            <div className="admin-section-stack">
              <section className="admin-panel admin-panel--dense">
                <div className="admin-toolbar">
                  <div className="search-box admin-search">
                    <Search size={16} />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={screenCopy.searchPlaceholder}
                    />
                  </div>

                  <div className="admin-filter-row">
                    <div className="admin-segmented-control">
                      <button
                        type="button"
                        className={menuStatusFilter === "all" ? "is-active" : ""}
                        onClick={() => setMenuStatusFilter("all")}
                      >
                        {screenCopy.all}
                      </button>
                      <button
                        type="button"
                        className={menuStatusFilter === "active" ? "is-active" : ""}
                        onClick={() => setMenuStatusFilter("active")}
                      >
                        {screenCopy.active}
                      </button>
                      <button
                        type="button"
                        className={menuStatusFilter === "inactive" ? "is-active" : ""}
                        onClick={() => setMenuStatusFilter("inactive")}
                      >
                        {screenCopy.inactive}
                      </button>
                    </div>

                    <label className="admin-select">
                      <span>{screenCopy.categoryFilter}</span>
                      <select
                        value={menuCategoryFilter}
                        onChange={(event) => setMenuCategoryFilter(event.target.value as MenuCategoryFilter)}
                      >
                        <option value="all">{screenCopy.all}</option>
                        {categoryOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="admin-select">
                      <span>{screenCopy.sort}</span>
                      <select value={menuSort} onChange={(event) => setMenuSort(event.target.value as MenuSort)}>
                        <option value="active-first">{screenCopy.sortActiveFirst}</option>
                        <option value="name">{screenCopy.sortName}</option>
                        <option value="price-high">{screenCopy.sortPriceHigh}</option>
                        <option value="price-low">{screenCopy.sortPriceLow}</option>
                      </select>
                    </label>
                  </div>
                </div>
                <p className="admin-helper-text">{screenCopy.foundItems(filteredMenu.length, menu.length)}</p>
              </section>

              <section className="admin-item-list">
                {filteredMenu.length > 0 ? (
                  filteredMenu.map((item) => (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      language={language}
                      categoryOptions={categoryOptions}
                      labels={{
                        category: screenCopy.category,
                        itemName: screenCopy.itemName,
                        price: screenCopy.price,
                        image: screenCopy.image,
                        description: screenCopy.description,
                        noCover: screenCopy.noCover,
                        stopListLabel: copy.common.stopList,
                        modifiers: screenCopy.modifiers,
                        noModifiers: screenCopy.noModifiers,
                        newModifier: screenCopy.newModifier,
                        surcharge: screenCopy.surcharge,
                        sortOrder: screenCopy.sortOrder,
                        availableNow: screenCopy.availableNow,
                        createCopy: screenCopy.createCopy,
                        copying: screenCopy.copying,
                        save: screenCopy.save,
                        saving: screenCopy.saving,
                        moveToStopList: screenCopy.moveToStopList,
                        restore: screenCopy.restore,
                        modifierPlaceholder: screenCopy.modifierPlaceholder,
                        descriptionPlaceholder: screenCopy.descriptionPlaceholder,
                        imagePlaceholder: screenCopy.imagePlaceholder,
                        availableToggle: screenCopy.availableNow,
                        addModifier: screenCopy.addModifier,
                        addingModifier: screenCopy.addingModifier,
                        modifierName: screenCopy.modifierName,
                      }}
                      onSave={saveMenuItem}
                      onDuplicate={duplicateMenuItem}
                      onCreateModifier={createModifierForItem}
                      onSaveModifier={saveModifier}
                    />
                  ))
                ) : (
                  <div className="empty-state">{screenCopy.noItems}</div>
                )}
              </section>
            </div>
          )}

          {currentTab === "tables" && (
            <div className="admin-section-stack">
              <section className="admin-panel admin-panel--dense">
                <div className="section-title-row">
                  <h2>{screenCopy.tables}</h2>
                  <span>{tables.length}</span>
                </div>
                <p className="admin-helper-text">{screenCopy.guestEntryHint}</p>
              </section>

              <section className="admin-table-grid">
                {tables.map((table) => (
                  <TableCard
                    key={table.id}
                    table={table}
                    qrCode={qrCodes[table.id]}
                    entryUrl={`${baseUrl}/table/${table.id}`}
                    labels={{
                      guestEntry: screenCopy.guestEntry,
                      tableNumber: screenCopy.tableNumber,
                      guestEntryHint: screenCopy.guestEntryHint,
                      copyLink: screenCopy.copyLink,
                      openLink: copy.common.open,
                      downloadQr: screenCopy.downloadQr,
                      saveTable: screenCopy.saveTable,
                      saving: screenCopy.saving,
                    }}
                    onSave={saveTableNumber}
                    onCopyLink={handleCopyLink}
                  />
                ))}
              </section>
            </div>
          )}

          {currentTab === "branding" && (
            <div className="admin-brand-grid">
              <section className="admin-panel admin-panel--dense">
                <div className="section-title-row">
                  <h2>{screenCopy.brandSettings}</h2>
                  <Palette size={18} />
                </div>
                <div className="admin-form-grid">
                  <label className="admin-field">
                    <span>{screenCopy.restaurantName}</span>
                    <input
                      value={settings.name}
                      onChange={(event) => setSettings((current) => ({ ...current, name: event.target.value }))}
                    />
                  </label>

                  <label className="admin-field">
                    <span>{screenCopy.accentColor}</span>
                    <div className="admin-color-field">
                      <input
                        type="color"
                        value={settings.accentColor}
                        onChange={(event) => setSettings((current) => ({ ...current, accentColor: event.target.value }))}
                      />
                      <input
                        value={settings.accentColor}
                        onChange={(event) => setSettings((current) => ({ ...current, accentColor: event.target.value }))}
                      />
                    </div>
                  </label>

                  <label className="admin-field">
                    <span>{screenCopy.serviceRate}</span>
                    <input
                      type="number"
                      min="0"
                      max="25"
                      value={Math.round(settings.serviceRate * 100)}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          serviceRate: Number(event.target.value || 0) / 100,
                        }))
                      }
                    />
                  </label>

                  <label className="admin-field">
                    <span>{screenCopy.coverImage}</span>
                    <input
                      value={settings.coverImage ?? ""}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          coverImage: event.target.value.trim() || null,
                        }))
                      }
                      placeholder={screenCopy.imagePlaceholder}
                    />
                  </label>
                </div>

                <button className="button button-primary" type="button" onClick={() => void saveSettings()} disabled={savingSettings}>
                  <Save size={16} />
                  {savingSettings ? screenCopy.saving : screenCopy.saveBrand}
                </button>
              </section>

              <section className="admin-panel admin-panel--dense">
                <div className="section-title-row">
                  <h2>{screenCopy.preview}</h2>
                  <span>{copy.common.live}</span>
                </div>
                <article className="admin-brand-preview">
                  <div
                    className="admin-brand-preview__cover"
                    style={
                      settings.coverImage
                        ? {
                            backgroundImage: `linear-gradient(rgba(23, 33, 28, 0.28), rgba(23, 33, 28, 0.48)), url(${settings.coverImage})`,
                          }
                        : { backgroundColor: settings.accentColor }
                    }
                  />
                  <div className="admin-brand-preview__body">
                    <div className="brand-mark" style={{ color: settings.accentColor }}>
                      <Palette size={22} />
                    </div>
                    <div>
                      <p className="eyebrow">{screenCopy.visibleToGuest}</p>
                      <h3>{settings.name}</h3>
                      <p className="admin-helper-text">{screenCopy.previewHint(Math.round(settings.serviceRate * 100))}</p>
                    </div>
                  </div>
                </article>
              </section>
            </div>
          )}
        </div>
      )}
    </DashboardShell>
  );
}
