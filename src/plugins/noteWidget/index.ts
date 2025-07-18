import { WidgetPlugin, WidgetTypeDefinition } from '../../types/widgets';
import { NoteWidgetFactory } from './factory';
import { NoteWidgetRenderer } from './renderer';

export class NoteWidgetPlugin implements WidgetPlugin {
  id = 'note-widget';
  name = 'Note Widget';
  version = '1.0.0';
  description = 'Create text notes with customizable colors';
  author = 'Pinboard Team';

  types: WidgetTypeDefinition[] = [
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
  ];

  factories = [new NoteWidgetFactory()];

  renderers = [
    {
      type: 'note',
      component: NoteWidgetRenderer,
    },
  ];

  async install(): Promise<void> {
    console.log(`Installing ${this.name} v${this.version}...`);
  }

  async uninstall(): Promise<void> {
    console.log(`Uninstalling ${this.name}...`);
  }
}

// Export plugin instance and components
export const noteWidgetPlugin = new NoteWidgetPlugin();
export type { NoteWidget, NoteWidgetCreateData } from './types';
export { NoteWidgetFactory } from './factory';
export { NoteWidgetRenderer } from './renderer';