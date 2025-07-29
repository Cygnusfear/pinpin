import type React from "react";
import { useBackgroundType } from "../stores/uiStore";

export const BackgroundToggle: React.FC = () => {
  const { backgroundType, toggleBackgroundType } = useBackgroundType();

  return (
      <button
        type="button"
        onClick={toggleBackgroundType}
        className="flex items-center gap-2 rounded-lg bg-white/90 px-3 py-2 font-medium text-black text-xs shadow-float backdrop-blur-sm transition-all hover:bg-white hover:shadow-float pointer-events-auto"
        title={`Switch to ${backgroundType === "board" ? "dot grid" : "corkboard"} background`}
      >
        <span className="capitalize">{backgroundType}</span>
      </button>
  );
};

export default BackgroundToggle;
