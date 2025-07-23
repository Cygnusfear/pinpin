import type React from 'react';
import { useBackgroundType } from '../stores/uiStore';

export const BackgroundToggle: React.FC = () => {
  const { backgroundType, toggleBackgroundType } = useBackgroundType();

  return (
    <button
      type="button"
      onClick={toggleBackgroundType}
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-white/90 px-3 py-2 text-sm font-medium text-gray-700 shadow-lg backdrop-blur-sm transition-all hover:bg-white hover:shadow-xl"
      title={`Switch to ${backgroundType === 'corkboard' ? 'dot grid' : 'corkboard'} background`}
    >
      <div className="flex h-6 w-6 items-center justify-center">
        {backgroundType === 'corkboard' ? (
          // Corkboard icon - cork texture pattern
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <title>Corkboard pattern</title>
            <rect width="16" height="16" fill="#D2B48C" rx="2" />
            <circle cx="3" cy="3" r="0.5" fill="#8B4513" />
            <circle cx="8" cy="2" r="0.5" fill="#8B4513" />
            <circle cx="13" cy="4" r="0.5" fill="#8B4513" />
            <circle cx="2" cy="8" r="0.5" fill="#8B4513" />
            <circle cx="7" cy="7" r="0.5" fill="#8B4513" />
            <circle cx="12" cy="9" r="0.5" fill="#8B4513" />
            <circle cx="4" cy="12" r="0.5" fill="#8B4513" />
            <circle cx="9" cy="13" r="0.5" fill="#8B4513" />
            <circle cx="14" cy="11" r="0.5" fill="#8B4513" />
          </svg>
        ) : (
          // Dot grid icon
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <title>Dot grid pattern</title>
            <circle cx="2" cy="2" r="0.5" fill="#9CA3AF" />
            <circle cx="6" cy="2" r="0.5" fill="#9CA3AF" />
            <circle cx="10" cy="2" r="0.5" fill="#9CA3AF" />
            <circle cx="14" cy="2" r="0.5" fill="#9CA3AF" />
            <circle cx="2" cy="6" r="0.5" fill="#9CA3AF" />
            <circle cx="6" cy="6" r="0.5" fill="#9CA3AF" />
            <circle cx="10" cy="6" r="0.5" fill="#9CA3AF" />
            <circle cx="14" cy="6" r="0.5" fill="#9CA3AF" />
            <circle cx="2" cy="10" r="0.5" fill="#9CA3AF" />
            <circle cx="6" cy="10" r="0.5" fill="#9CA3AF" />
            <circle cx="10" cy="10" r="0.5" fill="#9CA3AF" />
            <circle cx="14" cy="10" r="0.5" fill="#9CA3AF" />
            <circle cx="2" cy="14" r="0.5" fill="#9CA3AF" />
            <circle cx="6" cy="14" r="0.5" fill="#9CA3AF" />
            <circle cx="10" cy="14" r="0.5" fill="#9CA3AF" />
            <circle cx="14" cy="14" r="0.5" fill="#9CA3AF" />
          </svg>
        )}
      </div>
      <span className="capitalize">{backgroundType}</span>
    </button>
  );
};

export default BackgroundToggle;