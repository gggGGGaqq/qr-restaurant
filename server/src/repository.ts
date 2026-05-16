import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { config } from "./config";
import { pool, withTransaction } from "./db";
import { HttpError, assertFound } from "./errors";
import type {
  CreateOrderInput,
  MenuCategory,
  MenuItemDto,
  MenuModifierDto,
  OrderDto,
  OrderItemDto,
  OrderItemModifierDto,
  OrderStatus,
  OwnerSummaryDto,
  RestaurantSettingsDto,
  ServiceRequestDto,
  ServiceRequestStatus,
  ServiceRequestType,
  SessionStatus,
  TableDto,
  TableSessionDto,
} from "./types";

type Db = Pool | PoolConnection;

interface TableRow extends RowDataPacket {
  id: number;
  number: string;
}

interface SessionRow extends RowDataPacket {
  id: string;
  table_id: number;
  table_number: string;
  status: SessionStatus;
  created_at: Date;
  last_activity: Date;
}

interface MenuItemRow extends RowDataPacket {
  id: number;
  category: MenuCategory;
  name: string;
  price: number;
  description: string | null;
  image: string | null;
  active: 0 | 1 | boolean;
}

interface MenuModifierRow extends RowDataPacket {
  id: number;
  menu_item_id: number;
  name: string;
  price_delta: number;
  active: 0 | 1 | boolean;
  sort_order: number;
}

interface SettingsRow extends RowDataPacket {
  name: string;
  accent_color: string;
  cover_image: string | null;
  service_rate: number;
}

interface OrderRow extends RowDataPacket {
  id: string;
  table_id: number;
  table_number: string;
  session_id: string;
  status: OrderStatus;
  note: string | null;
  created_at: Date;
  updated_at: Date;
}

interface OrderItemRow extends RowDataPacket {
  id: number;
  menu_item_id: number;
  name: string;
  qty: number;
  price: number;
  note: string | null;
}

interface OrderItemModifierRow extends RowDataPacket {
  id: number;
  order_item_id: number;
  modifier_id: number | null;
  name: string;
  price_delta: number;
}

interface ServiceRequestRow extends RowDataPacket {
  id: string;
  table_id: number;
  table_number: string;
  session_id: string;
  type: ServiceRequestType;
  status: ServiceRequestStatus;
  note: string | null;
  created_at: Date;
  updated_at: Date;
}

interface PopularItemRow extends RowDataPacket {
  menu_item_id: number;
  name: string;
  qty: number;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapTable(row: TableRow): TableDto {
  return {
    id: row.id,
    number: row.number,
  };
}

function mapSession(row: SessionRow): TableSessionDto {
  return {
    id: row.id,
    tableId: row.table_id,
    tableNumber: row.table_number,
    status: row.status,
    createdAt: toIso(row.created_at),
    lastActivity: toIso(row.last_activity),
  };
}

function mapMenuModifier(row: MenuModifierRow): MenuModifierDto {
  return {
    id: row.id,
    menuItemId: row.menu_item_id,
    name: row.name,
    priceDelta: Number(row.price_delta),
    active: Boolean(row.active),
    sortOrder: Number(row.sort_order),
  };
}

function mapMenuItem(row: MenuItemRow, modifiers: MenuModifierDto[] = []): MenuItemDto {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    price: Number(row.price),
    description: row.description,
    image: row.image,
    active: Boolean(row.active),
    modifiers,
  };
}

function mapSettings(row: SettingsRow | undefined): RestaurantSettingsDto {
  return {
    name: row?.name ?? "QR Restaurant",
    accentColor: row?.accent_color ?? "#2f6f5e",
    coverImage: row?.cover_image ?? null,
    serviceRate: Number(row?.service_rate ?? 0.1),
  };
}

function mapServiceRequest(row: ServiceRequestRow): ServiceRequestDto {
  return {
    id: row.id,
    tableId: row.table_id,
    tableNumber: row.table_number,
    sessionId: row.session_id,
    type: row.type,
    status: row.status,
    note: row.note,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

async function logOrderEvent(
  connection: PoolConnection,
  orderId: string,
  eventType: string,
  fromStatus: OrderStatus | null,
  toStatus: OrderStatus,
  payload: unknown = {},
): Promise<void> {
  await connection.execute<ResultSetHeader>(
    `INSERT INTO order_events (order_id, event_type, from_status, to_status, payload)
     VALUES (?, ?, ?, ?, ?)`,
    [orderId, eventType, fromStatus, toStatus, JSON.stringify(payload)],
  );
}

async function logSessionEvent(
  connection: PoolConnection,
  sessionId: string,
  eventType: string,
  payload: unknown = {},
): Promise<void> {
  await connection.execute<ResultSetHeader>(
    `INSERT INTO session_events (session_id, event_type, payload)
     VALUES (?, ?, ?)`,
    [sessionId, eventType, JSON.stringify(payload)],
  );
}

export async function expireInactiveSessions(db: Db = pool): Promise<number> {
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE sessions
     SET status = 'EXPIRED'
     WHERE status = 'ACTIVE'
       AND last_activity < DATE_SUB(NOW(), INTERVAL ${config.sessionTimeoutMinutes} MINUTE)`,
  );

  return result.affectedRows;
}

export async function listTables(): Promise<TableDto[]> {
  const [rows] = await pool.execute<TableRow[]>(
    "SELECT id, number FROM `tables` ORDER BY CAST(number AS UNSIGNED), number",
  );

  return rows.map(mapTable);
}

export async function createTable(input: { number: string }): Promise<TableDto> {
  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO `tables` (number) VALUES (?)",
    [input.number],
  );

  const [rows] = await pool.execute<TableRow[]>(
    "SELECT id, number FROM `tables` WHERE id = ?",
    [result.insertId],
  );

  return mapTable(assertFound(rows[0], "Table not found after creation"));
}

export async function updateTable(id: number, input: { number?: string }): Promise<TableDto> {
  const [rows] = await pool.execute<TableRow[]>(
    "SELECT id, number FROM `tables` WHERE id = ?",
    [id],
  );

  const current = assertFound(rows[0], "Table not found");

  await pool.execute<ResultSetHeader>(
    "UPDATE `tables` SET number = ? WHERE id = ?",
    [input.number ?? current.number, id],
  );

  return mapTable({
    ...current,
    number: input.number ?? current.number,
  });
}

export async function getRestaurantSettings(): Promise<RestaurantSettingsDto> {
  const [rows] = await pool.execute<SettingsRow[]>(
    "SELECT name, accent_color, cover_image, service_rate FROM restaurant_settings WHERE id = 1",
  );

  return mapSettings(rows[0]);
}

export async function updateRestaurantSettings(input: {
  name: string;
  accentColor: string;
  coverImage?: string | null;
  serviceRate: number;
}): Promise<RestaurantSettingsDto> {
  await pool.execute<ResultSetHeader>(
    `INSERT INTO restaurant_settings (id, name, accent_color, cover_image, service_rate)
     VALUES (1, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       accent_color = VALUES(accent_color),
       cover_image = VALUES(cover_image),
       service_rate = VALUES(service_rate)`,
    [input.name, input.accentColor, input.coverImage ?? null, input.serviceRate],
  );

  return getRestaurantSettings();
}

export async function listMenuItems(options: { includeInactive?: boolean } = {}): Promise<MenuItemDto[]> {
  const [itemRows] = await pool.execute<MenuItemRow[]>(
    `SELECT id, category, name, price, description, image, active
     FROM menu_items
     ${options.includeInactive ? "" : "WHERE active = TRUE"}
     ORDER BY id`,
  );

  if (itemRows.length === 0) return [];

  const ids = itemRows.map((item) => item.id);
  const placeholders = ids.map(() => "?").join(", ");
  const [modifierRows] = await pool.execute<MenuModifierRow[]>(
    `SELECT id, menu_item_id, name, price_delta, active, sort_order
     FROM menu_item_modifiers
     WHERE menu_item_id IN (${placeholders})
       ${options.includeInactive ? "" : "AND active = TRUE"}
     ORDER BY menu_item_id, sort_order, id`,
    ids,
  );

  const modifiersByItem = new Map<number, MenuModifierDto[]>();
  for (const row of modifierRows) {
    const modifier = mapMenuModifier(row);
    modifiersByItem.set(modifier.menuItemId, [
      ...(modifiersByItem.get(modifier.menuItemId) ?? []),
      modifier,
    ]);
  }

  return itemRows.map((row) => mapMenuItem(row, modifiersByItem.get(row.id) ?? []));
}

export async function createMenuItem(input: {
  category: MenuCategory;
  name: string;
  price: number;
  description?: string | null;
  image?: string | null;
  active?: boolean;
}): Promise<MenuItemDto> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO menu_items (category, name, price, description, image, active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.category,
      input.name,
      input.price,
      input.description ?? null,
      input.image ?? null,
      input.active ?? true,
    ],
  );

  const items = await listMenuItems({ includeInactive: true });
  return assertFound(items.find((item) => item.id === result.insertId), "Позиция меню не найдена после создания");
}

export async function updateMenuItem(
  id: number,
  input: {
    category?: MenuCategory;
    name?: string;
    price?: number;
    description?: string | null;
    image?: string | null;
    active?: boolean;
  },
): Promise<MenuItemDto> {
  const current = assertFound(
    (await listMenuItems({ includeInactive: true })).find((item) => item.id === id),
    "Позиция меню не найдена",
  );

  await pool.execute<ResultSetHeader>(
    `UPDATE menu_items
     SET category = ?, name = ?, price = ?, description = ?, image = ?, active = ?
     WHERE id = ?`,
    [
      input.category ?? current.category,
      input.name ?? current.name,
      input.price ?? current.price,
      input.description === undefined ? current.description : input.description,
      input.image === undefined ? current.image : input.image,
      input.active === undefined ? current.active : input.active,
      id,
    ],
  );

  return assertFound(
    (await listMenuItems({ includeInactive: true })).find((item) => item.id === id),
    "Позиция меню не найдена после обновления",
  );
}

export async function createMenuModifier(
  menuItemId: number,
  input: {
    name: string;
    priceDelta: number;
    active?: boolean;
    sortOrder?: number;
  },
): Promise<MenuModifierDto> {
  await pool.execute<ResultSetHeader>(
    `INSERT INTO menu_item_modifiers (menu_item_id, name, price_delta, active, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
    [
      menuItemId,
      input.name,
      input.priceDelta,
      input.active ?? true,
      input.sortOrder ?? 0,
    ],
  );

  const menuItem = assertFound(
    (await listMenuItems({ includeInactive: true })).find((item) => item.id === menuItemId),
    "Menu item not found after modifier creation",
  );

  return assertFound(
    [...menuItem.modifiers].sort((a, b) => b.id - a.id)[0],
    "Modifier not found after creation",
  );
}

export async function updateMenuModifier(
  modifierId: number,
  input: {
    name?: string;
    priceDelta?: number;
    active?: boolean;
    sortOrder?: number;
  },
): Promise<MenuModifierDto> {
  const [rows] = await pool.execute<MenuModifierRow[]>(
    `SELECT id, menu_item_id, name, price_delta, active, sort_order
     FROM menu_item_modifiers
     WHERE id = ?`,
    [modifierId],
  );

  const current = assertFound(rows[0], "Modifier not found");

  await pool.execute<ResultSetHeader>(
    `UPDATE menu_item_modifiers
     SET name = ?, price_delta = ?, active = ?, sort_order = ?
     WHERE id = ?`,
    [
      input.name ?? current.name,
      input.priceDelta ?? Number(current.price_delta),
      input.active ?? Boolean(current.active),
      input.sortOrder ?? Number(current.sort_order),
      modifierId,
    ],
  );

  const menuItem = assertFound(
    (await listMenuItems({ includeInactive: true })).find((item) => item.id === current.menu_item_id),
    "Menu item not found after modifier update",
  );

  return assertFound(
    menuItem.modifiers.find((modifier) => modifier.id === modifierId),
    "Modifier not found after update",
  );
}

export async function createTableSession(tableId: number): Promise<TableSessionDto> {
  await expireInactiveSessions();

  const sessionId = randomUUID();

  await withTransaction(async (connection) => {
    const [tables] = await connection.execute<TableRow[]>(
      "SELECT id, number FROM `tables` WHERE id = ?",
      [tableId],
    );
    const table = assertFound(tables[0], "Стол не найден");

    await connection.execute<ResultSetHeader>(
      `INSERT INTO sessions (id, table_id, status, created_at, last_activity)
       VALUES (?, ?, 'ACTIVE', NOW(), NOW())`,
      [sessionId, table.id],
    );

    await logSessionEvent(connection, sessionId, "SESSION_CREATED", {
      tableId: table.id,
      tableNumber: table.number,
    });
  });

  const [sessions] = await pool.execute<SessionRow[]>(
    `SELECT s.id, s.table_id, t.number AS table_number, s.status, s.created_at, s.last_activity
     FROM sessions s
     JOIN ` + "`tables`" + ` t ON t.id = s.table_id
     WHERE s.id = ?`,
    [sessionId],
  );

  return mapSession(assertFound(sessions[0], "Сессия не найдена после создания"));
}

export async function getTableSession(sessionId: string): Promise<TableSessionDto> {
  await expireInactiveSessions();

  const [sessions] = await pool.execute<SessionRow[]>(
    `SELECT s.id, s.table_id, t.number AS table_number, s.status, s.created_at, s.last_activity
     FROM sessions s
     JOIN ` + "`tables`" + ` t ON t.id = s.table_id
     WHERE s.id = ?`,
    [sessionId],
  );

  return mapSession(assertFound(sessions[0], "Session not found"));
}

export async function getSessionOrders(sessionId: string): Promise<OrderDto[]> {
  await expireInactiveSessions();
  const [sessions] = await pool.execute<SessionRow[]>(
    `SELECT s.id, s.table_id, t.number AS table_number, s.status, s.created_at, s.last_activity
     FROM sessions s
     JOIN ` + "`tables`" + ` t ON t.id = s.table_id
     WHERE s.id = ?`,
    [sessionId],
  );

  assertFound(sessions[0], "Сессия не найдена");

  const [rows] = await pool.execute<OrderRow[]>(
    `SELECT o.id, o.table_id, t.number AS table_number, o.session_id, o.status, o.note, o.created_at, o.updated_at
     FROM orders o
     JOIN ` + "`tables`" + ` t ON t.id = o.table_id
     WHERE o.session_id = ?
     ORDER BY o.created_at DESC`,
    [sessionId],
  );

  return Promise.all(rows.map((row) => hydrateOrder(row)));
}

async function hydrateOrder(row: OrderRow): Promise<OrderDto> {
  const settings = await getRestaurantSettings();
  const [itemRows] = await pool.execute<OrderItemRow[]>(
    `SELECT oi.id, oi.menu_item_id, oi.qty, oi.note, mi.name, mi.price
     FROM order_items oi
     JOIN menu_items mi ON mi.id = oi.menu_item_id
     WHERE oi.order_id = ?
     ORDER BY oi.id`,
    [row.id],
  );

  const itemIds = itemRows.map((item) => item.id);
  let modifiersByOrderItem = new Map<number, OrderItemModifierDto[]>();

  if (itemIds.length > 0) {
    const placeholders = itemIds.map(() => "?").join(", ");
    const [modifierRows] = await pool.execute<OrderItemModifierRow[]>(
      `SELECT id, order_item_id, modifier_id, name, price_delta
       FROM order_item_modifiers
       WHERE order_item_id IN (${placeholders})
       ORDER BY id`,
      itemIds,
    );

    modifiersByOrderItem = modifierRows.reduce((map, modifier) => {
      const dto: OrderItemModifierDto = {
        id: modifier.id,
        modifierId: modifier.modifier_id,
        name: modifier.name,
        priceDelta: Number(modifier.price_delta),
      };
      map.set(modifier.order_item_id, [...(map.get(modifier.order_item_id) ?? []), dto]);
      return map;
    }, new Map<number, OrderItemModifierDto[]>());
  }

  const items: OrderItemDto[] = itemRows.map((item) => {
    const price = Number(item.price);
    const qty = Number(item.qty);
    const modifiers = modifiersByOrderItem.get(item.id) ?? [];
    const modifiersTotal = modifiers.reduce((sum, modifier) => sum + modifier.priceDelta, 0);
    const lineTotal = Number(((price + modifiersTotal) * qty).toFixed(2));

    return {
      id: item.id,
      menuItemId: item.menu_item_id,
      name: item.name,
      qty,
      price,
      note: item.note,
      modifiers,
      lineTotal,
    };
  });

  const total = Number(items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));
  const serviceFee = Number((total * settings.serviceRate).toFixed(2));

  return {
    id: row.id,
    tableId: row.table_id,
    tableNumber: row.table_number,
    sessionId: row.session_id,
    status: row.status,
    note: row.note,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    items,
    total,
    serviceFee,
    totalWithService: Number((total + serviceFee).toFixed(2)),
  };
}

export async function getOrderById(orderId: string): Promise<OrderDto | null> {
  const [rows] = await pool.execute<OrderRow[]>(
    `SELECT o.id, o.table_id, t.number AS table_number, o.session_id, o.status, o.note, o.created_at, o.updated_at
     FROM orders o
     JOIN ` + "`tables`" + ` t ON t.id = o.table_id
     WHERE o.id = ?`,
    [orderId],
  );

  if (!rows[0]) return null;
  return hydrateOrder(rows[0]);
}

export async function listOrdersByStatus(statuses: OrderStatus[]): Promise<OrderDto[]> {
  if (statuses.length === 0) return [];

  const placeholders = statuses.map(() => "?").join(", ");
  const [rows] = await pool.execute<OrderRow[]>(
    `SELECT o.id, o.table_id, t.number AS table_number, o.session_id, o.status, o.note, o.created_at, o.updated_at
     FROM orders o
     JOIN ` + "`tables`" + ` t ON t.id = o.table_id
     WHERE o.status IN (${placeholders})
     ORDER BY o.created_at ASC`,
    statuses,
  );

  return Promise.all(rows.map((row) => hydrateOrder(row)));
}

export async function createOrder(
  input: CreateOrderInput,
): Promise<{ order: OrderDto; created: boolean }> {
  const existing = await getOrderById(input.orderId);
  if (existing) {
    return { order: existing, created: false };
  }

  try {
    await withTransaction(async (connection) => {
      await expireInactiveSessions(connection);

      const [sessions] = await connection.execute<SessionRow[]>(
        `SELECT s.id, s.table_id, t.number AS table_number, s.status, s.created_at, s.last_activity
         FROM sessions s
         JOIN ` + "`tables`" + ` t ON t.id = s.table_id
         WHERE s.id = ?
         FOR UPDATE`,
        [input.sessionId],
      );

      const session = assertFound(sessions[0], "Session not found");
      if (session.status !== "ACTIVE") {
        throw new HttpError(409, "Сессия уже неактивна");
      }
      if (session.table_id !== input.tableId) {
        throw new HttpError(400, "Сессия не принадлежит этому столу");
      }

      const menuIds = [...new Set(input.items.map((item) => item.menuItemId))];
      const placeholders = menuIds.map(() => "?").join(", ");
      const [menuRows] = await connection.execute<MenuItemRow[]>(
        `SELECT id, category, name, price, description, image, active
         FROM menu_items
         WHERE active = TRUE
           AND id IN (${placeholders})`,
        menuIds,
      );
      const validMenuIds = new Set(menuRows.map((item) => item.id));
      const invalidItem = input.items.find((item) => !validMenuIds.has(item.menuItemId));
      if (invalidItem) {
        throw new HttpError(400, `Позиция меню ${invalidItem.menuItemId} недоступна`);
      }

      const modifierIds = [
        ...new Set(input.items.flatMap((item) => item.modifierIds ?? [])),
      ];
      const modifiersById = new Map<number, MenuModifierRow>();

      if (modifierIds.length > 0) {
        const modifierPlaceholders = modifierIds.map(() => "?").join(", ");
        const [modifierRows] = await connection.execute<MenuModifierRow[]>(
          `SELECT id, menu_item_id, name, price_delta, active
           FROM menu_item_modifiers
           WHERE active = TRUE
             AND id IN (${modifierPlaceholders})`,
          modifierIds,
        );
        for (const modifier of modifierRows) {
          modifiersById.set(modifier.id, modifier);
        }

        const missingModifierId = modifierIds.find((id) => !modifiersById.has(id));
        if (missingModifierId) {
          throw new HttpError(400, `Модификатор ${missingModifierId} недоступен`);
        }
      }

      await connection.execute<ResultSetHeader>(
        `INSERT INTO orders (id, table_id, session_id, status, note, created_at, updated_at)
         VALUES (?, ?, ?, 'NEW', ?, NOW(), NOW())`,
        [input.orderId, input.tableId, input.sessionId, input.note ?? null],
      );

      for (const item of input.items) {
        for (const modifierId of item.modifierIds ?? []) {
          const modifier = assertFound(modifiersById.get(modifierId), "Модификатор не найден");
          if (modifier.menu_item_id !== item.menuItemId) {
            throw new HttpError(400, `Модификатор ${modifier.name} не подходит к выбранному блюду`);
          }
        }

        const [insertResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO order_items (order_id, menu_item_id, qty, note)
           VALUES (?, ?, ?, ?)`,
          [input.orderId, item.menuItemId, item.qty, item.note ?? null],
        );

        for (const modifierId of item.modifierIds ?? []) {
          const modifier = assertFound(modifiersById.get(modifierId), "Модификатор не найден");
          await connection.execute<ResultSetHeader>(
            `INSERT INTO order_item_modifiers (order_item_id, modifier_id, name, price_delta)
             VALUES (?, ?, ?, ?)`,
            [insertResult.insertId, modifier.id, modifier.name, modifier.price_delta],
          );
        }
      }

      await connection.execute<ResultSetHeader>(
        "UPDATE sessions SET last_activity = NOW() WHERE id = ?",
        [input.sessionId],
      );

      await logOrderEvent(connection, input.orderId, "ORDER_CREATED", null, "NEW", {
        tableId: input.tableId,
        itemCount: input.items.length,
      });
    });
  } catch (error) {
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
      const order = await getOrderById(input.orderId);
      if (order) return { order, created: false };
    }
    throw error;
  }

  return {
    order: assertFound(await getOrderById(input.orderId), "Заказ не найден после создания"),
    created: true,
  };
}

export async function transitionOrderStatus(
  orderId: string,
  allowedFrom: OrderStatus[],
  toStatus: OrderStatus,
  eventType: string,
): Promise<OrderDto> {
  await withTransaction(async (connection) => {
    const [rows] = await connection.execute<OrderRow[]>(
      `SELECT o.id, o.table_id, t.number AS table_number, o.session_id, o.status, o.note, o.created_at, o.updated_at
       FROM orders o
       JOIN ` + "`tables`" + ` t ON t.id = o.table_id
       WHERE o.id = ?
       FOR UPDATE`,
      [orderId],
    );

    const order = assertFound(rows[0], "Заказ не найден");
    if (order.status === toStatus) {
      return;
    }
    if (!allowedFrom.includes(order.status)) {
      throw new HttpError(
        409,
        `Нельзя перевести заказ из статуса ${order.status} в ${toStatus}`,
      );
    }

    await connection.execute<ResultSetHeader>(
      "UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?",
      [toStatus, orderId],
    );

    await logOrderEvent(connection, orderId, eventType, order.status, toStatus, {
      tableId: order.table_id,
      sessionId: order.session_id,
    });
  });

  return assertFound(await getOrderById(orderId), "Заказ не найден после смены статуса");
}

export async function createServiceRequest(input: {
  tableId: number;
  sessionId: string;
  type: ServiceRequestType;
  note?: string | null;
}): Promise<ServiceRequestDto> {
  await expireInactiveSessions();
  const requestId = randomUUID();

  await withTransaction(async (connection) => {
    const [sessions] = await connection.execute<SessionRow[]>(
      `SELECT s.id, s.table_id, t.number AS table_number, s.status, s.created_at, s.last_activity
       FROM sessions s
       JOIN ` + "`tables`" + ` t ON t.id = s.table_id
       WHERE s.id = ?
       FOR UPDATE`,
      [input.sessionId],
    );

    const session = assertFound(sessions[0], "Сессия не найдена");
    if (session.status !== "ACTIVE") {
      throw new HttpError(409, "Сессия уже неактивна");
    }
    if (session.table_id !== input.tableId) {
      throw new HttpError(400, "Сессия не принадлежит этому столу");
    }

    await connection.execute<ResultSetHeader>(
      `INSERT INTO service_requests (id, table_id, session_id, type, status, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'OPEN', ?, NOW(), NOW())`,
      [requestId, input.tableId, input.sessionId, input.type, input.note ?? null],
    );

    await connection.execute<ResultSetHeader>(
      "UPDATE sessions SET last_activity = NOW() WHERE id = ?",
      [input.sessionId],
    );

    await logSessionEvent(connection, input.sessionId, "SERVICE_REQUEST_CREATED", {
      type: input.type,
      tableId: input.tableId,
    });
  });

  return assertFound(await getServiceRequestById(requestId), "Запрос официанту не найден после создания");
}

export async function getServiceRequestById(id: string): Promise<ServiceRequestDto | null> {
  const [rows] = await pool.execute<ServiceRequestRow[]>(
    `SELECT sr.id, sr.table_id, t.number AS table_number, sr.session_id, sr.type, sr.status, sr.note, sr.created_at, sr.updated_at
     FROM service_requests sr
     JOIN ` + "`tables`" + ` t ON t.id = sr.table_id
     WHERE sr.id = ?`,
    [id],
  );

  return rows[0] ? mapServiceRequest(rows[0]) : null;
}

export async function listServiceRequests(
  statuses: ServiceRequestStatus[] = ["OPEN"],
): Promise<ServiceRequestDto[]> {
  if (statuses.length === 0) return [];
  const placeholders = statuses.map(() => "?").join(", ");
  const [rows] = await pool.execute<ServiceRequestRow[]>(
    `SELECT sr.id, sr.table_id, t.number AS table_number, sr.session_id, sr.type, sr.status, sr.note, sr.created_at, sr.updated_at
     FROM service_requests sr
     JOIN ` + "`tables`" + ` t ON t.id = sr.table_id
     WHERE sr.status IN (${placeholders})
     ORDER BY sr.created_at ASC`,
    statuses,
  );

  return rows.map(mapServiceRequest);
}

export async function completeServiceRequest(id: string): Promise<ServiceRequestDto> {
  const [result] = await pool.execute<ResultSetHeader>(
    "UPDATE service_requests SET status = 'DONE', updated_at = NOW() WHERE id = ? AND status = 'OPEN'",
    [id],
  );

  if (result.affectedRows === 0) {
    assertFound(await getServiceRequestById(id), "Запрос официанту не найден");
  }

  return assertFound(await getServiceRequestById(id), "Запрос официанту не найден после обновления");
}

export async function getOwnerSummary(): Promise<OwnerSummaryDto> {
  const settings = await getRestaurantSettings();
  const [orderRows] = await pool.execute<OrderRow[]>(
    `SELECT o.id, o.table_id, t.number AS table_number, o.session_id, o.status, o.note, o.created_at, o.updated_at
     FROM orders o
     JOIN ` + "`tables`" + ` t ON t.id = o.table_id
     WHERE o.created_at >= CURDATE()
       AND o.status <> 'REJECTED'
     ORDER BY o.created_at ASC`,
  );

  const orders = await Promise.all(orderRows.map((row) => hydrateOrder(row)));
  const revenueToday = Number(
    orders.reduce((sum, order) => sum + order.totalWithService, 0).toFixed(2),
  );

  const [activeSessionRows] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(DISTINCT table_id) AS count FROM sessions WHERE status = 'ACTIVE'",
  );
  const [serviceRows] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM service_requests WHERE status = 'OPEN'",
  );
  const [popularRows] = await pool.execute<PopularItemRow[]>(
    `SELECT oi.menu_item_id, mi.name, SUM(oi.qty) AS qty
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN menu_items mi ON mi.id = oi.menu_item_id
     WHERE o.created_at >= CURDATE()
       AND o.status <> 'REJECTED'
     GROUP BY oi.menu_item_id, mi.name
     ORDER BY qty DESC
     LIMIT 5`,
  );

  return {
    ordersToday: orders.length,
    revenueToday,
    averageCheck: orders.length > 0 ? Number((revenueToday / orders.length).toFixed(2)) : 0,
    activeTables: Number(activeSessionRows[0]?.count ?? 0),
    openServiceRequests: Number(serviceRows[0]?.count ?? 0),
    popularItems: popularRows.map((row) => ({
      menuItemId: row.menu_item_id,
      name: row.name,
      qty: Number(row.qty),
    })),
  };
}
