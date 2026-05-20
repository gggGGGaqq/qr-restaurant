import { AnimatePresence, motion } from "framer-motion";
import { Suspense, lazy } from "react";
import type { ProtectedRole } from "./auth";
import { PageLoader } from "./components/PageLoader";
import { ProtectedPageGate } from "./components/ProtectedPageGate";

const CustomerApp = lazy(() =>
  import("./CustomerApp").then((module) => ({ default: module.CustomerApp })),
);
const WaiterDashboard = lazy(() =>
  import("./WaiterDashboard").then((module) => ({ default: module.WaiterDashboard })),
);
const KitchenDashboard = lazy(() =>
  import("./KitchenDashboard").then((module) => ({ default: module.KitchenDashboard })),
);
const AdminDashboard = lazy(() =>
  import("./AdminDashboard").then((module) => ({ default: module.AdminDashboard })),
);
const OwnerDashboard = lazy(() =>
  import("./OwnerDashboard").then((module) => ({ default: module.OwnerDashboard })),
);

export function App() {
  const path = window.location.pathname;
  const pageKey = path.startsWith("/waiter")
    ? "waiter"
    : path.startsWith("/kitchen")
      ? "kitchen"
      : path.startsWith("/admin")
        ? "admin"
        : path.startsWith("/owner")
          ? "owner"
          : "customer";

  let Content = CustomerApp;
  if (pageKey === "waiter") Content = WaiterDashboard;
  if (pageKey === "kitchen") Content = KitchenDashboard;
  if (pageKey === "admin") Content = AdminDashboard;
  if (pageKey === "owner") Content = OwnerDashboard;
  const protectedRole = pageKey === "customer" ? null : (pageKey as ProtectedRole);

  return (
    <Suspense fallback={<PageLoader />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={pageKey}
          onCopy={(event) => event.preventDefault()}
          onCut={(event) => event.preventDefault()}
          onDragStart={(event) => event.preventDefault()}
          initial={{ opacity: 0, y: 26, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -16, filter: "blur(8px)" }}
          transition={{ duration: 0.55, ease: [0.19, 1, 0.22, 1] }}
        >
          {protectedRole ? (
            <ProtectedPageGate role={protectedRole}>
              <Content />
            </ProtectedPageGate>
          ) : (
            <Content />
          )}
        </motion.div>
      </AnimatePresence>
    </Suspense>
  );
}
