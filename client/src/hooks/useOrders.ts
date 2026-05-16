import { useCallback, useState } from "react";
import type { Order, OrderStatus } from "../types";

export function sortOrders(orders: Order[]): Order[] {
  return [...orders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function useOrders(initial: Order[] = []) {
  const [orders, setOrders] = useState<Order[]>(sortOrders(initial));

  const replaceAll = useCallback((next: Order[]) => {
    setOrders(sortOrders(next));
  }, []);

  const upsert = useCallback((order: Order) => {
    setOrders((current) => {
      const exists = current.some((item) => item.id === order.id);
      const next = exists
        ? current.map((item) => (item.id === order.id ? order : item))
        : [...current, order];
      return sortOrders(next);
    });
  }, []);

  const upsertIfStatus = useCallback((order: Order, statuses: OrderStatus[]) => {
    setOrders((current) => {
      const keep = statuses.includes(order.status);
      const exists = current.some((item) => item.id === order.id);
      if (!keep) {
        return current.filter((item) => item.id !== order.id);
      }
      const next = exists
        ? current.map((item) => (item.id === order.id ? order : item))
        : [...current, order];
      return sortOrders(next);
    });
  }, []);

  return { orders, replaceAll, upsert, upsertIfStatus };
}
