/**
 * YouTube widget content for party-play synchronization
 * The content store handles sync automatically - we just need the playback state
 */
export interface YouTubeContent {
  url: string;
  videoId: string;
  title?: string;
  thumbnail?: string;
  duration?: number;
  currentTime: number;
  isPlaying: boolean;
  startTime?: number; // For URL params like ?t=123

  // Simple event tracking for UI feedback
  lastInteraction?: {
    type: "play" | "pause" | "seek";
    timestamp: number;
  };
}
