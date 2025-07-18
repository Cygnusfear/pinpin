import React from 'react';
import { WidgetRendererProps } from '../../types/widgets';
import { NoteWidget } from './types';

export const NoteWidgetRenderer: React.FC<WidgetRendererProps<NoteWidget>> = ({
  widget,
  state,
  events,
}) => {
  return (
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
    >
      {widget.content.split('\n').map((line, index) => (
        <div key={`line-${index}-${line.slice(0, 10)}`}>{line || '\u00A0'}</div>
      ))}
    </div>
  );
};