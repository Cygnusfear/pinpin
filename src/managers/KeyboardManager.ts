import { KeyModifiers } from '../types/canvas';

export type KeyboardCommand = 
  // Selection
  | 'selectAll'
  | 'duplicate'
  | 'group'
  | 'ungroup'
  
  // Navigation
  | 'handTool'
  | 'zoomToFit'
  | 'zoomToSelection'
  | 'zoomToActualSize'
  | 'zoomIn'
  | 'zoomOut'
  
  // Tools
  | 'selectTool'
  | 'textTool'
  | 'rectangleTool'
  | 'ellipseTool'
  | 'lineTool'
  | 'penTool'
  
  // Editing
  | 'undo'
  | 'redo'
  | 'copy'
  | 'paste'
  | 'cut'
  | 'delete'
  
  // Alignment
  | 'alignLeft'
  | 'alignRight'
  | 'alignTop'
  | 'alignBottom'
  | 'alignCenterHorizontal'
  | 'alignCenterVertical'
  
  // Layers
  | 'bringForward'
  | 'sendBackward'
  | 'bringToFront'
  | 'sendToBack';

interface KeyboardShortcut {
  key: string;
  modifiers: Partial<KeyModifiers>;
  command: KeyboardCommand;
  description: string;
}

export class KeyboardManager {
  private shortcuts: KeyboardShortcut[] = [
    // Selection
    { key: 'a', modifiers: { meta: true }, command: 'selectAll', description: 'Select All' },
    { key: 'd', modifiers: { meta: true }, command: 'duplicate', description: 'Duplicate' },
    { key: 'g', modifiers: { meta: true }, command: 'group', description: 'Group' },
    { key: 'g', modifiers: { meta: true, shift: true }, command: 'ungroup', description: 'Ungroup' },
    
    // Navigation
    { key: ' ', modifiers: {}, command: 'handTool', description: 'Hand Tool' },
    { key: '1', modifiers: {}, command: 'zoomToFit', description: 'Zoom to Fit' },
    { key: '2', modifiers: {}, command: 'zoomToSelection', description: 'Zoom to Selection' },
    { key: '0', modifiers: {}, command: 'zoomToActualSize', description: 'Zoom to 100%' },
    { key: '=', modifiers: {}, command: 'zoomIn', description: 'Zoom In' },
    { key: '+', modifiers: {}, command: 'zoomIn', description: 'Zoom In' },
    { key: '-', modifiers: {}, command: 'zoomOut', description: 'Zoom Out' },
    
    // Tools
    { key: 'v', modifiers: {}, command: 'selectTool', description: 'Select Tool' },
    { key: 'h', modifiers: {}, command: 'handTool', description: 'Hand Tool' },
    { key: 't', modifiers: {}, command: 'textTool', description: 'Text Tool' },
    { key: 'r', modifiers: {}, command: 'rectangleTool', description: 'Rectangle Tool' },
    { key: 'o', modifiers: {}, command: 'ellipseTool', description: 'Ellipse Tool' },
    { key: 'l', modifiers: {}, command: 'lineTool', description: 'Line Tool' },
    { key: 'p', modifiers: {}, command: 'penTool', description: 'Pen Tool' },
    
    // Editing
    { key: 'z', modifiers: { meta: true }, command: 'undo', description: 'Undo' },
    { key: 'z', modifiers: { meta: true, shift: true }, command: 'redo', description: 'Redo' },
    { key: 'c', modifiers: { meta: true }, command: 'copy', description: 'Copy' },
    { key: 'v', modifiers: { meta: true }, command: 'paste', description: 'Paste' },
    { key: 'x', modifiers: { meta: true }, command: 'cut', description: 'Cut' },
    { key: 'Delete', modifiers: {}, command: 'delete', description: 'Delete' },
    { key: 'Backspace', modifiers: {}, command: 'delete', description: 'Delete' },
    
    // Alignment
    { key: 'ArrowLeft', modifiers: { meta: true, shift: true }, command: 'alignLeft', description: 'Align Left' },
    { key: 'ArrowRight', modifiers: { meta: true, shift: true }, command: 'alignRight', description: 'Align Right' },
    { key: 'ArrowUp', modifiers: { meta: true, shift: true }, command: 'alignTop', description: 'Align Top' },
    { key: 'ArrowDown', modifiers: { meta: true, shift: true }, command: 'alignBottom', description: 'Align Bottom' },
    { key: 'h', modifiers: { meta: true, shift: true }, command: 'alignCenterHorizontal', description: 'Align Center Horizontal' },
    { key: 'v', modifiers: { meta: true, shift: true }, command: 'alignCenterVertical', description: 'Align Center Vertical' },
    
    // Layers
    { key: ']', modifiers: { meta: true }, command: 'bringForward', description: 'Bring Forward' },
    { key: '[', modifiers: { meta: true }, command: 'sendBackward', description: 'Send Backward' },
    { key: ']', modifiers: { meta: true, shift: true }, command: 'bringToFront', description: 'Bring to Front' },
    { key: '[', modifiers: { meta: true, shift: true }, command: 'sendToBack', description: 'Send to Back' },
  ];

  private pressedKeys = new Set<string>();
  private commandHandlers = new Map<KeyboardCommand, () => void>();
  private isEnabled = true;

  constructor() {
    this.bindEvents();
  }

  // Register command handlers
  registerCommand(command: KeyboardCommand, handler: () => void): void {
    this.commandHandlers.set(command, handler);
  }

  unregisterCommand(command: KeyboardCommand): void {
    this.commandHandlers.delete(command);
  }

  // Enable/disable keyboard handling
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  // Get current modifiers state
  getCurrentModifiers(): KeyModifiers {
    return {
      shift: this.pressedKeys.has('Shift'),
      ctrl: this.pressedKeys.has('Control'),
      alt: this.pressedKeys.has('Alt'),
      meta: this.pressedKeys.has('Meta') || this.pressedKeys.has('Cmd')
    };
  }

  // Check if a specific key is pressed
  isKeyPressed(key: string): boolean {
    return this.pressedKeys.has(key);
  }

  // Get all shortcuts for display
  getShortcuts(): KeyboardShortcut[] {
    return [...this.shortcuts];
  }

  // Get shortcut for a specific command
  getShortcutForCommand(command: KeyboardCommand): KeyboardShortcut | undefined {
    return this.shortcuts.find(s => s.command === command);
  }

  // Format shortcut for display
  formatShortcut(shortcut: KeyboardShortcut): string {
    const parts: string[] = [];
    
    if (shortcut.modifiers.meta) parts.push('⌘');
    if (shortcut.modifiers.ctrl) parts.push('Ctrl');
    if (shortcut.modifiers.alt) parts.push('⌥');
    if (shortcut.modifiers.shift) parts.push('⇧');
    
    // Format special keys
    let key = shortcut.key;
    switch (key) {
      case ' ':
        key = 'Space';
        break;
      case 'ArrowLeft':
        key = '←';
        break;
      case 'ArrowRight':
        key = '→';
        break;
      case 'ArrowUp':
        key = '↑';
        break;
      case 'ArrowDown':
        key = '↓';
        break;
    }
    
    parts.push(key.toUpperCase());
    
    return parts.join('+');
  }

  private bindEvents(): void {
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));
    
    // Handle window focus/blur to reset key state
    window.addEventListener('blur', this.handleWindowBlur.bind(this));
    window.addEventListener('focus', this.handleWindowFocus.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.isEnabled) return;

    // Don't handle shortcuts when typing in inputs
    if (this.isTypingInInput(event.target)) return;

    this.pressedKeys.add(event.key);

    const shortcut = this.findMatchingShortcut(event);
    if (shortcut) {
      event.preventDefault();
      event.stopPropagation();
      
      const handler = this.commandHandlers.get(shortcut.command);
      if (handler) {
        handler();
      }
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    this.pressedKeys.delete(event.key);
  }

  private handleWindowBlur(): void {
    // Clear all pressed keys when window loses focus
    this.pressedKeys.clear();
  }

  private handleWindowFocus(): void {
    // Reset key state when window gains focus
    this.pressedKeys.clear();
  }

  private findMatchingShortcut(event: KeyboardEvent): KeyboardShortcut | undefined {
    const currentModifiers: KeyModifiers = {
      shift: event.shiftKey,
      ctrl: event.ctrlKey,
      alt: event.altKey,
      meta: event.metaKey
    };

    return this.shortcuts.find(shortcut => {
      // Check if key matches
      if (shortcut.key !== event.key) return false;

      // Check if modifiers match
      const requiredModifiers = shortcut.modifiers;
      
      return (
        (requiredModifiers.shift ?? false) === currentModifiers.shift &&
        (requiredModifiers.ctrl ?? false) === currentModifiers.ctrl &&
        (requiredModifiers.alt ?? false) === currentModifiers.alt &&
        (requiredModifiers.meta ?? false) === currentModifiers.meta
      );
    });
  }

  private isTypingInInput(target: EventTarget | null): boolean {
    if (!target || !(target instanceof Element)) return false;
    
    const tagName = target.tagName.toLowerCase();
    const isInput = tagName === 'input' || tagName === 'textarea';
    const isContentEditable = target.getAttribute('contenteditable') === 'true';
    
    return isInput || isContentEditable;
  }

  // Cleanup
  destroy(): void {
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    document.removeEventListener('keyup', this.handleKeyUp.bind(this));
    window.removeEventListener('blur', this.handleWindowBlur.bind(this));
    window.removeEventListener('focus', this.handleWindowFocus.bind(this));
    
    this.commandHandlers.clear();
    this.pressedKeys.clear();
  }
}