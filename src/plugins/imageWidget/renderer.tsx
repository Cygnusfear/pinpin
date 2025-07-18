import React from 'react';
import { WidgetRendererProps } from '../../types/widgets';
import { ImageWidget } from './types';

export const ImageWidgetRenderer: React.FC<WidgetRendererProps<ImageWidget>> = ({
  widget,
  state,
  events,
}) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '1px',
      }}
    >
      <img
        src={widget.src}
        alt={widget.alt || 'Pinned image'}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          pointerEvents: 'none',
          filter: widget.filters ? `
            brightness(${widget.filters.brightness || 1})
            contrast(${widget.filters.contrast || 1})
            saturate(${widget.filters.saturation || 1})
            blur(${widget.filters.blur || 0}px)
          ` : undefined,
        }}
        draggable={false}
      />
    </div>
  );
};