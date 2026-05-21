import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import morgan from "morgan";
import { ZodError, z } from "zod";
import { createRoleSession, requireRole, verifyRolePassword } from "./auth";
import { config } from "./config";
import { pingDatabase } from "./db";
import { HttpError } from "./errors";
import { menuCategories } from "./types";
import {
  completeServiceRequest,
  createMenuModifier,
  createMenuItem,
  createOrder,
  createServiceRequest,
  createTable,
  createTableSession,
  getOrderById,
  getOwnerSummary,
  getRestaurantSettings,
  getSessionOrders,
  getTableSession,
  listMenuItems,
  listOrdersByStatus,
  listServiceRequests,
  listTables,
  transitionOrderStatus,
  updateMenuModifier,
  updateMenuItem,
  updateRestaurantSettings,
  updateTable,
} from "./repository";
import {
  publishMenuUpdated,
  publishOrderAccepted,
  publishOrderCreated,
  publishOrderReady,
  publishOrderUpdated,
  publishServiceRequestCreated,
  publishServiceRequestUpdated,
  publishSettingsUpdated,
} from "./realtime";

const uuidParamSchema = z.string().uuid();
const idParamSchema = z.coerce.number().int().positive();

const createSessionSchema = z.object({
  tableId: z.coerce.number().int().positive(),
});

const tableSchema = z.object({
  number: z.string().trim().min(1).max(24),
});

const createOrderSchema = z.object({
  orderId: z.string().uuid(),
  tableId: z.coerce.number().int().positive(),
  sessionId: z.string().uuid(),
  note: z.string().trim().max(500).optional().nullable(),
  items: z
    .array(
      z.object({
        menuItemId: z.coerce.number().int().positive(),
        qty: z.coerce.number().int().min(1).max(20),
        note: z.string().trim().max(300).optional().nullable(),
        modifierIds: z.array(z.coerce.number().int().positive()).max(10).optional(),
      }),
    )
    .min(1)
    .max(50),
});

const menuItemSchema = z.object({
  category: z.enum(menuCategories),
  name: z.string().trim().min(2).max(120),
  price: z.coerce.number().positive().max(1000000),
  description: z.string().trim().max(1000).optional().nullable(),
  image: z.string().trim().max(500).optional().nullable(),
  active: z.boolean().optional(),
});

const updateMenuItemSchema = menuItemSchema.partial();

const menuModifierSchema = z.object({
  name: z.string().trim().min(1).max(120),
  priceDelta: z.coerce.number().min(0).max(1000000),
  active: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

const updateMenuModifierSchema = menuModifierSchema.partial();

const settingsSchema = z.object({
  name: z.string().trim().min(2).max(80),
  accentColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/),
  coverImage: z.string().trim().max(500).optional().nullable(),
  serviceRate: z.coerce.number().min(0).max(0.25),
});

const imageUploadSchema = z.object({
  fileName: z.string().trim().max(180).optional(),
  dataUrl: z.string().max(7_000_000),
});

const serviceRequestSchema = z.object({
  tableId: z.coerce.number().int().positive(),
  sessionId: z.string().uuid(),
  type: z.enum(["WAITER", "WATER", "BILL", "CLEANUP"]),
  note: z.string().trim().max(300).optional().nullable(),
});

const authLoginSchema = z.object({
  role: z.enum(["waiter", "kitchen", "admin", "owner"]),
  password: z.string().min(1).max(200),
});

function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

const dbConnectionCodes = new Set([
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "PROTOCOL_CONNECTION_LOST",
  "ER_ACCESS_DENIED_ERROR",
  "ER_BAD_DB_ERROR",
]);

const uploadRoot = path.resolve(__dirname, "..", "..", "uploads");
const imageExtensionsByMime: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function parseImageDataUrl(dataUrl: string): { buffer: Buffer; extension: string } {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new HttpError(400, "Можно загрузить только JPG, PNG или WebP.");
  }

  const extension = imageExtensionsByMime[match[1]];
  const buffer = Buffer.from(match[2], "base64");

  if (!extension || buffer.length === 0) {
    throw new HttpError(400, "Не удалось прочитать изображение.");
  }

  if (buffer.length > 5 * 1024 * 1024) {
    throw new HttpError(400, "Изображение слишком большое. Максимум 5 МБ.");
  }

  return { buffer, extension };
}

function safeUploadName(fileName = "image"): string {
  return (
    fileName
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "image"
  );
}

function isDatabaseConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const candidate = error as {
    code?: unknown;
    errors?: unknown;
    cause?: unknown;
  };

  if (typeof candidate.code === "string" && dbConnectionCodes.has(candidate.code)) {
    return true;
  }

  if (Array.isArray(candidate.errors)) {
    return candidate.errors.some((item) => isDatabaseConnectionError(item));
  }

  if (candidate.cause) {
    return isDatabaseConnectionError(candidate.cause);
  }

  return false;
}

export function createApp() {
  const app = express();
  const waiterOnly = requireRole("waiter");
  const kitchenOnly = requireRole("kitchen");
  const adminOnly = requireRole("admin");
  const ownerOnly = requireRole("owner");

  app.use(cors({ origin: config.clientUrl }));
  app.use(express.json({ limit: "8mb" }));
  app.use(morgan("dev"));
  app.use("/uploads", express.static(uploadRoot, { immutable: true, maxAge: "365d" }));

  app.get(
    "/health",
    asyncHandler(async (_req, res) => {
      await pingDatabase();
      res.json({ ok: true });
    }),
  );

  app.post(
    "/api/auth/login",
    asyncHandler(async (req, res) => {
      const { role, password } = authLoginSchema.parse(req.body);
      if (!verifyRolePassword(role, password)) {
        throw new HttpError(401, "Invalid password");
      }

      res.json({
        data: createRoleSession(role),
      });
    }),
  );

  app.get(
    "/api/settings",
    asyncHandler(async (_req, res) => {
      res.json({ data: await getRestaurantSettings() });
    }),
  );

  app.get(
    "/api/tables",
    adminOnly,
    asyncHandler(async (_req, res) => {
      res.json({ data: await listTables() });
    }),
  );

  app.post(
    "/api/admin/tables",
    adminOnly,
    asyncHandler(async (req, res) => {
      const table = await createTable(tableSchema.parse(req.body));
      res.status(201).json({ data: table });
    }),
  );

  app.patch(
    "/api/admin/tables/:tableId",
    adminOnly,
    asyncHandler(async (req, res) => {
      const tableId = idParamSchema.parse(req.params.tableId);
      const table = await updateTable(tableId, tableSchema.partial().parse(req.body));
      res.json({ data: table });
    }),
  );

  app.get(
    "/api/menu",
    asyncHandler(async (_req, res) => {
      res.json({ data: await listMenuItems() });
    }),
  );

  app.get(
    "/api/admin/menu",
    adminOnly,
    asyncHandler(async (_req, res) => {
      res.json({ data: await listMenuItems({ includeInactive: true }) });
    }),
  );

  app.post(
    "/api/admin/menu",
    adminOnly,
    asyncHandler(async (req, res) => {
      const item = await createMenuItem(menuItemSchema.parse(req.body));
      publishMenuUpdated();
      res.status(201).json({ data: item });
    }),
  );

  app.patch(
    "/api/admin/menu/:menuItemId",
    adminOnly,
    asyncHandler(async (req, res) => {
      const menuItemId = idParamSchema.parse(req.params.menuItemId);
      const item = await updateMenuItem(menuItemId, updateMenuItemSchema.parse(req.body));
      publishMenuUpdated();
      res.json({ data: item });
    }),
  );

  app.post(
    "/api/admin/uploads",
    adminOnly,
    asyncHandler(async (req, res) => {
      const input = imageUploadSchema.parse(req.body);
      const { buffer, extension } = parseImageDataUrl(input.dataUrl);
      const folder = path.join(uploadRoot, "menu");
      const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}-${safeUploadName(input.fileName)}.${extension}`;
      const host = req.get("host") ?? new URL(config.clientUrl).host;

      await mkdir(folder, { recursive: true });
      await writeFile(path.join(folder, fileName), buffer);

      res.status(201).json({
        data: {
          url: `${req.protocol}://${host}/uploads/menu/${fileName}`,
        },
      });
    }),
  );

  app.post(
    "/api/admin/menu/:menuItemId/modifiers",
    adminOnly,
    asyncHandler(async (req, res) => {
      const menuItemId = idParamSchema.parse(req.params.menuItemId);
      const modifier = await createMenuModifier(menuItemId, menuModifierSchema.parse(req.body));
      publishMenuUpdated();
      res.status(201).json({ data: modifier });
    }),
  );

  app.patch(
    "/api/admin/modifiers/:modifierId",
    adminOnly,
    asyncHandler(async (req, res) => {
      const modifierId = idParamSchema.parse(req.params.modifierId);
      const modifier = await updateMenuModifier(
        modifierId,
        updateMenuModifierSchema.parse(req.body),
      );
      publishMenuUpdated();
      res.json({ data: modifier });
    }),
  );

  app.put(
    "/api/admin/settings",
    adminOnly,
    asyncHandler(async (req, res) => {
      const settings = await updateRestaurantSettings(settingsSchema.parse(req.body));
      publishSettingsUpdated(settings);
      res.json({ data: settings });
    }),
  );

  app.get(
    "/api/owner/summary",
    ownerOnly,
    asyncHandler(async (_req, res) => {
      res.json({ data: await getOwnerSummary() });
    }),
  );

  app.post(
    "/api/sessions",
    asyncHandler(async (req, res) => {
      const input = createSessionSchema.parse(req.body);
      const session = await createTableSession(input.tableId);
      res.status(201).json({ data: session });
    }),
  );

  app.get(
    "/api/sessions/:sessionId",
    asyncHandler(async (req, res) => {
      const sessionId = uuidParamSchema.parse(req.params.sessionId);
      res.json({ data: await getTableSession(sessionId) });
    }),
  );

  app.get(
    "/api/sessions/:sessionId/orders",
    asyncHandler(async (req, res) => {
      const sessionId = uuidParamSchema.parse(req.params.sessionId);
      res.json({ data: await getSessionOrders(sessionId) });
    }),
  );

  app.post(
    "/api/orders",
    asyncHandler(async (req, res) => {
      const input = createOrderSchema.parse(req.body);
      const result = await createOrder(input);
      if (result.created) {
        publishOrderCreated(result.order);
      }

      res.status(result.created ? 201 : 200).json({
        data: result.order,
        meta: { idempotent: !result.created },
      });
    }),
  );

  app.get(
    "/api/orders/:orderId",
    asyncHandler(async (req, res) => {
      const orderId = uuidParamSchema.parse(req.params.orderId);
      const order = await getOrderById(orderId);
      if (!order) {
        throw new HttpError(404, "Заказ не найден");
      }
      res.json({ data: order });
    }),
  );

  app.get(
    "/api/waiter/orders",
    waiterOnly,
    asyncHandler(async (_req, res) => {
      res.json({
        data: await listOrdersByStatus(["NEW", "ACCEPTED", "COOKING", "READY"]),
      });
    }),
  );

  app.get(
    "/api/waiter/orders/history",
    waiterOnly,
    asyncHandler(async (_req, res) => {
      res.json({
        data: await listOrdersByStatus(["COMPLETED", "REJECTED"]),
      });
    }),
  );

  app.get(
    "/api/waiter/service-requests",
    waiterOnly,
    asyncHandler(async (_req, res) => {
      res.json({ data: await listServiceRequests(["OPEN"]) });
    }),
  );

  app.get(
    "/api/kitchen/orders",
    kitchenOnly,
    asyncHandler(async (_req, res) => {
      res.json({ data: await listOrdersByStatus(["ACCEPTED", "COOKING"]) });
    }),
  );

  app.get(
    "/api/kitchen/orders/history",
    kitchenOnly,
    asyncHandler(async (_req, res) => {
      res.json({ data: await listOrdersByStatus(["READY", "COMPLETED"]) });
    }),
  );

  app.post(
    "/api/service-requests",
    asyncHandler(async (req, res) => {
      const request = await createServiceRequest(serviceRequestSchema.parse(req.body));
      publishServiceRequestCreated(request);
      res.status(201).json({ data: request });
    }),
  );

  app.post(
    "/api/service-requests/:requestId/complete",
    waiterOnly,
    asyncHandler(async (req, res) => {
      const requestId = uuidParamSchema.parse(req.params.requestId);
      const request = await completeServiceRequest(requestId);
      publishServiceRequestUpdated(request);
      res.json({ data: request });
    }),
  );

  app.post(
    "/api/orders/:orderId/accept",
    waiterOnly,
    asyncHandler(async (req, res) => {
      const orderId = uuidParamSchema.parse(req.params.orderId);
      const order = await transitionOrderStatus(
        orderId,
        ["NEW"],
        "ACCEPTED",
        "ORDER_ACCEPTED",
      );
      publishOrderAccepted(order);
      res.json({ data: order });
    }),
  );

  app.post(
    "/api/orders/:orderId/reject",
    waiterOnly,
    asyncHandler(async (req, res) => {
      const orderId = uuidParamSchema.parse(req.params.orderId);
      const order = await transitionOrderStatus(
        orderId,
        ["NEW"],
        "REJECTED",
        "ORDER_REJECTED",
      );
      publishOrderUpdated(order);
      res.json({ data: order });
    }),
  );

  app.post(
    "/api/orders/:orderId/reopen-new",
    waiterOnly,
    asyncHandler(async (req, res) => {
      const orderId = uuidParamSchema.parse(req.params.orderId);
      const order = await transitionOrderStatus(
        orderId,
        ["REJECTED"],
        "NEW",
        "ORDER_REOPENED",
      );
      publishOrderUpdated(order);
      res.json({ data: order });
    }),
  );

  app.post(
    "/api/orders/:orderId/reopen-ready",
    waiterOnly,
    asyncHandler(async (req, res) => {
      const orderId = uuidParamSchema.parse(req.params.orderId);
      const order = await transitionOrderStatus(
        orderId,
        ["COMPLETED"],
        "READY",
        "ORDER_REOPENED",
      );
      publishOrderReady(order);
      res.json({ data: order });
    }),
  );

  app.post(
    "/api/orders/:orderId/cooking",
    kitchenOnly,
    asyncHandler(async (req, res) => {
      const orderId = uuidParamSchema.parse(req.params.orderId);
      const order = await transitionOrderStatus(
        orderId,
        ["ACCEPTED"],
        "COOKING",
        "ORDER_COOKING",
      );
      publishOrderUpdated(order);
      res.json({ data: order });
    }),
  );

  app.post(
    "/api/orders/:orderId/reopen-cooking",
    kitchenOnly,
    asyncHandler(async (req, res) => {
      const orderId = uuidParamSchema.parse(req.params.orderId);
      const order = await transitionOrderStatus(
        orderId,
        ["READY"],
        "COOKING",
        "ORDER_REOPENED",
      );
      publishOrderUpdated(order);
      res.json({ data: order });
    }),
  );

  app.post(
    "/api/orders/:orderId/ready",
    kitchenOnly,
    asyncHandler(async (req, res) => {
      const orderId = uuidParamSchema.parse(req.params.orderId);
      const order = await transitionOrderStatus(
        orderId,
        ["ACCEPTED", "COOKING"],
        "READY",
        "ORDER_READY",
      );
      publishOrderReady(order);
      res.json({ data: order });
    }),
  );

  app.post(
    "/api/orders/:orderId/complete",
    waiterOnly,
    asyncHandler(async (req, res) => {
      const orderId = uuidParamSchema.parse(req.params.orderId);
      const order = await transitionOrderStatus(
        orderId,
        ["READY"],
        "COMPLETED",
        "ORDER_COMPLETED",
      );
      publishOrderUpdated(order);
      res.json({ data: order });
    }),
  );

  app.use((_req, _res, next) => {
    next(new HttpError(404, "Маршрут не найден"));
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: {
          message: "Некорректный запрос",
          details: error.flatten(),
        },
      });
      return;
    }

    if (error instanceof HttpError) {
      res.status(error.statusCode).json({
        error: {
          message: error.message,
          details: error.details,
        },
      });
      return;
    }

    if (isDatabaseConnectionError(error)) {
      console.error(error);
      res.status(503).json({
        error: {
          message: "Сервис временно недоступен: нет подключения к базе данных.",
        },
      });
      return;
    }

    console.error(error);
    res.status(500).json({
      error: {
        message: "Внутренняя ошибка сервера",
      },
    });
  });

  return app;
}
