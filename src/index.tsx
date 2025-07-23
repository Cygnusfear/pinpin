import React from "react";
import "./index.css";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { initializeSyncEngine } from "./config/syncEngine";
import { getWidgetRegistry } from "./core/WidgetRegistry";
import { calculatorWidgetPlugin } from "./plugins/calculatorWidget";
import { documentWidgetPlugin } from "./plugins/documentWidget";
import { imageWidgetPlugin } from "./plugins/imageWidget";
import { noteWidgetPlugin } from "./plugins/noteWidget";
import { urlWidgetPlugin } from "./plugins/urlWidget";

// Initialize widget plugins
async function initializeWidgetPlugins() {
  const registry = getWidgetRegistry();

  try {
    console.log("🔌 Registering widget plugins...");

    // Register all widget plugins
    await registry.installPlugin(imageWidgetPlugin);
    await registry.installPlugin(urlWidgetPlugin);
    await registry.installPlugin(noteWidgetPlugin);
    await registry.installPlugin(calculatorWidgetPlugin);
    await registry.installPlugin(documentWidgetPlugin);

    console.log("✅ All widget plugins registered successfully");

    // Log registry stats
    const stats = registry.getRegistryStats();
    console.log("📊 Widget Registry Stats:", stats);

    // Validate registry
    const validation = registry.validateRegistry();
    if (!validation.isValid) {
      console.warn("⚠️ Widget registry validation issues:", validation.issues);
    } else {
      console.log("✅ Widget registry validation passed");
    }
  } catch (error) {
    console.error("❌ Failed to initialize widget plugins:", error);
    throw error;
  }
}

// Initialize sync engine before rendering the app
async function initApp() {
  try {
    // Initialize widget plugins first
    await initializeWidgetPlugins();

    // Then initialize sync engine
    await initializeSyncEngine();
    console.log("Sync engine ready, starting app...");
  } catch (error) {
    console.warn(
      "Sync engine failed to initialize, continuing in offline mode:",
      error,
    );
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
