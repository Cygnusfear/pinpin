import React from 'react';
import { motion } from 'framer-motion';
import { 
  Widget, 
  WidgetRenderState, 
  WidgetEvents,
  ImageWidget,
  UrlWidget,
  NoteWidget,
  UnknownWidget
} from '../types/widgets';
import { getWidgetRegistry } from '../core/WidgetRegistry';

interface GenericWidgetRendererProps {
  widget: Widget;
  state: WidgetRenderState;
  events: WidgetEvents;
}

export const GenericWidgetRenderer: React.FC<GenericWidgetRendererProps> = ({
  widget,
  state,
  events,
}) => {
  const registry = getWidgetRegistry();
  const renderer = registry.getRenderer(widget.type);

  // If we have a custom renderer, use it
  if (renderer?.component) {
    const RendererComponent = renderer.component;
    return (
      <RendererComponent
        widget={widget}
        state={state}
        events={events}
        canvasTransform={state.transform}
      />
    );
  }

  // Fallback to built-in renderers
  return (
    <motion.div
      style={{
        position: 'absolute',
        left: widget.x,
        top: widget.y,
        width: widget.width,
        height: widget.height + 20, // Extra space for pin
        transform: `rotate(${widget.rotation}deg)`,
        transformOrigin: 'center',
        zIndex: state.isSelected ? 1000 : widget.zIndex,
        opacity: state.isSelected ? 0.9 : 1,
        cursor: state.isSelected ? 'move' : 'pointer',
      }}
      className="select-none"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ 
        opacity: 1, 
        scale: state.isHovered ? 1.02 : 1,
        transition: { duration: 0.2 }
      }}
      exit={{ opacity: 0, scale: 0.8 }}
      onClick={events.onSelect}
      onMouseEnter={events.onHover}
      onMouseLeave={events.onUnhover}
    >
      {/* Pin/Thumbtack */}
      <div
        style={{
          position: 'absolute',
          top: '5px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          width: '12px',
          height: '12px',
          backgroundColor: state.isSelected ? '#3b82f6' : '#dc2626',
          borderRadius: '50%',
          border: `2px solid ${state.isSelected ? '#1d4ed8' : '#b91c1c'}`,
          boxShadow: '0 2px 4px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.3)',
        }}
      />
      
      {/* Widget Content Container */}
      <div
        style={{
          position: 'relative',
          top: '10px',
          width: '100%',
          height: widget.height,
          backgroundColor: 'white',
          padding: '8px',
          borderRadius: '2px',
          boxShadow: `
            0 4px 8px rgba(0,0,0,0.15),
            0 2px 4px rgba(0,0,0,0.1),
            0 8px 16px rgba(0,0,0,0.1)
          `,
          border: state.isSelected ? '2px solid #3b82f6' : 'none',
          overflow: 'hidden',
        }}
      >
        {renderWidgetContent(widget, state, events)}
      </div>
      
      {/* Pin Shadow */}
      <div
        style={{
          position: 'absolute',
          top: '7px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '8px',
          height: '8px',
          backgroundColor: 'rgba(0,0,0,0.2)',
          borderRadius: '50%',
          filter: 'blur(2px)',
          zIndex: -1,
        }}
      />

      {/* Loading indicator */}
      {state.isLoading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
        </div>
      )}

      {/* Error indicator */}
      {state.hasError && (
        <div className="absolute inset-0 bg-red-50 flex items-center justify-center">
          <div className="text-red-500 text-center p-2">
            <div className="text-lg">⚠️</div>
            <div className="text-xs">{state.errorMessage || 'Error loading widget'}</div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

// Built-in widget content renderers
function renderWidgetContent(widget: Widget, state: WidgetRenderState, events: WidgetEvents): React.ReactNode {
  switch (widget.type) {
    case 'image':
      return <ImageWidgetContent widget={widget as ImageWidget} state={state} events={events} />;
    
    case 'url':
      return <UrlWidgetContent widget={widget as UrlWidget} state={state} events={events} />;
    
    case 'note':
      return <NoteWidgetContent widget={widget as NoteWidget} state={state} events={events} />;
    
    case 'unknown':
      return <UnknownWidgetContent widget={widget as UnknownWidget} state={state} events={events} />;
    
    default:
      return <DefaultWidgetContent widget={widget} state={state} events={events} />;
  }
}

// Image widget content
const ImageWidgetContent: React.FC<{
  widget: ImageWidget;
  state: WidgetRenderState;
  events: WidgetEvents;
}> = ({ widget, state, events }) => (
  <img
    src={widget.src}
    alt={widget.alt || 'Pinned image'}
    style={{
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      borderRadius: '1px',
      pointerEvents: 'none',
      filter: widget.filters ? `
        brightness(${widget.filters.brightness || 1})
        contrast(${widget.filters.contrast || 1})
        saturate(${widget.filters.saturation || 1})
        blur(${widget.filters.blur || 0}px)
      ` : undefined,
    }}
    draggable={false}
    onDoubleClick={events.onEdit}
  />
);

// URL widget content
const UrlWidgetContent: React.FC<{
  widget: UrlWidget;
  state: WidgetRenderState;
  events: WidgetEvents;
}> = ({ widget, state, events }) => (
  <div className="h-full flex flex-col">
    {/* Header with favicon and title */}
    <div className="flex items-center gap-2 mb-2 min-h-0">
      {widget.favicon && (
        <img 
          src={widget.favicon} 
          alt="" 
          className="w-4 h-4 flex-shrink-0"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      <div className="font-medium text-sm truncate">
        {widget.title || new URL(widget.url).hostname}
      </div>
    </div>
    
    {/* Preview or description */}
    <div className="flex-1 min-h-0">
      {widget.preview ? (
        <img 
          src={widget.preview} 
          alt="" 
          className="w-full h-full object-cover rounded"
        />
      ) : widget.description ? (
        <div className="text-xs text-gray-600 line-clamp-3">
          {widget.description}
        </div>
      ) : (
        <div className="text-xs text-gray-400 italic">
          Click to open link
        </div>
      )}
    </div>
    
    {/* URL */}
    <div className="text-xs text-blue-500 truncate mt-1">
      {widget.url}
    </div>
  </div>
);

// Note widget content
const NoteWidgetContent: React.FC<{
  widget: NoteWidget;
  state: WidgetRenderState;
  events: WidgetEvents;
}> = ({ widget, state, events }) => (
  <div
    style={{
      width: '100%',
      height: '100%',
      backgroundColor: widget.backgroundColor,
      color: widget.textColor,
      fontSize: `${widget.fontSize}px`,
      fontFamily: widget.fontFamily,
      textAlign: widget.textAlign,
      padding: '8px',
      borderRadius: '2px',
      overflow: 'auto',
      fontWeight: widget.formatting?.bold ? 'bold' : 'normal',
      fontStyle: widget.formatting?.italic ? 'italic' : 'normal',
      textDecoration: widget.formatting?.underline ? 'underline' : 'none',
    }}
    onDoubleClick={events.onEdit}
  >
    {widget.content.split('\n').map((line, index) => (
      <div key={`line-${index}-${line.slice(0, 10)}`}>{line || '\u00A0'}</div>
    ))}
  </div>
);

// Unknown widget content
const UnknownWidgetContent: React.FC<{
  widget: UnknownWidget;
  state: WidgetRenderState;
  events: WidgetEvents;
}> = ({ widget, state, events }) => (
  <div className="h-full flex flex-col items-center justify-center text-center p-4">
    <div className="text-2xl mb-2">❓</div>
    <div className="text-sm font-medium mb-1">Unknown Widget</div>
    <div className="text-xs text-gray-500 mb-2">
      Type: {widget.originalType || 'unknown'}
    </div>
    {widget.errorMessage && (
      <div className="text-xs text-red-500">
        {widget.errorMessage}
      </div>
    )}
  </div>
);

// Default widget content for unhandled types
const DefaultWidgetContent: React.FC<{
  widget: Widget;
  state: WidgetRenderState;
  events: WidgetEvents;
}> = ({ widget, state, events }) => (
  <div className="h-full flex flex-col items-center justify-center text-center p-4">
    <div className="text-2xl mb-2">📦</div>
    <div className="text-sm font-medium mb-1">{widget.type}</div>
    <div className="text-xs text-gray-500">
      No renderer available
    </div>
  </div>
);

export default GenericWidgetRenderer;