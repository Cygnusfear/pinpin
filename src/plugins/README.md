# Complete Plugin Development Guide for LLMs

This is the **definitive plugin development guide** for the Pinboard widget system. This guide is specifically designed for LLMs and provides step-by-step instructions, concrete examples, and comprehensive patterns.

## 🎯 Quick Start: What You Need to Know

**A Plugin = 4 Required Files + 1 Registration Step**

```
src/plugins/your-plugin-name/
├── index.ts          # Plugin definition (metadata + installation)
├── factory.ts        # Widget creation logic (handles data input)
├── renderer.tsx      # React component (displays the widget)
├── types.ts          # TypeScript interfaces (data structure)
└── README.md         # Optional documentation
```

**Then register in**: `src/plugins/index.ts`

## 📋 Plugin Categories and Examples

Before building, understand the **7 categories** and their purposes:

| Category | Purpose | Examples | Default Size |
|----------|---------|----------|--------------|
| `text` | Text editing/display | note, todo | 200x200 |
| `media` | Images, videos, audio | image, youtube | 300x200 |
| `document` | File handling | document, pdf | 300x200 |
| `web` | Web content | url, embed | 400x300 |
| `app` | Interactive tools | calculator, terminal | 300x400 |
| `layout` | Organization | group, container | 400x300 |
| `other` | Everything else | custom widgets | 250x250 |

## 🏗️ Complete Plugin Template

### Step 1: Create `types.ts` (Data Structure)

```typescript
/**
 * Define your widget's data structure
 * This is what gets saved and loaded
 */
export interface YourPluginContent {
  // Required fields
  title: string;
  description: string;
  
  // Optional fields with defaults
  color?: string;
  fontSize?: number;
  isEnabled?: boolean;
  
  // Complex data structures
  items?: Array<{
    id: string;
    name: string;
    value: number;
  }>;
  
  // File-related fields (if needed)
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
}
```

### Step 2: Create `index.ts` (Plugin Definition)

```typescript
import type { WidgetPlugin } from "../../types/widgets";
import { YourPluginFactory, yourPluginTypeDefinition } from "./factory";
import { YourPluginRenderer } from "./renderer";

// Plugin class implementation
export class YourPlugin implements WidgetPlugin {
  // Plugin metadata
  id = "your-plugin";                    // Must match type above
  name = "Your Plugin";                  // Must match name above  
  version = "1.0.0";                     // Semantic versioning
  description = "Detailed description";  // Can be longer than type definition
  author = "Your Name";                  // Credit

  // Plugin components - NOTE: Import type definition from factory to avoid circular dependency
  types = yourPluginTypeDefinition;
  factories = [new YourPluginFactory()];
  renderers = [{ type: "your-plugin", component: YourPluginRenderer }];

  // Installation (called when plugin loads)
  async install(registry: any): Promise<void> {
    this.types.forEach((type) => registry.registerType(type));
    this.factories.forEach((factory) => registry.registerFactory(factory));
    this.renderers.forEach((renderer) => registry.registerRenderer(renderer));
    console.log(`✅ Installed ${this.name} v${this.version}`);
  }

  // Cleanup (called when plugin unloads)
  async uninstall(registry: any): Promise<void> {
    this.renderers.forEach((renderer) => registry.unregisterRenderer(renderer.type));
    this.factories.forEach((factory) => registry.unregisterFactory(factory.type));
    this.types.forEach((type) => registry.unregisterType(type.type));
    console.log(`❌ Uninstalled ${this.name}`);
  }
}

// Export instances
export const yourPlugin = new YourPlugin();
export { YourPluginFactory, yourPluginTypeDefinition } from "./factory";
export { YourPluginRenderer } from "./renderer";
```

### Step 3: Create `factory.ts` (Widget Creation Logic)

```typescript
import type {
  CreateWidgetInput,
  HydratedWidget,
  Position,
  WidgetCapabilities,
  WidgetFactory,
  WidgetTypeDefinition,
} from "../../types/widgets";
import type { YourPluginContent } from "./types";

// Define widget metadata HERE to avoid circular dependency
export const yourPluginTypeDefinition: WidgetTypeDefinition[] = [
  {
    type: "your-plugin", // Must match factory.type and renderer type
    name: "Your Plugin", // Display name in UI
    description: "What your plugin does in one sentence",
    icon: "🎯", // Emoji or icon string
    category: "app", // Choose from: text, media, document, web, app, layout, other
    
    // Size constraints
    defaultSize: { width: 300, height: 200 },
    minSize: { width: 200, height: 150 },
    maxSize: { width: 600, height: 400 },
    
    // Capabilities
    aspectRatioLocked: false, // true = maintains aspect ratio when resizing
    resizable: true,          // Can user resize widget?
    rotatable: true,          // Can user rotate widget?
    configurable: true,       // Does widget have settings?
    autoCreateOnly: false,    // true = only created by other widgets/automation
  },
];

export class YourPluginFactory implements WidgetFactory<YourPluginContent> {
  type = "your-plugin"; // Must match index.ts type

  /**
   * CRITICAL: This determines when your plugin handles data
   * Return true if your plugin should create a widget from this data
   */
  canHandle(data: any): boolean {
    // Handle explicit requests
    if (data?.type === "your-plugin") {
      return true;
    }

    // Handle specific data patterns - BE SPECIFIC!
    if (typeof data === "string") {
      // Example: Handle URLs that match a pattern
      if (data.startsWith("https://example.com/")) {
        return true;
      }
      
      // Example: Handle file extensions
      if (data.match(/\.(xyz|abc)$/i)) {
        return true;
      }
    }

    // Handle File objects
    if (data instanceof File) {
      // Example: Handle specific file types
      if (data.type === "application/your-format") {
        return true;
      }
    }

    // Handle object data
    if (data && typeof data === "object") {
      // Check for specific properties
      if (data.yourSpecificProperty || data.yourIdentifier) {
        return true;
      }
    }

    return false; // Don't handle this data
  }

  /**
   * Default data for demo/testing purposes
   */
  getDemoDefaults(): any {
    return {
      type: "your-plugin",
      title: "Demo Widget",
      description: "This is a demo",
    };
  }

  /**
   * MAIN FUNCTION: Create widget from input data
   */
  async create(data: any, position: Position): Promise<CreateWidgetInput> {
    // Initialize with defaults
    let content: YourPluginContent = {
      title: "Untitled",
      description: "",
      color: "#ffffff",
      fontSize: 14,
      isEnabled: true,
      items: [],
    };

    // Parse different input types
    if (typeof data === "string") {
      // Handle string input
      content.title = this.extractTitleFromString(data);
      content.description = data;
    } else if (data instanceof File) {
      // Handle file input
      content.title = data.name;
      content.fileName = data.name;
      content.fileSize = data.size;
      
      // For text files, read content
      if (data.type.startsWith("text/")) {
        try {
          content.description = await data.text();
        } catch (error) {
          console.warn("Could not read file:", error);
        }
      }
    } else if (data && typeof data === "object") {
      // Handle object input - merge with defaults
      content = {
        ...content,
        ...data,
        title: data.title || data.name || content.title,
        description: data.description || data.content || content.description,
      };
    }

    // Return widget creation input
    return {
      type: this.type,
      x: position.x,
      y: position.y,
      width: yourPluginTypeDefinition[0].defaultSize.width,
      height: yourPluginTypeDefinition[0].defaultSize.height,
      content: content,
    };
  }

  /**
   * Helper method to extract title from string
   */
  private extractTitleFromString(str: string): string {
    // Take first line or first 50 characters
    const firstLine = str.split('\n')[0];
    return firstLine.length > 50 ? firstLine.substring(0, 47) + "..." : firstLine;
  }

  /**
   * Get default size for this widget type
   */
  getDefaultSize(): { width: number; height: number } {
    return yourPluginTypeDefinition[0].defaultSize;
  }

  /**
   * Define what users can do with this widget
   */
  getCapabilities(): WidgetCapabilities {
    return {
      canResize: true,       // Can be resized
      canRotate: true,       // Can be rotated
      canEdit: true,         // Has editable content
      canConfigure: true,    // Has settings/config panel
      canGroup: true,        // Can be grouped with other widgets
      canDuplicate: false,   // Can be duplicated (disabled)
      canExport: true,       // Can be exported
      hasContextMenu: true,  // Shows context menu on right-click
      hasToolbar: false,     // Shows toolbar when selected
      hasInspector: true,    // Shows in property inspector
    };
  }

  /**
   * Validate widget data (optional but recommended)
   */
  validate(widget: HydratedWidget<YourPluginContent>) {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!widget.content || !widget.content.data) {
      errors.push("Widget content is missing");
      return { isValid: false, errors, warnings };
    }

    const data = widget.content.data;

    // Check required fields
    if (!data.title || typeof data.title !== "string") {
      errors.push("Title is required and must be a string");
    }

    if (data.fontSize && (typeof data.fontSize !== "number" || data.fontSize < 8 || data.fontSize > 72)) {
      warnings.push("Font size should be between 8 and 72");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
```

### Step 4: Create `renderer.tsx` (React Component)

```typescript
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import {
  useWidgetActions,
  useWidgetContent,
} from "../../stores/selectiveHooks";
import type { WidgetRendererProps } from "../../types/widgets";
import type { YourPluginContent } from "./types";

export const YourPluginRenderer: React.FC<WidgetRendererProps> = ({ widgetId }) => {
  // Subscribe to content changes (selective subscriptions for performance)
  const title = useWidgetContent(widgetId, (content) => content.data.title);
  const description = useWidgetContent(widgetId, (content) => content.data.description);
  const color = useWidgetContent(widgetId, (content) => content.data.color);
  const fontSize = useWidgetContent(widgetId, (content) => content.data.fontSize);
  const isEnabled = useWidgetContent(widgetId, (content) => content.data.isEnabled);
  const items = useWidgetContent(widgetId, (content) => content.data.items);

  // Get update functions
  const { updateContent } = useWidgetActions(widgetId);

  // Local state for editing
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Handle edit mode
  const startEdit = useCallback(() => {
    setEditTitle(title || "");
    setEditDescription(description || "");
    setIsEditing(true);
  }, [title, description]);

  const saveEdit = useCallback(() => {
    updateContent({
      title: editTitle,
      description: editDescription,
    });
    setIsEditing(false);
  }, [editTitle, editDescription, updateContent]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditing) {
        if (e.key === "Enter" && e.ctrlKey) {
          e.preventDefault();
          saveEdit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancelEdit();
        }
      }
    };

    if (isEditing) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isEditing, saveEdit, cancelEdit]);

  // Handle item actions
  const addItem = useCallback(() => {
    const newItem = {
      id: Date.now().toString(),
      name: "New Item",
      value: 0,
    };
    updateContent({
      items: [...(items || []), newItem],
    });
  }, [items, updateContent]);

  const removeItem = useCallback((itemId: string) => {
    updateContent({
      items: (items || []).filter(item => item.id !== itemId),
    });
  }, [items, updateContent]);

  const updateItem = useCallback((itemId: string, updates: Partial<typeof items[0]>) => {
    updateContent({
      items: (items || []).map(item => 
        item.id === itemId ? { ...item, ...updates } : item
      ),
    });
  }, [items, updateContent]);

  // Render loading state
  if (title === undefined) {
    return (
      <div style={{ 
        width: "100%", 
        height: "100%", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        opacity: 0.5
      }}>
        Loading...
      </div>
    );
  }

  // Render edit mode
  if (isEditing) {
    return (
      <div style={{ 
        width: "100%", 
        height: "100%", 
        padding: "8px",
        backgroundColor: color,
        display: "flex",
        flexDirection: "column",
        gap: "8px"
      }}>
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          placeholder="Title"
          style={{
            border: "1px solid #ccc",
            borderRadius: "4px",
            padding: "4px 8px",
            fontSize: fontSize || 14,
            fontWeight: "bold",
          }}
          autoFocus
        />
        <textarea
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          placeholder="Description"
          style={{
            border: "1px solid #ccc",
            borderRadius: "4px",
            padding: "4px 8px",
            fontSize: (fontSize || 14) - 2,
            flex: 1,
            resize: "none",
          }}
        />
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            onClick={saveEdit}
            style={{
              padding: "4px 12px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Save (Ctrl+Enter)
          </button>
          <button
            onClick={cancelEdit}
            style={{
              padding: "4px 12px",
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Cancel (Esc)
          </button>
        </div>
      </div>
    );
  }

  // Render normal view
  return (
    <div 
      style={{ 
        width: "100%", 
        height: "100%", 
        padding: "8px",
        backgroundColor: color,
        opacity: isEnabled ? 1 : 0.5,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
      onClick={startEdit}
      onDoubleClick={startEdit}
    >
      {/* Header */}
      <div style={{
        fontSize: fontSize || 14,
        fontWeight: "bold",
        color: "#333",
        wordWrap: "break-word",
      }}>
        {title || "Untitled"}
      </div>

      {/* Description */}
      {description && (
        <div style={{
          fontSize: (fontSize || 14) - 2,
          color: "#666",
          wordWrap: "break-word",
          flex: 1,
        }}>
          {description}
        </div>
      )}

      {/* Items list */}
      {items && items.length > 0 && (
        <div style={{ marginTop: "8px" }}>
          <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>
            Items ({items.length})
          </div>
          {items.slice(0, 3).map((item) => ( // Show max 3 items
            <div 
              key={item.id} 
              style={{ 
                fontSize: "11px", 
                color: "#555",
                padding: "2px 0",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>{item.name}</span>
              <span>{item.value}</span>
            </div>
          ))}
          {items.length > 3 && (
            <div style={{ fontSize: "10px", color: "#999", fontStyle: "italic" }}>
              +{items.length - 3} more...
            </div>
          )}
        </div>
      )}

      {/* Click hint */}
      <div style={{
        position: "absolute",
        bottom: "4px",
        right: "4px",
        fontSize: "10px",
        color: "#999",
        opacity: 0.7,
      }}>
        Click to edit
      </div>
    </div>
  );
};
```

### Step 5: Add Plugin to `server/plugins.json`

⚠️ **IMPORTANT**: After creating your plugin files, add it to the plugin configuration.

```json
{
  "plugins": [
    {
      "name": "your-plugin",
      "path": "./your-plugin",
      "enabled": true
    }
  ]
}
```

**That's it!** The plugin will load automatically without page reloads.

## 🚨 CRITICAL: Avoid Circular Dependencies

**MANDATORY RULE**: Never import from `index.ts` in `factory.ts` or any other plugin files. This creates circular dependencies that cause runtime errors.

**✅ CORRECT Structure**:
```typescript
// factory.ts - Define type definitions HERE
export const yourPluginTypeDefinition: WidgetTypeDefinition[] = [/* ... */];

// index.ts - Import from factory
import { YourPluginFactory, yourPluginTypeDefinition } from "./factory";
```

**❌ INCORRECT Structure**:
```typescript
// index.ts - DON'T define types here if factory needs them
export const yourPluginTypeDefinition: WidgetTypeDefinition[] = [/* ... */];

// factory.ts - DON'T import from index.ts
import { yourPluginTypeDefinition } from "./index"; // CIRCULAR DEPENDENCY!
```

**The Rule**: Type definitions should live in `factory.ts` if the factory needs them. The `index.ts` file should import from `factory.ts`, never the other way around.

**Plugin Export Requirements**:
- Your plugin must be exported as `yourPluginNamePlugin` (camelCase)
- For multi-word names, use camelCase: `myAwesomePlugin`
- Special case: YouTube uses `youTubePlugin` (capital T)

**Example Plugin Exports**:
```typescript
// ✅ CORRECT - Standard naming
export const calculatorPlugin = new CalculatorPlugin();
export const notePlugin = new NotePlugin();

// ✅ CORRECT - Multi-word naming  
export const awesomeToolPlugin = new AwesomeToolPlugin();

// ✅ CORRECT - Special case (YouTube)
export const youTubePlugin = new YouTubePlugin();

// ❌ INCORRECT - Wrong naming
export const calculator = new CalculatorPlugin();        // Missing "Plugin"
export const Calculator = new CalculatorPlugin();        // Wrong case
export const calculator_plugin = new CalculatorPlugin(); // Underscore
```

## 🛡️ Plugin Error Handling & Recovery

The plugin system includes **automatic error recovery** to ensure broken plugins don't crash the entire application.

### Error Boundaries & Safe Loading

**What Happens When a Plugin Fails**:
1. 🔄 Plugin loading fails gracefully 
2. ⚠️ Error is logged to console with details
3. 🔄 Application continues with other plugins
4. 🎨 Broken widgets show fallback UI with retry options

**Error Recovery Features**:
- **Individual isolation**: One broken plugin won't affect others
- **Fallback UI**: Broken widgets show helpful error messages  
- **Retry mechanisms**: Users can attempt to reload failed plugins
- **Debug information**: Detailed error reporting for developers
- **HMR support**: Hot module replacement works without page reloads

### Plugin Loading Status

Check plugin loading in browser console:
```
🔌 Loading plugin: calculator
✅ Successfully loaded plugin: calculator
❌ Failed to load plugin youtube: Plugin export "youtubePlugin" not found
📊 Plugin loading completed: 8/9 successful
⚠️ 1 plugins failed to load, but application will continue
```

### Debugging Failed Plugins

**Common Plugin Errors**:

1. **Export Name Mismatch**:
   ```
   ❌ Plugin export "myPlugin" not found. Available exports: MyPlugin, MyPluginFactory
   ```
   **Fix**: Ensure your export matches the expected pattern (`myPlugin`)

2. **Missing Install Method**:
   ```
   ❌ Plugin "calculator" missing install method
   ```
   **Fix**: Implement the `install` method in your plugin class

3. **Import Errors**:
   ```
   ❌ Failed to load plugin: Cannot resolve module './missing-dependency'
   ```
   **Fix**: Check your imports and dependencies

### Widget Error Recovery

**Broken Widget UI**: When a widget fails to render, users see:
- 🔧 Error icon and description
- 🔄 "Reload Plugin" button (attempts recovery without page reload)
- 📋 "Debug" button (copies error info to clipboard)
- Widget ID for debugging

**Error Boundary Features**:
- Catches React rendering errors
- Prevents widget crashes from affecting other widgets
- Provides user-friendly recovery options
- Maintains application stability

## 🔧 Advanced Patterns and Features

### File Upload Handling

For plugins that handle files:

```typescript
// In factory.ts canHandle method
canHandle(data: any): boolean {
  if (data instanceof File) {
    // Check file type
    if (data.type.startsWith("image/")) {
      return false; // Let image plugin handle this
    }
    
    // Check file extension
    const validExtensions = [".xyz", ".abc", ".custom"];
    return validExtensions.some(ext => data.name.toLowerCase().endsWith(ext));
  }
  return false;
}

// In factory.ts create method
async create(data: any, position: Position): Promise<CreateWidgetInput> {
  if (data instanceof File) {
    const content: YourPluginContent = {
      title: data.name,
      fileName: data.name,
      fileSize: data.size,
      fileType: data.type,
    };

    // For text files, read content
    if (data.type.startsWith("text/")) {
      try {
        content.fileContent = await data.text();
      } catch (error) {
        console.warn("Could not read file:", error);
      }
    }

    // For binary files, create object URL
    if (data.type.startsWith("application/")) {
      content.fileUrl = URL.createObjectURL(data);
    }

    return {
      type: this.type,
      x: position.x,
      y: position.y,
      width: 300,
      height: 200,
      content,
    };
  }
}
```

### Configuration Panel

Add settings to your widget:

```typescript
// In types.ts
export interface YourPluginContent {
  // ... other fields
  settings?: {
    theme: "light" | "dark";
    autoRefresh: boolean;
    refreshInterval: number;
  };
}

// In renderer.tsx - add configuration UI
const [showSettings, setShowSettings] = useState(false);

// Configuration panel component
const ConfigPanel = () => (
  <div style={{ 
    position: "absolute", 
    top: 0, 
    right: 0, 
    background: "white", 
    border: "1px solid #ccc",
    borderRadius: "4px",
    padding: "8px",
    zIndex: 1000,
  }}>
    <h4>Settings</h4>
    <label>
      <input 
        type="checkbox" 
        checked={settings?.autoRefresh || false}
        onChange={(e) => updateContent({
          settings: { ...settings, autoRefresh: e.target.checked }
        })}
      />
      Auto Refresh
    </label>
    {/* More settings... */}
  </div>
);
```

### State Management and Performance

```typescript
// Use selective subscriptions for performance
const title = useWidgetContent(widgetId, (content) => content.data.title);
const items = useWidgetContent(widgetId, (content) => content.data.items);

// Don't subscribe to entire content unless necessary
// BAD: const content = useWidgetContent(widgetId);
// GOOD: const specificField = useWidgetContent(widgetId, (c) => c.data.specificField);

// Use callbacks to prevent re-renders
const handleClick = useCallback(() => {
  // Handle click
}, [dependencies]);

// Use useMemo for expensive calculations
const processedData = useMemo(() => {
  return items?.map(item => ({
    ...item,
    processed: expensiveCalculation(item)
  }));
}, [items]);
```

### Error Handling

```typescript
// In factory.ts validate method
validate(widget: HydratedWidget<YourPluginContent>) {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    if (!widget.content?.data) {
      errors.push("Content is missing");
      return { isValid: false, errors, warnings };
    }

    const data = widget.content.data;

    // Validate required fields
    if (!data.title?.trim()) {
      errors.push("Title is required");
    }

    // Validate data types
    if (data.fontSize && typeof data.fontSize !== "number") {
      errors.push("Font size must be a number");
    }

    // Validate ranges
    if (data.fontSize && (data.fontSize < 8 || data.fontSize > 72)) {
      warnings.push("Font size should be between 8 and 72");
    }

    // Validate arrays
    if (data.items && !Array.isArray(data.items)) {
      errors.push("Items must be an array");
    }

  } catch (error) {
    errors.push(`Validation error: ${error.message}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// In renderer.tsx - handle errors gracefully
if (error) {
  return (
    <div style={{ 
      width: "100%", 
      height: "100%", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      color: "red",
      padding: "8px",
      textAlign: "center",
    }}>
      <div>
        <div>⚠️ Error</div>
        <div style={{ fontSize: "12px", marginTop: "4px" }}>
          {error.message}
        </div>
      </div>
    </div>
  );
}
```

## 🎨 Plugin Categories Deep Dive

### Text Plugins (`category: "text"`)
- **Purpose**: Text editing, formatting, note-taking
- **Examples**: note, todo, rich-text-editor
- **Common patterns**: Inline editing, text formatting, keyboard shortcuts
- **Default size**: 200x200 (square for sticky notes)

### Media Plugins (`category: "media"`)
- **Purpose**: Images, videos, audio, visual content
- **Examples**: image, youtube, audio-player
- **Common patterns**: File upload, media controls, thumbnails
- **Default size**: 300x200 (landscape for media)

### Document Plugins (`category: "document"`)
- **Purpose**: File handling, document viewing
- **Examples**: document, pdf-viewer, spreadsheet
- **Common patterns**: File upload, preview generation, download links
- **Default size**: 300x200 (document aspect ratio)

### Web Plugins (`category: "web"`)
- **Purpose**: Web content, embeds, external services
- **Examples**: url, iframe-embed, api-display
- **Common patterns**: URL validation, metadata fetching, CORS handling
- **Default size**: 400x300 (web content ratio)

### App Plugins (`category: "app"`)
- **Purpose**: Interactive tools and utilities
- **Examples**: calculator, terminal, timer
- **Common patterns**: User input, state management, real-time updates
- **Default size**: 300x400 (portrait for tools)

### Layout Plugins (`category: "layout"`)
- **Purpose**: Organization and grouping
- **Examples**: container, grid, separator
- **Common patterns**: Child widget management, layout algorithms
- **Default size**: 400x300 (container size)

## 🐛 Common Issues and Solutions

### Issue: Plugin Not Detecting Data

**Problem**: Your `canHandle()` method isn't working

**Solution**: Check the order in `src/plugins/index.ts`. Plugins are checked in order, so if another plugin claims your data first, yours won't get it.

```typescript
// BAD: Too generic
canHandle(data: any): boolean {
  return typeof data === "string"; // This will catch everything!
}

// GOOD: Specific patterns
canHandle(data: any): boolean {
  if (typeof data === "string") {
    return data.startsWith("myprotocol://") || data.endsWith(".myext");
  }
  return false;
}
```

### Issue: Widget Not Updating

**Problem**: Changes don't show in UI

**Solution**: Use selective subscriptions and proper update methods

```typescript
// BAD: Not subscribed to changes
const content = widget.content.data;

// GOOD: Subscribed to specific field
const title = useWidgetContent(widgetId, (content) => content.data.title);

// BAD: Direct mutation
content.title = "New Title";

// GOOD: Use update method
const { updateContent } = useWidgetActions(widgetId);
updateContent({ title: "New Title" });
```

### Issue: Performance Problems

**Problem**: Widget causes lag or freezing

**Solution**: Optimize subscriptions and use React patterns

```typescript
// BAD: Subscribe to everything
const content = useWidgetContent(widgetId);

// GOOD: Subscribe to specific fields
const title = useWidgetContent(widgetId, (c) => c.data.title);
const count = useWidgetContent(widgetId, (c) => c.data.items?.length);

// Use callbacks and memoization
const handleClick = useCallback(() => {
  // Handle click
}, [dependency1, dependency2]);

const expensiveValue = useMemo(() => {
  return heavyCalculation(data);
}, [data]);
```

### Issue: Type Errors

**Problem**: TypeScript errors in plugin

**Solution**: Ensure proper type imports and definitions

```typescript
// Make sure you import all needed types
import type {
  CreateWidgetInput,
  HydratedWidget,
  Position,
  WidgetCapabilities,
  WidgetFactory,
  WidgetRendererProps,
} from "../../types/widgets";

// Ensure your content interface is properly defined
export interface YourPluginContent {
  // All fields should have explicit types
  title: string;              // Required string
  count?: number;             // Optional number
  items: Array<{              // Required array with typed objects
    id: string;
    name: string;
  }>;
}
```

## ✅ Testing Your Plugin

### Development Workflow

**Development Tips**:
1. **Add new plugins**: Edit `server/plugins.json` 
2. **Disable for testing**: Set `"enabled": false` in `server/plugins.json`
3. **Monitor loading**: Check browser console for plugin status
4. **Test exports**: Look for "Successfully loaded plugin: your-plugin" message

**Adding a New Plugin**:
```json
{
  "name": "new-plugin",
  "path": "./new-plugin", 
  "enabled": true
}
```

### Manual Testing Checklist

1. **Creation**: Can your plugin be created from appropriate data?
2. **Display**: Does it render correctly in different sizes?
3. **Interaction**: Do clicks, edits, and interactions work?
4. **Persistence**: Does data save and load correctly?
5. **Performance**: No lag when typing or interacting?
6. **Edge Cases**: Empty data, very long text, special characters?
7. **Error Recovery**: Does plugin handle errors gracefully?
8. **HMR**: Do changes reload without page refresh?

### Test Data Examples

```typescript
// Test your canHandle method with these inputs
const testCases = [
  "plain text",
  "https://example.com/file.xyz",
  new File(["content"], "test.xyz", { type: "text/plain" }),
  { type: "your-plugin", title: "Test" },
  null,
  undefined,
  "",
  123,
  [],
  {},
];

testCases.forEach(testCase => {
  console.log(`${JSON.stringify(testCase)}: ${factory.canHandle(testCase)}`);
});
```

## 🚀 Deployment Checklist

Before considering your plugin complete:

### Core Requirements
- [ ] All 4 required files created (`index.ts`, `factory.ts`, `renderer.tsx`, `types.ts`)
- [ ] Plugin added to `server/plugins.json`
- [ ] Plugin export uses correct naming convention (`yourPluginNamePlugin`)
- [ ] `canHandle()` method is specific and doesn't conflict with other plugins
- [ ] Widget renders correctly at different sizes
- [ ] Content updates work properly

### Error Handling & Recovery
- [ ] Plugin loads without errors (check console for "✅ Successfully loaded plugin")
- [ ] Error boundary shows proper fallback UI when plugin crashes
- [ ] Plugin recovery works (test by breaking renderer temporarily)
- [ ] All edge cases handled gracefully (null data, empty objects, etc.)
- [ ] Validation method implemented and working

### Development & Performance  
- [ ] No TypeScript errors or warnings
- [ ] No console errors during normal operation
- [ ] HMR works without page reloads
- [ ] Performance is acceptable (no lag during interactions)
- [ ] Plugin follows category conventions
- [ ] Selective subscriptions used for performance

## 📚 Reference: Existing Plugin Examples

Study these plugins for patterns:

| Plugin | Complexity | Key Features | Learn From |
|--------|------------|--------------|------------|
| `note` | Simple | Basic text editing | Inline editing, selective subscriptions |
| `calculator` | Medium | Interactive app | State management, keyboard handling |
| `document` | Complex | File handling | File upload, MIME types, validation |
| `image` | Complex | Media display | File handling, aspect ratios, thumbnails |
| `todo` | Medium | List management | Array operations, item management |
| `url` | Medium | Web integration | URL validation, metadata fetching |

## 💡 Pro Tips for LLMs

1. **Start Simple**: Build the basic structure first, then add features
2. **Copy and Modify**: Use existing plugins as templates
3. **Test Frequently**: Check your plugin after each major change
4. **Be Specific**: Make `canHandle()` as specific as possible
5. **Handle Errors**: Always include error handling and validation
6. **Performance First**: Use selective subscriptions from the start
7. **Follow Patterns**: Stick to established patterns from existing plugins

Remember: A working simple plugin is better than a broken complex one!