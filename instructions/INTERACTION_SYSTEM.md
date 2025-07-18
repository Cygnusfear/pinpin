# Enhanced Pinboard Interaction System

This document describes the comprehensive Figma-like interaction system implemented for the pinboard application, including the latest transform functionality and generic widget architecture.

## Overview

The enhanced interaction system provides a professional-grade canvas experience with:

- **Multi-selection and area selection**
- **Precise dragging with snapping and constraints**
- **Transform functionality (resize and rotation)**
- **Generic widget architecture with extensible types**
- **Comprehensive keyboard shortcuts**
- **Smooth zoom and pan controls**
- **Visual feedback and indicators**
- **Modular, extensible architecture**

## Architecture

### Core Components

```
src/
├── types/
│   ├── canvas.ts              # Core interaction type definitions
│   └── widgets.ts             # Widget type system and interfaces
├── managers/
│   ├── SelectionManager.ts    # Selection logic and state
│   ├── KeyboardManager.ts     # Keyboard shortcuts and commands
│   ├── DragManager.ts         # Drag operations with snapping
│   └── InteractionController.ts # Main orchestrator with transform support
├── components/
│   ├── SelectionIndicator.tsx # Visual selection feedback with transform handles
│   ├── PinboardCanvas.tsx     # Enhanced canvas component
│   └── GenericWidgetRenderer.tsx # Universal widget renderer
├── core/
│   └── WidgetRegistry.ts      # Widget type registry and factory system
├── factories/
│   ├── ImageWidgetFactory.ts  # Image widget creation
│   ├── UrlWidgetFactory.ts    # URL/link widget creation
│   ├── NoteWidgetFactory.ts   # Text note widget creation
│   └── DocumentWidgetFactory.ts # Document widget creation
├── plugins/
│   └── CoreWidgetPlugin.ts    # Core widget types plugin
└── views/
    └── Pinboard.tsx           # Main pinboard view
```

### Manager Classes

#### InteractionController
Main orchestrator that handles:
- Event handling and routing
- Mode management (select, drag, hand, transform, area-select)
- Canvas transforms (pan/zoom)
- Transform operations (resize/rotation)
- Manager coordination

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

### Widget System

#### WidgetRegistry
Central registry for widget management:
- Widget type registration
- Factory pattern for widget creation
- Renderer registration
- Plugin system support

#### Widget Factories
Specialized factories for different content types:
- **ImageWidgetFactory**: Handles image files and URLs
- **UrlWidgetFactory**: Creates web link widgets
- **NoteWidgetFactory**: Creates text note widgets
- **DocumentWidgetFactory**: Handles PDF and document files

#### GenericWidgetRenderer
Universal renderer that:
- Renders any widget type using registered renderers
- Provides consistent interaction patterns
- Handles widget lifecycle events

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
- Rotation handle with connection line
- Selection count indicator
- Hover state indicators

### Transform System

#### Resize Functionality
- 8-point resize handles (corners and edges)
- Proportional and free-form resizing
- Minimum size constraints
- Zoom-level aware coordinate conversion
- Visual feedback during transformation

#### Rotation Functionality
- Dedicated rotation handle above selection
- Center-point rotation calculations
- Smooth rotation with proper angle calculations
- Visual connection line to selection

#### Transform Modes
- **Select Mode**: Default interaction mode
- **Transform Mode**: Active during resize/rotation operations
- Proper mode switching and state management

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

### Widget Management

#### Content Detection
- Automatic content type detection
- Smart widget creation based on dropped content
- Support for files, URLs, and text

#### Widget Types
- **Image Widgets**: Display images from files or URLs
- **URL Widgets**: Web link previews and navigation
- **Note Widgets**: Text content with editing capabilities
- **Document Widgets**: PDF and document file handling

#### Drag & Drop
- File drop support for multiple file types
- URL paste functionality
- Text content creation
- Automatic widget positioning

### Keyboard Shortcuts

#### Selection
- `Cmd+A` - Select All
- `Cmd+D` - Duplicate Selection
- `Delete/Backspace` - Delete Selection

#### Navigation
- `Space` - Hand Tool (pan mode)
- `1` - Zoom to Fit
- `2` - Zoom to Selection
- `0` - Zoom to 100%
- `+/-` - Zoom In/Out

#### Tools
- `V` - Select Tool
- `H` - Hand Tool

#### Canvas
- `Ctrl/Cmd + Scroll` - Zoom
- `Space + Drag` - Pan
- `Middle Mouse + Drag` - Pan

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
import { PinboardCanvas } from './components/PinboardCanvas';
import { Widget } from './types/widgets';

function MyPinboard() {
  const [widgets, setWidgets] = useState<Widget[]>([]);

  const handleWidgetUpdate = (id: string, updates: Partial<Widget>) => {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
  };

  const handleWidgetsUpdate = (updates: Array<{ id: string; updates: Partial<Widget> }>) => {
    setWidgets(prev => prev.map(widget => {
      const update = updates.find(u => u.id === widget.id);
      return update ? { ...widget, ...update.updates } : widget;
    }));
  };

  const handleWidgetAdd = (widget: WidgetCreateData) => {
    const newWidget: Widget = {
      ...widget,
      id: `widget-${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setWidgets(prev => [...prev, newWidget]);
  };

  const handleWidgetRemove = (id: string) => {
    setWidgets(prev => prev.filter(w => w.id !== id));
  };

  return (
    <PinboardCanvas
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
  metadata: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

// Specific widget types
interface ImageWidget extends Widget {
  type: 'image';
  src: string;
  alt?: string;
}

interface UrlWidget extends Widget {
  type: 'url';
  url: string;
  title?: string;
  description?: string;
}

interface NoteWidget extends Widget {
  type: 'note';
  content: string;
  backgroundColor?: string;
}
```

### Creating Custom Widget Types

```tsx
// 1. Define widget interface
interface CustomWidget extends Widget {
  type: 'custom';
  customProperty: string;
}

// 2. Create factory
class CustomWidgetFactory implements WidgetFactory<CustomWidget> {
  canHandle(data: any): boolean {
    return typeof data === 'string' && data.startsWith('custom:');
  }

  async create(data: string, position: Point): Promise<CustomWidget> {
    return {
      type: 'custom',
      x: position.x,
      y: position.y,
      width: 200,
      height: 100,
      rotation: 0,
      zIndex: 1,
      locked: false,
      metadata: {},
      customProperty: data.replace('custom:', ''),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
}

// 3. Create renderer
const CustomWidgetRenderer: React.FC<WidgetRendererProps<CustomWidget>> = ({
  widget,
  state,
  events
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: widget.x,
        top: widget.y,
        width: widget.width,
        height: widget.height,
        transform: `rotate(${widget.rotation}deg)`,
      }}
      onClick={events.onSelect}
    >
      {widget.customProperty}
    </div>
  );
};

// 4. Register with registry
const registry = getWidgetRegistry();
registry.registerWidgetType('custom', CustomWidgetFactory);
registry.registerRenderer('custom', CustomWidgetRenderer);
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

### Transform Performance
- Zoom-aware coordinate conversion
- Efficient bounds calculations
- Optimized handle positioning
- Smooth transform animations

## Current Status

### ✅ Fully Implemented
- **Selection System**: Single, multi, and area selection
- **Drag System**: Multi-widget dragging with snapping
- **Transform System**: Resize functionality with proper zoom handling
- **Widget System**: Generic architecture with extensible factories
- **Keyboard Shortcuts**: Comprehensive shortcut system
- **Canvas Navigation**: Zoom and pan controls
- **Content Management**: Drag & drop, paste, delete functionality

### ⚠️ Partially Working
- **Rotation Handle**: Implementation complete but event detection needs refinement
- **Some Transform Handles**: Most handles work, some need event detection improvements

### 🔧 In Development
- **Advanced Transform Features**: Rotation handle detection
- **Additional Widget Types**: More specialized widget types
- **Enhanced Snapping**: More sophisticated snapping algorithms

## Testing

### Manual Testing Checklist
- [x] Single selection works
- [x] Multi-selection with Cmd+Click
- [x] Area selection with drag
- [x] Dragging single widget
- [x] Dragging multiple widgets
- [x] Snapping to other widgets
- [x] Grid snapping
- [x] Constraint dragging with Shift
- [x] Zoom with Ctrl+Scroll
- [x] Pan with Space+Drag
- [x] Resize with transform handles
- [x] Delete functionality
- [x] File drop functionality
- [x] URL paste functionality
- [ ] Rotation functionality (in progress)

## Troubleshooting

### Common Issues

#### Transform handles not working
- Check z-index values (should be 1005+)
- Verify `pointerEvents: 'auto'` is set
- Ensure proper event propagation with `stopPropagation()`

#### Extreme scaling during resize
- Verify zoom level is properly accounted for in coordinate conversion
- Check `startTransform` method uses correct canvas bounds

#### Selection not working
- Check if InteractionController is properly initialized
- Verify canvas element is set
- Check for event handler conflicts

#### Dragging feels laggy
- Reduce snap target count
- Optimize widget rendering
- Check for unnecessary re-renders

## Future Enhancements

### Planned Features
- [ ] Complete rotation handle detection
- [ ] Grouping and ungrouping
- [ ] Layer management
- [ ] Alignment tools
- [ ] Undo/redo system
- [ ] Copy/paste functionality
- [ ] Context menus
- [ ] Grid and guides

### Advanced Interactions
- [ ] Multi-touch gestures
- [ ] Pen/stylus support
- [ ] Custom tools
- [ ] Advanced snapping modes

### Collaboration Features (Keepsync Integration)
- [ ] Real-time cursors
- [ ] Presence indicators
- [ ] Conflict resolution
- [ ] Live collaboration
- [ ] Comments and annotations

## Contributing

When adding new interaction features:

1. Follow the existing manager pattern
2. Add comprehensive TypeScript types
3. Include visual feedback components
4. Write unit tests
5. Update this documentation
6. Test across different devices/browsers
7. Consider performance implications
8. Ensure proper event handling and cleanup

## Performance Metrics

Target performance goals:
- 60fps during interactions
- <100ms response time for selections
- <16ms for drag updates
- Smooth zoom/pan at all scales
- Memory usage <50MB for 1000 widgets
- Transform operations <50ms response time