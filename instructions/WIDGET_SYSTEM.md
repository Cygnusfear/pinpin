# Generic Widget System Architecture

This document describes the extensible widget system implemented for the pinboard application, providing a foundation for supporting any type of content as interactive widgets.

## Overview

The widget system provides:

- **Generic widget architecture** supporting any content type
- **Extensible factory pattern** for widget creation
- **Plugin system** for registering new widget types
- **Universal renderer** for consistent widget display
- **Type-safe interfaces** with comprehensive TypeScript support
- **Automatic content detection** and smart widget creation

## Core Architecture

### Widget Registry

The `WidgetRegistry` serves as the central hub for widget management:

```typescript
// Core registry functionality
class WidgetRegistry {
  // Widget type management
  registerWidgetType<T extends Widget>(type: string, factory: WidgetFactory<T>): void
  getWidgetTypes(): string[]
  canHandleData(data: any): string[]
  
  // Widget creation
  createWidget<T extends Widget>(type: string, data: any, position: Point): Promise<T>
  
  // Renderer management
  registerRenderer<T extends Widget>(type: string, renderer: WidgetRenderer<T>): void
  getRenderer(type: string): WidgetRenderer<any> | null
  
  // Plugin system
  installPlugin(plugin: WidgetPlugin): Promise<void>
  uninstallPlugin(pluginId: string): void
}
```

### Widget Types

#### Base Widget Interface
```typescript
interface Widget {
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
```

#### Specific Widget Types
```typescript
// Image widgets for photos and graphics
interface ImageWidget extends Widget {
  type: 'image';
  src: string;
  alt?: string;
}

// URL widgets for web links
interface UrlWidget extends Widget {
  type: 'url';
  url: string;
  title?: string;
  description?: string;
  favicon?: string;
}

// Note widgets for text content
interface NoteWidget extends Widget {
  type: 'note';
  content: string;
  backgroundColor?: string;
  textColor?: string;
}

// Document widgets for files
interface DocumentWidget extends Widget {
  type: 'document';
  filename: string;
  fileType: string;
  fileSize: number;
  previewUrl?: string;
}

// Group widgets for organizing content
interface GroupWidget extends Widget {
  type: 'group';
  children: string[];
  backgroundColor?: string;
}

// App widgets for embedded applications
interface AppWidget extends Widget {
  type: 'app';
  appId: string;
  config: Record<string, any>;
}

// Unknown widgets for unrecognized content
interface UnknownWidget extends Widget {
  type: 'unknown';
  originalData: any;
  reason: string;
}
```

### Widget Factories

#### Factory Interface
```typescript
interface WidgetFactory<T extends Widget> {
  canHandle(data: any): boolean;
  create(data: any, position: Point): Promise<T>;
  getDefaultSize?(): { width: number; height: number };
  getPreview?(data: any): Promise<string>;
}
```

#### Core Factories

##### ImageWidgetFactory
Handles image content from various sources:
```typescript
class ImageWidgetFactory implements WidgetFactory<ImageWidget> {
  canHandle(data: any): boolean {
    // Handles File objects with image MIME types
    // Handles URLs pointing to images
    // Handles base64 image data
  }

  async create(data: File | string, position: Point): Promise<ImageWidget> {
    // Creates image widgets with proper src URLs
    // Handles file upload and URL validation
    // Sets appropriate default dimensions
  }
}
```

##### UrlWidgetFactory
Creates widgets for web links:
```typescript
class UrlWidgetFactory implements WidgetFactory<UrlWidget> {
  canHandle(data: any): boolean {
    // Detects valid URLs in text content
    // Supports various URL formats
  }

  async create(data: string, position: Point): Promise<UrlWidget> {
    // Extracts and validates URLs
    // Fetches metadata when possible
    // Creates link preview widgets
  }
}
```

##### NoteWidgetFactory
Handles text content:
```typescript
class NoteWidgetFactory implements WidgetFactory<NoteWidget> {
  canHandle(data: any): boolean {
    // Handles plain text strings
    // Fallback for unrecognized text content
  }

  async create(data: string, position: Point): Promise<NoteWidget> {
    // Creates sticky note-style widgets
    // Supports rich text formatting
    // Auto-sizes based on content
  }
}
```

##### DocumentWidgetFactory
Manages document files:
```typescript
class DocumentWidgetFactory implements WidgetFactory<DocumentWidget> {
  canHandle(data: any): boolean {
    // Handles PDF files
    // Supports various document formats
    // Handles file metadata
  }

  async create(data: File, position: Point): Promise<DocumentWidget> {
    // Creates document preview widgets
    // Extracts file metadata
    // Generates preview thumbnails
  }
}
```

### Widget Renderers

#### Renderer Interface
```typescript
interface WidgetRenderer<T extends Widget> {
  (props: WidgetRendererProps<T>): React.ReactElement;
}

interface WidgetRendererProps<T extends Widget> {
  widget: T;
  state: WidgetRenderState;
  events: WidgetEvents;
}
```

#### Render State
```typescript
interface WidgetRenderState {
  isSelected: boolean;
  isHovered: boolean;
  isEditing: boolean;
  isLoading: boolean;
  hasError: boolean;
  transform: {
    x: number;
    y: number;
    scale: number;
    rotation: number;
  };
}
```

#### Widget Events
```typescript
interface WidgetEvents {
  onUpdate: (updates: Partial<Widget>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onConfigure: () => void;
  onSelect: (event?: React.MouseEvent) => void;
  onDeselect: () => void;
  onHover: () => void;
  onUnhover: () => void;
}
```

### Generic Widget Renderer

The `GenericWidgetRenderer` provides universal widget rendering:

```typescript
const GenericWidgetRenderer: React.FC<{
  widget: Widget;
  state: WidgetRenderState;
  events: WidgetEvents;
}> = ({ widget, state, events }) => {
  const registry = getWidgetRegistry();
  const SpecificRenderer = registry.getRenderer(widget.type);
  
  if (!SpecificRenderer) {
    return <UnknownWidgetRenderer widget={widget} state={state} events={events} />;
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      style={{
        position: 'absolute',
        left: widget.x,
        top: widget.y,
        width: widget.width,
        height: widget.height,
        transform: `rotate(${widget.rotation}deg)`,
        zIndex: widget.zIndex,
      }}
    >
      <SpecificRenderer widget={widget} state={state} events={events} />
    </motion.div>
  );
};
```

## Plugin System

### Plugin Interface
```typescript
interface WidgetPlugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  
  install(registry: WidgetRegistry): Promise<void>;
  uninstall?(registry: WidgetRegistry): Promise<void>;
}
```

### Core Widget Plugin
The `CoreWidgetPlugin` registers essential widget types:

```typescript
export const coreWidgetPlugin: WidgetPlugin = {
  id: 'core-widgets',
  name: 'Core Widget Types',
  version: '1.0.0',
  description: 'Essential widget types for images, URLs, notes, and documents',
  
  async install(registry: WidgetRegistry) {
    // Register widget types
    registry.registerWidgetType('image', new ImageWidgetFactory());
    registry.registerWidgetType('url', new UrlWidgetFactory());
    registry.registerWidgetType('note', new NoteWidgetFactory());
    registry.registerWidgetType('document', new DocumentWidgetFactory());
    
    // Register renderers
    registry.registerRenderer('image', ImageWidgetRenderer);
    registry.registerRenderer('url', UrlWidgetRenderer);
    registry.registerRenderer('note', NoteWidgetRenderer);
    registry.registerRenderer('document', DocumentWidgetRenderer);
  }
};
```

## Content Detection and Creation

### Smart Content Detection
The system automatically detects content types and creates appropriate widgets:

```typescript
// Example usage in canvas component
const handleContentDrop = async (dataTransfer: DataTransfer, position: Point) => {
  const registry = getWidgetRegistry();
  const files = Array.from(dataTransfer.files);
  const text = dataTransfer.getData('text/plain');
  
  // Handle files first (highest priority)
  for (const file of files) {
    const supportedTypes = registry.canHandleData(file);
    if (supportedTypes.length > 0) {
      const widget = await registry.createWidget(supportedTypes[0], file, position);
      onWidgetAdd(widget);
    }
  }
  
  // Handle text/URLs if no files
  if (text && files.length === 0) {
    const supportedTypes = registry.canHandleData(text);
    if (supportedTypes.length > 0) {
      // Prefer URL over note for URL-like text
      const preferredType = supportedTypes.includes('url') ? 'url' : supportedTypes[0];
      const widget = await registry.createWidget(preferredType, text, position);
      onWidgetAdd(widget);
    }
  }
};
```

### Widget Creation Data
```typescript
interface WidgetCreateData {
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  metadata: Record<string, any>;
  [key: string]: any; // Type-specific properties
}
```

## Usage Examples

### Basic Widget Management
```typescript
import { getWidgetRegistry } from './core/WidgetRegistry';
import { coreWidgetPlugin } from './plugins/CoreWidgetPlugin';

// Initialize registry
const registry = getWidgetRegistry();
await registry.installPlugin(coreWidgetPlugin);

// Create widgets from different content types
const imageWidget = await registry.createWidget('image', imageFile, { x: 100, y: 100 });
const urlWidget = await registry.createWidget('url', 'https://example.com', { x: 200, y: 100 });
const noteWidget = await registry.createWidget('note', 'Hello World!', { x: 300, y: 100 });
```

### Creating Custom Widget Types
```typescript
// 1. Define custom widget interface
interface CalendarWidget extends Widget {
  type: 'calendar';
  events: CalendarEvent[];
  viewMode: 'month' | 'week' | 'day';
}

// 2. Create factory
class CalendarWidgetFactory implements WidgetFactory<CalendarWidget> {
  canHandle(data: any): boolean {
    return data && typeof data === 'object' && data.type === 'calendar';
  }

  async create(data: any, position: Point): Promise<CalendarWidget> {
    return {
      type: 'calendar',
      x: position.x,
      y: position.y,
      width: 400,
      height: 300,
      rotation: 0,
      zIndex: 1,
      locked: false,
      metadata: {},
      events: data.events || [],
      viewMode: data.viewMode || 'month',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
}

// 3. Create renderer
const CalendarWidgetRenderer: React.FC<WidgetRendererProps<CalendarWidget>> = ({
  widget,
  state,
  events
}) => {
  return (
    <div
      className={`calendar-widget ${state.isSelected ? 'selected' : ''}`}
      onClick={events.onSelect}
    >
      <CalendarComponent
        events={widget.events}
        viewMode={widget.viewMode}
        onEventAdd={(event) => events.onUpdate({ 
          events: [...widget.events, event] 
        })}
      />
    </div>
  );
};

// 4. Create plugin
const calendarPlugin: WidgetPlugin = {
  id: 'calendar-widget',
  name: 'Calendar Widget',
  version: '1.0.0',
  
  async install(registry: WidgetRegistry) {
    registry.registerWidgetType('calendar', new CalendarWidgetFactory());
    registry.registerRenderer('calendar', CalendarWidgetRenderer);
  }
};

// 5. Install plugin
await registry.installPlugin(calendarPlugin);
```

### Widget State Management
```typescript
// Widget update patterns
const handleWidgetUpdate = (id: string, updates: Partial<Widget>) => {
  setWidgets(prev => prev.map(w => 
    w.id === id ? { ...w, ...updates, updatedAt: Date.now() } : w
  ));
};

// Batch widget updates (for dragging multiple widgets)
const handleWidgetsUpdate = (updates: Array<{ id: string; updates: Partial<Widget> }>) => {
  setWidgets(prev => prev.map(widget => {
    const update = updates.find(u => u.id === widget.id);
    return update 
      ? { ...widget, ...update.updates, updatedAt: Date.now() }
      : widget;
  }));
};

// Widget creation
const handleWidgetAdd = (widgetData: WidgetCreateData) => {
  const newWidget: Widget = {
    ...widgetData,
    id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  setWidgets(prev => [...prev, newWidget]);
};

// Widget deletion
const handleWidgetRemove = (id: string) => {
  setWidgets(prev => prev.filter(w => w.id !== id));
};
```

## Performance Considerations

### Efficient Rendering
- Use `React.memo` for widget renderers
- Implement virtual scrolling for large widget counts
- Optimize image loading with lazy loading
- Cache widget previews and thumbnails

### Memory Management
- Clean up widget resources on unmount
- Implement widget pooling for frequently created types
- Use weak references for large widget collections
- Optimize metadata storage

### Factory Performance
- Cache factory results when possible
- Implement async factory methods for heavy operations
- Use worker threads for file processing
- Optimize content detection algorithms

## Error Handling

### Factory Error Handling
```typescript
class RobustWidgetFactory implements WidgetFactory<Widget> {
  async create(data: any, position: Point): Promise<Widget> {
    try {
      return await this.createWidget(data, position);
    } catch (error) {
      console.error('Widget creation failed:', error);
      
      // Fallback to unknown widget
      return {
        type: 'unknown',
        x: position.x,
        y: position.y,
        width: 200,
        height: 100,
        rotation: 0,
        zIndex: 1,
        locked: false,
        metadata: { error: error.message },
        originalData: data,
        reason: 'Creation failed',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }
  }
}
```

### Renderer Error Boundaries
```typescript
class WidgetErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Widget render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorWidgetRenderer error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

## Testing

### Factory Testing
```typescript
describe('ImageWidgetFactory', () => {
  const factory = new ImageWidgetFactory();
  
  test('handles image files', () => {
    const imageFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
    expect(factory.canHandle(imageFile)).toBe(true);
  });
  
  test('creates valid image widgets', async () => {
    const widget = await factory.create(imageFile, { x: 0, y: 0 });
    expect(widget.type).toBe('image');
    expect(widget.src).toBeDefined();
  });
});
```

### Registry Testing
```typescript
describe('WidgetRegistry', () => {
  test('registers and retrieves widget types', () => {
    const registry = new WidgetRegistry();
    const factory = new TestWidgetFactory();
    
    registry.registerWidgetType('test', factory);
    expect(registry.getWidgetTypes()).toContain('test');
  });
});
```

## Future Enhancements

### Planned Features
- [ ] Widget templates and presets
- [ ] Advanced widget grouping
- [ ] Widget animation system
- [ ] Cross-widget data binding
- [ ] Widget marketplace/store
- [ ] Version control for widgets
- [ ] Widget collaboration features

### Advanced Widget Types
- [ ] Chart and graph widgets
- [ ] Video and audio widgets
- [ ] Interactive form widgets
- [ ] Code editor widgets
- [ ] Map and location widgets
- [ ] Social media embed widgets

### System Improvements
- [ ] Widget lazy loading
- [ ] Advanced caching strategies
- [ ] Widget streaming for large datasets
- [ ] Real-time widget synchronization
- [ ] Widget analytics and usage tracking

## Best Practices

### Widget Development
1. **Type Safety**: Always use TypeScript interfaces
2. **Error Handling**: Implement robust error handling
3. **Performance**: Optimize for large widget counts
4. **Accessibility**: Include proper ARIA attributes
5. **Testing**: Write comprehensive unit tests
6. **Documentation**: Document widget APIs clearly

### Factory Implementation
1. **Content Detection**: Make detection specific but flexible
2. **Async Operations**: Handle file processing asynchronously
3. **Fallback Handling**: Provide graceful degradation
4. **Resource Management**: Clean up resources properly
5. **Validation**: Validate input data thoroughly

### Renderer Guidelines
1. **Consistent Styling**: Follow design system guidelines
2. **Event Handling**: Implement all required events
3. **State Management**: Handle all render states properly
4. **Performance**: Optimize rendering performance
5. **Responsive Design**: Support different widget sizes