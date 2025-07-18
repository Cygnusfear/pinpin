import React, { useEffect, useState, ReactNode } from 'react';
import { initializeSyncEngine } from '../config/syncEngine';
import { setSyncAvailability } from '../stores/storeSelector';

interface SyncProviderProps {
  children: ReactNode;
}

export type SyncStatus = 'initializing' | 'synced' | 'offline' | 'error';

interface SyncContextType {
  status: SyncStatus;
  error?: string;
  retrySync: () => void;
}

const SyncContext = React.createContext<SyncContextType>({
  status: 'initializing',
  retrySync: () => {},
});

export const useSyncContext = () => React.useContext(SyncContext);

export const SyncProvider: React.FC<SyncProviderProps> = ({ children }) => {
  const [status, setStatus] = useState<SyncStatus>('initializing');
  const [error, setError] = useState<string>();
  const [retryCount, setRetryCount] = useState(0);

  const initializeSync = React.useCallback(async () => {
    try {
      setStatus('initializing');
      setError(undefined);
      
      const success = initializeSyncEngine();
      
      if (success) {
        setStatus('synced');
        setSyncAvailability(true);
        console.log('Sync engine initialized successfully');
      } else {
        throw new Error('Sync engine initialization failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown sync error';
      console.error('Sync initialization failed:', errorMessage);
      
      setError(errorMessage);
      setStatus('offline');
      setSyncAvailability(false);
    }
  }, []);

  const retrySync = React.useCallback(() => {
    setRetryCount(prev => prev + 1);
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
      if (status === 'offline') {
        console.log('Network connection restored, retrying sync...');
        setRetryCount(prev => prev + 1);
      }
    };

    const handleOffline = () => {
      console.log('Network connection lost, switching to offline mode');
      setStatus('offline');
      setSyncAvailability(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [status]);

  const contextValue: SyncContextType = {
    status,
    error,
    retrySync,
  };

  return (
    <SyncContext.Provider value={contextValue}>
      <div className="relative w-full h-full">
        {children}
        <SyncStatusIndicator />
      </div>
    </SyncContext.Provider>
  );
};

// Sync status indicator component
const SyncStatusIndicator: React.FC = () => {
  const { status, error, retrySync } = useSyncContext();

  const getStatusConfig = () => {
    switch (status) {
      case 'initializing':
        return {
          icon: '🔄',
          text: 'Connecting...',
          color: 'bg-yellow-500',
          textColor: 'text-yellow-900',
        };
      case 'synced':
        return {
          icon: '🟢',
          text: 'Synced',
          color: 'bg-green-500',
          textColor: 'text-green-900',
        };
      case 'offline':
        return {
          icon: '🟡',
          text: 'Offline',
          color: 'bg-yellow-500',
          textColor: 'text-yellow-900',
        };
      case 'error':
        return {
          icon: '🔴',
          text: 'Error',
          color: 'bg-red-500',
          textColor: 'text-red-900',
        };
      default:
        return {
          icon: '❓',
          text: 'Unknown',
          color: 'bg-gray-500',
          textColor: 'text-gray-900',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="fixed top-4 left-4 z-50">
      {(status === 'error' || status === 'offline') ? (
        <button
          type="button"
          className={`
            flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg
            ${config.color} ${config.textColor}
            transition-all duration-300 ease-in-out
            hover:shadow-xl cursor-pointer
          `}
          onClick={retrySync}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              retrySync();
            }
          }}
          title={
            status === 'error'
              ? `Sync error: ${error}. Click to retry.`
              : 'Working offline. Click to retry sync.'
          }
        >
          <span className="text-sm font-medium">
            {config.icon} {config.text}
          </span>
          <span className="ml-2 text-xs underline hover:no-underline">
            Retry
          </span>
        </button>
      ) : (
        <div
          className={`
            flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg
            ${config.color} ${config.textColor}
            transition-all duration-300 ease-in-out
          `}
          title={`Sync status: ${status}`}
        >
          <span className="text-sm font-medium">
            {config.icon} {config.text}
          </span>
        </div>
      )}
      
      {status === 'error' && error && (
        <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-red-800 text-xs max-w-xs">
          {error}
        </div>
      )}
    </div>
  );
};

export default SyncProvider;