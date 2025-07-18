# Keepsync Integration Documentation

## Overview

The pinboard application provides real-time collaboration and persistence through Keepsync integration. This enables multiple users to work on the same pinboard simultaneously with automatic conflict resolution and offline support.

## Architecture

### Core Components

1. **SyncProvider** (`src/components/SyncProvider.tsx`)
   - Initializes the Keepsync sync engine
   - Manages connection status and error handling
   - Provides visual feedback for sync status

2. **PinboardStore** (`src/stores/pinboardStore.ts`)
   - Zustand store wrapped with Keepsync's `sync` middleware
   - Automatically synchronizes widget state across clients
   - Handles canvas transform state

3. **Sync Configuration** (`src/config/syncEngine.ts`)
   - Environment-specific sync engine configuration
   - WebSocket and storage adapter settings

## Features

### Real-time Collaboration
- **Widget Synchronization**: All widget operations (create, update, delete, transform) sync in real-time
- **Canvas State Sync**: Pan and zoom state is synchronized across clients
- **Conflict Resolution**: Automatic conflict resolution using Automerge CRDT
- **Offline Support**: Changes are queued and synced when connection is restored

### Store Integration
The `usePinboardStore` provides these synced methods:
- `addWidget(widgetData)` - Add new widgets
- `updateWidget(id, updates)` - Update single widget
- `updateWidgets(updates)` - Batch update multiple widgets
- `removeWidget(id)` - Delete widgets
- `setCanvasTransform(transform)` - Update canvas view
- `selectWidget(id, selected)` - Selection state
- `clearSelection()` - Clear all selections

### Connection Management
- **Auto-reconnection**: Automatic reconnection on network issues
- **Status Indicators**: Visual feedback for connection status
- **Error Handling**: Graceful degradation when sync is unavailable

## Implementation Details

### Store Structure
```typescript
interface PinboardData {
  widgets: Widget[];
  canvasTransform: CanvasTransform;
  lastModified: number;
}
```

### Sync Configuration
- **Document ID**: `"pinboard-main"` - Unique identifier for the shared document
- **Storage**: IndexedDB for local persistence
- **Network**: WebSocket for real-time communication
- **Conflict Resolution**: Last-write-wins with timestamp-based ordering

### Error Handling
- Initialization errors are caught and displayed to users
- Network errors trigger offline mode
- Retry mechanisms for failed operations

## Usage Examples

### Basic Widget Operations
```typescript
const { addWidget, updateWidget, removeWidget } = usePinboardStore();

// Add a new widget
addWidget({
  type: 'note',
  content: 'Hello World',
  x: 100,
  y: 100,
  width: 200,
  height: 150,
  // ... other properties
});

// Update widget position
updateWidget('widget-id', { x: 150, y: 200 });

// Delete widget
removeWidget('widget-id');
```

### Canvas Operations
```typescript
const { setCanvasTransform, canvasTransform } = usePinboardStore();

// Update canvas view
setCanvasTransform({ x: 100, y: 50, scale: 1.5 });
```

### Selection Management
```typescript
const { selectWidget, clearSelection, getSelectedWidgets } = usePinboardStore();

// Select a widget
selectWidget('widget-id', true);

// Clear all selections
clearSelection();

// Get selected widgets
const selected = getSelectedWidgets();
```

## Environment Configuration

### Development
- WebSocket URL: `ws://localhost:8080`
- Sync server: `http://localhost:7777`
- Debug logging enabled

### Production
- WebSocket URL: From `REACT_APP_SYNC_SERVER_URL` environment variable
- Sync server: Uses current domain
- Debug logging disabled

## Sync Status Indicators

The application displays sync status in the top-left corner:
- 🟢 **Synced**: Connected and synchronized
- 🟡 **Offline**: Working in offline mode
- 🔴 **Error**: Sync initialization failed

## Performance Considerations

### Optimization Features
- **Batch Updates**: Multiple widget updates are batched for efficiency
- **Selective Sync**: Only changed properties are synchronized
- **Compression**: Network traffic is compressed
- **Garbage Collection**: Automatic cleanup of old document versions

### Best Practices
- Use `updateWidgets()` for batch operations instead of multiple `updateWidget()` calls
- Avoid frequent canvas transform updates during smooth animations
- Leverage the built-in debouncing for high-frequency updates

## Troubleshooting

### Common Issues

1. **Sync Engine Initialization Failed**
   - Check network connectivity
   - Verify WebSocket server is running
   - Check browser console for detailed errors

2. **Changes Not Syncing**
   - Verify connection status indicator
   - Check if multiple document IDs are being used
   - Ensure proper store usage patterns

3. **Performance Issues**
   - Monitor network traffic in dev tools
   - Check for excessive update frequency
   - Verify batch operations are being used

### Debug Information
Enable debug logging by setting `NODE_ENV=development` to see:
- Sync engine initialization logs
- Document change events
- Network connection status
- Conflict resolution details

## Future Enhancements

### Planned Features
- **User Presence**: Show cursors and selections of other users
- **User Avatars**: Display who is currently editing
- **Change History**: View and revert to previous versions
- **Permissions**: Role-based access control
- **Room Management**: Multiple pinboard rooms

### Advanced Collaboration
- **Voice/Video Chat**: Integrated communication
- **Comments**: Contextual discussions on widgets
- **Notifications**: Real-time activity updates
- **Analytics**: Usage and collaboration metrics

## Security Considerations

- All data is encrypted in transit via WebSocket Secure (WSS)
- Local storage uses browser's built-in security
- Server-side authentication can be added via custom adapters
- Document access control through room-based permissions

## Migration Guide

### From Local State
If migrating from local state management:

1. Replace `useState` with `usePinboardStore`
2. Update component props to use store methods
3. Remove local state management logic
4. Test real-time synchronization

### Backward Compatibility
The store interface maintains compatibility with existing components while adding sync capabilities transparently.