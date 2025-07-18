import React from 'react';
import { useSyncContext } from './SyncProvider';
import { usePinboardStore } from '../stores/storeSelector';

export const SyncDemo: React.FC = () => {
  const { status } = useSyncContext();
  const { widgets, lastModified } = usePinboardStore();

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getSyncStatusText = () => {
    switch (status) {
      case 'synced':
        return 'Real-time collaboration active';
      case 'offline':
        return 'Working offline - changes will sync when connection is restored';
      case 'error':
        return 'Sync error - using local storage';
      case 'initializing':
        return 'Connecting to sync server...';
      default:
        return 'Unknown sync status';
    }
  };

  const getSyncStatusColor = () => {
    switch (status) {
      case 'synced':
        return 'text-green-600';
      case 'offline':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
      case 'initializing':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-sm">
      <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">
              Sync Status
            </h3>
            <div className={`text-xs font-medium ${getSyncStatusColor()}`}>
              {status.toUpperCase()}
            </div>
          </div>
          
          <p className={`text-xs ${getSyncStatusColor()}`}>
            {getSyncStatusText()}
          </p>
          
          <div className="border-t border-gray-200 pt-2 space-y-1">
            <div className="flex justify-between text-xs text-gray-600">
              <span>Widgets:</span>
              <span className="font-medium">{widgets.length}</span>
            </div>
            
            <div className="flex justify-between text-xs text-gray-600">
              <span>Last modified:</span>
              <span className="font-medium">{formatTime(lastModified)}</span>
            </div>
          </div>
          
          {status === 'synced' && (
            <div className="bg-green-50 border border-green-200 rounded p-2 mt-2">
              <p className="text-xs text-green-700">
                🎉 Open this app in multiple windows to see real-time collaboration!
              </p>
            </div>
          )}
          
          {status === 'offline' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mt-2">
              <p className="text-xs text-yellow-700">
                📱 Your changes are saved locally and will sync when you're back online.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SyncDemo;