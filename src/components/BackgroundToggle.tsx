import type React from 'react';
import { useBackgroundType } from '../stores/uiStore';
import { createCorkboardPattern, createDotGridPattern } from './PinboardCanvas';

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
          <img src={createCorkboardPattern(1)} alt="Corkboard pattern" className="w-[16px] h-[16px]" />
        ) : (
          <img src={createDotGridPattern(1)} alt="Dot grid pattern" className="w-[16px] h-[16px]" />
        )}
      </div>
      <span className="capitalize">{backgroundType}</span>
    </button>
  );
};

export default BackgroundToggle;