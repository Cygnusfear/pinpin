import React from "react";
import "./index.css";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { initializeSyncEngine } from "./config/syncEngine";
import App from "./App";

// Initialize sync engine before rendering the app
async function initApp() {
  try {
    await initializeSyncEngine();
    console.log("Sync engine ready, starting app...");
  } catch (error) {
    console.warn("Sync engine failed to initialize, continuing in offline mode:", error);
  }

  const container = document.getElementById("root");
  if (!container) throw new Error("Failed to find the root element");
  const root = createRoot(container);

  const basename =
    import.meta.env.VITE_BASE_PATH !== "/"
      ? import.meta.env.VITE_BASE_PATH?.replace(/\/$/, "")
      : "";

  root.render(
    <React.StrictMode>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  );
}

// Start the application
initApp().catch(console.error);
