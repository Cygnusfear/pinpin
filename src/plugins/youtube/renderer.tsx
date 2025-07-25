import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
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

// ============================================================================
// ISOLATED YOUTUBE PLAYER COMPONENT
// ============================================================================

interface IsolatedPlayerProps {
  videoId: string;
  contentId: string;
  data: YouTubeContent;
  onPlayerEvent: (updates: Partial<YouTubeContent>) => void;
}

const IsolatedYouTubePlayer: React.FC<IsolatedPlayerProps> = ({
  videoId,
  contentId,
  data,
  onPlayerEvent,
}) => {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isApiReady, setIsApiReady] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  // Store current video ID to detect changes
  const currentVideoIdRef = useRef(videoId);
  const lastSyncDataRef = useRef<YouTubeContent>(data);

  // Track if we just performed a sync operation to avoid feedback loops
  const justSyncedRef = useRef(false);
  
  // Track if we're in initialization mode to prevent sync events during setup
  const isInitializingRef = useRef(false);

  // Queue for play commands when video isn't ready
  const playCommandQueueRef = useRef<{action: 'play' | 'pause', currentTime: number, timestamp: number} | null>(null);
  
  // Timeout for queued commands (clear stale commands after 10 seconds)
  const queueTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load YouTube API
  useEffect(() => {
    if (window.YT?.Player) {
      setIsApiReady(true);
      return;
    }

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

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    window.onYouTubeIframeAPIReady = () => setIsApiReady(true);
    document.head.appendChild(script);
  }, []);

  // Initialize or recreate player when API is ready or video changes
  useEffect(() => {
    if (!isApiReady || !videoId || !containerRef.current) {
      return;
    }

    // Only recreate player if video ID changed
    if (playerRef.current && currentVideoIdRef.current === videoId) {
      return;
    }

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

    currentVideoIdRef.current = videoId;
    const playerId = `youtube-player-${contentId}`;

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
          start: data.startTime || 0,
        },
        events: {
          onReady: (event: YTEvent) => {
            console.log("🎬 YouTube player ready");
            setIsPlayerReady(true);

            // Mark that we're initializing to prevent sync events
            isInitializingRef.current = true;

            // Set initial state from last interaction
            if (data.lastInteraction?.currentTime && data.lastInteraction.currentTime > 0) {
              event.target.seekTo(data.lastInteraction.currentTime, true);
            }
            if (data.lastInteraction?.isPlaying) {
              event.target.playVideo();
            }

            // Clear initialization flag after a short delay to allow state changes to settle
            setTimeout(() => {
              isInitializingRef.current = false;
            }, 500);
          },
          onStateChange: (event: YTEvent) => {
            const playerState = event.target.getPlayerState();
            const currentTime = event.target.getCurrentTime();
            const isPlaying = playerState === window.YT.PlayerState.PLAYING;

            console.log("🎬 Player state changed:", {
              playerState,
              isPlaying,
              currentTime,
              justSynced: justSyncedRef.current,
              isInitializing: isInitializingRef.current,
            });

            // Check if we have a queued command and the video is now ready to play
            // Expand the states that can execute queued commands
            const canExecuteCommands = playerState === window.YT.PlayerState.PAUSED ||
                                     playerState === window.YT.PlayerState.PLAYING ||
                                     playerState === window.YT.PlayerState.CUED ||
                                     playerState === window.YT.PlayerState.BUFFERING;
            
            if (playCommandQueueRef.current && canExecuteCommands) {
              const queuedCommand = playCommandQueueRef.current;
              playCommandQueueRef.current = null; // Clear the queue
              
              console.log("🔄 Video ready, executing queued command", {
                queuedAction: queuedCommand.action,
                currentTime: queuedCommand.currentTime,
                playerState: playerState,
                stateDescription: Object.keys(window.YT.PlayerState).find(key => window.YT.PlayerState[key] === playerState)
              });

              // Execute the queued command
              justSyncedRef.current = true;
              
              try {
                if (queuedCommand.action === 'play') {
                  event.target.seekTo(queuedCommand.currentTime, true);
                  const result = event.target.playVideo();
                  console.log("🔄 Executed queued play command", { result });
                } else {
                  event.target.seekTo(queuedCommand.currentTime, true);
                  const result = event.target.pauseVideo();
                  console.log("🔄 Executed queued pause command", { result });
                }
              } catch (error) {
                console.error("🔄 Error executing queued command:", error);
              }
              
              // Reset the sync flag after a delay
              setTimeout(() => {
                justSyncedRef.current = false;
              }, 1000);
              
              return; // Skip normal state change processing
            }

            // Only sync state changes that are NOT from our own sync operations
            // and NOT during initialization
            if (!justSyncedRef.current && !isInitializingRef.current) {
              console.log("🎯 User interaction detected - syncing state");
              onPlayerEvent({
                lastInteraction: {
                  type: isPlaying ? "play" : "pause",
                  timestamp: Date.now(),
                  currentTime,
                  isPlaying,
                },
              });
            } else {
              if (justSyncedRef.current) {
                console.log("🔄 Skipping sync - this was our own sync operation");
                justSyncedRef.current = false; // Reset flag
              } else if (isInitializingRef.current) {
                console.log("🔄 Skipping sync - player is initializing");
              }
            }
          },
        },
      });

      playerRef.current = player;

      // No need for complex user interaction detection
      // We'll use the sync flag approach instead
    } catch (error) {
      console.error("Failed to create YouTube player:", error);
    }

    return () => {
      // Clear any pending command timeout
      if (queueTimeoutRef.current) {
        clearTimeout(queueTimeoutRef.current);
        queueTimeoutRef.current = null;
      }
      
      // Clear any queued commands
      playCommandQueueRef.current = null;
      
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
  }, [isApiReady, videoId, contentId, data.startTime]);

  // Sync player state when content changes from other users
  useEffect(() => {
    console.log("🔄 Sync effect triggered", {
      isPlayerReady,
      hasPlayer: !!playerRef.current,
      contentId,
      lastInteraction: data.lastInteraction,
    });

    if (!isPlayerReady || !playerRef.current) {
      console.log("🔄 Skipping sync - player not ready or missing");
      return;
    }

    const player = playerRef.current;
    const lastData = lastSyncDataRef.current;

    try {
      // We rely on justSyncedRef flag for feedback loop detection
      // Timestamp-based detection was incorrectly flagging cross-browser events
      console.log("🔄 Processing sync event", {
        hasLastInteraction: !!data.lastInteraction,
        interactionType: data.lastInteraction?.type,
        interactionTime: data.lastInteraction?.timestamp,
      });

      const currentState = player.getPlayerState();
      const isCurrentlyPlaying = currentState === window.YT.PlayerState.PLAYING;
      
      // Get target state from last interaction
      const targetIsPlaying = data.lastInteraction?.isPlaying ?? false;
      const targetCurrentTime = data.lastInteraction?.currentTime ?? 0;

      console.log("🔄 Sync state comparison", {
        currentState,
        isCurrentlyPlaying,
        targetIsPlaying,
        targetCurrentTime,
        needsSync: targetIsPlaying !== isCurrentlyPlaying,
      });

      // Refined sync behavior: only sync play/pause interactions
      if (targetIsPlaying !== isCurrentlyPlaying) {
        console.log("🔄 SYNCING: State mismatch detected", {
          isInitializing: isInitializingRef.current,
          justSynced: justSyncedRef.current,
        });
        
        // Check if we're still initializing - this might block sync
        if (isInitializingRef.current) {
          console.log("🔄 BLOCKED: Cannot sync while initializing");
          return;
        }

        // Check if video is loaded enough to play (state must be >= 2 for PAUSED or higher)
        if (currentState === window.YT.PlayerState.UNSTARTED || currentState === window.YT.PlayerState.BUFFERING) {
          console.log("🔄 Video not ready for playback, queueing command", {
            currentState: currentState,
            stateDescription: currentState === window.YT.PlayerState.UNSTARTED ? 'UNSTARTED' : 'BUFFERING',
            queuedAction: targetIsPlaying ? 'play' : 'pause'
          });
          
          // Queue the command for when video is ready
          playCommandQueueRef.current = {
            action: targetIsPlaying ? 'play' : 'pause',
            currentTime: targetCurrentTime,
            timestamp: Date.now()
          };
          
          // Seek if we can (this works even when not fully loaded)
          try {
            player.seekTo(targetCurrentTime, true);
            console.log("🔄 Seeked to position while queueing", { targetCurrentTime });
          } catch (e) {
            console.log("🔄 Could not seek while video loading", { error: e });
          }
          
          return;
        }
        
        justSyncedRef.current = true; // Mark that we're about to sync
        
        if (targetIsPlaying) {
          console.log("🔄 Playing video (synced from other user)", {
            seekTo: targetCurrentTime,
            action: "play",
            playerState: currentState,
          });
          
          try {
            // When someone plays, seek to their current time first, then play
            player.seekTo(targetCurrentTime, true);
            const playResult = player.playVideo();
            console.log("🔄 playVideo() called", { result: playResult });
            
            // Verify the command worked after a short delay
            setTimeout(() => {
              const newState = player.getPlayerState();
              const newPlaying = newState === window.YT.PlayerState.PLAYING;
              console.log("🔄 Play command result", {
                newState,
                newPlaying,
                expectedPlaying: true,
                success: newPlaying === true,
              });
            }, 100);
          } catch (error) {
            console.error("🔄 Error executing play command:", error);
          }
        } else {
          console.log("🔄 Pausing video (synced from other user)", {
            action: "pause",
            playerState: currentState,
          });
          
          try {
            const pauseResult = player.pauseVideo();
            console.log("🔄 pauseVideo() called", { result: pauseResult });
          } catch (error) {
            console.error("🔄 Error executing pause command:", error);
          }
        }
      } else {
        console.log("🔄 No sync needed - states match", {
          both: `${isCurrentlyPlaying ? 'playing' : 'paused'}`,
          isInitializing: isInitializingRef.current,
        });
      }

      lastSyncDataRef.current = data;
    } catch (error) {
      console.error("🔄 Failed to sync player:", error);
    }
  }, [data, isPlayerReady, contentId]);

  // No more periodic position sync - players run naturally once playing

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* Loading overlay */}
      {!isPlayerReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-white">
            {!isApiReady ? "Loading YouTube API..." : "Initializing player..."}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// YOUTUBE RENDERER - SIMPLE PRESENTATION LAYER
// ============================================================================

export const YouTubeRenderer: React.FC<WidgetRendererProps<YouTubeContent>> = ({
  widget,
  state,
  events,
}) => {
  const { updateContent } = useContentActions();

  // Handle player events using content store pattern
  const handlePlayerEvent = useCallback(
    (updates: Partial<YouTubeContent>) => {
      if (!widget.isContentLoaded || !widget.content.data) return;

      const newData = {
        ...widget.content.data,
        ...updates,
      };

      // Update content store - this will sync automatically
      updateContent(widget.contentId, { data: newData });
    },
    [widget, updateContent],
  );

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
  const data = widget.content.data;
  if (!data?.videoId) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-yellow-100">
        <div className="text-yellow-700">Invalid YouTube video ID</div>
      </div>
    );
  }

  return (
    <div className="group relative h-full w-full overflow-hidden rounded-lg bg-black shadow-lg">
      {/* Isolated Player Component */}
      <IsolatedYouTubePlayer
        videoId={data.videoId}
        contentId={widget.contentId}
        data={data}
        onPlayerEvent={handlePlayerEvent}
      />

      {/* Video info overlay */}
      {data.title && (
        <div className="pointer-events-none absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black to-transparent p-3 opacity-0 group-hover:opacity-100">
          <div className="font-medium text-sm text-white">{data.title}</div>

          {/* Party sync status */}
          <div className="mt-1 flex items-center gap-2 text-white text-xs opacity-75">
            {data.lastInteraction?.isPlaying ? (
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
