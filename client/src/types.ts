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

export type OwnerAnalyticsRangePreset =
  | "today"
  | "yesterday"
  | "last7days"
  | "last30days"
  | "this_month"
  | "previous_month"
  | "custom";

export interface OwnerAnalyticsRange {
  preset: OwnerAnalyticsRangePreset;
  from: string;
  to: string;
}

export interface OwnerAnalyticsRevenue {
  subtotal: number;
  serviceFee: number;
  total: number;
  orders: number;
}

export interface OwnerAnalyticsComparison {
  current: OwnerAnalyticsRevenue;
  previous: OwnerAnalyticsRevenue;
  change: number;
  changePercent: number | null;
}

export interface OwnerAnalyticsDishMetric {
  menuItemId: number;
  name: string;
  category: MenuCategory;
  active: boolean;
  qty: number;
  orders: number;
  subtotal: number;
  serviceFee: number;
  revenue: number;
}

export interface OwnerAnalyticsSummary {
  range: OwnerAnalyticsRange;
  totalRevenue: number;
  subtotalRevenue: number;
  serviceFeeTotal: number;
  totalOrders: number;
  billableOrders: number;
  ordersToday: number;
  revenueToday: number;
  revenueThisWeek: number;
  revenueThisMonth: number;
  averageOrderValue: number;
  rejectedOrders: number;
  cancelledOrRejectedOrders: number;
  activeOrdersNow: number;
  completedOrders: number;
  mostPopularDish: OwnerAnalyticsDishMetric | null;
  leastPopularDish: OwnerAnalyticsDishMetric | null;
}

export interface OwnerAnalyticsSalesPoint {
  period: string;
  subtotal: number;
  serviceFee: number;
  revenue: number;
  orders: number;
}

export interface OwnerAnalyticsSales {
  range: OwnerAnalyticsRange;
  revenueByDay: OwnerAnalyticsSalesPoint[];
  revenueByWeek: OwnerAnalyticsSalesPoint[];
  revenueByMonth: OwnerAnalyticsSalesPoint[];
  dailySalesTrend: OwnerAnalyticsSalesPoint[];
  weeklySalesTrend: OwnerAnalyticsSalesPoint[];
  monthlySalesTrend: OwnerAnalyticsSalesPoint[];
  todayVsYesterday: OwnerAnalyticsComparison;
  thisWeekVsPreviousWeek: OwnerAnalyticsComparison;
  thisMonthVsPreviousMonth: OwnerAnalyticsComparison;
}

export interface OwnerAnalyticsOrders {
  range: OwnerAnalyticsRange;
  totalOrders: number;
  ordersByStatus: Array<{ status: OrderStatus; count: number }>;
  ordersByHour: Array<{ hour: number; count: number }>;
  peakHours: Array<{ hour: number; count: number }>;
  averageOrdersPerDay: number;
  averageProcessingSeconds: number | null;
  averageAcceptanceSeconds: number | null;
  averageKitchenPreparationSeconds: number | null;
  rejectedOrderPercentage: number;
}

export interface OwnerAnalyticsCategoryMetric {
  category: MenuCategory;
  qty: number;
  orders: number;
  subtotal: number;
  serviceFee: number;
  revenue: number;
  averageMenuPrice: number | null;
  activeItems: number;
  inactiveItems: number;
  totalItems: number;
}

export interface OwnerAnalyticsMenu {
  range: OwnerAnalyticsRange;
  topSellingDishes: OwnerAnalyticsDishMetric[];
  worstSellingDishes: OwnerAnalyticsDishMetric[];
  revenueByDish: OwnerAnalyticsDishMetric[];
  quantitySoldByDish: OwnerAnalyticsDishMetric[];
  revenueByCategory: OwnerAnalyticsCategoryMetric[];
  ordersByCategory: Array<{ category: MenuCategory; orders: number }>;
  averagePriceByCategory: Array<{ category: MenuCategory; averagePrice: number | null }>;
  availabilitySummary: {
    totalItems: number;
    activeItems: number;
    inactiveItems: number;
  };
  itemsNeverOrdered: Array<{
    menuItemId: number;
    name: string;
    category: MenuCategory;
    active: boolean;
    price: number;
  }>;
}

export interface OwnerAnalyticsTableMetric {
  tableId: number;
  tableNumber: string;
  totalOrders: number;
  billableOrders: number;
  rejectedOrders: number;
  subtotal: number;
  serviceFee: number;
  revenue: number;
  averageOrderValue: number;
}

export interface OwnerAnalyticsTables {
  range: OwnerAnalyticsRange;
  tables: OwnerAnalyticsTableMetric[];
  mostActiveTables: OwnerAnalyticsTableMetric[];
  tablesWithRejectedOrders: OwnerAnalyticsTableMetric[];
  currentActiveSessions: Array<{
    sessionId: string;
    tableId: number;
    tableNumber: string;
    lastActivity: string;
  }>;
}

export interface OwnerAnalyticsOperations {
  range: OwnerAnalyticsRange;
  currentActiveOrders: number;
  waitingForWaiterConfirmation: number;
  ordersInKitchen: number;
  readyToServe: number;
  completedToday: number;
  rejectedToday: number;
  openServiceRequests: number;
  bottleneck: {
    level: "none" | "medium" | "high";
    reasons: string[];
    averageKitchenPreparationSeconds: number | null;
  };
}

export interface OwnerAnalyticsDashboardData {
  summary: OwnerAnalyticsSummary;
  sales: OwnerAnalyticsSales;
  orders: OwnerAnalyticsOrders;
  menu: OwnerAnalyticsMenu;
  tables: OwnerAnalyticsTables;
  operations: OwnerAnalyticsOperations;
}
