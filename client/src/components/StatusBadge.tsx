import type { OrderStatus } from "../types";
import { useLanguage } from "../i18n";

export function StatusBadge({ status }: { status: OrderStatus }) {
  const { copy } = useLanguage();
  return <span className={`status status-${status.toLowerCase()}`}>{copy.orderStatuses[status]}</span>;
}
