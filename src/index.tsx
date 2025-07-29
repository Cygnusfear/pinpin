import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { initializeSyncEngine } from "./config/syncEngine";
import { registerAllPlugins } from "./plugins";

// Initialize widget plugins with new clean architecture
async function initializeWidgetPlugins() {
  try {
    console.log("🔌 Registering widget plugins with new architecture...");

    // Register all plugins using the new unified system
    await registerAllPlugins();

    console.log("✅ All widget plugins registered successfully");
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

// Hot Module Replacement (HMR) support
if (import.meta.hot) {
  // Accept HMR for the entire app
  import.meta.hot.accept(['./App', './plugins'], () => {
    console.log('🔥 HMR: Main app modules updated');
  });
  
  // Listen for plugin updates and reload without full page refresh
  window.addEventListener('pluginsReloaded', (event) => {
    console.log('🔥 HMR: Plugins reloaded, updating app state');
    // The plugin registry is already updated by the config reloader
    // Force re-render of any components that depend on plugin state
  });
}
