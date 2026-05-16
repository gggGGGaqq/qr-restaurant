export const orderStatuses = [
  "NEW",
  "ACCEPTED",
  "COOKING",
  "READY",
  "COMPLETED",
  "REJECTED",
] as const;

export const menuCategories = [
  "grill",
  "hot",
  "salad",
  "dessert",
  "drink",
] as const;

export type OrderStatus = (typeof orderStatuses)[number];
export type MenuCategory = (typeof menuCategories)[number];
export type SessionStatus = "ACTIVE" | "EXPIRED" | "CLOSED";
export type ServiceRequestType = "WAITER" | "WATER" | "BILL" | "CLEANUP";
export type ServiceRequestStatus = "OPEN" | "DONE";

export interface TableDto {
  id: number;
  number: string;
}

export interface MenuModifierDto {
  id: number;
  menuItemId: number;
  name: string;
  priceDelta: number;
  active: boolean;
  sortOrder: number;
}

export interface MenuItemDto {
  id: number;
  category: MenuCategory;
  name: string;
  price: number;
  description: string | null;
  image: string | null;
  active: boolean;
  modifiers: MenuModifierDto[];
}

export interface RestaurantSettingsDto {
  name: string;
  accentColor: string;
  coverImage: string | null;
  serviceRate: number;
}

export interface TableSessionDto {
  id: string;
  tableId: number;
  tableNumber: string;
  status: SessionStatus;
  createdAt: string;
  lastActivity: string;
}

export interface OrderItemModifierDto {
  id: number;
  modifierId: number | null;
  name: string;
  priceDelta: number;
}

export interface OrderItemDto {
  id: number;
  menuItemId: number;
  name: string;
  qty: number;
  price: number;
  note: string | null;
  modifiers: OrderItemModifierDto[];
  lineTotal: number;
}

export interface OrderDto {
  id: string;
  tableId: number;
  tableNumber: string;
  sessionId: string;
  status: OrderStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItemDto[];
  total: number;
  serviceFee: number;
  totalWithService: number;
}

export interface CreateOrderInput {
  orderId: string;
  tableId: number;
  sessionId: string;
  note?: string | null;
  items: Array<{
    menuItemId: number;
    qty: number;
    note?: string | null;
    modifierIds?: number[];
  }>;
}

export interface ServiceRequestDto {
  id: string;
  tableId: number;
  tableNumber: string;
  sessionId: string;
  type: ServiceRequestType;
  status: ServiceRequestStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerSummaryDto {
  ordersToday: number;
  revenueToday: number;
  averageCheck: number;
  activeTables: number;
  openServiceRequests: number;
  popularItems: Array<{
    menuItemId: number;
    name: string;
    qty: number;
  }>;
}
