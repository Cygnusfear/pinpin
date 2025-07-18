import React from 'react';
import { motion } from 'framer-motion';
import { 
  Widget, 
  WidgetRenderState, 
  WidgetEvents
} from '../types/widgets';
import { getWidgetRegistry } from '../core/WidgetRegistry';

interface WidgetContainerProps {
  widget: Widget;
  state: WidgetRenderState;
  events: WidgetEvents;
}

export const WidgetContainer: React.FC<WidgetContainerProps> = ({
  widget,
  state,
  events,
}) => {
  const registry = getWidgetRegistry();
  const renderer = registry.getRenderer(widget.type);

  // Render widget content using plugin renderer or fallback
  const renderWidgetContent = () => {
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

    // Fallback renderer for unknown widget types
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-4">
        <div className="text-2xl mb-2">📦</div>
        <div className="text-sm font-medium mb-1">{widget.type}</div>
        <div className="text-xs text-gray-500">
          No renderer available
        </div>
      </div>
    );
  };

  return (
    <motion.div
      style={{
        position: 'absolute',
        left: widget.x,
        top: widget.y,
        width: widget.width,
        height: widget.height + 20, // Extra space for pin
        transformOrigin: 'center',
        zIndex: state.isSelected ? 1000 : widget.zIndex,
        opacity: state.isSelected ? 0.9 : widget.locked ? 0.7 : 1,
        cursor: widget.locked ? 'not-allowed' : (state.isSelected ? 'move' : 'pointer'),
        pointerEvents: widget.locked ? 'none' : 'auto',
        transform: `rotate(${widget.rotation}deg)`,
      }}
      className="select-none"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ 
        opacity: 1, 
        scale: state.isHovered ? 1.02 : 1,
        transition: { duration: 0.2 }
      }}
      exit={{ opacity: 0, scale: 0.8 }}
      onClick={widget.locked ? undefined : events.onSelect}
      onMouseEnter={widget.locked ? undefined : events.onHover}
      onMouseLeave={widget.locked ? undefined : events.onUnhover}
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
          backgroundColor: widget.locked ? '#9ca3af' : (state.isSelected ? '#3b82f6' : '#dc2626'),
          borderRadius: '50%',
          border: `2px solid ${widget.locked ? '#6b7280' : (state.isSelected ? '#1d4ed8' : '#b91c1c')}`,
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
        {renderWidgetContent()}
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

      {/* Locked indicator */}
      {widget.locked && (
        <div className="absolute inset-0 bg-gray-500/20 flex items-center justify-center">
          <div className="text-gray-600 text-center p-2">
            <div className="text-lg">🔒</div>
            <div className="text-xs">Locked</div>
          </div>
        </div>
      )}

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

export default WidgetContainer;