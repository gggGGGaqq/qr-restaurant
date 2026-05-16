export type OrderStatus =
  | "NEW"
  | "ACCEPTED"
  | "COOKING"
  | "READY"
  | "COMPLETED"
  | "REJECTED";

export type MenuCategory = "grill" | "hot" | "salad" | "dessert" | "drink";

export type ServiceRequestType = "WAITER" | "WATER" | "BILL" | "CLEANUP";
export type ServiceRequestStatus = "OPEN" | "DONE";

export interface Table {
  id: number;
  number: string;
}

export interface MenuModifier {
  id: number;
  menuItemId: number;
  name: string;
  priceDelta: number;
  active: boolean;
  sortOrder: number;
}

export interface MenuItem {
  id: number;
  category: MenuCategory;
  name: string;
  price: number;
  description: string | null;
  image: string | null;
  active: boolean;
  modifiers: MenuModifier[];
}

export interface RestaurantSettings {
  name: string;
  accentColor: string;
  coverImage: string | null;
  serviceRate: number;
}

export interface TableSession {
  id: string;
  tableId: number;
  tableNumber: string;
  status: "ACTIVE" | "EXPIRED" | "CLOSED";
  createdAt: string;
  lastActivity: string;
}

export interface OrderItemModifier {
  id: number;
  modifierId: number | null;
  name: string;
  priceDelta: number;
}

export interface OrderItem {
  id: number;
  menuItemId: number;
  name: string;
  qty: number;
  price: number;
  note: string | null;
  modifiers: OrderItemModifier[];
  lineTotal: number;
}

export interface Order {
  id: string;
  tableId: number;
  tableNumber: string;
  sessionId: string;
  status: OrderStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  total: number;
  serviceFee: number;
  totalWithService: number;
}

export interface ServiceRequest {
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

export interface OwnerSummary {
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
