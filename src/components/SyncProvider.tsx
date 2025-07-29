import React, { type ReactNode, useEffect, useState } from "react";
import { initializeSyncEngine } from "../config/syncEngine";
import { sync } from "@tonk/keepsync";
import { cn } from "@/lib/utils";

interface SyncProviderProps {
  children: ReactNode;
}

export type SyncStatus = "initializing" | "synced" | "offline" | "error";

interface SyncContextType {
  status: SyncStatus;
  error?: string;
  retrySync: () => void;
}

const SyncContext = React.createContext<SyncContextType>({
  status: "initializing",
  retrySync: () => {},
});

export const useSyncContext = () => React.useContext(SyncContext);

export const SyncProvider: React.FC<SyncProviderProps> = ({ children }) => {
  const [status, setStatus] = useState<SyncStatus>("initializing");
  const [error, setError] = useState<string>();
  const [retryCount, setRetryCount] = useState(0);

  const initializeSync = React.useCallback(async () => {
    try {
      setStatus("initializing");
      setError(undefined);

      const success = await initializeSyncEngine(); 

      if (success) {
        setStatus("synced");
        console.log("Sync engine initialized successfully");
      } else {
        throw new Error("Sync engine initialization failed");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown sync error";
      console.error("Sync initialization failed:", errorMessage);

      setError(errorMessage);
      setStatus("offline");
    }
  }, []);

  const retrySync = React.useCallback(() => {
    setRetryCount((prev) => prev + 1);
  }, []);

  useEffect(() => {
    initializeSync();
  }, [initializeSync]);

  // Separate effect for retry count changes
  useEffect(() => {
    if (retryCount > 0) {
      initializeSync();
    }
  }, [retryCount, initializeSync]);

  // Monitor connection status
  useEffect(() => {
    const handleOnline = () => {
      if (status === "offline") {
        console.log("Network connection restored, retrying sync...");
        setRetryCount((prev) => prev + 1);
      }
    };

    const handleOffline = () => {
      console.log("Network connection lost, switching to offline mode");
      setStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [status]);

  const contextValue: SyncContextType = {
    status,
    error,
    retrySync,
  };

  return (
    <SyncContext.Provider value={contextValue}>
      <div className="relative h-full w-full">
        {children}
        <SyncStatusIndicator />
      </div>
    </SyncContext.Provider>
  );
};

// Sync status indicator component
const SyncStatusIndicator: React.FC = () => {
  const { status, error, retrySync } = useSyncContext();
  const [randomEmoji, setRandomEmoji] = useState<string>("");

  // Array of emojis similar to index.html
  const emojis = ['🎯', '🚀', '⭐', '🎮', '🎪', '🎨', '🎭', '🏆', '💫', '🌟', '✨', '🎊', '🎉', '🌈', '🦄', '🎸', '🎲'];

  // Inject CSS animations if not already present
  useEffect(() => {
    const styleId = 'sync-status-animations';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-2px); }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Update random emoji periodically when syncing
  useEffect(() => {
    if (status === "initializing") {
      const updateEmoji = () => {
        setRandomEmoji(emojis[Math.floor(Math.random() * emojis.length)]);
      };
      
      // Set initial emoji
      updateEmoji();
      
      // Update emoji every 1.5 seconds while syncing
      const interval = setInterval(updateEmoji, 1500);
      
      return () => clearInterval(interval);
    }
  }, [status, emojis]);

  const getStatusConfig = () => {
    switch (status) {
      case "initializing":
        return {
          icon: randomEmoji,
          text: "Connecting...",
          color: "bg-white",
          textColor: "text-grey-500",
          showSpinner: true,
        };
      case "synced":
        return {
          icon: "dot",
          text: "Synced",
          color: "bg-transparent",
          textColor: "text-green-400",
          showSpinner: false,
        };
      case "offline":
        return {
          icon: "dot",
          text: "Offline",
          color: "bg-yellow-500",
          textColor: "text-yellow-400",
          showSpinner: false,
        };
      case "error":
        return {
          icon: "dot",
          text: "Error",
          color: "bg-red-500",
          textColor: "text-red-400",
          showSpinner: false,
        };
      default:
        return {
          icon: "dot",
          text: "Unknown",
          color: "bg-gray-500",
          textColor: "text-gray-400",
          showSpinner: false,
        };
    }
  };

  const config = getStatusConfig();

  const isBroken = status === "error" || status === "offline";

  return (
    <div className="fixed top-4 right-4 z-50">
      <button
        type="button"
        className={cn(
          "relative flex items-center gap-2 rounded-full transition-all duration-300 ease-in-out bg-transparent",
          config.textColor,
        )}
        onClick={isBroken ? retrySync : undefined}
        onKeyDown={(e) => {
          if (isBroken && (e.key === "Enter" || e.key === " ")) {
            retrySync();
          }
        }}
        disabled={!isBroken}
        title={
          status === "error"
            ? `Sync error: ${error}. Click to retry.`
            : status === "offline"
            ? "Working offline. Click to retry sync."
            : config.text
        }
      >
          <div className="relative flex items-center justify-center w-8 h-8 ml-2">
            <div 
              className={cn("absolute w-10 h-10 border-3 border-slate-300 border-t-sky-300 rounded-full animate-spin", 
                !config.showSpinner && "hidden"
              )}
            />
            <div 
              className={cn("relative z-10 text-sm",config.showSpinner && "animate-bounce")} 
            >
              {config.icon === "dot" ? <div className={cn("w-3 h-3 rounded-full", config.color)}/> : config.icon}
            </div>
          </div>
        
      </button>

    </div>
  );
};

export default SyncProvider;
