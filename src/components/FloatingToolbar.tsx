import type React from "react";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getWidgetRegistry } from "../core/WidgetRegistry";
import type { CreateWidgetInput } from "../types/widgets";
import { usePluginHotReload } from "../hooks/usePluginHotReload";
import BackgroundToggle from "./BackgroundToggle";

interface FloatingToolbarProps {
  onWidgetAdd: (widget: CreateWidgetInput) => void;
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

  // Filter to only show widgets that are not autoCreateOnly
  const manualCreateTypes = allTypes.filter((type) => !type.autoCreateOnly);

  // Define widget buttons with their creation data
  const widgetButtons: WidgetButton[] = manualCreateTypes.map((type) => ({
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

      // Get demo defaults from the factory
      const createData = factory.getDemoDefaults
        ? factory.getDemoDefaults()
        : { type: widgetType };

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
    <div className="pointer-events-none fixed bottom-0 z-50 flex w-screen flex-row items-center justify-center transition-all duration-100">
      <div className="mb-6 rounded-md bg-white py-2 px-4 shadow-float transition-all">
        <div className="flex flex-row gap-2 transition-all" >
          <BackgroundToggle/>
          <div className="w-1 border-r border-gray-200" />
          {widgetButtons.map((button, index) => (
            <Tooltip key={button.type}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    `group pointer-events-auto flex h-10 w-10 items-center justify-center rounded-md transition-all duration-100 hover:px-3`,
                  )}
                  onClick={() => handleWidgetCreate(button.type)}
                  disabled={isCreating !== null}
                  title={button.description}
                >
                  {typeof button.icon === "function" ? (
                    button.icon
                  ) : (
                    <span className="pointer-events-none text-lg group-hover:animate-bounce">
                      {button.icon.includes("/") ? (
                        <img
                          alt={button.name}
                          src={button.icon}
                          className="h-6 w-6 object-contain"
                        />
                      ) : (
                        button.icon
                      )}
                    </span>
                  )}
                  {isCreating === button.type && (
                    <div className="ml-2 h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-b-transparent" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{button.name}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Backdrop to close toolbar when clicking outside */}
      {isExpanded && (
        <div
          className="-z-10 fixed inset-0"
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
