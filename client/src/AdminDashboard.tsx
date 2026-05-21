import { type ChangeEvent, type FormEvent, type ReactNode, useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import { motion } from "framer-motion";
import QRCode from "qrcode";
import {
  Copy,
  Download,
  ExternalLink,
  ImagePlus,
  LayoutDashboard,
  Palette,
  Plus,
  Power,
  QrCode,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Sparkles,
  Store,
  Trash2,
  Upload,
  UtensilsCrossed,
  X,
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
  uploadAdminImage,
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

interface DraftModifier {
  id: string;
  name: string;
  priceDelta: string;
  sortOrder: string;
  active: boolean;
}

interface AdminScreenCopy {
  title: string;
  subtitle: string;
  heroBadge: string;
  heroTitle: string;
  heroText: string;
  overview: string;
  menu: string;
  tables: string;
  branding: string;
  menuCount: (count: number) => string;
  summaryMenu: string;
  summaryMenuDetail: (count: number) => string;
  summaryStopList: string;
  summaryStopListDetail: string;
  summaryModifiers: string;
  summaryModifiersDetail: string;
  summaryTables: string;
  summaryTablesDetail: string;
  refreshScreen: string;
  editMenu: string;
  manageTables: string;
  setupBrand: string;
  focusTitle: string;
  focusPhotos: string;
  focusStopList: string;
  focusTables: string;
  focusEmpty: string;
  menuBuilder: string;
  itemCatalog: string;
  brandStudio: string;
  livePreview: string;
  newMenuItem: string;
  newTable: string;
  category: string;
  itemName: string;
  price: string;
  description: string;
  photo: string;
  selectPhoto: string;
  replacePhoto: string;
  removePhoto: string;
  photoHint: string;
  photoReady: string;
  uploadingPhoto: string;
  descriptionPlaceholder: string;
  activateForGuests: string;
  createItem: string;
  creatingItem: string;
  tableNumber: string;
  tableNumberPlaceholder: string;
  createTable: string;
  creatingTable: string;
  searchPlaceholder: string;
  all: string;
  active: string;
  inactive: string;
  sort: string;
  sortActiveFirst: string;
  sortName: string;
  sortPriceHigh: string;
  sortPriceLow: string;
  categoryFilter: string;
  foundItems: (filtered: number, total: number) => string;
  noItems: string;
  save: string;
  saving: string;
  reset: string;
  moveToStopList: string;
  restore: string;
  stopListLabel: string;
  modifiers: string;
  noModifiers: string;
  addModifier: string;
  addingModifier: string;
  modifierName: string;
  modifierPlaceholder: string;
  surcharge: string;
  sortOrder: string;
  draftModifiers: string;
  draftModifierHint: string;
  remove: string;
  availableNow: string;
  guestEntry: string;
  copyLink: string;
  downloadQr: string;
  linkLabel: string;
  saveTable: string;
  restaurantName: string;
  accentColor: string;
  serviceRate: string;
  coverImage: string;
  saveBrand: string;
  previewHint: (percent: number) => string;
  genericError: string;
  copiedLink: string;
  savedSettings: string;
  menuItemSaved: (name: string) => string;
  modifierAdded: (name: string) => string;
  modifierSaved: (name: string) => string;
  itemAdded: (name: string) => string;
  tableCreated: (name: string) => string;
  tableSaved: (name: string) => string;
  imageTypeError: string;
  imageSizeError: string;
}

const defaultSettings: RestaurantSettings = {
  name: "Demo Bistro",
  accentColor: "#2f6f5e",
  coverImage: null,
  serviceRate: 0.1,
};

function toDbMoney(value: number): number {
  return value >= 1000 ? value / 1000 : value;
}

function toInputMoney(value: number): string {
  return Number.isFinite(value) ? String(value) : "";
}

function trimOrNull(value: string): null | string {
  const next = value.trim();
  return next.length > 0 ? next : null;
}

function renumberDraftModifiers(items: DraftModifier[]): DraftModifier[] {
  return items.map((item, index) => ({
    ...item,
    sortOrder: String(index + 1),
  }));
}

function createDraftModifier(name: string, priceDelta: string, active: boolean, order: number): DraftModifier {
  return {
    id: crypto.randomUUID(),
    name,
    priceDelta,
    sortOrder: String(order),
    active,
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
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
    <motion.article
      className="admin-summary-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <div className="admin-summary-card__icon">{icon}</div>
      <div className="admin-summary-card__copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{detail}</p>
      </div>
    </motion.article>
  );
}

function ImageUploadField({
  label,
  value,
  emptyLabel,
  uploadLabel,
  replaceLabel,
  removeLabel,
  hint,
  readyLabel,
  uploadingLabel,
  uploading,
  onFileSelected,
  onClear,
}: {
  label: string;
  value: string;
  emptyLabel: string;
  uploadLabel: string;
  replaceLabel: string;
  removeLabel: string;
  hint: string;
  readyLabel: string;
  uploadingLabel: string;
  uploading: boolean;
  onFileSelected: (file: File) => Promise<void>;
  onClear: () => void;
}) {
  const inputId = useId();

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      await onFileSelected(file);
    } catch {
      // Ошибка уже обрабатывается родителем и показывается в интерфейсе.
    }
  }

  return (
    <div className="admin-upload-field">
      <div className="admin-upload-field__top">
        <span>{label}</span>
        {value && (
          <button className="admin-upload-field__remove" type="button" onClick={onClear}>
            <Trash2 size={14} />
            {removeLabel}
          </button>
        )}
      </div>

      <div className={`admin-upload ${value ? "has-image" : ""}`}>
        <div className="admin-upload__preview">
          {value ? (
            <img src={value} alt={label} />
          ) : (
            <div className="admin-upload__empty">
              <ImagePlus size={28} />
              <span>{emptyLabel}</span>
            </div>
          )}
        </div>

        <div className="admin-upload__content">
          <strong>{value ? readyLabel : hint}</strong>
          <p>{hint}</p>
          <div className="admin-upload__actions">
            <label className="button button-secondary admin-upload__button" htmlFor={inputId}>
              <Upload size={16} />
              {uploading ? uploadingLabel : value ? replaceLabel : uploadLabel}
            </label>
            <input
              id={inputId}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(event) => {
                void handleFileChange(event);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ModifierEditor({
  modifier,
  language,
  screenCopy,
  onSave,
}: {
  modifier: MenuModifier;
  language: "ru" | "kk";
  screenCopy: AdminScreenCopy;
  onSave: (
    modifierId: number,
    input: Partial<Pick<MenuModifier, "name" | "priceDelta" | "active" | "sortOrder">>,
  ) => Promise<void>;
}) {
  const [draft, setDraft] = useState({
    name: modifier.name,
    priceDelta: toInputMoney(modifier.priceDelta),
    sortOrder: String(modifier.sortOrder),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft({
      name: modifier.name,
      priceDelta: toInputMoney(modifier.priceDelta),
      sortOrder: String(modifier.sortOrder),
    });
  }, [modifier]);

  const canSubmit = draft.name.trim().length > 0 && Number(draft.priceDelta || 0) >= 0;
  const isDirty =
    draft.name.trim() !== modifier.name ||
    Number(draft.priceDelta || 0) !== modifier.priceDelta ||
    Number(draft.sortOrder || 0) !== modifier.sortOrder;

  function buildPayload(active = modifier.active) {
    return {
      name: draft.name.trim(),
      priceDelta: toDbMoney(Number(draft.priceDelta || 0)),
      sortOrder: Number(draft.sortOrder || 0),
      active,
    };
  }

  async function handleSave() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await onSave(modifier.id, buildPayload());
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await onSave(modifier.id, buildPayload(!modifier.active));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`admin-modifier-card ${modifier.active ? "" : "is-disabled"}`}>
      <div className="admin-modifier-card__headline">
        <div>
          <p className="eyebrow">{screenCopy.modifiers}</p>
          <h4>{modifier.name}</h4>
        </div>
        <span className={`admin-status-pill ${modifier.active ? "is-active" : "is-muted"}`}>
          {modifier.active ? screenCopy.active : screenCopy.stopListLabel}
        </span>
      </div>

      <div className="admin-modifier-card__grid">
        <label className="admin-field">
          <span>{screenCopy.modifierName}</span>
          <input
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          />
        </label>

        <label className="admin-field">
          <span>{screenCopy.surcharge}</span>
          <input
            type="number"
            min="0"
            value={draft.priceDelta}
            onChange={(event) => setDraft((current) => ({ ...current, priceDelta: event.target.value }))}
          />
        </label>

        <label className="admin-field">
          <span>{screenCopy.sortOrder}</span>
          <input
            type="number"
            min="0"
            value={draft.sortOrder}
            onChange={(event) => setDraft((current) => ({ ...current, sortOrder: event.target.value }))}
          />
        </label>
      </div>

      <div className="admin-card-note">
        <strong>{formatMoney(modifier.priceDelta, language)}</strong>
        <span>{modifier.active ? screenCopy.availableNow : screenCopy.stopListLabel}</span>
      </div>

      <div className="admin-modifier-card__actions">
        <button
          className={`button ${modifier.active ? "button-secondary" : "button-primary"}`}
          type="button"
          onClick={() => void handleToggle()}
          disabled={saving || !canSubmit}
        >
          <Power size={16} />
          {modifier.active ? screenCopy.moveToStopList : screenCopy.restore}
        </button>

        <button
          className="button button-secondary"
          type="button"
          onClick={() =>
            setDraft({
              name: modifier.name,
              priceDelta: toInputMoney(modifier.priceDelta),
              sortOrder: String(modifier.sortOrder),
            })
          }
          disabled={!isDirty || saving}
        >
          <X size={16} />
          {screenCopy.reset}
        </button>

        <button
          className="button button-primary"
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !isDirty || !canSubmit}
        >
          <Save size={16} />
          {saving ? screenCopy.saving : screenCopy.save}
        </button>
      </div>
    </div>
  );
}

function MenuItemCard({
  item,
  language,
  categoryOptions,
  screenCopy,
  onSave,
  onCreateModifier,
  onSaveModifier,
  onUploadImage,
}: {
  item: MenuItem;
  language: "ru" | "kk";
  categoryOptions: Array<{ id: MenuCategory; label: string }>;
  screenCopy: AdminScreenCopy;
  onSave: (
    id: number,
    input: Partial<Pick<MenuItem, "category" | "name" | "price" | "description" | "image" | "active">>,
  ) => Promise<void>;
  onCreateModifier: (
    menuItemId: number,
    input: Pick<MenuModifier, "name" | "priceDelta" | "active" | "sortOrder">,
  ) => Promise<void>;
  onSaveModifier: (
    modifierId: number,
    input: Partial<Pick<MenuModifier, "name" | "priceDelta" | "active" | "sortOrder">>,
  ) => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
}) {
  const [draft, setDraft] = useState({
    category: item.category,
    name: item.name,
    price: toInputMoney(item.price),
    description: item.description ?? "",
    image: item.image ?? "",
  });
  const [newModifier, setNewModifier] = useState({
    name: "",
    priceDelta: "",
    active: true,
  });
  const [saving, setSaving] = useState(false);
  const [creatingModifier, setCreatingModifier] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    setDraft({
      category: item.category,
      name: item.name,
      price: toInputMoney(item.price),
      description: item.description ?? "",
      image: item.image ?? "",
    });
    setNewModifier({
      name: "",
      priceDelta: "",
      active: true,
    });
  }, [item]);

  const canSubmit = draft.name.trim().length >= 2 && Number(draft.price || 0) > 0;
  const isDirty =
    draft.category !== item.category ||
    draft.name.trim() !== item.name ||
    Number(draft.price || 0) !== item.price ||
    draft.description.trim() !== (item.description ?? "") ||
    draft.image.trim() !== (item.image ?? "");

  function buildPayload(active = item.active) {
    return {
      category: draft.category,
      name: draft.name.trim(),
      price: toDbMoney(Number(draft.price || 0)),
      description: trimOrNull(draft.description),
      image: trimOrNull(draft.image),
      active,
    };
  }

  async function handleSave() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await onSave(item.id, buildPayload());
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await onSave(item.id, buildPayload(!item.active));
    } finally {
      setSaving(false);
    }
  }

  async function handleImageUpload(file: File) {
    setUploadingImage(true);
    try {
      const url = await onUploadImage(file);
      setDraft((current) => ({ ...current, image: url }));
    } finally {
      setUploadingImage(false);
    }
  }

  async function submitModifier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newModifier.name.trim().length === 0) return;

    setCreatingModifier(true);
    try {
      await onCreateModifier(item.id, {
        name: newModifier.name.trim(),
        priceDelta: toDbMoney(Number(newModifier.priceDelta || 0)),
        active: newModifier.active,
        sortOrder: item.modifiers.length + 1,
      });

      setNewModifier({
        name: "",
        priceDelta: "",
        active: true,
      });
    } finally {
      setCreatingModifier(false);
    }
  }

  return (
    <motion.article
      className={`admin-item-card ${item.active ? "" : "is-disabled"}`}
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: "easeOut" }}
    >
      <div className="admin-item-card__preview">
        {draft.image ? (
          <img src={draft.image} alt={draft.name || item.name} />
        ) : (
          <div className="admin-item-card__placeholder">
            <ImagePlus size={28} />
            <span>{screenCopy.photoHint}</span>
          </div>
        )}
      </div>

      <div className="admin-item-card__body">
        <div className="admin-item-card__header">
          <div>
            <p className="eyebrow">
              {categoryOptions.find((option) => option.id === item.category)?.label ?? item.category}
            </p>
            <h3>{item.name}</h3>
          </div>

          <div className="admin-badge-strip">
            <span className={`admin-status-pill ${item.active ? "is-active" : "is-muted"}`}>
              {item.active ? screenCopy.availableNow : screenCopy.stopListLabel}
            </span>
            <span className="soft-pill">{screenCopy.modifiers}: {item.modifiers.length}</span>
          </div>
        </div>

        <div className="admin-card-note">
          <strong>{formatMoney(item.price, language)}</strong>
          <span>{item.description ?? screenCopy.descriptionPlaceholder}</span>
        </div>

        <div className="admin-form-grid admin-form-grid--item">
          <label className="admin-field">
            <span>{screenCopy.category}</span>
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
            <span>{screenCopy.price}</span>
            <input
              type="number"
              min="0"
              value={draft.price}
              onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))}
            />
          </label>

          <label className="admin-field admin-field--span-2">
            <span>{screenCopy.itemName}</span>
            <input
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            />
          </label>

          <label className="admin-field admin-field--span-2">
            <span>{screenCopy.description}</span>
            <textarea
              value={draft.description}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              placeholder={screenCopy.descriptionPlaceholder}
            />
          </label>
        </div>

        <ImageUploadField
          label={screenCopy.photo}
          value={draft.image}
          emptyLabel={screenCopy.photoHint}
          uploadLabel={screenCopy.selectPhoto}
          replaceLabel={screenCopy.replacePhoto}
          removeLabel={screenCopy.removePhoto}
          hint={screenCopy.photoHint}
          readyLabel={screenCopy.photoReady}
          uploadingLabel={screenCopy.uploadingPhoto}
          uploading={uploadingImage}
          onFileSelected={handleImageUpload}
          onClear={() => setDraft((current) => ({ ...current, image: "" }))}
        />

        <div className="admin-item-card__actions">
          <button
            className={`button ${item.active ? "button-secondary" : "button-primary"}`}
            type="button"
            onClick={() => void handleToggleActive()}
            disabled={saving || !canSubmit}
          >
            <Power size={16} />
            {item.active ? screenCopy.moveToStopList : screenCopy.restore}
          </button>

          <button
            className="button button-secondary"
            type="button"
            onClick={() =>
              setDraft({
                category: item.category,
                name: item.name,
                price: toInputMoney(item.price),
                description: item.description ?? "",
                image: item.image ?? "",
              })
            }
            disabled={!isDirty || saving}
          >
            <X size={16} />
            {screenCopy.reset}
          </button>

          <button
            className="button button-primary"
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !isDirty || !canSubmit}
          >
            <Save size={16} />
            {saving ? screenCopy.saving : screenCopy.save}
          </button>
        </div>

        <section className="admin-modifier-section">
          <div className="section-title-row">
            <h3>{screenCopy.modifiers}</h3>
            <span>{item.modifiers.length}</span>
          </div>

          {item.modifiers.length > 0 ? (
            <div className="admin-modifier-list-grid">
              {item.modifiers.map((modifier) => (
                <ModifierEditor
                  key={modifier.id}
                  modifier={modifier}
                  language={language}
                  screenCopy={screenCopy}
                  onSave={onSaveModifier}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">{screenCopy.noModifiers}</div>
          )}

          <form className="admin-inline-form" onSubmit={(event) => void submitModifier(event)}>
            <label className="admin-field">
              <span>{screenCopy.modifierName}</span>
              <input
                value={newModifier.name}
                onChange={(event) => setNewModifier((current) => ({ ...current, name: event.target.value }))}
                placeholder={screenCopy.modifierPlaceholder}
              />
            </label>

            <label className="admin-field">
              <span>{screenCopy.surcharge}</span>
              <input
                type="number"
                min="0"
                value={newModifier.priceDelta}
                onChange={(event) => setNewModifier((current) => ({ ...current, priceDelta: event.target.value }))}
              />
            </label>

            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={newModifier.active}
                onChange={(event) => setNewModifier((current) => ({ ...current, active: event.target.checked }))}
              />
              <span>{screenCopy.availableNow}</span>
            </label>

            <button
              className="button button-primary"
              type="submit"
              disabled={creatingModifier || newModifier.name.trim().length === 0}
            >
              <Plus size={16} />
              {creatingModifier ? screenCopy.addingModifier : screenCopy.addModifier}
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
  screenCopy,
  openLabel,
  onSave,
  onCopyLink,
}: {
  table: Table;
  qrCode?: string;
  entryUrl: string;
  screenCopy: AdminScreenCopy;
  openLabel: string;
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
    <motion.article
      className="admin-table-card"
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
    >
      <div className="admin-table-card__qr">
        {qrCode ? <img src={qrCode} alt={`QR ${table.number}`} /> : <Skeleton className="admin-table-card__qr-skeleton" />}
      </div>

      <div className="admin-table-card__body">
        <div className="admin-table-card__header">
          <div>
            <p className="eyebrow">{screenCopy.guestEntry}</p>
            <h3>{table.number}</h3>
          </div>
          <span className="soft-pill">ID {table.id}</span>
        </div>

        <label className="admin-field">
          <span>{screenCopy.tableNumber}</span>
          <input value={number} onChange={(event) => setNumber(event.target.value)} />
        </label>

        <label className="admin-field">
          <span>{screenCopy.linkLabel}</span>
          <input value={entryUrl} readOnly />
        </label>

        <div className="admin-table-card__actions">
          <button className="button button-secondary" type="button" onClick={() => void onCopyLink(entryUrl)}>
            <Copy size={16} />
            {screenCopy.copyLink}
          </button>

          <a className="button button-secondary" href={entryUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={16} />
            {openLabel}
          </a>

          {qrCode && (
            <a className="button button-secondary" href={qrCode} download={`table-${table.number}-qr.png`}>
              <Download size={16} />
              {screenCopy.downloadQr}
            </a>
          )}

          <button className="button button-primary" type="button" onClick={() => void saveTableNumber()} disabled={saving}>
            <Save size={16} />
            {saving ? screenCopy.saving : screenCopy.saveTable}
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
  const [newItemModifierDraft, setNewItemModifierDraft] = useState({
    name: "",
    priceDelta: "",
    active: true,
  });
  const [newItemModifiers, setNewItemModifiers] = useState<DraftModifier[]>([]);
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
  const [newItemImageBusy, setNewItemImageBusy] = useState(false);
  const [coverImageBusy, setCoverImageBusy] = useState(false);

  const deferredSearch = useDeferredValue(search);
  const baseUrl = useMemo(() => window.location.origin, []);

  const screenCopy = useMemo<AdminScreenCopy>(
    () =>
      language === "kk"
        ? {
            title: "Әкімші панелі",
            subtitle: "Мәзір, QR және брендті бір жерден басқарыңыз",
            heroBadge: "Басқару орталығы",
            heroTitle: "Залға керек нәрсенің бәрі бір экранда",
            heroText: "Стоп-парақ, жаңа тағамдар, модификаторлар, үстелдер және бренд баптауы осы жерден тез жаңарады.",
            overview: "Шолу",
            menu: "Мәзір",
            tables: "Үстелдер",
            branding: "Бренд",
            menuCount: (count: number) => `${count} позиция`,
            summaryMenu: "Мәзір позициялары",
            summaryMenuDetail: (count: number) => `${count} қонаққа қазір көрініп тұр`,
            summaryStopList: "Стоп-парақ",
            summaryStopListDetail: "Уақытша жабылған тағамдар",
            summaryModifiers: "Модификаторлар",
            summaryModifiersDetail: "Өлшемдер, қоспалар және үстемелер",
            summaryTables: "Үстелдер",
            summaryTablesDetail: "QR кіруі бар үстелдер",
            refreshScreen: "Жаңарту",
            editMenu: "Мәзірді өңдеу",
            manageTables: "Үстелдерді ашу",
            setupBrand: "Брендті баптау",
            focusTitle: "Қазір назар аударатын нәрсе",
            focusPhotos: "Фотосыз позициялар",
            focusStopList: "Стоп-парақтағы тағамдар",
            focusTables: "Жүйедегі үстелдер",
            focusEmpty: "Мәзір түгел, фото және қолжетімділік жақсы күйде.",
            menuBuilder: "Жаңа тағам қосу",
            itemCatalog: "Барлық мәзір",
            brandStudio: "Бренд баптауы",
            livePreview: "Тікелей алдын ала қарау",
            newMenuItem: "Жаңа мәзір позициясы",
            newTable: "Жаңа үстел",
            category: "Санат",
            itemName: "Тағам атауы",
            price: "Баға, ₸",
            description: "Сипаттама",
            photo: "Фото",
            selectPhoto: "Құрылғыдан таңдау",
            replacePhoto: "Фотоны ауыстыру",
            removePhoto: "Алып тастау",
            photoHint: "JPG, PNG немесе WebP жүктеңіз",
            photoReady: "Фото жүктелді",
            uploadingPhoto: "Жүктелуде...",
            descriptionPlaceholder: "Құрамы мен қысқа сипаттамасы",
            activateForGuests: "Қонаққа бірден көрсету",
            createItem: "Позицияны қосу",
            creatingItem: "Құрылуда...",
            tableNumber: "Үстел нөмірі",
            tableNumberPlaceholder: "Мысалы: VIP-3",
            createTable: "Үстел қосу",
            creatingTable: "Құрылуда...",
            searchPlaceholder: "Тағам, сипаттама немесе модификатор бойынша іздеу",
            all: "Барлығы",
            active: "Белсенді",
            inactive: "Стоп-парақ",
            sort: "Сұрыптау",
            sortActiveFirst: "Алдымен белсенді",
            sortName: "Атауы бойынша",
            sortPriceHigh: "Алдымен қымбат",
            sortPriceLow: "Алдымен арзан",
            categoryFilter: "Санат сүзгісі",
            foundItems: (filtered: number, total: number) => `${filtered} / ${total} позиция`,
            noItems: "Бұл сүзгіге сай позиция табылмады.",
            save: copy.common.save,
            saving: "Сақталуда...",
            reset: "Қайтару",
            moveToStopList: "Стоп-параққа",
            restore: "Қайтару",
            stopListLabel: copy.common.stopList,
            modifiers: "Модификаторлар",
            noModifiers: "Әзірге модификатор жоқ.",
            addModifier: "Модификатор қосу",
            addingModifier: "Қосылуда...",
            modifierName: "Модификатор атауы",
            modifierPlaceholder: "Мысалы: extra cheese",
            surcharge: "Үстеме, ₸",
            sortOrder: "Реті",
            draftModifiers: "Жаңа позиция модификаторлары",
            draftModifierHint: "Позиция сақталғанда осы модификаторлар бірге жасалады.",
            remove: "Өшіру",
            availableNow: copy.common.available,
            guestEntry: "Қонаққа кіру",
            copyLink: "Сілтемені көшіру",
            downloadQr: "QR жүктеу",
            linkLabel: "Кіру сілтемесі",
            saveTable: "Үстелді сақтау",
            restaurantName: "Мейрамхана атауы",
            accentColor: "Акцент түсі",
            serviceRate: "Сервис, %",
            coverImage: "Мәзір мұқабасы",
            saveBrand: "Брендті сақтау",
            previewHint: (percent: number) => `Қызмет ақысы ${percent}%. Бұл түс батырмалар мен QR аймағында көрінеді.`,
            genericError: "Әрекетті орындау мүмкін болмады.",
            copiedLink: "Сілтеме көшірілді.",
            savedSettings: "Баптаулар сақталды.",
            menuItemSaved: (name: string) => `"${name}" жаңартылды.`,
            modifierAdded: (name: string) => `"${name}" модификаторы қосылды.`,
            modifierSaved: (name: string) => `"${name}" модификаторы сақталды.`,
            itemAdded: (name: string) => `"${name}" қосылды.`,
            tableCreated: (name: string) => `${name} үстелі құрылды.`,
            tableSaved: (name: string) => `${name} үстелі жаңартылды.`,
            imageTypeError: "Тек JPG, PNG немесе WebP суретін таңдаңыз.",
            imageSizeError: "Сурет 5 МБ-тан аспауы керек.",
          }
        : {
            title: "Админ-панель",
            subtitle: "Управляйте меню, QR и брендом из одного места",
            heroBadge: "Операционный центр",
            heroTitle: "Вся админка собрана в одну понятную панель",
            heroText: "Стоп-лист, новые блюда, модификаторы, столы и внешний вид меню теперь редактируются быстрее и чище.",
            overview: "Обзор",
            menu: "Меню",
            tables: "Столы",
            branding: "Бренд",
            menuCount: (count: number) => `${count} позиций`,
            summaryMenu: "Позиции меню",
            summaryMenuDetail: (count: number) => `${count} сейчас видны гостям`,
            summaryStopList: "Стоп-лист",
            summaryStopListDetail: "Временно недоступные блюда",
            summaryModifiers: "Модификаторы",
            summaryModifiersDetail: "Размеры, добавки и доплаты",
            summaryTables: "Столы",
            summaryTablesDetail: "Точки входа по QR",
            refreshScreen: "Обновить",
            editMenu: "Править меню",
            manageTables: "Открыть столы",
            setupBrand: "Настроить бренд",
            focusTitle: "Что сейчас требует внимания",
            focusPhotos: "позиций без фото",
            focusStopList: "позиций в стоп-листе",
            focusTables: "столов в системе",
            focusEmpty: "Сейчас всё выглядит аккуратно: фото есть, стоп-лист под контролем.",
            menuBuilder: "Добавление новых блюд",
            itemCatalog: "Каталог меню",
            brandStudio: "Настройки бренда",
            livePreview: "Живой предпросмотр",
            newMenuItem: "Новая позиция",
            newTable: "Новый стол",
            category: "Категория",
            itemName: "Название блюда",
            price: "Цена, ₸",
            description: "Описание",
            photo: "Фото",
            selectPhoto: "Выбрать с устройства",
            replacePhoto: "Заменить фото",
            removePhoto: "Убрать фото",
            photoHint: "Загрузите JPG, PNG или WebP",
            photoReady: "Фото загружено",
            uploadingPhoto: "Загружаем...",
            descriptionPlaceholder: "Коротко опишите состав и подачу",
            activateForGuests: "Сразу показывать гостям",
            createItem: "Добавить позицию",
            creatingItem: "Создаём...",
            tableNumber: "Номер стола",
            tableNumberPlaceholder: "Например: VIP-3",
            createTable: "Добавить стол",
            creatingTable: "Создаём...",
            searchPlaceholder: "Искать по названию, описанию или модификаторам",
            all: "Все",
            active: "Активные",
            inactive: "Стоп-лист",
            sort: "Сортировка",
            sortActiveFirst: "Сначала активные",
            sortName: "По названию",
            sortPriceHigh: "Сначала дорогие",
            sortPriceLow: "Сначала дешёвые",
            categoryFilter: "Фильтр категории",
            foundItems: (filtered: number, total: number) => `Найдено ${filtered} из ${total}`,
            noItems: "По текущему фильтру ничего не найдено.",
            save: copy.common.save,
            saving: "Сохраняем...",
            reset: "Сбросить",
            moveToStopList: "В стоп-лист",
            restore: "Вернуть",
            stopListLabel: copy.common.stopList,
            modifiers: "Модификаторы",
            noModifiers: "Для этого блюда пока нет модификаторов.",
            addModifier: "Добавить модификатор",
            addingModifier: "Добавляем...",
            modifierName: "Название модификатора",
            modifierPlaceholder: "Например: extra cheese",
            surcharge: "Доплата, ₸",
            sortOrder: "Порядок",
            draftModifiers: "Модификаторы для нового блюда",
            draftModifierHint: "Они будут созданы сразу вместе с новым блюдом.",
            remove: "Удалить",
            availableNow: copy.common.available,
            guestEntry: "Вход для гостя",
            copyLink: "Копировать ссылку",
            downloadQr: "Скачать QR",
            linkLabel: "Ссылка входа",
            saveTable: "Сохранить стол",
            restaurantName: "Название ресторана",
            accentColor: "Акцентный цвет",
            serviceRate: "Сервисный сбор, %",
            coverImage: "Обложка меню",
            saveBrand: "Сохранить бренд",
            previewHint: (percent: number) => `Сервисный сбор ${percent}%. Этот цвет используется в ключевых кнопках и QR-зоне.`,
            genericError: "Не удалось выполнить действие.",
            copiedLink: "Ссылка скопирована.",
            savedSettings: "Настройки сохранены.",
            menuItemSaved: (name: string) => `Позиция "${name}" обновлена.`,
            modifierAdded: (name: string) => `Модификатор "${name}" добавлен.`,
            modifierSaved: (name: string) => `Модификатор "${name}" сохранён.`,
            itemAdded: (name: string) => `Позиция "${name}" создана.`,
            tableCreated: (name: string) => `Стол ${name} создан.`,
            tableSaved: (name: string) => `Стол ${name} обновлён.`,
            imageTypeError: "Можно выбрать только JPG, PNG или WebP.",
            imageSizeError: "Изображение должно быть не больше 5 МБ.",
          },
    [copy.common.save, copy.common.stopList, language],
  );

  const categoryOptions = useMemo(
    () => menuCategories.map((category) => ({ id: category, label: copy.categories[category] })),
    [copy.categories],
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

  const categorySnapshot = useMemo(
    () =>
      categoryOptions
        .map((option) => ({
          ...option,
          count: menu.filter((item) => item.category === option.id).length,
        }))
        .filter((option) => option.count > 0),
    [categoryOptions, menu],
  );

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

  async function uploadImageFile(file: File): Promise<string> {
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

    if (!allowedTypes.has(file.type)) {
      throw new Error(screenCopy.imageTypeError);
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error(screenCopy.imageSizeError);
    }

    const dataUrl = await readFileAsDataUrl(file);
    const uploaded = await uploadAdminImage({
      fileName: file.name,
      dataUrl,
    });

    return uploaded.url;
  }

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

  async function handleNewItemImageUpload(file: File) {
    setNewItemImageBusy(true);
    setErrorMessage(null);

    try {
      const url = await uploadImageFile(file);
      setNewItem((current) => ({ ...current, image: url }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : screenCopy.genericError);
      throw error;
    } finally {
      setNewItemImageBusy(false);
    }
  }

  async function handleCoverImageUpload(file: File) {
    setCoverImageBusy(true);
    setErrorMessage(null);

    try {
      const url = await uploadImageFile(file);
      setSettings((current) => ({ ...current, coverImage: url }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : screenCopy.genericError);
      throw error;
    } finally {
      setCoverImageBusy(false);
    }
  }

  function addDraftModifierToNewItem() {
    if (newItemModifierDraft.name.trim().length === 0) return;

    setNewItemModifiers((current) =>
      renumberDraftModifiers([
        ...current,
        createDraftModifier(
          newItemModifierDraft.name.trim(),
          newItemModifierDraft.priceDelta,
          newItemModifierDraft.active,
          current.length + 1,
        ),
      ]),
    );

    setNewItemModifierDraft({
      name: "",
      priceDelta: "",
      active: true,
    });
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
        description: trimOrNull(newItem.description),
        image: trimOrNull(newItem.image),
        active: newItem.active,
      });

      for (const modifier of newItemModifiers) {
        await createMenuModifier(created.id, {
          name: modifier.name,
          priceDelta: toDbMoney(Number(modifier.priceDelta || 0)),
          active: modifier.active,
          sortOrder: Number(modifier.sortOrder || 0),
        });
      }

      const refreshedMenu = await listAdminMenu();
      setMenu(refreshedMenu);
      setNewItem({
        category: "hot",
        name: "",
        price: "",
        description: "",
        image: "",
        active: true,
      });
      setNewItemModifiers([]);
      setNewItemModifierDraft({
        name: "",
        priceDelta: "",
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
      className="admin-shell"
      title={screenCopy.title}
      subtitle={screenCopy.subtitle}
      icon="admin"
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
          <motion.section
            className="admin-hero"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            <div className="admin-hero__content">
              <span className="soft-pill admin-hero__pill">{screenCopy.heroBadge}</span>
              <h2>{screenCopy.heroTitle}</h2>
              <p>{screenCopy.heroText}</p>
              <div className="admin-hero__actions">
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
                  <RefreshCw size={16} />
                  {screenCopy.refreshScreen}
                </button>
              </div>
            </div>

            <div className="admin-hero__stats">
              <div>
                <strong>{menuMetrics.activeItems}</strong>
                <span>{screenCopy.summaryMenu}</span>
              </div>
              <div>
                <strong>{menuMetrics.inactiveItems}</strong>
                <span>{screenCopy.summaryStopList}</span>
              </div>
              <div>
                <strong>{menuMetrics.modifierCount}</strong>
                <span>{screenCopy.summaryModifiers}</span>
              </div>
              <div>
                <strong>{tables.length}</strong>
                <span>{screenCopy.summaryTables}</span>
              </div>
            </div>
          </motion.section>

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
              <section className="admin-panel admin-panel--feature">
                <div className="section-title-row">
                  <h2>{screenCopy.focusTitle}</h2>
                  <Sparkles size={18} />
                </div>

                <div className="admin-insight-list">
                  <div>
                    <strong>{menuMetrics.itemsWithoutImage}</strong>
                    <p>{screenCopy.focusPhotos}</p>
                  </div>
                  <div>
                    <strong>{menuMetrics.inactiveItems}</strong>
                    <p>{screenCopy.focusStopList}</p>
                  </div>
                  <div>
                    <strong>{tables.length}</strong>
                    <p>{screenCopy.focusTables}</p>
                  </div>
                </div>

                {menuMetrics.itemsWithoutImage === 0 && menuMetrics.inactiveItems === 0 && (
                  <div className="admin-empty-note">{screenCopy.focusEmpty}</div>
                )}
              </section>

              <section className="admin-panel admin-panel--feature">
                <div className="section-title-row">
                  <h2>{screenCopy.menu}</h2>
                  <span>{categorySnapshot.length}</span>
                </div>
                <div className="admin-chip-cloud">
                  {categorySnapshot.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className="admin-chip-button"
                      onClick={() => {
                        setMenuCategoryFilter(category.id);
                        setCurrentTab("menu");
                      }}
                    >
                      <span>{category.label}</span>
                      <strong>{category.count}</strong>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {currentTab === "menu" && (
            <div className="admin-section-stack">
              <div className="admin-creation-grid">
                <form className="admin-creation-card admin-creation-card--menu" onSubmit={(event) => void submitNewItem(event)}>
                  <div className="section-title-row">
                    <div>
                      <p className="eyebrow">{screenCopy.menuBuilder}</p>
                      <h3>{screenCopy.newMenuItem}</h3>
                    </div>
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
                      <span>{screenCopy.description}</span>
                      <textarea
                        value={newItem.description}
                        onChange={(event) => setNewItem((current) => ({ ...current, description: event.target.value }))}
                        placeholder={screenCopy.descriptionPlaceholder}
                      />
                    </label>
                  </div>

                  <ImageUploadField
                    label={screenCopy.photo}
                    value={newItem.image}
                    emptyLabel={screenCopy.photoHint}
                    uploadLabel={screenCopy.selectPhoto}
                    replaceLabel={screenCopy.replacePhoto}
                    removeLabel={screenCopy.removePhoto}
                    hint={screenCopy.photoHint}
                    readyLabel={screenCopy.photoReady}
                    uploadingLabel={screenCopy.uploadingPhoto}
                    uploading={newItemImageBusy}
                    onFileSelected={handleNewItemImageUpload}
                    onClear={() => setNewItem((current) => ({ ...current, image: "" }))}
                  />

                  <section className="admin-modifier-section">
                    <div className="section-title-row">
                      <h3>{screenCopy.draftModifiers}</h3>
                      <span>{newItemModifiers.length}</span>
                    </div>
                    <p className="admin-helper-text">{screenCopy.draftModifierHint}</p>

                    <div className="admin-inline-form admin-inline-form--modifier-draft">
                      <label className="admin-field">
                        <span>{screenCopy.modifierName}</span>
                        <input
                          value={newItemModifierDraft.name}
                          onChange={(event) =>
                            setNewItemModifierDraft((current) => ({ ...current, name: event.target.value }))
                          }
                          placeholder={screenCopy.modifierPlaceholder}
                        />
                      </label>

                      <label className="admin-field">
                        <span>{screenCopy.surcharge}</span>
                        <input
                          type="number"
                          min="0"
                          value={newItemModifierDraft.priceDelta}
                          onChange={(event) =>
                            setNewItemModifierDraft((current) => ({ ...current, priceDelta: event.target.value }))
                          }
                        />
                      </label>

                      <label className="admin-checkbox">
                        <input
                          type="checkbox"
                          checked={newItemModifierDraft.active}
                          onChange={(event) =>
                            setNewItemModifierDraft((current) => ({ ...current, active: event.target.checked }))
                          }
                        />
                        <span>{screenCopy.availableNow}</span>
                      </label>

                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={addDraftModifierToNewItem}
                        disabled={newItemModifierDraft.name.trim().length === 0}
                      >
                        <Plus size={16} />
                        {screenCopy.addModifier}
                      </button>
                    </div>

                    {newItemModifiers.length > 0 ? (
                      <div className="admin-draft-modifiers">
                        {newItemModifiers.map((modifier) => (
                          <div key={modifier.id} className={`admin-draft-modifier ${modifier.active ? "" : "is-muted"}`}>
                            <div>
                              <strong>{modifier.name}</strong>
                              <span>
                                {formatMoney(Number(modifier.priceDelta || 0), language)} · {modifier.active ? screenCopy.availableNow : screenCopy.stopListLabel}
                              </span>
                            </div>
                            <div className="admin-draft-modifier__actions">
                              <button
                                className="button button-secondary"
                                type="button"
                                onClick={() =>
                                  setNewItemModifiers((current) =>
                                    current.map((item) =>
                                      item.id === modifier.id ? { ...item, active: !item.active } : item,
                                    ),
                                  )
                                }
                              >
                                <Power size={14} />
                                {modifier.active ? screenCopy.moveToStopList : screenCopy.restore}
                              </button>
                              <button
                                className="button button-secondary"
                                type="button"
                                onClick={() =>
                                  setNewItemModifiers((current) =>
                                    renumberDraftModifiers(current.filter((item) => item.id !== modifier.id)),
                                  )
                                }
                              >
                                <Trash2 size={14} />
                                {screenCopy.remove}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-state">{screenCopy.noModifiers}</div>
                    )}
                  </section>

                  <label className="admin-checkbox">
                    <input
                      type="checkbox"
                      checked={newItem.active}
                      onChange={(event) => setNewItem((current) => ({ ...current, active: event.target.checked }))}
                    />
                    <span>{screenCopy.activateForGuests}</span>
                  </label>

                  <button
                    className="button button-primary"
                    type="submit"
                    disabled={creatingItem || newItem.name.trim().length < 2 || Number(newItem.price || 0) <= 0}
                  >
                    <Plus size={16} />
                    {creatingItem ? screenCopy.creatingItem : screenCopy.createItem}
                  </button>
                </form>

                <section className="admin-panel admin-panel--feature">
                  <div className="section-title-row">
                    <div>
                      <p className="eyebrow">{screenCopy.itemCatalog}</p>
                      <h3>{screenCopy.focusTitle}</h3>
                    </div>
                    <Sparkles size={18} />
                  </div>

                  <div className="admin-insight-list">
                    <div>
                      <strong>{menuMetrics.itemsWithoutImage}</strong>
                      <p>{screenCopy.focusPhotos}</p>
                    </div>
                    <div>
                      <strong>{menuMetrics.inactiveItems}</strong>
                      <p>{screenCopy.focusStopList}</p>
                    </div>
                    <div>
                      <strong>{menuMetrics.modifierCount}</strong>
                      <p>{screenCopy.summaryModifiersDetail}</p>
                    </div>
                  </div>
                </section>
              </div>

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
                      screenCopy={screenCopy}
                      onSave={saveMenuItem}
                      onCreateModifier={createModifierForItem}
                      onSaveModifier={saveModifier}
                      onUploadImage={uploadImageFile}
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
              <div className="admin-creation-grid">
                <form className="admin-creation-card" onSubmit={(event) => void submitNewTable(event)}>
                  <div className="section-title-row">
                    <div>
                      <p className="eyebrow">{screenCopy.tables}</p>
                      <h3>{screenCopy.newTable}</h3>
                    </div>
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

                  <button className="button button-primary" type="submit" disabled={creatingTable || newTableNumber.trim().length === 0}>
                    <Plus size={16} />
                    {creatingTable ? screenCopy.creatingTable : screenCopy.createTable}
                  </button>
                </form>

                <section className="admin-panel admin-panel--feature">
                  <div className="section-title-row">
                    <div>
                      <p className="eyebrow">{screenCopy.tables}</p>
                      <h3>{screenCopy.summaryTables}</h3>
                    </div>
                    <QrCode size={18} />
                  </div>

                  <div className="admin-insight-list">
                    <div>
                      <strong>{tables.length}</strong>
                      <p>{screenCopy.summaryTablesDetail}</p>
                    </div>
                  </div>
                </section>
              </div>

              <section className="admin-table-grid">
                {tables.map((table) => (
                  <TableCard
                    key={table.id}
                    table={table}
                    qrCode={qrCodes[table.id]}
                    entryUrl={`${baseUrl}/table/${table.id}`}
                    screenCopy={screenCopy}
                    openLabel={copy.common.open}
                    onSave={saveTableNumber}
                    onCopyLink={handleCopyLink}
                  />
                ))}
              </section>
            </div>
          )}

          {currentTab === "branding" && (
            <div className="admin-brand-grid">
              <section className="admin-creation-card">
                <div className="section-title-row">
                  <div>
                    <p className="eyebrow">{screenCopy.brandStudio}</p>
                    <h3>{screenCopy.brandStudio}</h3>
                  </div>
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
                </div>

                <ImageUploadField
                  label={screenCopy.coverImage}
                  value={settings.coverImage ?? ""}
                  emptyLabel={screenCopy.photoHint}
                  uploadLabel={screenCopy.selectPhoto}
                  replaceLabel={screenCopy.replacePhoto}
                  removeLabel={screenCopy.removePhoto}
                  hint={screenCopy.photoHint}
                  readyLabel={screenCopy.photoReady}
                  uploadingLabel={screenCopy.uploadingPhoto}
                  uploading={coverImageBusy}
                  onFileSelected={handleCoverImageUpload}
                  onClear={() => setSettings((current) => ({ ...current, coverImage: null }))}
                />

                <button className="button button-primary" type="button" onClick={() => void saveSettings()} disabled={savingSettings}>
                  <Save size={16} />
                  {savingSettings ? screenCopy.saving : screenCopy.saveBrand}
                </button>
              </section>

              <section className="admin-panel admin-panel--feature">
                <div className="section-title-row">
                  <div>
                    <p className="eyebrow">{screenCopy.livePreview}</p>
                    <h3>{settings.name}</h3>
                  </div>
                  <span className="soft-pill">{copy.common.live}</span>
                </div>

                <article className="admin-brand-preview">
                  <div
                    className="admin-brand-preview__cover"
                    style={
                      settings.coverImage
                        ? {
                            backgroundImage: `linear-gradient(rgba(23, 33, 28, 0.18), rgba(23, 33, 28, 0.5)), url(${settings.coverImage})`,
                          }
                        : { backgroundColor: settings.accentColor }
                    }
                  />
                  <div className="admin-brand-preview__body">
                    <div className="brand-mark" style={{ color: settings.accentColor }}>
                      <Palette size={22} />
                    </div>
                    <div>
                      <p className="eyebrow">{copy.common.visibleToGuest}</p>
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
