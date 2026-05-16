import ReactDOM from "react-dom/client";
import { MotionConfig } from "framer-motion";
import { App } from "./App";
import { LanguageProvider } from "./i18n";
import "./styles/main.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <LanguageProvider>
    <MotionConfig
      reducedMotion="user"
      transition={{ type: "spring", stiffness: 170, damping: 24, mass: 0.78 }}
    >
      <App />
    </MotionConfig>
  </LanguageProvider>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
