import { AnimatePresence, motion } from "framer-motion";
import { Check, ChefHat, Clock3, Flame, X } from "lucide-react";
import { localizeMenuItemName, localizeModifierName } from "../contentTranslations";
import { useLanguage } from "../i18n";
import type { Order } from "../types";
import { formatMoney, formatOrderAge, parseOrderTimestamp } from "../utils/format";
import { StatusBadge } from "./StatusBadge";

interface OrderCardProps {
  order: Order;
  variant?: "waiter" | "kitchen" | "customer";
  showTimer?: boolean;
  nowTimestamp?: number;
  onAccept?: (order: Order) => void;
  onReject?: (order: Order) => void;
  onCooking?: (order: Order) => void;
  onReady?: (order: Order) => void;
  onComplete?: (order: Order) => void;
}

export function OrderCard({
  order,
  variant = "customer",
  showTimer = false,
  nowTimestamp = Date.now(),
  onAccept,
  onReject,
  onCooking,
  onReady,
  onComplete,
}: OrderCardProps) {
  const { language, copy } = useLanguage();
  const age = formatOrderAge(order.createdAt, nowTimestamp, language);
  const ageMinutes = Math.max(0, Math.floor((nowTimestamp - parseOrderTimestamp(order.createdAt, nowTimestamp)) / 60000));
  const urgencyClass = ageMinutes >= 20 ? "is-critical" : ageMinutes >= 10 ? "is-warn" : "";
  const servicePercent = order.total > 0 ? Math.round((order.serviceFee / order.total) * 100) : 0;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className={`order-card order-card--${variant} ${urgencyClass}`.trim()}
    >
      <div className="order-card__header">
        <div>
          <p className="eyebrow">{copy.common.table(order.tableNumber)}</p>
          <h3>{copy.common.order(order.id.slice(0, 8))}</h3>
        </div>
        <div className="order-card__status-stack">
          <StatusBadge status={order.status} />
          {showTimer && (
            <div className="order-age" title={copy.common.timerTitle}>
              <Clock3 size={14} />
              <span>{age}</span>
            </div>
          )}
        </div>
      </div>

      <div className="order-lines">
        {order.items.map((item) => (
          <div className="order-line order-line--stacked" key={item.id}>
            <div>
              <span>
                {item.qty} x {localizeMenuItemName({ id: item.menuItemId, name: item.name }, language)}
              </span>
              {item.modifiers.length > 0 && (
                <small>
                  {item.modifiers
                    .map((modifier) =>
                      localizeModifierName(
                        { id: modifier.id, modifierId: modifier.modifierId, name: modifier.name },
                        language,
                      ),
                    )
                    .join(", ")}
                </small>
              )}
              {item.note && <small>{copy.common.commentToDish(item.note)}</small>}
            </div>
            <strong>{formatMoney(item.lineTotal, language)}</strong>
          </div>
        ))}
      </div>

      {order.note && <p className="order-note">{copy.common.commentToOrder(order.note)}</p>}

      <div className="order-price-lines">
        <div>
          <span>{copy.common.subtotal}</span>
          <strong>{formatMoney(order.total, language)}</strong>
        </div>
        <div>
          <span>{copy.common.serviceFee(servicePercent)}</span>
          <strong>{formatMoney(order.serviceFee, language)}</strong>
        </div>
        <div className="order-total">
          <span>{copy.common.totalDue}</span>
          <strong>{formatMoney(order.totalWithService, language)}</strong>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {variant === "waiter" && order.status === "NEW" && (
          <motion.div
            key="waiter-new-actions"
            className="action-row"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <button className="button button-primary" onClick={() => onAccept?.(order)} title={copy.common.accept}>
              <Check size={18} /> {copy.common.accept}
            </button>
            <button className="button button-danger" onClick={() => onReject?.(order)} title={copy.common.reject}>
              <X size={18} /> {copy.common.reject}
            </button>
          </motion.div>
        )}

        {variant === "waiter" && order.status === "READY" && (
          <motion.div
            key="waiter-ready-actions"
            className="action-row"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <button className="button button-primary" onClick={() => onComplete?.(order)} title={copy.common.complete}>
              <Check size={18} /> {copy.common.complete}
            </button>
          </motion.div>
        )}

        {variant === "kitchen" && (
          <motion.div
            key="kitchen-actions"
            className="action-row"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {order.status === "ACCEPTED" && (
              <button className="button button-secondary" onClick={() => onCooking?.(order)} title={copy.common.startCooking}>
                <Flame size={18} /> {copy.common.startCooking}
              </button>
            )}
            {(order.status === "ACCEPTED" || order.status === "COOKING") && (
              <button className="button button-primary" onClick={() => onReady?.(order)} title={copy.common.markReady}>
                <ChefHat size={18} /> {copy.common.markReady}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
