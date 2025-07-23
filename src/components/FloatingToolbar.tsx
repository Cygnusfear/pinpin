import type React from "react";
import { useState } from "react";
import { getWidgetRegistry } from "../core/WidgetRegistry";
import type { WidgetCreateData } from "../types/widgets";

interface FloatingToolbarProps {
  onWidgetAdd: (widget: WidgetCreateData) => void;
  canvasPosition?: { x: number; y: number }; // Position to place new widgets
}

interface WidgetButton {
  type: string;
  name: string;
  icon: string;
  description: string;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  onWidgetAdd,
  canvasPosition = { x: 400, y: 300 },
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCreating, setIsCreating] = useState<string | null>(null);

  const registry = getWidgetRegistry();
  const allTypes = registry.getAllTypes();

  // Define widget buttons with their creation data
  const widgetButtons: WidgetButton[] = allTypes.map((type) => ({
    type: type.type,
    name: type.name,
    icon: type.icon,
    description: type.description,
  }));

  const handleWidgetCreate = async (widgetType: string) => {
    setIsCreating(widgetType);

    try {
      const factory = registry.getFactory(widgetType);
      if (!factory) {
        console.error(`No factory found for widget type: ${widgetType}`);
        return;
      }

      let createData: any;

      // Create appropriate data based on widget type
      switch (widgetType) {
        case "note":
          createData = {
            type: "note",
            text: "New note",
          };
          break;
        case "calculator":
          createData = {
            type: "calculator",
            calculator: true,
          };
          break;
        case "image":
          // For image, we'll create a placeholder that prompts for upload
          createData = {
            type: "image",
            src: "https://via.placeholder.com/200x150?text=Drag+Image+Here",
            alt: "Placeholder image - drag an image here to replace",
            originalDimensions: { width: 200, height: 150 },
          };
          break;
        case "url":
          createData = {
            type: "url",
            url: "https://example.com",
            title: "Example Link",
            description: "Click to edit this link",
          };
          break;
        case "document":
          createData = {
            type: "document",
            fileName: "New Document",
            fileType: "document",
            fileSize: 0,
            mimeType: "text/plain",
            content: "Drop a file here or click to edit",
          };
          break;
        case "todo":
          createData = {
            type: "todo",
            items: [],
            title: "Todo List",
          };
          break;
        default:
          createData = { type: widgetType };
      }

      // Create the widget using the factory
      const widgetCreateData = await factory.create(createData, canvasPosition);

      // Add the widget
      onWidgetAdd(widgetCreateData);

      console.log(`Created ${widgetType} widget at position:`, canvasPosition);
    } catch (error) {
      console.error(`Failed to create ${widgetType} widget:`, error);
    } finally {
      setIsCreating(null);
      setIsExpanded(false); // Collapse toolbar after creating widget
    }
  };

  return (
    <div className="fixed left-4 top-4 z-50">
      {/* Main Toggle Button */}
      <button
        type="button"
        className={`
          flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all duration-300 hover:bg-blue-700 hover:scale-110
          ${isExpanded ? "rotate-45" : ""}
        `}
        onClick={() => setIsExpanded(!isExpanded)}
        title="Widget Toolbar"
      >
        <span className="text-xl">+</span>
      </button>

      {/* Expanded Widget Buttons */}
      {isExpanded && (
        <div className="mt-2 space-y-2">
          {widgetButtons.map((button, index) => (
            <div
              key={button.type}
              className="animate-in slide-in-from-left fade-in"
              style={{
                animationDelay: `${index * 50}ms`,
                animationDuration: "300ms",
                animationFillMode: "both",
              }}
            >
              <button
                type="button"
                className={`
                  group flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md transition-all duration-200 hover:w-auto hover:px-3 hover:shadow-lg
                  ${
                    isCreating === button.type
                      ? "animate-pulse bg-blue-100"
                      : "hover:bg-gray-50"
                  }
                `}
                onClick={() => handleWidgetCreate(button.type)}
                disabled={isCreating !== null}
                title={button.description}
              >
                <span className="text-lg">{button.icon}</span>
                <span className="ml-2 hidden whitespace-nowrap text-sm font-medium text-gray-700 group-hover:inline">
                  {button.name}
                </span>
                {isCreating === button.type && (
                  <div className="ml-2 h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-b-transparent" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Backdrop to close toolbar when clicking outside */}
      {isExpanded && (
        <div
          className="fixed inset-0 -z-10"
          onClick={() => setIsExpanded(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setIsExpanded(false);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Close toolbar"
        />
      )}
    </div>
  );
};

export default FloatingToolbar;