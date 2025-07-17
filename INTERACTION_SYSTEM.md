# Enhanced Pinboard Interaction System

This document describes the comprehensive Figma-like interaction system implemented for the pinboard application.

## Overview

The enhanced interaction system provides a professional-grade canvas experience with:

- **Multi-selection and area selection**
- **Precise dragging with snapping and constraints**
- **Comprehensive keyboard shortcuts**
- **Smooth zoom and pan controls**
- **Visual feedback and indicators**
- **Modular, extensible architecture**

## Architecture

### Core Components

```
src/
├── types/
│   └── canvas.ts              # Core type definitions
├── managers/
│   ├── SelectionManager.ts    # Selection logic and state
│   ├── KeyboardManager.ts     # Keyboard shortcuts and commands
│   ├── DragManager.ts         # Drag operations with snapping
│   └── InteractionController.ts # Main orchestrator
├── components/
│   ├── SelectionIndicator.tsx # Visual selection feedback
│   ├── EnhancedPinboardCanvas.tsx # Main canvas component
│   └── PinboardCanvas.tsx     # Original implementation
└── views/
    ├── EnhancedPinboard.tsx   # Enhanced demo view
    └── Pinboard.tsx           # Original view
```

### Manager Classes

#### SelectionManager
Handles all selection logic including:
- Single and multi-selection
- Area selection (marquee)
- Hover states
- Selection bounds calculation
- Figma-style click behaviors

#### KeyboardManager
Manages keyboard shortcuts and commands:
- Configurable shortcut mappings
- Command registration system
- Modifier key handling
- Input field detection

#### DragManager
Handles widget dragging with:
- Multi-widget dragging
- Smart snapping to other widgets and grid
- Movement constraints (45-degree angles)
- Visual snap indicators

#### InteractionController
Orchestrates all interactions:
- Event handling and routing
- Mode management
- Canvas transforms (pan/zoom)
- Manager coordination

## Features

### Selection System

#### Single Selection
- Click on widget to select
- Clear visual selection indicators
- Transform handles for resize/rotate

#### Multi-Selection
- `Cmd+Click` to toggle selection
- `Shift+Click` to add to selection
- Drag on canvas for area selection
- `Cmd+Drag` for additive area selection

#### Visual Feedback
- Blue selection outlines
- Transform handles on selection bounds
- Selection count indicator
- Hover state indicators

### Dragging System

#### Basic Dragging
- Click and drag to move widgets
- Smooth visual feedback
- Multi-widget dragging support

#### Smart Snapping
- Snap to other widget edges
- Snap to widget centers
- Grid snapping (10px intervals)
- Visual snap indicators
- Configurable snap threshold

#### Constraints
- `Shift+Drag` for 45-degree angle constraints
- Horizontal/vertical locking
- Diagonal movement support

### Keyboard Shortcuts

#### Selection
- `Cmd+A` - Select All
- `Cmd+D` - Duplicate Selection
- `Cmd+G` - Group (planned)
- `Cmd+Shift+G` - Ungroup (planned)

#### Navigation
- `Space` - Hand Tool (pan mode)
- `1` - Zoom to Fit
- `2` - Zoom to Selection
- `0` - Zoom to 100%
- `+/-` - Zoom In/Out

#### Tools
- `V` - Select Tool
- `H` - Hand Tool
- `T` - Text Tool (planned)
- `R` - Rectangle Tool (planned)

#### Editing
- `Cmd+Z` - Undo (planned)
- `Cmd+Shift+Z` - Redo (planned)
- `Cmd+C` - Copy (planned)
- `Cmd+V` - Paste (planned)
- `Delete` - Delete Selection

#### Alignment (planned)
- `Cmd+Shift+←` - Align Left
- `Cmd+Shift+→` - Align Right
- `Cmd+Shift+↑` - Align Top
- `Cmd+Shift+↓` - Align Bottom

### Canvas Navigation

#### Zoom Controls
- `Ctrl/Cmd + Scroll` - Zoom in/out
- Zoom towards mouse cursor
- Smooth zoom transitions
- Zoom limits (1% to 10000%)

#### Pan Controls
- `Space + Drag` - Pan canvas
- `Middle Mouse + Drag` - Pan canvas
- `Scroll` - Pan canvas
- Auto-pan during edge dragging

## Usage

### Basic Setup

```tsx
import { EnhancedPinboardCanvas } from './components/EnhancedPinboardCanvas';
import { Widget } from './types/canvas';

function MyPinboard() {
  const [widgets, setWidgets] = useState<Widget[]>([]);

  const handleWidgetUpdate = (id: string, updates: Partial<Widget>) => {
    // Update single widget
  };

  const handleWidgetsUpdate = (updates: Array<{ id: string; updates: Partial<Widget> }>) => {
    // Update multiple widgets (for dragging)
  };

  const handleWidgetAdd = (widget: Omit<Widget, 'id'>) => {
    // Add new widget
  };

  const handleWidgetRemove = (id: string) => {
    // Remove widget
  };

  return (
    <EnhancedPinboardCanvas
      widgets={widgets}
      onWidgetUpdate={handleWidgetUpdate}
      onWidgetsUpdate={handleWidgetsUpdate}
      onWidgetAdd={handleWidgetAdd}
      onWidgetRemove={handleWidgetRemove}
    />
  );
}
```

### Widget Interface

```tsx
interface Widget extends BaseWidget {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  selected: boolean;
  metadata: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}
```

## Performance Optimizations

### Event Handling
- Throttled mouse move events (60fps)
- Debounced resize operations
- Efficient hit testing
- Minimal re-renders

### Rendering
- React.memo for components
- Optimized selection calculations
- Efficient transform updates
- AnimatePresence for smooth transitions

### Memory Management
- Proper event cleanup
- Manager lifecycle management
- Optimized data structures

## Extensibility

### Adding New Interaction Modes
```tsx
// Add to InteractionMode type
type InteractionMode = 'select' | 'hand' | 'your-mode';

// Handle in InteractionController
switch (this.interactionState.mode) {
  case 'your-mode':
    this.handleYourMode(point, modifiers);
    break;
}
```

### Custom Keyboard Shortcuts
```tsx
keyboardManager.registerCommand('customCommand', () => {
  // Your custom logic
});
```

### Custom Snap Targets
```tsx
// Extend SnapTarget interface
interface CustomSnapTarget extends SnapTarget {
  customProperty: any;
}

// Add to DragManager
generateCustomSnapTargets(): CustomSnapTarget[] {
  // Your snap logic
}
```

## Future Enhancements

### Planned Features
- [ ] Grouping and ungrouping
- [ ] Layer management
- [ ] Alignment tools
- [ ] Undo/redo system
- [ ] Copy/paste functionality
- [ ] Context menus
- [ ] Tool palette
- [ ] Grid and guides
- [ ] Rulers and measurements

### Advanced Interactions
- [ ] Multi-touch gestures
- [ ] Pen/stylus support
- [ ] Voice commands
- [ ] Gesture shortcuts
- [ ] Custom tools

### Collaboration Features
- [ ] Real-time cursors
- [ ] Presence indicators
- [ ] Conflict resolution
- [ ] Live collaboration
- [ ] Comments and annotations

## Testing

### Manual Testing Checklist
- [ ] Single selection works
- [ ] Multi-selection with Cmd+Click
- [ ] Area selection with drag
- [ ] Dragging single widget
- [ ] Dragging multiple widgets
- [ ] Snapping to other widgets
- [ ] Grid snapping
- [ ] Constraint dragging with Shift
- [ ] Zoom with Ctrl+Scroll
- [ ] Pan with Space+Drag
- [ ] All keyboard shortcuts
- [ ] File drop functionality

### Automated Testing
```bash
# Run interaction tests
npm test -- --testPathPattern=interaction

# Run performance tests
npm run test:performance
```

## Troubleshooting

### Common Issues

#### Selection not working
- Check if InteractionController is properly initialized
- Verify canvas element is set
- Check for event handler conflicts

#### Dragging feels laggy
- Reduce snap target count
- Optimize widget rendering
- Check for unnecessary re-renders

#### Keyboard shortcuts not working
- Verify KeyboardManager is enabled
- Check for input field focus
- Ensure proper event binding

### Debug Mode
```tsx
// Enable debug logging
const controller = new InteractionController(callbacks);
controller.setDebugMode(true);
```

## Contributing

When adding new interaction features:

1. Follow the existing manager pattern
2. Add comprehensive TypeScript types
3. Include visual feedback components
4. Write unit tests
5. Update this documentation
6. Test across different devices/browsers

## Performance Metrics

Target performance goals:
- 60fps during interactions
- <100ms response time for selections
- <16ms for drag updates
- Smooth zoom/pan at all scales
- Memory usage <50MB for 1000 widgets