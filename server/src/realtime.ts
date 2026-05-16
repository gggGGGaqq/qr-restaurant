import { Server } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { authorizeSocketRole } from "./auth";
import { config } from "./config";
import type { OrderDto, RestaurantSettingsDto, ServiceRequestDto } from "./types";

let io: Server | null = null;

const rooms = {
  waiter: "dashboard:waiter",
  kitchen: "dashboard:kitchen",
  session: (sessionId: string) => `session:${sessionId}`,
};

export function initRealtime(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: config.clientUrl,
      methods: ["GET", "POST"],
    },
  });

  io.use((socket, next) => {
    const auth = socket.handshake.auth as {
      role?: unknown;
      sessionId?: unknown;
      token?: unknown;
    };

    if (!auth.role) {
      next();
      return;
    }

    const role = authorizeSocketRole(auth.role, auth.token);
    if (!role) {
      next(new Error("Authentication required"));
      return;
    }

    socket.data.role = role;
    next();
  });

  io.on("connection", (socket) => {
    const auth = socket.handshake.auth as {
      role?: string;
      sessionId?: string;
    };

    if (socket.data.role === "waiter") {
      socket.join(rooms.waiter);
    }

    if (socket.data.role === "kitchen") {
      socket.join(rooms.kitchen);
    }

    if (auth.sessionId) {
      socket.join(rooms.session(auth.sessionId));
    }

    socket.on("join_waiter", () => {
      if (socket.data.role === "waiter") {
        socket.join(rooms.waiter);
      }
    });
    socket.on("join_kitchen", () => {
      if (socket.data.role === "kitchen") {
        socket.join(rooms.kitchen);
      }
    });
    socket.on("join_session", (payload: { sessionId?: string }) => {
      if (payload?.sessionId) {
        socket.join(rooms.session(payload.sessionId));
      }
    });
  });

  return io;
}

function publishToActiveRooms(eventName: string, order: OrderDto): void {
  if (!io) return;

  io.to(rooms.waiter).emit(eventName, order);
  io.to(rooms.kitchen).emit(eventName, order);
  io.to(rooms.session(order.sessionId)).emit(eventName, order);
}

export function publishOrderCreated(order: OrderDto): void {
  if (!io) return;

  io.to(rooms.waiter).emit("order_created", order);
  io.to(rooms.session(order.sessionId)).emit("order_updated", order);
}

export function publishOrderUpdated(order: OrderDto): void {
  publishToActiveRooms("order_updated", order);
}

export function publishOrderAccepted(order: OrderDto): void {
  publishOrderUpdated(order);
  io?.to(rooms.kitchen).emit("order_accepted", order);
}

export function publishOrderReady(order: OrderDto): void {
  publishOrderUpdated(order);
  io?.to(rooms.waiter).emit("order_ready", order);
  io?.to(rooms.session(order.sessionId)).emit("order_ready", order);
}

export function publishServiceRequestCreated(request: ServiceRequestDto): void {
  if (!io) return;

  io.to(rooms.waiter).emit("service_request_created", request);
  io.to(rooms.session(request.sessionId)).emit("service_request_updated", request);
}

export function publishServiceRequestUpdated(request: ServiceRequestDto): void {
  if (!io) return;

  io.to(rooms.waiter).emit("service_request_updated", request);
  io.to(rooms.session(request.sessionId)).emit("service_request_updated", request);
}

export function publishMenuUpdated(): void {
  io?.emit("menu_updated");
}

export function publishSettingsUpdated(settings: RestaurantSettingsDto): void {
  io?.emit("settings_updated", settings);
}
