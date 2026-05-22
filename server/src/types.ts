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

export const ownerAnalyticsRangePresets = [
  "today",
  "yesterday",
  "last7days",
  "last30days",
  "this_month",
  "previous_month",
  "custom",
] as const;

export type OwnerAnalyticsRangePreset = (typeof ownerAnalyticsRangePresets)[number];

export interface OwnerAnalyticsRangeDto {
  preset: OwnerAnalyticsRangePreset;
  from: string;
  to: string;
}

export interface OwnerAnalyticsRevenueDto {
  subtotal: number;
  serviceFee: number;
  total: number;
  orders: number;
}

export interface OwnerAnalyticsComparisonDto {
  current: OwnerAnalyticsRevenueDto;
  previous: OwnerAnalyticsRevenueDto;
  change: number;
  changePercent: number | null;
}

export interface OwnerAnalyticsDishMetricDto {
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

export interface OwnerAnalyticsSummaryDto {
  range: OwnerAnalyticsRangeDto;
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
  mostPopularDish: OwnerAnalyticsDishMetricDto | null;
  leastPopularDish: OwnerAnalyticsDishMetricDto | null;
}

export interface OwnerAnalyticsSalesPointDto {
  period: string;
  subtotal: number;
  serviceFee: number;
  revenue: number;
  orders: number;
}

export interface OwnerAnalyticsSalesDto {
  range: OwnerAnalyticsRangeDto;
  revenueByDay: OwnerAnalyticsSalesPointDto[];
  revenueByWeek: OwnerAnalyticsSalesPointDto[];
  revenueByMonth: OwnerAnalyticsSalesPointDto[];
  dailySalesTrend: OwnerAnalyticsSalesPointDto[];
  weeklySalesTrend: OwnerAnalyticsSalesPointDto[];
  monthlySalesTrend: OwnerAnalyticsSalesPointDto[];
  todayVsYesterday: OwnerAnalyticsComparisonDto;
  thisWeekVsPreviousWeek: OwnerAnalyticsComparisonDto;
  thisMonthVsPreviousMonth: OwnerAnalyticsComparisonDto;
}

export interface OwnerAnalyticsOrdersDto {
  range: OwnerAnalyticsRangeDto;
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

export interface OwnerAnalyticsCategoryMetricDto {
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

export interface OwnerAnalyticsMenuDto {
  range: OwnerAnalyticsRangeDto;
  topSellingDishes: OwnerAnalyticsDishMetricDto[];
  worstSellingDishes: OwnerAnalyticsDishMetricDto[];
  revenueByDish: OwnerAnalyticsDishMetricDto[];
  quantitySoldByDish: OwnerAnalyticsDishMetricDto[];
  revenueByCategory: OwnerAnalyticsCategoryMetricDto[];
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

export interface OwnerAnalyticsTableMetricDto {
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

export interface OwnerAnalyticsTablesDto {
  range: OwnerAnalyticsRangeDto;
  tables: OwnerAnalyticsTableMetricDto[];
  mostActiveTables: OwnerAnalyticsTableMetricDto[];
  tablesWithRejectedOrders: OwnerAnalyticsTableMetricDto[];
  currentActiveSessions: Array<{
    sessionId: string;
    tableId: number;
    tableNumber: string;
    lastActivity: string;
  }>;
}

export interface OwnerAnalyticsOperationsDto {
  range: OwnerAnalyticsRangeDto;
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
