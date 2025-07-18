import React from 'react';
import { WidgetRendererProps } from '../../types/widgets';
import { DocumentWidget } from './types';

export const DocumentWidgetRenderer: React.FC<WidgetRendererProps<DocumentWidget>> = ({
  widget,
  state,
  events,
}) => {
  return (
    <div className="h-full flex flex-col p-3">
      {/* File icon and name */}
      <div className="flex items-center gap-2 mb-2">
        <div className="text-lg">
          {widget.fileType === 'pdf' ? '📄' : 
           widget.fileType === 'doc' || widget.fileType === 'docx' ? '📝' :
           widget.fileType === 'txt' ? '📃' :
           widget.fileType === 'xls' || widget.fileType === 'xlsx' ? '📊' :
           widget.fileType === 'ppt' || widget.fileType === 'pptx' ? '📽️' :
           '📄'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {widget.fileName}
          </div>
          <div className="text-xs text-gray-500">
            {widget.fileType.toUpperCase()} • {widget.fileSize ? `${(widget.fileSize / 1024).toFixed(1)}KB` : 'Unknown size'}
          </div>
        </div>
      </div>
      
      {/* Thumbnail or preview */}
      <div className="flex-1 min-h-0 mb-2">
        {widget.thumbnail ? (
          <img 
            src={widget.thumbnail} 
            alt="Document preview"
            className="w-full h-full object-cover rounded"
          />
        ) : widget.content ? (
          <div className="text-xs text-gray-600 line-clamp-4 bg-gray-50 p-2 rounded">
            {widget.content.slice(0, 200)}...
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="text-2xl mb-1">📄</div>
              <div className="text-xs">No preview</div>
            </div>
          </div>
        )}
      </div>
      
      {/* Actions */}
      <div className="flex gap-1">
        {widget.downloadUrl && (
          <button 
            type="button"
            className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
            onClick={(e) => {
              e.stopPropagation();
              window.open(widget.downloadUrl, '_blank');
            }}
          >
            Download
          </button>
        )}
        {widget.previewUrl && (
          <button 
            type="button"
            className="text-xs bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600"
            onClick={(e) => {
              e.stopPropagation();
              window.open(widget.previewUrl, '_blank');
            }}
          >
            Preview
          </button>
        )}
      </div>
    </div>
  );
};