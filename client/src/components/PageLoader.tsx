import { Skeleton } from "./Skeleton";

export function PageLoader() {
  return (
    <main className="app-shell customer-shell">
      <div className="loader-stack">
        <Skeleton className="loader-header" />
        <Skeleton className="loader-card" />
        <Skeleton className="loader-card" />
        <Skeleton className="loader-card" />
      </div>
    </main>
  );
}
