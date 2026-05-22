import type { RowDataPacket } from "mysql2/promise";
import { pool } from "./db";
import { HttpError } from "./errors";
import { getRestaurantSettings } from "./repository";
import {
  menuCategories,
  orderStatuses,
  ownerAnalyticsRangePresets,
  type MenuCategory,
  type OrderStatus,
  type OwnerAnalyticsCategoryMetricDto,
  type OwnerAnalyticsComparisonDto,
  type OwnerAnalyticsDishMetricDto,
  type OwnerAnalyticsMenuDto,
  type OwnerAnalyticsOperationsDto,
  type OwnerAnalyticsOrdersDto,
  type OwnerAnalyticsRangeDto,
  type OwnerAnalyticsRangePreset,
  type OwnerAnalyticsRevenueDto,
  type OwnerAnalyticsSalesDto,
  type OwnerAnalyticsSalesPointDto,
  type OwnerAnalyticsSummaryDto,
  type OwnerAnalyticsTableMetricDto,
  type OwnerAnalyticsTablesDto,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CUSTOM_RANGE_DAYS = 366;
const BILLABLE_STATUS_SQL = "o.status <> 'REJECTED'";
const ACTIVE_ORDER_STATUSES: OrderStatus[] = ["NEW", "ACCEPTED", "COOKING", "READY"];
const MODIFIER_TOTAL_JOIN = `
  LEFT JOIN (
    SELECT order_item_id, SUM(price_delta) AS modifier_total
    FROM order_item_modifiers
    GROUP BY order_item_id
  ) mods ON mods.order_item_id = oi.id
`;
const LINE_SUBTOTAL_SQL = "(COALESCE(mi.price, 0) + COALESCE(mods.modifier_total, 0)) * COALESCE(oi.qty, 0)";

interface ResolvedAnalyticsRange {
  dto: OwnerAnalyticsRangeDto;
  from: Date;
  to: Date;
  sqlFrom: string;
  sqlTo: string;
}

interface AnalyticsRangeInput {
  range?: OwnerAnalyticsRangePreset;
  from?: string;
  to?: string;
}

interface OrderAggregateRow extends RowDataPacket {
  total_orders: number;
  billable_orders: number;
  rejected_orders: number;
  completed_orders: number;
  subtotal: number | null;
  service_fee: number | null;
}

interface CountRow extends RowDataPacket {
  count: number;
}

interface DishMetricRow extends RowDataPacket {
  menu_item_id: number;
  name: string;
  category: MenuCategory;
  active: 0 | 1 | boolean;
  qty: number | null;
  orders: number | null;
  subtotal: number | null;
}

interface SalesPointRow extends RowDataPacket {
  period: string;
  subtotal: number | null;
  service_fee: number | null;
  orders: number | null;
}

interface StatusCountRow extends RowDataPacket {
  status: OrderStatus;
  count: number;
}

interface EventStatusCountRow extends RowDataPacket {
  status: OrderStatus;
  count: number;
}

interface HourCountRow extends RowDataPacket {
  hour: number;
  count: number;
}

interface AverageRow extends RowDataPacket {
  average_seconds: number | null;
}

interface CategorySalesRow extends RowDataPacket {
  category: MenuCategory;
  qty: number | null;
  orders: number | null;
  subtotal: number | null;
}

interface CategoryPriceRow extends RowDataPacket {
  category: MenuCategory;
  total_items: number;
  active_items: number | null;
  inactive_items: number | null;
  average_price: number | null;
}

interface AvailabilityRow extends RowDataPacket {
  total_items: number;
  active_items: number | null;
  inactive_items: number | null;
}

interface NeverOrderedRow extends RowDataPacket {
  menu_item_id: number;
  name: string;
  category: MenuCategory;
  active: 0 | 1 | boolean;
  price: number;
}

interface TableMetricRow extends RowDataPacket {
  table_id: number;
  table_number: string;
  total_orders: number;
  billable_orders: number | null;
  rejected_orders: number | null;
  subtotal: number | null;
  service_fee: number | null;
}

interface ActiveSessionRow extends RowDataPacket {
  session_id: string;
  table_id: number;
  table_number: string;
  last_activity: Date;
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function toNumber(value: unknown): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function nullableSeconds(value: unknown): number | null {
  const next = Number(value);
  return Number.isFinite(next) ? Math.round(next) : null;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date): Date {
  const dayOffset = (date.getDay() + 6) % 7;
  return addDays(startOfDay(date), -dayOffset);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toMysqlDateTime(date: Date): string {
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  ].join(" ");
}

function parseDateOnly(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function makeRange(preset: OwnerAnalyticsRangePreset, from: Date, to: Date): ResolvedAnalyticsRange {
  return {
    dto: {
      preset,
      from: from.toISOString(),
      to: to.toISOString(),
    },
    from,
    to,
    sqlFrom: toMysqlDateTime(from),
    sqlTo: toMysqlDateTime(to),
  };
}

export function resolveOwnerAnalyticsRange(input: AnalyticsRangeInput = {}): ResolvedAnalyticsRange {
  const preset = input.range ?? "today";
  if (!ownerAnalyticsRangePresets.includes(preset)) {
    throw new HttpError(400, "Invalid analytics range");
  }

  const today = startOfDay(new Date());
  if (preset === "today") return makeRange(preset, today, addDays(today, 1));
  if (preset === "yesterday") return makeRange(preset, addDays(today, -1), today);
  if (preset === "last7days") return makeRange(preset, addDays(today, -6), addDays(today, 1));
  if (preset === "last30days") return makeRange(preset, addDays(today, -29), addDays(today, 1));
  if (preset === "this_month") {
    const monthStart = startOfMonth(today);
    return makeRange(preset, monthStart, addMonths(monthStart, 1));
  }
  if (preset === "previous_month") {
    const monthStart = startOfMonth(today);
    return makeRange(preset, addMonths(monthStart, -1), monthStart);
  }

  const from = parseDateOnly(input.from);
  const to = parseDateOnly(input.to);
  if (!from || !to) {
    throw new HttpError(400, "Custom analytics range requires from and to dates in YYYY-MM-DD format");
  }

  const exclusiveTo = addDays(to, 1);
  if (from >= exclusiveTo) {
    throw new HttpError(400, "Analytics range start must be before end");
  }
  if ((exclusiveTo.getTime() - from.getTime()) / DAY_MS > MAX_CUSTOM_RANGE_DAYS) {
    throw new HttpError(400, `Custom analytics range cannot exceed ${MAX_CUSTOM_RANGE_DAYS} days`);
  }

  return makeRange(preset, from, exclusiveTo);
}

function dayCount(range: ResolvedAnalyticsRange): number {
  return Math.max(1, Math.ceil((range.to.getTime() - range.from.getTime()) / DAY_MS));
}

function revenueFromParts(subtotal: number, serviceFee: number, orders: number): OwnerAnalyticsRevenueDto {
  return {
    subtotal: roundMoney(subtotal),
    serviceFee: roundMoney(serviceFee),
    total: roundMoney(subtotal + serviceFee),
    orders,
  };
}

function mapDishMetric(row: DishMetricRow, serviceRate: number): OwnerAnalyticsDishMetricDto {
  const subtotal = roundMoney(toNumber(row.subtotal));
  const serviceFee = roundMoney(subtotal * serviceRate);
  return {
    menuItemId: row.menu_item_id,
    name: row.name,
    category: row.category,
    active: Boolean(row.active),
    qty: toNumber(row.qty),
    orders: toNumber(row.orders),
    subtotal,
    serviceFee,
    revenue: roundMoney(subtotal + serviceFee),
  };
}

function mapSalesPoint(row: SalesPointRow): OwnerAnalyticsSalesPointDto {
  const subtotal = roundMoney(toNumber(row.subtotal));
  const serviceFee = roundMoney(toNumber(row.service_fee));
  return {
    period: row.period,
    subtotal,
    serviceFee,
    revenue: roundMoney(subtotal + serviceFee),
    orders: toNumber(row.orders),
  };
}

function comparison(current: OwnerAnalyticsRevenueDto, previous: OwnerAnalyticsRevenueDto): OwnerAnalyticsComparisonDto {
  const change = roundMoney(current.total - previous.total);
  return {
    current,
    previous,
    change,
    changePercent: previous.total > 0 ? roundMoney((change / previous.total) * 100) : null,
  };
}

async function getOrderAggregate(range: ResolvedAnalyticsRange, serviceRate: number): Promise<OrderAggregateRow> {
  const [rows] = await pool.execute<OrderAggregateRow[]>(
    `SELECT
       COUNT(*) AS total_orders,
       COALESCE(SUM(CASE WHEN status <> 'REJECTED' THEN 1 ELSE 0 END), 0) AS billable_orders,
       COALESCE(SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END), 0) AS rejected_orders,
       COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END), 0) AS completed_orders,
       COALESCE(SUM(CASE WHEN status <> 'REJECTED' THEN subtotal ELSE 0 END), 0) AS subtotal,
       COALESCE(SUM(CASE WHEN status <> 'REJECTED' THEN ROUND(subtotal * ?, 2) ELSE 0 END), 0) AS service_fee
     FROM (
       SELECT o.id, o.status, COALESCE(SUM(${LINE_SUBTOTAL_SQL}), 0) AS subtotal
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
       ${MODIFIER_TOTAL_JOIN}
       WHERE o.created_at >= ? AND o.created_at < ?
       GROUP BY o.id, o.status
     ) order_totals`,
    [serviceRate, range.sqlFrom, range.sqlTo],
  );

  return rows[0] ?? {
    total_orders: 0,
    billable_orders: 0,
    rejected_orders: 0,
    completed_orders: 0,
    subtotal: 0,
    service_fee: 0,
  } as OrderAggregateRow;
}

async function getRevenue(range: ResolvedAnalyticsRange, serviceRate: number): Promise<OwnerAnalyticsRevenueDto> {
  const aggregate = await getOrderAggregate(range, serviceRate);
  return revenueFromParts(
    toNumber(aggregate.subtotal),
    toNumber(aggregate.service_fee),
    toNumber(aggregate.billable_orders),
  );
}

async function getActiveOrderCount(): Promise<number> {
  const [rows] = await pool.execute<CountRow[]>(
    `SELECT COUNT(*) AS count
     FROM orders
     WHERE status IN ('NEW', 'ACCEPTED', 'COOKING', 'READY')`,
  );
  return toNumber(rows[0]?.count);
}

async function getDishMetric(
  range: ResolvedAnalyticsRange,
  serviceRate: number,
  direction: "best" | "worst",
): Promise<OwnerAnalyticsDishMetricDto | null> {
  const orderBy =
    direction === "best"
      ? "qty DESC, subtotal DESC, mi.name ASC"
      : "qty ASC, subtotal ASC, mi.name ASC";
  const [rows] = await pool.execute<DishMetricRow[]>(
    `SELECT
       mi.id AS menu_item_id,
       mi.name,
       mi.category,
       mi.active,
       SUM(oi.qty) AS qty,
       COUNT(DISTINCT o.id) AS orders,
       SUM(${LINE_SUBTOTAL_SQL}) AS subtotal
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     JOIN menu_items mi ON mi.id = oi.menu_item_id
     ${MODIFIER_TOTAL_JOIN}
     WHERE o.created_at >= ? AND o.created_at < ?
       AND ${BILLABLE_STATUS_SQL}
     GROUP BY mi.id, mi.name, mi.category, mi.active
     HAVING qty > 0
     ORDER BY ${orderBy}
     LIMIT 1`,
    [range.sqlFrom, range.sqlTo],
  );

  return rows[0] ? mapDishMetric(rows[0], serviceRate) : null;
}

async function getSalesSeries(
  range: ResolvedAnalyticsRange,
  serviceRate: number,
  periodSql: string,
): Promise<OwnerAnalyticsSalesPointDto[]> {
  const [rows] = await pool.execute<SalesPointRow[]>(
    `SELECT
       ${periodSql} AS period,
       COALESCE(SUM(subtotal), 0) AS subtotal,
       COALESCE(SUM(ROUND(subtotal * ?, 2)), 0) AS service_fee,
       COUNT(*) AS orders
     FROM (
       SELECT o.id, o.created_at, COALESCE(SUM(${LINE_SUBTOTAL_SQL}), 0) AS subtotal
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
       ${MODIFIER_TOTAL_JOIN}
       WHERE o.created_at >= ? AND o.created_at < ?
         AND ${BILLABLE_STATUS_SQL}
       GROUP BY o.id, o.created_at
     ) order_totals
     GROUP BY period
     ORDER BY MIN(created_at) ASC`,
    [serviceRate, range.sqlFrom, range.sqlTo],
  );

  return rows.map(mapSalesPoint);
}

async function getStatusCounts(range: ResolvedAnalyticsRange): Promise<Array<{ status: OrderStatus; count: number }>> {
  const [rows] = await pool.execute<StatusCountRow[]>(
    `SELECT status, COUNT(*) AS count
     FROM orders
     WHERE created_at >= ? AND created_at < ?
     GROUP BY status`,
    [range.sqlFrom, range.sqlTo],
  );
  const counts = new Map(rows.map((row) => [row.status, toNumber(row.count)]));
  return orderStatuses.map((status) => ({ status, count: counts.get(status) ?? 0 }));
}

async function getStatusEventCounts(
  range: ResolvedAnalyticsRange,
  statuses: OrderStatus[],
): Promise<Map<OrderStatus, number>> {
  if (statuses.length === 0) return new Map();
  const placeholders = statuses.map(() => "?").join(", ");
  const [rows] = await pool.execute<EventStatusCountRow[]>(
    `SELECT to_status AS status, COUNT(DISTINCT order_id) AS count
     FROM order_events
     WHERE created_at >= ? AND created_at < ?
       AND to_status IN (${placeholders})
     GROUP BY to_status`,
    [range.sqlFrom, range.sqlTo, ...statuses],
  );

  return new Map(rows.map((row) => [row.status, toNumber(row.count)]));
}


async function getOrdersByHour(range: ResolvedAnalyticsRange): Promise<Array<{ hour: number; count: number }>> {
  const [rows] = await pool.execute<HourCountRow[]>(
    `SELECT HOUR(created_at) AS hour, COUNT(*) AS count
     FROM orders
     WHERE created_at >= ? AND created_at < ?
     GROUP BY HOUR(created_at)
     ORDER BY hour ASC`,
    [range.sqlFrom, range.sqlTo],
  );
  const counts = new Map(rows.map((row) => [Number(row.hour), toNumber(row.count)]));
  return Array.from({ length: 24 }, (_, hour) => ({ hour, count: counts.get(hour) ?? 0 }));
}

async function getAverageProcessingSeconds(range: ResolvedAnalyticsRange): Promise<number | null> {
  const [rows] = await pool.execute<AverageRow[]>(
    `SELECT AVG(TIMESTAMPDIFF(SECOND, created_at, updated_at)) AS average_seconds
     FROM orders
     WHERE created_at >= ? AND created_at < ?
       AND status IN ('COMPLETED', 'REJECTED')`,
    [range.sqlFrom, range.sqlTo],
  );
  return nullableSeconds(rows[0]?.average_seconds);
}

async function getAverageAcceptanceSeconds(range: ResolvedAnalyticsRange): Promise<number | null> {
  const [rows] = await pool.execute<AverageRow[]>(
    `SELECT AVG(TIMESTAMPDIFF(SECOND, o.created_at, accepted.accepted_at)) AS average_seconds
     FROM orders o
     JOIN (
       SELECT order_id, MIN(created_at) AS accepted_at
       FROM order_events
       WHERE to_status = 'ACCEPTED'
       GROUP BY order_id
     ) accepted ON accepted.order_id = o.id
     WHERE o.created_at >= ? AND o.created_at < ?
       AND accepted.accepted_at >= o.created_at`,
    [range.sqlFrom, range.sqlTo],
  );
  return nullableSeconds(rows[0]?.average_seconds);
}

async function getAverageKitchenPreparationSeconds(range: ResolvedAnalyticsRange): Promise<number | null> {
  const [rows] = await pool.execute<AverageRow[]>(
    `SELECT AVG(TIMESTAMPDIFF(SECOND, event_times.cooking_at, event_times.ready_at)) AS average_seconds
     FROM orders o
     JOIN (
       SELECT
         order_id,
         MIN(CASE WHEN to_status = 'COOKING' THEN created_at END) AS cooking_at,
         MIN(CASE WHEN to_status = 'READY' THEN created_at END) AS ready_at
       FROM order_events
       WHERE to_status IN ('COOKING', 'READY')
       GROUP BY order_id
     ) event_times ON event_times.order_id = o.id
     WHERE o.created_at >= ? AND o.created_at < ?
       AND event_times.cooking_at IS NOT NULL
       AND event_times.ready_at IS NOT NULL
       AND event_times.ready_at >= event_times.cooking_at`,
    [range.sqlFrom, range.sqlTo],
  );
  return nullableSeconds(rows[0]?.average_seconds);
}

async function getDishMetrics(range: ResolvedAnalyticsRange, serviceRate: number): Promise<OwnerAnalyticsDishMetricDto[]> {
  const [rows] = await pool.execute<DishMetricRow[]>(
    `SELECT
       mi.id AS menu_item_id,
       mi.name,
       mi.category,
       mi.active,
       SUM(oi.qty) AS qty,
       COUNT(DISTINCT o.id) AS orders,
       SUM(${LINE_SUBTOTAL_SQL}) AS subtotal
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     JOIN menu_items mi ON mi.id = oi.menu_item_id
     ${MODIFIER_TOTAL_JOIN}
     WHERE o.created_at >= ? AND o.created_at < ?
       AND ${BILLABLE_STATUS_SQL}
     GROUP BY mi.id, mi.name, mi.category, mi.active
     ORDER BY subtotal DESC, qty DESC, mi.name ASC`,
    [range.sqlFrom, range.sqlTo],
  );
  return rows.map((row) => mapDishMetric(row, serviceRate));
}

async function getCategoryPriceRows(): Promise<CategoryPriceRow[]> {
  const [rows] = await pool.execute<CategoryPriceRow[]>(
    `SELECT
       category,
       COUNT(*) AS total_items,
       COALESCE(SUM(CASE WHEN active = TRUE THEN 1 ELSE 0 END), 0) AS active_items,
       COALESCE(SUM(CASE WHEN active = FALSE THEN 1 ELSE 0 END), 0) AS inactive_items,
       AVG(price) AS average_price
     FROM menu_items
     GROUP BY category`,
  );
  return rows;
}

async function getCategorySales(
  range: ResolvedAnalyticsRange,
  serviceRate: number,
): Promise<OwnerAnalyticsCategoryMetricDto[]> {
  const [salesRows, priceRows] = await Promise.all([
    pool.execute<CategorySalesRow[]>(
      `SELECT
         mi.category,
         SUM(oi.qty) AS qty,
         COUNT(DISTINCT o.id) AS orders,
         SUM(${LINE_SUBTOTAL_SQL}) AS subtotal
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       ${MODIFIER_TOTAL_JOIN}
       WHERE o.created_at >= ? AND o.created_at < ?
         AND ${BILLABLE_STATUS_SQL}
       GROUP BY mi.category`,
      [range.sqlFrom, range.sqlTo],
    ),
    getCategoryPriceRows(),
  ]);

  const salesByCategory = new Map(salesRows[0].map((row) => [row.category, row]));
  const pricesByCategory = new Map(priceRows.map((row) => [row.category, row]));

  return menuCategories.map((category) => {
    const sales = salesByCategory.get(category);
    const prices = pricesByCategory.get(category);
    const subtotal = roundMoney(toNumber(sales?.subtotal));
    const serviceFee = roundMoney(subtotal * serviceRate);
    return {
      category,
      qty: toNumber(sales?.qty),
      orders: toNumber(sales?.orders),
      subtotal,
      serviceFee,
      revenue: roundMoney(subtotal + serviceFee),
      averageMenuPrice: prices?.average_price === null || prices?.average_price === undefined
        ? null
        : roundMoney(toNumber(prices.average_price)),
      activeItems: toNumber(prices?.active_items),
      inactiveItems: toNumber(prices?.inactive_items),
      totalItems: toNumber(prices?.total_items),
    };
  });
}

async function getAvailabilitySummary(): Promise<OwnerAnalyticsMenuDto["availabilitySummary"]> {
  const [rows] = await pool.execute<AvailabilityRow[]>(
    `SELECT
       COUNT(*) AS total_items,
       COALESCE(SUM(CASE WHEN active = TRUE THEN 1 ELSE 0 END), 0) AS active_items,
       COALESCE(SUM(CASE WHEN active = FALSE THEN 1 ELSE 0 END), 0) AS inactive_items
     FROM menu_items`,
  );
  const row = rows[0];
  return {
    totalItems: toNumber(row?.total_items),
    activeItems: toNumber(row?.active_items),
    inactiveItems: toNumber(row?.inactive_items),
  };
}

async function getItemsNeverOrdered(range: ResolvedAnalyticsRange): Promise<OwnerAnalyticsMenuDto["itemsNeverOrdered"]> {
  const [rows] = await pool.execute<NeverOrderedRow[]>(
    `SELECT mi.id AS menu_item_id, mi.name, mi.category, mi.active, mi.price
     FROM menu_items mi
     LEFT JOIN order_items oi ON oi.menu_item_id = mi.id
     LEFT JOIN orders o ON o.id = oi.order_id
       AND o.created_at >= ? AND o.created_at < ?
       AND o.status <> 'REJECTED'
     GROUP BY mi.id, mi.name, mi.category, mi.active, mi.price
     HAVING COUNT(o.id) = 0
     ORDER BY mi.active DESC, mi.category ASC, mi.name ASC`,
    [range.sqlFrom, range.sqlTo],
  );

  return rows.map((row) => ({
    menuItemId: row.menu_item_id,
    name: row.name,
    category: row.category,
    active: Boolean(row.active),
    price: roundMoney(toNumber(row.price)),
  }));
}

async function getTableMetrics(
  range: ResolvedAnalyticsRange,
  serviceRate: number,
): Promise<OwnerAnalyticsTableMetricDto[]> {
  const [rows] = await pool.execute<TableMetricRow[]>(
    `SELECT
       t.id AS table_id,
       t.number AS table_number,
       COUNT(order_totals.id) AS total_orders,
       COALESCE(SUM(CASE WHEN order_totals.status <> 'REJECTED' THEN 1 ELSE 0 END), 0) AS billable_orders,
       COALESCE(SUM(CASE WHEN order_totals.status = 'REJECTED' THEN 1 ELSE 0 END), 0) AS rejected_orders,
       COALESCE(SUM(CASE WHEN order_totals.status <> 'REJECTED' THEN order_totals.subtotal ELSE 0 END), 0) AS subtotal,
       COALESCE(SUM(CASE WHEN order_totals.status <> 'REJECTED' THEN ROUND(order_totals.subtotal * ?, 2) ELSE 0 END), 0) AS service_fee
     FROM \`tables\` t
     LEFT JOIN (
       SELECT o.id, o.table_id, o.status, COALESCE(SUM(${LINE_SUBTOTAL_SQL}), 0) AS subtotal
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
       ${MODIFIER_TOTAL_JOIN}
       WHERE o.created_at >= ? AND o.created_at < ?
       GROUP BY o.id, o.table_id, o.status
     ) order_totals ON order_totals.table_id = t.id
     GROUP BY t.id, t.number
     ORDER BY total_orders DESC, subtotal DESC, t.number ASC`,
    [serviceRate, range.sqlFrom, range.sqlTo],
  );

  return rows.map((row) => {
    const subtotal = roundMoney(toNumber(row.subtotal));
    const serviceFee = roundMoney(toNumber(row.service_fee));
    const revenue = roundMoney(subtotal + serviceFee);
    const billableOrders = toNumber(row.billable_orders);
    return {
      tableId: row.table_id,
      tableNumber: row.table_number,
      totalOrders: toNumber(row.total_orders),
      billableOrders,
      rejectedOrders: toNumber(row.rejected_orders),
      subtotal,
      serviceFee,
      revenue,
      averageOrderValue: billableOrders > 0 ? roundMoney(revenue / billableOrders) : 0,
    };
  });
}

async function getCurrentActiveSessions(): Promise<OwnerAnalyticsTablesDto["currentActiveSessions"]> {
  const [rows] = await pool.execute<ActiveSessionRow[]>(
    `SELECT s.id AS session_id, s.table_id, t.number AS table_number, s.last_activity
     FROM sessions s
     JOIN \`tables\` t ON t.id = s.table_id
     WHERE s.status = 'ACTIVE'
     ORDER BY s.last_activity DESC`,
  );

  return rows.map((row) => ({
    sessionId: row.session_id,
    tableId: row.table_id,
    tableNumber: row.table_number,
    lastActivity: new Date(row.last_activity).toISOString(),
  }));
}

async function getCurrentStatusMap(): Promise<Map<OrderStatus, number>> {
  const [rows] = await pool.execute<StatusCountRow[]>(
    `SELECT status, COUNT(*) AS count
     FROM orders
     WHERE status IN ('NEW', 'ACCEPTED', 'COOKING', 'READY')
     GROUP BY status`,
  );
  return new Map(rows.map((row) => [row.status, toNumber(row.count)]));
}

function createPresetRange(preset: Exclude<OwnerAnalyticsRangePreset, "custom">): ResolvedAnalyticsRange {
  return resolveOwnerAnalyticsRange({ range: preset });
}

export async function getOwnerAnalyticsSummary(range: ResolvedAnalyticsRange): Promise<OwnerAnalyticsSummaryDto> {
  const settings = await getRestaurantSettings();
  const todayRange = createPresetRange("today");
  const weekRange = makeRange("last7days", startOfWeek(new Date()), addDays(startOfDay(new Date()), 1));
  const monthRange = createPresetRange("this_month");

  const [
    selectedAggregate,
    todayAggregate,
    weekRevenue,
    monthRevenue,
    activeOrdersNow,
    mostPopularDish,
    leastPopularDish,
  ] = await Promise.all([
    getOrderAggregate(range, settings.serviceRate),
    getOrderAggregate(todayRange, settings.serviceRate),
    getRevenue(weekRange, settings.serviceRate),
    getRevenue(monthRange, settings.serviceRate),
    getActiveOrderCount(),
    getDishMetric(range, settings.serviceRate, "best"),
    getDishMetric(range, settings.serviceRate, "worst"),
  ]);

  const subtotalRevenue = roundMoney(toNumber(selectedAggregate.subtotal));
  const serviceFeeTotal = roundMoney(toNumber(selectedAggregate.service_fee));
  const totalRevenue = roundMoney(subtotalRevenue + serviceFeeTotal);
  const billableOrders = toNumber(selectedAggregate.billable_orders);
  const todayRevenue = revenueFromParts(
    toNumber(todayAggregate.subtotal),
    toNumber(todayAggregate.service_fee),
    toNumber(todayAggregate.billable_orders),
  );

  return {
    range: range.dto,
    totalRevenue,
    subtotalRevenue,
    serviceFeeTotal,
    totalOrders: toNumber(selectedAggregate.total_orders),
    billableOrders,
    ordersToday: toNumber(todayAggregate.total_orders),
    revenueToday: todayRevenue.total,
    revenueThisWeek: weekRevenue.total,
    revenueThisMonth: monthRevenue.total,
    averageOrderValue: billableOrders > 0 ? roundMoney(totalRevenue / billableOrders) : 0,
    rejectedOrders: toNumber(selectedAggregate.rejected_orders),
    cancelledOrRejectedOrders: toNumber(selectedAggregate.rejected_orders),
    activeOrdersNow,
    completedOrders: toNumber(selectedAggregate.completed_orders),
    mostPopularDish,
    leastPopularDish,
  };
}

export async function getOwnerAnalyticsSales(range: ResolvedAnalyticsRange): Promise<OwnerAnalyticsSalesDto> {
  const settings = await getRestaurantSettings();
  const todayRange = createPresetRange("today");
  const yesterdayRange = createPresetRange("yesterday");
  const thisWeekStart = startOfWeek(new Date());
  const thisWeekRange = makeRange("last7days", thisWeekStart, addDays(startOfDay(new Date()), 1));
  const previousWeekRange = makeRange("last7days", addDays(thisWeekStart, -7), thisWeekStart);
  const thisMonthRange = createPresetRange("this_month");
  const previousMonthRange = createPresetRange("previous_month");

  const [
    byDay,
    byWeek,
    byMonth,
    todayRevenue,
    yesterdayRevenue,
    thisWeekRevenue,
    previousWeekRevenue,
    thisMonthRevenue,
    previousMonthRevenue,
  ] = await Promise.all([
    getSalesSeries(range, settings.serviceRate, "DATE_FORMAT(created_at, '%Y-%m-%d')"),
    getSalesSeries(range, settings.serviceRate, "DATE_FORMAT(created_at, '%x-W%v')"),
    getSalesSeries(range, settings.serviceRate, "DATE_FORMAT(created_at, '%Y-%m')"),
    getRevenue(todayRange, settings.serviceRate),
    getRevenue(yesterdayRange, settings.serviceRate),
    getRevenue(thisWeekRange, settings.serviceRate),
    getRevenue(previousWeekRange, settings.serviceRate),
    getRevenue(thisMonthRange, settings.serviceRate),
    getRevenue(previousMonthRange, settings.serviceRate),
  ]);

  return {
    range: range.dto,
    revenueByDay: byDay,
    revenueByWeek: byWeek,
    revenueByMonth: byMonth,
    dailySalesTrend: byDay,
    weeklySalesTrend: byWeek,
    monthlySalesTrend: byMonth,
    todayVsYesterday: comparison(todayRevenue, yesterdayRevenue),
    thisWeekVsPreviousWeek: comparison(thisWeekRevenue, previousWeekRevenue),
    thisMonthVsPreviousMonth: comparison(thisMonthRevenue, previousMonthRevenue),
  };
}

export async function getOwnerAnalyticsOrders(range: ResolvedAnalyticsRange): Promise<OwnerAnalyticsOrdersDto> {
  const [
    statusCounts,
    ordersByHour,
    aggregate,
    averageProcessingSeconds,
    averageAcceptanceSeconds,
    averageKitchenPreparationSeconds,
  ] = await Promise.all([
    getStatusCounts(range),
    getOrdersByHour(range),
    getOrderAggregate(range, 0),
    getAverageProcessingSeconds(range),
    getAverageAcceptanceSeconds(range),
    getAverageKitchenPreparationSeconds(range),
  ]);

  const maxHourCount = Math.max(0, ...ordersByHour.map((point) => point.count));
  const totalOrders = toNumber(aggregate.total_orders);

  return {
    range: range.dto,
    totalOrders,
    ordersByStatus: statusCounts,
    ordersByHour,
    peakHours: maxHourCount > 0 ? ordersByHour.filter((point) => point.count === maxHourCount) : [],
    averageOrdersPerDay: roundMoney(totalOrders / dayCount(range)),
    averageProcessingSeconds,
    averageAcceptanceSeconds,
    averageKitchenPreparationSeconds,
    rejectedOrderPercentage: totalOrders > 0
      ? roundMoney((toNumber(aggregate.rejected_orders) / totalOrders) * 100)
      : 0,
  };
}

export async function getOwnerAnalyticsMenu(range: ResolvedAnalyticsRange): Promise<OwnerAnalyticsMenuDto> {
  const settings = await getRestaurantSettings();
  const [dishMetrics, categoryMetrics, availabilitySummary, itemsNeverOrdered] = await Promise.all([
    getDishMetrics(range, settings.serviceRate),
    getCategorySales(range, settings.serviceRate),
    getAvailabilitySummary(),
    getItemsNeverOrdered(range),
  ]);

  return {
    range: range.dto,
    topSellingDishes: [...dishMetrics].sort((left, right) => right.qty - left.qty || right.revenue - left.revenue).slice(0, 10),
    worstSellingDishes: [...dishMetrics].sort((left, right) => left.qty - right.qty || left.revenue - right.revenue).slice(0, 10),
    revenueByDish: dishMetrics,
    quantitySoldByDish: [...dishMetrics].sort((left, right) => right.qty - left.qty || left.name.localeCompare(right.name)),
    revenueByCategory: categoryMetrics,
    ordersByCategory: categoryMetrics.map((item) => ({ category: item.category, orders: item.orders })),
    averagePriceByCategory: categoryMetrics.map((item) => ({
      category: item.category,
      averagePrice: item.averageMenuPrice,
    })),
    availabilitySummary,
    itemsNeverOrdered,
  };
}

export async function getOwnerAnalyticsTables(range: ResolvedAnalyticsRange): Promise<OwnerAnalyticsTablesDto> {
  const settings = await getRestaurantSettings();
  const [tables, currentActiveSessions] = await Promise.all([
    getTableMetrics(range, settings.serviceRate),
    getCurrentActiveSessions(),
  ]);

  return {
    range: range.dto,
    tables,
    mostActiveTables: tables.filter((table) => table.totalOrders > 0).slice(0, 10),
    tablesWithRejectedOrders: tables.filter((table) => table.rejectedOrders > 0),
    currentActiveSessions,
  };
}

export async function getOwnerAnalyticsOperations(range: ResolvedAnalyticsRange): Promise<OwnerAnalyticsOperationsDto> {
  const todayRange = createPresetRange("today");
  const [statusMap, todayStatusEventCounts, openServiceRows, averageKitchenPreparationSeconds] = await Promise.all([
    getCurrentStatusMap(),
    getStatusEventCounts(todayRange, ["COMPLETED", "REJECTED"]),
    pool.execute<CountRow[]>("SELECT COUNT(*) AS count FROM service_requests WHERE status = 'OPEN'"),
    getAverageKitchenPreparationSeconds(todayRange),
  ]);

  const waitingForWaiterConfirmation = statusMap.get("NEW") ?? 0;
  const ordersInKitchen = (statusMap.get("ACCEPTED") ?? 0) + (statusMap.get("COOKING") ?? 0);
  const readyToServe = statusMap.get("READY") ?? 0;
  const currentActiveOrders = ACTIVE_ORDER_STATUSES.reduce((sum, status) => sum + (statusMap.get(status) ?? 0), 0);
  const reasons: string[] = [];

  if (waitingForWaiterConfirmation >= 3) reasons.push("WAITING_FOR_WAITER_CONFIRMATION");
  if (ordersInKitchen >= 5) reasons.push("KITCHEN_QUEUE");
  if (averageKitchenPreparationSeconds !== null && averageKitchenPreparationSeconds >= 20 * 60) {
    reasons.push("SLOW_KITCHEN_PREPARATION");
  }

  const high =
    waitingForWaiterConfirmation >= 5 ||
    ordersInKitchen >= 8 ||
    (averageKitchenPreparationSeconds !== null && averageKitchenPreparationSeconds >= 30 * 60);

  return {
    range: range.dto,
    currentActiveOrders,
    waitingForWaiterConfirmation,
    ordersInKitchen,
    readyToServe,
    completedToday: todayStatusEventCounts.get("COMPLETED") ?? 0,
    rejectedToday: todayStatusEventCounts.get("REJECTED") ?? 0,
    openServiceRequests: toNumber(openServiceRows[0][0]?.count),
    bottleneck: {
      level: reasons.length === 0 ? "none" : high ? "high" : "medium",
      reasons,
      averageKitchenPreparationSeconds,
    },
  };
}
