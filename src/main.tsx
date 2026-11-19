import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeMobileRuntime } from "./platform/mobileRuntime";
import { registerPwaServiceWorker } from "./platform/pwa";

initializeMobileRuntime();
registerPwaServiceWorker();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
