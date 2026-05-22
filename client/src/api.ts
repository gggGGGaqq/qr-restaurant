import { clearAuthSession, getAuthToken, type ProtectedRole } from "./auth";
import { getDictionary } from "./i18n";
import type {
  MenuCategory,
  MenuItem,
  Order,
  OwnerAnalyticsCategoryMetric,
  OwnerAnalyticsDashboardData,
  OwnerAnalyticsDishMetric,
  OwnerAnalyticsMenu,
  OwnerAnalyticsOperations,
  OwnerAnalyticsOrders,
  OwnerAnalyticsRangePreset,
  OwnerAnalyticsRevenue,
  OwnerAnalyticsSales,
  OwnerAnalyticsSalesPoint,
  OwnerAnalyticsTableMetric,
  OwnerAnalyticsTables,
  OwnerSummary,
  RestaurantSettings,
  ServiceRequest,
  ServiceRequestType,
  Table,
  TableSession,
} from "./types";
import { fixMojibake } from "./utils/text";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

function fallbackMessageByStatus(status: number): string {
  const copy = getDictionary().api;
  if (status === 400) return copy.invalidRequest;
  if (status === 401 || status === 403) return "Authentication required.";
  if (status === 404) return copy.notFound;
  if (status === 409) return copy.conflict;
  if (status === 503) return copy.unavailable;
  return copy.requestFailed;
}

function toDisplayMoney(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  const absoluteAmount = Math.abs(amount);
  return absoluteAmount > 0 && absoluteAmount < 1000 ? amount * 1000 : amount;
}

export function normalizeMenuItem(item: MenuItem): MenuItem {
  return {
    ...item,
    category: item.category as MenuCategory,
    name: fixMojibake(item.name),
    description: item.description ? fixMojibake(item.description) : null,
    price: toDisplayMoney(item.price),
    active: Boolean(item.active),
    modifiers: (item.modifiers ?? []).map((modifier) => ({
      ...modifier,
      name: fixMojibake(modifier.name),
      priceDelta: toDisplayMoney(modifier.priceDelta),
      active: Boolean(modifier.active),
      sortOrder: Number(modifier.sortOrder ?? 0),
    })),
  };
}

export function normalizeOrder(order: Order): Order {
  return {
    ...order,
    tableNumber: fixMojibake(order.tableNumber),
    note: order.note ? fixMojibake(order.note) : null,
    total: toDisplayMoney(order.total),
    serviceFee: toDisplayMoney(order.serviceFee),
    totalWithService: toDisplayMoney(order.totalWithService),
    items: order.items.map((item) => ({
      ...item,
      name: fixMojibake(item.name),
      note: item.note ? fixMojibake(item.note) : null,
      price: toDisplayMoney(item.price),
      lineTotal: toDisplayMoney(item.lineTotal),
      modifiers: (item.modifiers ?? []).map((modifier) => ({
        ...modifier,
        name: fixMojibake(modifier.name),
        priceDelta: toDisplayMoney(modifier.priceDelta),
      })),
    })),
  };
}

export function normalizeServiceRequest(request: ServiceRequest): ServiceRequest {
  return {
    ...request,
    tableNumber: fixMojibake(request.tableNumber),
    note: request.note ? fixMojibake(request.note) : null,
  };
}

export function normalizeSettings(settings: RestaurantSettings): RestaurantSettings {
  return {
    ...settings,
    name: fixMojibake(settings.name),
    coverImage: settings.coverImage ? fixMojibake(settings.coverImage) : null,
    serviceRate: Number(settings.serviceRate),
  };
}

function normalizeTable(table: Table): Table {
  return {
    ...table,
    number: fixMojibake(table.number),
  };
}

function normalizeAnalyticsRevenue(revenue: OwnerAnalyticsRevenue): OwnerAnalyticsRevenue {
  return {
    ...revenue,
    subtotal: toDisplayMoney(revenue.subtotal),
    serviceFee: toDisplayMoney(revenue.serviceFee),
    total: toDisplayMoney(revenue.total),
  };
}

function normalizeAnalyticsSalesPoint(point: OwnerAnalyticsSalesPoint): OwnerAnalyticsSalesPoint {
  return {
    ...point,
    subtotal: toDisplayMoney(point.subtotal),
    serviceFee: toDisplayMoney(point.serviceFee),
    revenue: toDisplayMoney(point.revenue),
  };
}

function normalizeAnalyticsDishMetric(metric: OwnerAnalyticsDishMetric): OwnerAnalyticsDishMetric {
  return {
    ...metric,
    name: fixMojibake(metric.name),
    subtotal: toDisplayMoney(metric.subtotal),
    serviceFee: toDisplayMoney(metric.serviceFee),
    revenue: toDisplayMoney(metric.revenue),
  };
}

function normalizeAnalyticsCategoryMetric(
  metric: OwnerAnalyticsCategoryMetric,
): OwnerAnalyticsCategoryMetric {
  return {
    ...metric,
    subtotal: toDisplayMoney(metric.subtotal),
    serviceFee: toDisplayMoney(metric.serviceFee),
    revenue: toDisplayMoney(metric.revenue),
    averageMenuPrice: metric.averageMenuPrice === null ? null : toDisplayMoney(metric.averageMenuPrice),
  };
}

function normalizeOwnerAnalyticsSummary(summary: OwnerAnalyticsDashboardData["summary"]) {
  return {
    ...summary,
    totalRevenue: toDisplayMoney(summary.totalRevenue),
    subtotalRevenue: toDisplayMoney(summary.subtotalRevenue),
    serviceFeeTotal: toDisplayMoney(summary.serviceFeeTotal),
    revenueToday: toDisplayMoney(summary.revenueToday),
    revenueThisWeek: toDisplayMoney(summary.revenueThisWeek),
    revenueThisMonth: toDisplayMoney(summary.revenueThisMonth),
    averageOrderValue: toDisplayMoney(summary.averageOrderValue),
    mostPopularDish: summary.mostPopularDish ? normalizeAnalyticsDishMetric(summary.mostPopularDish) : null,
    leastPopularDish: summary.leastPopularDish ? normalizeAnalyticsDishMetric(summary.leastPopularDish) : null,
  };
}

function normalizeOwnerAnalyticsSales(sales: OwnerAnalyticsSales): OwnerAnalyticsSales {
  return {
    ...sales,
    revenueByDay: sales.revenueByDay.map(normalizeAnalyticsSalesPoint),
    revenueByWeek: sales.revenueByWeek.map(normalizeAnalyticsSalesPoint),
    revenueByMonth: sales.revenueByMonth.map(normalizeAnalyticsSalesPoint),
    dailySalesTrend: sales.dailySalesTrend.map(normalizeAnalyticsSalesPoint),
    weeklySalesTrend: sales.weeklySalesTrend.map(normalizeAnalyticsSalesPoint),
    monthlySalesTrend: sales.monthlySalesTrend.map(normalizeAnalyticsSalesPoint),
    todayVsYesterday: {
      ...sales.todayVsYesterday,
      current: normalizeAnalyticsRevenue(sales.todayVsYesterday.current),
      previous: normalizeAnalyticsRevenue(sales.todayVsYesterday.previous),
      change: toDisplayMoney(sales.todayVsYesterday.change),
    },
    thisWeekVsPreviousWeek: {
      ...sales.thisWeekVsPreviousWeek,
      current: normalizeAnalyticsRevenue(sales.thisWeekVsPreviousWeek.current),
      previous: normalizeAnalyticsRevenue(sales.thisWeekVsPreviousWeek.previous),
      change: toDisplayMoney(sales.thisWeekVsPreviousWeek.change),
    },
    thisMonthVsPreviousMonth: {
      ...sales.thisMonthVsPreviousMonth,
      current: normalizeAnalyticsRevenue(sales.thisMonthVsPreviousMonth.current),
      previous: normalizeAnalyticsRevenue(sales.thisMonthVsPreviousMonth.previous),
      change: toDisplayMoney(sales.thisMonthVsPreviousMonth.change),
    },
  };
}

function normalizeOwnerAnalyticsMenu(menu: OwnerAnalyticsMenu): OwnerAnalyticsMenu {
  return {
    ...menu,
    topSellingDishes: menu.topSellingDishes.map(normalizeAnalyticsDishMetric),
    worstSellingDishes: menu.worstSellingDishes.map(normalizeAnalyticsDishMetric),
    revenueByDish: menu.revenueByDish.map(normalizeAnalyticsDishMetric),
    quantitySoldByDish: menu.quantitySoldByDish.map(normalizeAnalyticsDishMetric),
    revenueByCategory: menu.revenueByCategory.map(normalizeAnalyticsCategoryMetric),
    averagePriceByCategory: menu.averagePriceByCategory.map((item) => ({
      ...item,
      averagePrice: item.averagePrice === null ? null : toDisplayMoney(item.averagePrice),
    })),
    itemsNeverOrdered: menu.itemsNeverOrdered.map((item) => ({
      ...item,
      name: fixMojibake(item.name),
      price: toDisplayMoney(item.price),
    })),
  };
}

function normalizeAnalyticsTableMetric(metric: OwnerAnalyticsTableMetric): OwnerAnalyticsTableMetric {
  return {
    ...metric,
    tableNumber: fixMojibake(metric.tableNumber),
    subtotal: toDisplayMoney(metric.subtotal),
    serviceFee: toDisplayMoney(metric.serviceFee),
    revenue: toDisplayMoney(metric.revenue),
    averageOrderValue: toDisplayMoney(metric.averageOrderValue),
  };
}

function normalizeOwnerAnalyticsTables(tables: OwnerAnalyticsTables): OwnerAnalyticsTables {
  return {
    ...tables,
    tables: tables.tables.map(normalizeAnalyticsTableMetric),
    mostActiveTables: tables.mostActiveTables.map(normalizeAnalyticsTableMetric),
    tablesWithRejectedOrders: tables.tablesWithRejectedOrders.map(normalizeAnalyticsTableMetric),
    currentActiveSessions: tables.currentActiveSessions.map((session) => ({
      ...session,
      tableNumber: fixMojibake(session.tableNumber),
    })),
  };
}

interface OwnerAnalyticsParams {
  range: OwnerAnalyticsRangePreset;
  from?: string;
  to?: string;
}

function buildOwnerAnalyticsQuery(params: OwnerAnalyticsParams): string {
  const search = new URLSearchParams({ range: params.range });
  if (params.range === "custom") {
    if (params.from) search.set("from", params.from);
    if (params.to) search.set("to", params.to);
  }

  return search.toString();
}

interface RequestOptions {
  authRole?: ProtectedRole;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<ApiEnvelope<T>> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  if (options.authRole) {
    const token = getAuthToken(options.authRole);
    if (!token) {
      throw new ApiError("Authentication required.", 401);
    }

    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new ApiError(getDictionary().api.connectionFailed, 0);
  }

  const body = (await response.json().catch(() => null)) as
    | { data?: T; meta?: Record<string, unknown>; error?: { message?: string; details?: unknown } }
    | null;

  if (!response.ok) {
    if (options.authRole && (response.status === 401 || response.status === 403)) {
      clearAuthSession(options.authRole);
    }

    throw new ApiError(
      body?.error?.message ?? fallbackMessageByStatus(response.status),
      response.status,
      body?.error?.details,
    );
  }

  return {
    data: body?.data as T,
    meta: body?.meta,
  };
}

export async function getSettings(): Promise<RestaurantSettings> {
  return normalizeSettings((await request<RestaurantSettings>("/api/settings")).data);
}

export async function updateSettings(input: RestaurantSettings): Promise<RestaurantSettings> {
  return normalizeSettings(
    (
      await request<RestaurantSettings>("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(input),
      }, { authRole: "admin" })
    ).data,
  );
}

export async function listTables(): Promise<Table[]> {
  return (await request<Table[]>("/api/tables", {}, { authRole: "admin" })).data.map(normalizeTable);
}

export async function createTable(input: { number: string }): Promise<Table> {
  return normalizeTable(
    (
      await request<Table>("/api/admin/tables", {
        method: "POST",
        body: JSON.stringify(input),
      }, { authRole: "admin" })
    ).data,
  );
}

export async function updateTable(
  id: number,
  input: Partial<Pick<Table, "number">>,
): Promise<Table> {
  return normalizeTable(
    (
      await request<Table>(`/api/admin/tables/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }, { authRole: "admin" })
    ).data,
  );
}

export async function createSession(tableId: number | string): Promise<TableSession> {
  return (
    await request<TableSession>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ tableId }),
    })
  ).data;
}

export async function getSession(sessionId: string): Promise<TableSession> {
  return (await request<TableSession>(`/api/sessions/${sessionId}`)).data;
}

export async function listMenu(): Promise<MenuItem[]> {
  return (await request<MenuItem[]>("/api/menu")).data.map(normalizeMenuItem);
}

export async function listAdminMenu(): Promise<MenuItem[]> {
  return (await request<MenuItem[]>("/api/admin/menu", {}, { authRole: "admin" })).data.map(normalizeMenuItem);
}

export async function createMenuItem(input: {
  category: MenuCategory;
  name: string;
  price: number;
  description?: string | null;
  image?: string | null;
  active?: boolean;
}): Promise<MenuItem> {
  return normalizeMenuItem(
    (
      await request<MenuItem>("/api/admin/menu", {
        method: "POST",
        body: JSON.stringify(input),
      }, { authRole: "admin" })
    ).data,
  );
}

export async function updateMenuItem(
  id: number,
  input: Partial<Pick<MenuItem, "category" | "name" | "price" | "description" | "image" | "active">>,
): Promise<MenuItem> {
  return normalizeMenuItem(
    (
      await request<MenuItem>(`/api/admin/menu/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }, { authRole: "admin" })
    ).data,
  );
}

export async function uploadAdminImage(input: { fileName: string; dataUrl: string }): Promise<{ url: string }> {
  return (
    await request<{ url: string }>(
      "/api/admin/uploads",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      { authRole: "admin" },
    )
  ).data;
}

export async function createMenuModifier(
  menuItemId: number,
  input: {
    name: string;
    priceDelta: number;
    active?: boolean;
    sortOrder?: number;
  },
): Promise<MenuItem["modifiers"][number]> {
  const modifier = (
    await request<MenuItem["modifiers"][number]>(`/api/admin/menu/${menuItemId}/modifiers`, {
      method: "POST",
      body: JSON.stringify(input),
    }, { authRole: "admin" })
  ).data;

  return {
    ...modifier,
    name: fixMojibake(modifier.name),
    priceDelta: toDisplayMoney(modifier.priceDelta),
    active: Boolean(modifier.active),
    sortOrder: Number(modifier.sortOrder ?? 0),
  };
}

export async function updateMenuModifier(
  modifierId: number,
  input: Partial<Pick<MenuItem["modifiers"][number], "name" | "priceDelta" | "active" | "sortOrder">>,
): Promise<MenuItem["modifiers"][number]> {
  const modifier = (
    await request<MenuItem["modifiers"][number]>(`/api/admin/modifiers/${modifierId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }, { authRole: "admin" })
  ).data;

  return {
    ...modifier,
    name: fixMojibake(modifier.name),
    priceDelta: toDisplayMoney(modifier.priceDelta),
    active: Boolean(modifier.active),
    sortOrder: Number(modifier.sortOrder ?? 0),
  };
}

export async function listSessionOrders(sessionId: string): Promise<Order[]> {
  return (await request<Order[]>(`/api/sessions/${sessionId}/orders`)).data.map(normalizeOrder);
}

export async function listSessionServiceRequests(sessionId: string): Promise<ServiceRequest[]> {
  return (
    await request<ServiceRequest[]>(`/api/sessions/${sessionId}/service-requests`)
  ).data.map(normalizeServiceRequest);
}

export async function placeOrder(input: {
  orderId: string;
  tableId: number;
  sessionId: string;
  note?: string | null;
  items: Array<{ menuItemId: number; qty: number; note?: string | null; modifierIds?: number[] }>;
}): Promise<Order> {
  return normalizeOrder(
    (
      await request<Order>("/api/orders", {
        method: "POST",
        body: JSON.stringify(input),
      })
    ).data,
  );
}

export async function createServiceRequest(input: {
  tableId: number;
  sessionId: string;
  type: ServiceRequestType;
  note?: string | null;
}): Promise<ServiceRequest> {
  return normalizeServiceRequest(
    (
      await request<ServiceRequest>("/api/service-requests", {
        method: "POST",
        body: JSON.stringify(input),
      })
    ).data,
  );
}

export async function listWaiterServiceRequests(): Promise<ServiceRequest[]> {
  return (
    await request<ServiceRequest[]>("/api/waiter/service-requests", {}, { authRole: "waiter" })
  ).data.map(normalizeServiceRequest);
}

export async function completeServiceRequest(id: string): Promise<ServiceRequest> {
  return normalizeServiceRequest(
    (
      await request<ServiceRequest>(`/api/service-requests/${id}/complete`, {
        method: "POST",
      }, { authRole: "waiter" })
    ).data,
  );
}

export async function listWaiterOrders(): Promise<Order[]> {
  return (await request<Order[]>("/api/waiter/orders", {}, { authRole: "waiter" })).data.map(normalizeOrder);
}

export async function listWaiterOrderHistory(): Promise<Order[]> {
  return (await request<Order[]>("/api/waiter/orders/history", {}, { authRole: "waiter" })).data.map(normalizeOrder);
}

export async function listKitchenOrders(): Promise<Order[]> {
  return (await request<Order[]>("/api/kitchen/orders", {}, { authRole: "kitchen" })).data.map(normalizeOrder);
}

export async function listKitchenOrderHistory(): Promise<Order[]> {
  return (await request<Order[]>("/api/kitchen/orders/history", {}, { authRole: "kitchen" })).data.map(normalizeOrder);
}

export async function getOwnerSummary(): Promise<OwnerSummary> {
  const summary = (await request<OwnerSummary>("/api/owner/summary", {}, { authRole: "owner" })).data;
  return {
    ...summary,
    revenueToday: toDisplayMoney(summary.revenueToday),
    averageCheck: toDisplayMoney(summary.averageCheck),
    popularItems: summary.popularItems.map((item) => ({
      ...item,
      name: fixMojibake(item.name),
    })),
  };
}

export async function getOwnerAnalyticsDashboard(
  params: OwnerAnalyticsParams,
  signal?: AbortSignal,
): Promise<OwnerAnalyticsDashboardData> {
  const query = buildOwnerAnalyticsQuery(params);
  const init = signal ? { signal } : {};
  const [summary, sales, orders, menu, tables, operations] = await Promise.all([
    request<OwnerAnalyticsDashboardData["summary"]>(
      `/api/owner/analytics/summary?${query}`,
      init,
      { authRole: "owner" },
    ),
    request<OwnerAnalyticsSales>(
      `/api/owner/analytics/sales?${query}`,
      init,
      { authRole: "owner" },
    ),
    request<OwnerAnalyticsOrders>(
      `/api/owner/analytics/orders?${query}`,
      init,
      { authRole: "owner" },
    ),
    request<OwnerAnalyticsMenu>(
      `/api/owner/analytics/menu?${query}`,
      init,
      { authRole: "owner" },
    ),
    request<OwnerAnalyticsTables>(
      `/api/owner/analytics/tables?${query}`,
      init,
      { authRole: "owner" },
    ),
    request<OwnerAnalyticsOperations>(
      `/api/owner/analytics/operations?${query}`,
      init,
      { authRole: "owner" },
    ),
  ]);

  return {
    summary: normalizeOwnerAnalyticsSummary(summary.data),
    sales: normalizeOwnerAnalyticsSales(sales.data),
    orders: orders.data,
    menu: normalizeOwnerAnalyticsMenu(menu.data),
    tables: normalizeOwnerAnalyticsTables(tables.data),
    operations: operations.data,
  };
}

export async function orderAction(
  orderId: string,
  action: "accept" | "reject" | "cooking" | "ready" | "complete" | "reopen-new" | "reopen-ready" | "reopen-cooking",
): Promise<Order> {
  const authRole: ProtectedRole =
    action === "cooking" || action === "ready" || action === "reopen-cooking" ? "kitchen" : "waiter";

  return normalizeOrder(
    (
      await request<Order>(`/api/orders/${orderId}/${action}`, {
        method: "POST",
      }, { authRole })
    ).data,
  );
}
