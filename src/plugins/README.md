# Plugin Development Documentation

This directory contains the complete plugin system for Pinboard, including all existing plugins and comprehensive development documentation.

## Quick Start

New to plugin development? Start here:

1. **[Plugin Development Guide](PLUGIN_DEVELOPMENT_GUIDE.md)** - Complete step-by-step guide to building plugins
2. **[Pinata File Storage](PINATA_FILE_STORAGE.md)** - How to use IPFS storage for files
3. **[Interaction Handling](INTERACTION_HANDLING.md)** - Managing user interactions and events
4. **[Plugin Development Overview](PLUGIN_DEVELOPMENT_OVERVIEW.md)** - High-level architecture and patterns

## Existing Plugins

### Core Plugins

- **[`calculator/`](calculator/)** - Interactive calculator widget with math expression support
- **[`document/`](document/)** - File document widgets with Pinata storage integration
- **[`image/`](image/)** - Image widgets with IPFS upload and display
- **[`note/`](note/)** - Text note widgets with inline editing
- **[`todo/`](todo/)** - Todo list widgets with checkbox interactions
- **[`url/`](url/)** - Web link widgets with metadata fetching

### Plugin Structure

Each plugin follows this consistent structure:

```
plugin-name/
├── index.ts          # Plugin definition and exports
├── factory.ts        # Widget creation logic
├── renderer.tsx      # React component for rendering
└── README.md         # Plugin-specific documentation
```

## Architecture

The plugin system is built around these core components:

- **Plugin Definition** - Metadata and installation logic
- **Widget Factory** - Creates widgets from various data sources
- **Widget Renderer** - React component for display and interaction
- **Widget Registry** - Central registry managing all widget types
- **Interaction Controller** - Handles user interactions and events
- **Pinata Service** - IPFS file storage for media and documents

## Development Workflow

1. **Plan Your Plugin** - Define purpose, data sources, and interactions
2. **Create Plugin Structure** - Set up files following the standard pattern
3. **Implement Factory** - Handle data detection and widget creation
4. **Build Renderer** - Create React component with proper interactions
5. **Add File Storage** - Integrate Pinata for file uploads if needed
6. **Register Plugin** - Add to the main plugin registry
7. **Test Integration** - Verify all functionality works correctly

## Key Features

### File Storage with Pinata
- IPFS-based decentralized storage
- Automatic upload handling
- Progress tracking and error recovery
- Content deduplication via content addressing

### Interaction Management
- State machine-based interaction handling
- Event propagation and coordinate translation
- Custom interaction modes and accessibility
- Multi-touch and keyboard support

### Type Safety
- Full TypeScript integration
- Strongly typed content interfaces
- Runtime validation and error handling
- IntelliSense support for development

## Best Practices

1. **Start Simple** - Build basic functionality first, then add features
2. **Error Handling** - Always provide fallbacks and graceful degradation
3. **Performance** - Use React optimization patterns and debouncing
4. **Accessibility** - Make widgets keyboard accessible
5. **Testing** - Write comprehensive tests for edge cases

## Getting Help

- Review existing plugin implementations for patterns
- Check the comprehensive guides in this directory
- Use TypeScript interfaces for type safety
- Test with various data sources and interaction modes

For detailed implementation guidance, see the [Plugin Development Guide](PLUGIN_DEVELOPMENT_GUIDE.md).