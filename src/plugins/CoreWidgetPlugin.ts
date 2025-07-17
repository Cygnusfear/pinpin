import { 
  WidgetPlugin, 
  WidgetTypeDefinition,
  WidgetRegistry
} from '../types/widgets';
import { ImageWidgetFactory } from '../factories/ImageWidgetFactory';
import { UrlWidgetFactory } from '../factories/UrlWidgetFactory';
import { NoteWidgetFactory } from '../factories/NoteWidgetFactory';
import { DocumentWidgetFactory } from '../factories/DocumentWidgetFactory';

export class CoreWidgetPlugin implements WidgetPlugin {
  id = 'core-widgets';
  name = 'Core Widget Types';
  version = '1.0.0';
  description = 'Basic widget types for images, URLs, and notes';
  author = 'Pinboard Team';

  types: WidgetTypeDefinition[] = [
    {
      type: 'image',
      name: 'Image',
      description: 'Display images from files or URLs',
      icon: '🖼️',
      category: 'media',
      defaultSize: { width: 200, height: 150 },
      minSize: { width: 50, height: 50 },
      maxSize: { width: 1000, height: 1000 },
      aspectRatioLocked: false,
      resizable: true,
      rotatable: true,
      configurable: true,
      supportedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        'image/bmp',
      ],
      supportedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'],
    },
    {
      type: 'url',
      name: 'Web Link',
      description: 'Display web links with previews',
      icon: '🔗',
      category: 'web',
      defaultSize: { width: 300, height: 200 },
      minSize: { width: 200, height: 100 },
      maxSize: { width: 600, height: 400 },
      aspectRatioLocked: false,
      resizable: true,
      rotatable: false,
      configurable: true,
    },
    {
      type: 'note',
      name: 'Sticky Note',
      description: 'Create text notes with customizable colors',
      icon: '📝',
      category: 'text',
      defaultSize: { width: 200, height: 150 },
      minSize: { width: 100, height: 80 },
      maxSize: { width: 500, height: 400 },
      aspectRatioLocked: false,
      resizable: true,
      rotatable: true,
      configurable: true,
    },
    {
      type: 'document',
      name: 'Document',
      description: 'Display documents, files, and other content',
      icon: '📄',
      category: 'document',
      defaultSize: { width: 200, height: 250 },
      minSize: { width: 150, height: 200 },
      maxSize: { width: 400, height: 500 },
      aspectRatioLocked: false,
      resizable: true,
      rotatable: true,
      configurable: true,
      supportedMimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv',
        'application/json',
        'application/xml',
        'text/xml',
        'text/html',
        'text/css',
        'text/javascript',
        'application/javascript',
        'application/zip',
        'audio/mpeg',
        'audio/wav',
        'video/mp4',
        'video/webm',
        'application/octet-stream',
      ],
      supportedExtensions: [
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.txt', '.csv', '.json', '.xml', '.html', '.css', '.js', '.ts',
        '.zip', '.rar', '.7z', '.mp3', '.wav', '.mp4', '.webm', '.avi'
      ],
    },
  ];

  factories = [
    new ImageWidgetFactory(),
    new UrlWidgetFactory(),
    new NoteWidgetFactory(),
    new DocumentWidgetFactory(),
  ];

  renderers = [
    // Renderers will be handled by the GenericWidgetRenderer for now
    // Custom renderers can be added here later
  ];

  async install(registry: WidgetRegistry): Promise<void> {
    console.log(`Installing ${this.name} v${this.version}...`);
    
    // Types and factories are automatically registered by the registry
    // Any additional setup can be done here
    
    console.log(`✅ ${this.name} installed successfully`);
  }

  async uninstall(registry: WidgetRegistry): Promise<void> {
    console.log(`Uninstalling ${this.name}...`);
    
    // Any cleanup can be done here
    
    console.log(`✅ ${this.name} uninstalled successfully`);
  }
}

// Export a singleton instance
export const coreWidgetPlugin = new CoreWidgetPlugin();