# Plugin Development Guide

This comprehensive guide covers how to build plugins for the Pinboard application, including file storage with Pinata, and interaction handling.

## Table of Contents

1. [Plugin Architecture Overview](#plugin-architecture-overview)
2. [Creating a Basic Plugin](#creating-a-basic-plugin)
3. [Plugin Factory Implementation](#plugin-factory-implementation)
4. [Plugin Renderer Implementation](#plugin-renderer-implementation)
5. [Using Pinata for File Storage](#using-pinata-for-file-storage)
6. [Interaction Handling](#interaction-handling)
7. [Plugin Registration](#plugin-registration)
8. [Advanced Features](#advanced-features)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

## Plugin Architecture Overview

The Pinboard plugin system is built around a modular architecture that separates concerns into distinct components:

```
src/plugins/your-plugin/
├── index.ts          # Plugin definition and exports
├── factory.ts        # Widget creation logic
├── renderer.tsx      # React component for rendering
└── types.ts          # Optional: Plugin-specific types
```

### Core Components

1. **Plugin Definition** ([`WidgetPlugin`](../types/widgets.ts:404)): Main plugin interface
2. **Factory** ([`WidgetFactory`](../types/widgets.ts:287)): Handles widget creation from data
3. **Renderer** ([`WidgetRenderer`](../types/widgets.ts:346)): React component for displaying widgets
4. **Type Definition** ([`WidgetTypeDefinition`](../types/widgets.ts:361)): Metadata about the widget type

## Creating a Basic Plugin

### Step 1: Define Your Plugin Structure

First, create the directory structure and define your plugin:

```typescript
// src/plugins/my-widget/index.ts
import type { WidgetPlugin, WidgetTypeDefinition } from "../../types/widgets";
import { MyWidgetFactory } from "./factory";
import { MyWidgetRenderer } from "./renderer";

export const myWidgetTypeDefinition: WidgetTypeDefinition[] = [
  {
    type: "my-widget",
    name: "My Widget",
    description: "Description of what your widget does",
    icon: "🎯", // Emoji or icon identifier
    category: "app", // "media" | "document" | "web" | "text" | "app" | "layout" | "other"
    defaultSize: { width: 300, height: 200 },
    minSize: { width: 200, height: 150 },
    maxSize: { width: 600, height: 400 },
    aspectRatioLocked: false,
    resizable: true,
    rotatable: true,
    configurable: true,
    autoCreateOnly: false, // Set to true if widget should only be created automatically
  },
];

export class MyWidgetPlugin implements WidgetPlugin {
  id = "my-widget";
  name = "My Widget";
  version = "1.0.0";
  description = "A custom widget for specific functionality";
  author = "Your Name";

  types: WidgetTypeDefinition[] = myWidgetTypeDefinition;
  factories = [new MyWidgetFactory()];
  renderers = [{ type: "my-widget", component: MyWidgetRenderer }];

  async install(registry: any): Promise<void> {
    // Register type definition
    this.types.forEach((type) => registry.registerType(type));

    // Register factory
    this.factories.forEach((factory) => registry.registerFactory(factory));

    // Register renderer
    this.renderers.forEach((renderer) => registry.registerRenderer(renderer));

    console.log(`✅ Installed ${this.name} v${this.version}`);
  }

  async uninstall(registry: any): Promise<void> {
    // Unregister in reverse order
    this.renderers.forEach((renderer) =>
      registry.unregisterRenderer(renderer.type),
    );
    this.factories.forEach((factory) =>
      registry.unregisterFactory(factory.type),
    );
    this.types.forEach((type) => registry.unregisterType(type.type));

    console.log(`❌ Uninstalled ${this.name}`);
  }
}

// Export plugin instance
export const myWidgetPlugin = new MyWidgetPlugin();

// Export individual components for flexibility
export { MyWidgetFactory } from "./factory";
export { MyWidgetRenderer } from "./renderer";
```

### Step 2: Define Your Widget Content Type

Add your widget's content interface to [`src/types/widgets.ts`](../types/widgets.ts:75):

```typescript
// In src/types/widgets.ts, add to the widget content types section
export interface MyWidgetContent {
  title: string;
  data: any; // Your specific data structure
  settings?: {
    color?: string;
    enabled?: boolean;
  };
}
```

## Plugin Factory Implementation

The factory is responsible for creating widgets from various data sources. It implements the [`WidgetFactory<T>`](../types/widgets.ts:287) interface:

```typescript
// src/plugins/my-widget/factory.ts
import type {
  CreateWidgetInput,
  HydratedWidget,
  Position,
  WidgetCapabilities,
  WidgetFactory,
  MyWidgetContent,
} from "../../types/widgets";
import { myWidgetTypeDefinition } from "./index";

export class MyWidgetFactory implements WidgetFactory<MyWidgetContent> {
  type = "my-widget";

  /**
   * Determines if this factory can handle the provided data
   * This is called by the system to find the right factory for data
   */
  canHandle(data: any): boolean {
    // Handle explicit requests
    if (data?.type === "my-widget") {
      return true;
    }

    // Handle specific data patterns
    if (data && typeof data === "object" && data.someSpecificProperty) {
      return true;
    }

    // Handle specific string patterns
    if (typeof data === "string") {
      // Example: Handle URLs with specific patterns
      return data.includes("specific-pattern");
    }

    return false;
  }

  /**
   * Create a widget from the provided data
   */
  async create(data: any, position: Position): Promise<CreateWidgetInput> {
    let title = "Default Title";
    let content: any = {};

    // Process different data types
    if (typeof data === "string") {
      title = data;
      content = { value: data };
    } else if (data && typeof data === "object") {
      title = data.title || "Default Title";
      content = data.content || {};
    }

    const widgetContent: MyWidgetContent = {
      title,
      data: content,
      settings: {
        color: "#ffffff",
        enabled: true,
      },
    };

    return {
      type: this.type,
      x: position.x,
      y: position.y,
      width: myWidgetTypeDefinition[0].defaultSize.width,
      height: myWidgetTypeDefinition[0].defaultSize.height,
      content: widgetContent,
    };
  }

  /**
   * Get default size for the widget
   */
  getDefaultSize(): { width: number; height: number } {
    return myWidgetTypeDefinition[0].defaultSize;
  }

  /**
   * Define what capabilities this widget has
   */
  getCapabilities(): WidgetCapabilities {
    return {
      canResize: true,
      canRotate: true,
      canEdit: true,
      canConfigure: true,
      canGroup: true,
      canDuplicate: true,
      canExport: true,
      hasContextMenu: true,
      hasToolbar: false,
      hasInspector: true,
    };
  }

  /**
   * Validate widget content (optional)
   */
  validate(widget: HydratedWidget<MyWidgetContent>) {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!widget.content || !widget.content.data) {
      errors.push("Widget content is missing");
    } else {
      const data = widget.content.data;
      if (!data.title || typeof data.title !== "string") {
        errors.push("Title is required and must be a string");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
```

## Plugin Renderer Implementation

The renderer is a React component that displays your widget. It receives [`WidgetRendererProps<T>`](../types/widgets.ts:310):

```typescript
// src/plugins/my-widget/renderer.tsx
import React, { useCallback, useState } from "react";
import type {
  WidgetRendererProps,
  MyWidgetContent,
} from "../../types/widgets";
import { useContentActions } from "../../stores/widgetStore";

export const MyWidgetRenderer: React.FC<WidgetRendererProps<MyWidgetContent>> = ({
  widget,
  state,
  events,
  canvasTransform,
}) => {
  const { updateContent } = useContentActions();
  const [isEditing, setIsEditing] = useState(false);

  // Handle content updates
  const handleUpdateContent = useCallback((updates: Partial<MyWidgetContent>) => {
    if (!widget.isContentLoaded || !widget.content.data) return;

    const newData = {
      ...widget.content.data,
      ...updates,
    };

    updateContent(widget.contentId, { data: newData });
  }, [widget, updateContent]);

  // Loading state
  if (!widget.isContentLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Error state
  if (widget.contentError) {
    return (
      <div className="flex items-center justify-center h-full bg-red-100 rounded-lg">
        <div className="text-red-500">Error: {widget.contentError}</div>
      </div>
    );
  }

  const data = widget.content.data;

  return (
    <div 
      className="h-full rounded-lg shadow border overflow-hidden"
      style={{ backgroundColor: data.settings?.color || "#ffffff" }}
    >
      <div className="p-4 h-full flex flex-col">
        {/* Header */}
        <div className="mb-2">
          <h3 className="text-lg font-semibold">{data.title}</h3>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {/* Your widget content here */}
          <pre className="text-sm">
            {JSON.stringify(data.data, null, 2)}
          </pre>
        </div>

        {/* Footer/Controls */}
        <div className="mt-2 flex justify-between items-center">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-2 py-1 text-xs bg-blue-500 text-white rounded"
          >
            {isEditing ? "Done" : "Edit"}
          </button>
          
          <div className="text-xs text-gray-500">
            {data.settings?.enabled ? "Enabled" : "Disabled"}
          </div>
        </div>
      </div>
    </div>
  );
};
```

## Using Pinata for File Storage

The [`PinataService`](../services/pinataService.ts:28) provides IPFS file storage capabilities. Here's how to use it in your plugin:

### Basic File Upload

```typescript
import { pinataService } from "../../services/pinataService";

// In your factory or component
async handleFileUpload(file: File) {
  try {
    // Upload file to Pinata
    const result = await pinataService.uploadFile(file, (progress) => {
      console.log(`Upload progress: ${progress.progress}%`);
    });

    console.log("File uploaded:", result);
    // result contains: { cid, url, size, filename }
    
    return result.url; // Use this URL in your widget
  } catch (error) {
    console.error("Upload failed:", error);
    throw error;
  }
}
```

### Multiple File Upload

```typescript
async handleMultipleFiles(files: File[]) {
  try {
    const results = await pinataService.uploadFiles(
      files,
      (uploadId, progress) => {
        console.log(`Upload ${uploadId}: ${progress.progress}%`);
      }
    );

    return results; // Array of upload results
  } catch (error) {
    console.error("Batch upload failed:", error);
    throw error;
  }
}
```

### File Upload in Widget Factory

Here's an example of handling file uploads in a factory:

```typescript
// In your factory's create method
async create(data: any, position: Position): Promise<CreateWidgetInput> {
  let fileUrl = "";
  let fileName = "";

  if (data instanceof File) {
    try {
      // Show immediate preview with blob URL
      const tempUrl = URL.createObjectURL(data);
      
      // Upload to Pinata in background
      const uploadResult = await pinataService.uploadFile(data);
      
      // Clean up temp URL
      URL.revokeObjectURL(tempUrl);
      
      fileUrl = uploadResult.url;
      fileName = uploadResult.filename;
    } catch (error) {
      console.error("File upload failed:", error);
      // Fallback to local blob URL
      fileUrl = URL.createObjectURL(data);
      fileName = data.name;
    }
  }

  const content: MyWidgetContent = {
    title: fileName || "Uploaded File",
    data: {
      url: fileUrl,
      originalName: fileName,
    },
  };

  return {
    type: this.type,
    x: position.x,
    y: position.y,
    width: 300,
    height: 200,
    content,
  };
}
```

### Environment Configuration

Ensure your environment variables are set in `.env`:

```bash
VITE_PINATA_JWT=your_pinata_jwt_token
VITE_PINATA_KEY=your_pinata_api_key
VITE_PINATA_SECRET=your_pinata_secret_key
VITE_PINATA_GATEWAY=your_custom_gateway.mypinata.cloud
```

## Interaction Handling

The [`InteractionController`](../managers/InteractionController.ts:43) manages user interactions with widgets. Here's how to handle interactions in your plugin:

### Widget Events

Your renderer receives event handlers through the [`WidgetEvents`](../types/widgets.ts:200) interface:

```typescript
export const MyWidgetRenderer: React.FC<WidgetRendererProps<MyWidgetContent>> = ({
  widget,
  state,
  events,
}) => {
  const handleClick = () => {
    // Trigger widget selection
    events.onSelect();
  };

  const handleDoubleClick = () => {
    // Start editing mode
    events.onEdit();
  };

  const handleDelete = () => {
    // Delete the widget
    events.onDelete();
  };

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`widget ${state.isSelected ? 'selected' : ''} ${state.isHovered ? 'hovered' : ''}`}
    >
      {/* Widget content */}
    </div>
  );
};
```

### Custom Interaction Modes

For advanced interactions, you can work with the state machine:

```typescript
// Example: Custom drag behavior
const handleMouseDown = (event: React.MouseEvent) => {
  // Let the interaction controller handle the event
  event.stopPropagation(); // Prevent default canvas behavior if needed
  
  // Your custom logic here
  console.log("Custom mouse down handler");
};

// Example: Keyboard shortcuts
const handleKeyDown = (event: React.KeyboardEvent) => {
  if (event.key === 'Enter' && event.ctrlKey) {
    // Custom shortcut logic
    events.onEdit();
    event.preventDefault();
  }
};
```

### Widget State Management

Your renderer receives [`WidgetRenderState`](../types/widgets.ts:182):

```typescript
export const MyWidgetRenderer: React.FC<WidgetRendererProps<MyWidgetContent>> = ({
  widget,
  state,
  events,
}) => {
  // Use state to adapt rendering
  const className = [
    'widget',
    state.isSelected && 'widget-selected',
    state.isHovered && 'widget-hovered',
    state.isEditing && 'widget-editing',
    state.isLoading && 'widget-loading',
    state.hasError && 'widget-error',
  ].filter(Boolean).join(' ');

  const style = {
    transform: `translate(${state.transform.x}px, ${state.transform.y}px) scale(${state.transform.scale}) rotate(${state.transform.rotation}deg)`,
    opacity: state.isLoading ? 0.5 : 1,
  };

  return (
    <div className={className} style={style}>
      {state.hasError ? (
        <div className="error-message">{state.errorMessage}</div>
      ) : (
        // Normal widget content
      )}
    </div>
  );
};
```

## Plugin Registration

### Step 1: Add to Plugin Index

Register your plugin in [`src/plugins/index.ts`](index.ts:13):

```typescript
// Add your plugin import
import { myWidgetPlugin } from "./my-widget";

export const plugins = [
  calculatorPlugin,
  notePlugin,
  todoPlugin,
  imagePlugin,
  urlPlugin,
  documentPlugin,
  myWidgetPlugin, // Add your plugin here
];

// Export your plugin components
export {
  MyWidgetFactory,
  MyWidgetRenderer,
  myWidgetPlugin,
} from "./my-widget";
```

### Step 2: Update Widget Registry

The plugin will be automatically registered when [`registerAllPlugins()`](index.ts:26) is called during application startup.

## Advanced Features

### Custom Validation

Implement validation in your factory:

```typescript
validate(widget: HydratedWidget<MyWidgetContent>) {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate required fields
  if (!widget.content?.data?.title) {
    errors.push("Title is required");
  }

  // Validate data formats
  if (widget.content?.data?.url && !this.isValidUrl(widget.content.data.url)) {
    errors.push("Invalid URL format");
  }

  // Add warnings for deprecated features
  if (widget.content?.data?.legacyField) {
    warnings.push("legacyField is deprecated, use newField instead");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

private isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
```

### Serialization and Export

Implement custom serialization for complex widgets:

```typescript
async serialize(
  widget: HydratedWidget<MyWidgetContent>,
  options: SerializationOptions
): Promise<WidgetExportData> {
  const assets: any[] = [];
  
  // Handle embedded assets
  if (widget.content.data.fileUrl) {
    // Download and include the file
    const response = await fetch(widget.content.data.fileUrl);
    const blob = await response.blob();
    
    assets.push({
      id: 'main-file',
      type: 'file',
      data: await blob.arrayBuffer(),
      mimeType: blob.type,
    });
  }

  return {
    widget,
    assets,
    dependencies: ['pinata-service'], // External dependencies
  };
}
```

### Context Menu Integration

Add custom context menu items:

```typescript
// Optional: Custom context menu component
export const MyWidgetContextMenu: React.FC<WidgetContextMenuProps<MyWidgetContent>> = ({
  widget,
  position,
  onAction,
  onClose,
}) => {
  return (
    <div className="context-menu" style={{ left: position.x, top: position.y }}>
      <button onClick={() => onAction('custom-action')}>
        Custom Action
      </button>
      <button onClick={() => onAction('export')}>
        Export Data
      </button>
      <button onClick={onClose}>
        Close
      </button>
    </div>
  );
};

// Register in your plugin
renderers = [{
  type: "my-widget",
  component: MyWidgetRenderer,
  contextMenu: MyWidgetContextMenu,
}];
```

## Best Practices

### 1. Error Handling

Always handle errors gracefully:

```typescript
// In factory
async create(data: any, position: Position): Promise<CreateWidgetInput> {
  try {
    // Your creation logic
  } catch (error) {
    console.error(`Failed to create ${this.type} widget:`, error);
    
    // Return a fallback widget
    return {
      type: this.type,
      x: position.x,
      y: position.y,
      width: 200,
      height: 150,
      content: {
        title: "Error",
        data: { error: error.message },
      },
    };
  }
}

// In renderer
if (widget.contentError) {
  return (
    <div className="widget-error">
      <p>Failed to load widget content</p>
      <button onClick={() => events.onUpdate({})}>
        Retry
      </button>
    </div>
  );
}
```

### 2. Performance Optimization

- Use React.memo for expensive renders
- Implement lazy loading for large content
- Debounce frequent updates

```typescript
import React, { memo, useMemo, useCallback } from "react";
import { debounce } from "lodash-es";

export const MyWidgetRenderer = memo<WidgetRendererProps<MyWidgetContent>>(({
  widget,
  state,
  events,
}) => {
  // Memoize expensive calculations
  const processedData = useMemo(() => {
    return expensiveDataProcessing(widget.content.data);
  }, [widget.content.data]);

  // Debounce frequent updates
  const debouncedUpdate = useCallback(
    debounce((updates) => {
      events.onUpdate(updates);
    }, 300),
    [events.onUpdate]
  );

  // Rest of component
});
```

### 3. Accessibility

Make your widgets accessible:

```typescript
<div
  role="button"
  tabIndex={0}
  aria-label={`${widget.content.data.title} widget`}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      events.onSelect();
    }
  }}
>
  {/* Widget content */}
</div>
```

### 4. TypeScript Best Practices

- Define strict interfaces for your content types
- Use generics appropriately
- Export types for other plugins to use

```typescript
// Export your content type for other plugins
export interface MyWidgetContent {
  readonly title: string;
  readonly data: {
    readonly value: string;
    readonly timestamp: number;
  };
  settings?: Readonly<{
    color?: string;
    enabled?: boolean;
  }>;
}

// Use const assertions for immutable data
const DEFAULT_SETTINGS = {
  color: "#ffffff",
  enabled: true,
} as const;
```

## Troubleshooting

### Common Issues

1. **Plugin not registering**
   - Check that your plugin is added to [`src/plugins/index.ts`](index.ts)
   - Verify the plugin implements all required methods
   - Check browser console for registration errors

2. **Factory not handling data**
   - Ensure `canHandle()` method correctly identifies your data
   - Test with different data types and formats
   - Add debug logging to `canHandle()` method

3. **Renderer not updating**
   - Verify you're using the correct update methods from stores
   - Check that content IDs match between widget and content
   - Ensure React dependencies are properly declared

4. **File uploads failing**
   - Verify Pinata environment variables are set
   - Check network connectivity and CORS settings
   - Implement proper error handling for upload failures

### Debug Logging

Add comprehensive logging to your plugin:

```typescript
// Factory debug logging
canHandle(data: any): boolean {
  const canHandle = /* your logic */;
  console.debug(`[${this.type}] canHandle:`, { data, canHandle });
  return canHandle;
}

// Renderer debug logging
useEffect(() => {
  console.debug(`[${widget.type}] Widget rendered:`, {
    id: widget.id,
    isContentLoaded: widget.isContentLoaded,
    state,
  });
}, [widget, state]);
```

### Testing Your Plugin

Create unit tests for your factory:

```typescript
// __tests__/my-widget-factory.test.ts
import { MyWidgetFactory } from "../factory";

describe("MyWidgetFactory", () => {
  const factory = new MyWidgetFactory();

  test("should handle specific data patterns", () => {
    expect(factory.canHandle({ type: "my-widget" })).toBe(true);
    expect(factory.canHandle("random string")).toBe(false);
  });

  test("should create valid widget", async () => {
    const data = { title: "Test" };
    const position = { x: 100, y: 100 };
    
    const widget = await factory.create(data, position);
    
    expect(widget.type).toBe("my-widget");
    expect(widget.x).toBe(100);
    expect(widget.y).toBe(100);
  });
});
```

This guide covers the essential aspects of plugin development for the Pinboard application. For more specific examples, refer to the existing plugins in the current directory.