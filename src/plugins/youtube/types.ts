/**
 * YouTube widget content for party-play synchronization
 * Uses content store for automatic sync across devices
 * All playback state is managed through lastInteraction for single-source-of-truth
 */
export interface YouTubeContent {
  // Video metadata
  url: string;
  videoId: string;
  title?: string;
  thumbnail?: string;
  duration?: number;
  startTime?: number; // For URL params like ?t=123

  // All synchronization handled through interactions
  lastInteraction?: {
    type: "play" | "pause" | "seek";
    timestamp: number;
    currentTime: number; // Position when interaction occurred
    isPlaying: boolean; // State after interaction
    userId?: string; // Optional user identification
  };
}
