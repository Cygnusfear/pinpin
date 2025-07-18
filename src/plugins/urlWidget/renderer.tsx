import React from 'react';
import { WidgetRendererProps } from '../../types/widgets';
import { UrlWidget } from './types';

export const UrlWidgetRenderer: React.FC<WidgetRendererProps<UrlWidget>> = ({
  widget,
  state,
  events,
}) => {
  const domain = new URL(widget.url).hostname;
  
  return (
    <div className="h-full flex flex-col">
      {/* Preview card */}
      <div className="flex-1 min-h-0 bg-white rounded border border-gray-200 overflow-hidden">
        {/* Preview image */}
        {widget.preview && (
          <div className="w-full h-24 bg-gray-100">
            <img 
              src={widget.preview} 
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
        )}
        
        {/* Card content */}
        <div className="p-3">
          {/* Title */}
          <div className="font-medium text-sm text-gray-900 mb-1 line-clamp-2">
            {widget.title || domain}
          </div>
          
          {/* Description */}
          {widget.description && (
            <div className="text-xs text-gray-600 line-clamp-2 mb-2">
              {widget.description}
            </div>
          )}
          
          {/* Domain and favicon */}
          <div className="flex items-center gap-2">
            {widget.favicon && (
              <img 
                src={widget.favicon} 
                alt="" 
                className="w-3 h-3 flex-shrink-0"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
            <div className="text-xs text-gray-500 truncate">
              {domain}
            </div>
          </div>
        </div>
      </div>
      
      {/* URL bar */}
      <div className="text-xs text-blue-500 truncate mt-2 px-1">
        {widget.url}
      </div>
    </div>
  );
};