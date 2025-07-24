import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useContentActions } from "../../stores/widgetStore";
import type { WidgetRendererProps } from "../../types/widgets";
import type { YouTubeContent } from "./types";

// YouTube Player API types
interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  destroy(): void;
}

interface YTEvent {
  target: YouTubePlayer;
  data: number;
}

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        config: {
          videoId: string;
          playerVars?: Record<string, any>;
          events?: Record<string, (event: YTEvent) => void>;
        },
      ) => YouTubePlayer;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

export const YouTubeRenderer: React.FC<WidgetRendererProps<YouTubeContent>> = ({
  widget,
}) => {
  const { updateContent } = useContentActions();
  const playerRef = useRef<YouTubePlayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isApiReady, setIsApiReady] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  
  // Use refs for ALL changing values to prevent effect dependencies
  const dataRef = useRef(widget.content?.data);
  const widgetRef = useRef(widget);
  const updateContentRef = useRef(updateContent);
  const isLocalUpdateRef = useRef(false);

  // Get current data
  const data = widget.content?.data;
  const videoId = data?.videoId;

  // Update refs when values change (doesn't trigger re-renders)
  useEffect(() => {
    dataRef.current = data;
    widgetRef.current = widget;
    updateContentRef.current = updateContent;
  });

  // Load YouTube API only once
  useEffect(() => {
    if (window.YT?.Player) {
      setIsApiReady(true);
      return;
    }

    // Check if script already exists
    const existingScript = document.querySelector(
      'script[src*="youtube.com/iframe_api"]',
    );
    if (existingScript) {
      const checkAPI = () => {
        if (window.YT?.Player) {
          setIsApiReady(true);
        } else {
          setTimeout(checkAPI, 100);
        }
      };
      checkAPI();
      return;
    }

    // Load YouTube API script
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;

    window.onYouTubeIframeAPIReady = () => setIsApiReady(true);
    document.head.appendChild(script);
  }, []);

  // Completely stable event handlers - NO dependencies at all!
  const onPlayerReady = useCallback((event: YTEvent) => {
    console.log("YouTube player ready");
    setIsPlayerReady(true);

    // Set initial state from current data
    const currentData = dataRef.current;
    if (currentData) {
      if (currentData.currentTime > 0) {
        event.target.seekTo(currentData.currentTime, true);
      }
      if (currentData.isPlaying) {
        event.target.playVideo();
      }
    }
  }, []);

  const onPlayerStateChange = useCallback((event: YTEvent) => {
    if (isLocalUpdateRef.current) return; // Don't update if this is our own change

    const playerState = event.target.getPlayerState();
    const currentTime = event.target.getCurrentTime();
    const isPlaying = playerState === window.YT.PlayerState.PLAYING;

    console.log("Player state changed:", { playerState, isPlaying, currentTime });

    // Get current data and functions from refs
    const currentData = dataRef.current;
    const currentWidget = widgetRef.current;
    const currentUpdateContent = updateContentRef.current;
    
    if (!currentData || !currentWidget.isContentLoaded) return;

    // Set flag to prevent feedback loop
    isLocalUpdateRef.current = true;

    // Update content store with new state
    const newData = {
      ...currentData,
      isPlaying,
      currentTime,
      lastInteraction: {
        type: isPlaying ? ("play" as const) : ("pause" as const),
        timestamp: Date.now(),
      },
    };

    currentUpdateContent(currentWidget.contentId, { data: newData });

    // Reset flag after a short delay
    setTimeout(() => {
      isLocalUpdateRef.current = false;
    }, 100);
  }, []);

  // Memoize start time only when video changes
  const initialStartTime = useMemo(() => data?.startTime || 0, [data?.startTime]);

  // Initialize player ONLY when API ready and video ID changes - completely stable!
  useEffect(() => {
    if (!isApiReady || !videoId || !containerRef.current) {
      return;
    }

    const playerId = `youtube-player-${widget.id}`;

    // Clean up existing player
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch (error) {
        console.warn("Failed to destroy existing player:", error);
      }
      playerRef.current = null;
      setIsPlayerReady(false);
    }

    // Create player container
    const playerDiv = document.createElement("div");
    playerDiv.id = playerId;
    playerDiv.style.width = "100%";
    playerDiv.style.height = "100%";

    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(playerDiv);

    try {
      const player = new window.YT.Player(playerId, {
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          disablekb: 0,
          enablejsapi: 1,
          fs: 1,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          start: initialStartTime,
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
        },
      });

      playerRef.current = player;
    } catch (error) {
      console.error("Failed to create YouTube player:", error);
    }

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (error) {
          console.warn("Cleanup failed:", error);
        }
        playerRef.current = null;
      }
      setIsPlayerReady(false);
    };
  }, [isApiReady, videoId, widget.id, initialStartTime, onPlayerReady, onPlayerStateChange]);

  // Sync player state when content changes from other users
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current || !data || isLocalUpdateRef.current) {
      return;
    }

    const player = playerRef.current;

    try {
      const currentTime = player.getCurrentTime();
      const currentState = player.getPlayerState();
      const isCurrentlyPlaying = currentState === window.YT.PlayerState.PLAYING;

      console.log("Syncing player state:", {
        remoteIsPlaying: data.isPlaying,
        localIsPlaying: isCurrentlyPlaying,
        remoteTime: data.currentTime,
        localTime: currentTime,
      });

      // Sync playback state
      if (data.isPlaying !== isCurrentlyPlaying) {
        if (data.isPlaying) {
          console.log("🔄 Playing video (synced from other user)");
          player.playVideo();
        } else {
          console.log("🔄 Pausing video (synced from other user)");
          player.pauseVideo();
        }
      }

      // Sync time position if there's a significant difference
      const timeDifference = Math.abs(currentTime - data.currentTime);
      if (timeDifference > 2) {
        console.log(`🔄 Seeking to ${data.currentTime}s (diff: ${timeDifference.toFixed(1)}s)`);
        player.seekTo(data.currentTime, true);
      }
    } catch (error) {
      console.error("Failed to sync player:", error);
    }
  }, [data, isPlayerReady]);

  // Periodic position updates when playing
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current || !data?.isPlaying) {
      return;
    }

    const interval = setInterval(() => {
      if (playerRef.current && dataRef.current && !isLocalUpdateRef.current) {
        try {
          const currentTime = playerRef.current.getCurrentTime();
          const currentData = dataRef.current;
          
          // Only update if there's a meaningful change (every 2 seconds)
          if (Math.abs(currentTime - currentData.currentTime) > 2) {
            const currentWidget = widgetRef.current;
            const currentUpdateContent = updateContentRef.current;
            
            if (currentWidget.isContentLoaded) {
              // Set flag to prevent feedback loop
              isLocalUpdateRef.current = true;
              
              const newData = {
                ...currentData,
                currentTime,
                lastInteraction: {
                  type: "seek" as const,
                  timestamp: Date.now(),
                },
              };

              currentUpdateContent(currentWidget.contentId, { data: newData });

              // Reset flag after a short delay
              setTimeout(() => {
                isLocalUpdateRef.current = false;
              }, 100);
            }
          }
        } catch (error) {
          console.warn("Periodic sync failed:", error);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isPlayerReady, data?.isPlaying]);

  // Loading state
  if (!widget.isContentLoaded) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-gray-100">
        <div className="text-gray-500">Loading YouTube player...</div>
      </div>
    );
  }

  // Error state
  if (widget.contentError) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-red-100">
        <div className="text-red-500">Error: {widget.contentError}</div>
      </div>
    );
  }

  // Invalid video ID
  if (!data?.videoId) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-yellow-100">
        <div className="text-yellow-700">Invalid YouTube video ID</div>
      </div>
    );
  }

  return (
    <div className="group relative h-full w-full overflow-hidden rounded-lg bg-black shadow-lg">
      {/* Player container */}
      <div key={widget.id} ref={containerRef} className="h-full w-full" />

      {/* Loading overlay */}
      {!isPlayerReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-white">
            {!isApiReady ? "Loading YouTube API..." : "Initializing player..."}
          </div>
        </div>
      )}

      {/* Video info overlay */}
      {data.title && (
        <div className="pointer-events-none absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black to-transparent p-3 opacity-0 group-hover:opacity-100">
          <div className="font-medium text-sm text-white">{data.title}</div>

          {/* Party sync status */}
          <div className="mt-1 flex items-center gap-2 text-white text-xs opacity-75">
            {data.isPlaying ? (
              <>
                <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                <span>Playing</span>
              </>
            ) : (
              <>
                <div className="h-2 w-2 rounded-full bg-gray-400" />
                <span>Paused</span>
              </>
            )}

            {data.lastInteraction && (
              <span className="ml-2 text-xs opacity-60">
                Last {data.lastInteraction.type}{" "}
                {Math.round(
                  (Date.now() - data.lastInteraction.timestamp) / 1000,
                )}
                s ago
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
