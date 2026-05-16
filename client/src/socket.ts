import { io, Socket } from "socket.io-client";
import { getAuthToken } from "./auth";
import type { Order, RestaurantSettings, ServiceRequest } from "./types";

const socketUrl = import.meta.env.VITE_SOCKET_URL ?? import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export type OrderSocket = Socket<{
  order_created: (order: Order) => void;
  order_updated: (order: Order) => void;
  order_accepted: (order: Order) => void;
  order_ready: (order: Order) => void;
  service_request_created: (request: ServiceRequest) => void;
  service_request_updated: (request: ServiceRequest) => void;
  menu_updated: () => void;
  settings_updated: (settings: RestaurantSettings) => void;
}>;

export function createOrderSocket(auth: { role?: "waiter" | "kitchen"; sessionId?: string }): OrderSocket {
  return io(socketUrl, {
    auth: {
      ...auth,
      token: auth.role ? getAuthToken(auth.role) ?? undefined : undefined,
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
  }) as OrderSocket;
}
