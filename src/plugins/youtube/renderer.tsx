import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  useWidgetActions,
  useWidgetContent,
} from "../../stores/selectiveHooks";
import type { SelectiveWidgetRendererProps } from "../../types/widgets";
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
// ISOLATED YOUTUBE PLAYER COMPONENT - NEW SELECTIVE REACTIVITY
// ============================================================================

interface IsolatedPlayerProps {
  widgetId: string;
}

const IsolatedYouTubePlayer: React.FC<IsolatedPlayerProps> = ({ widgetId }) => {
  // Selective subscriptions - only re-render when these specific values change
  const videoId = useWidgetContent(widgetId, (content) => content.data.videoId);
  const startTime = useWidgetContent(
    widgetId,
    (content) => content.data.startTime || 0,
  );
  const lastInteraction = useWidgetContent(
    widgetId,
    (content) => content.data.lastInteraction,
  );

  // Get update actions
  const { updateContent } = useWidgetActions(widgetId);

  const playerRef = useRef<YouTubePlayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isApiReady, setIsApiReady] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  // Store current video ID to detect changes
  const currentVideoIdRef = useRef(videoId);
  const lastSyncDataRef = useRef(lastInteraction);

  // Track if we just performed a sync operation to avoid feedback loops
  const justSyncedRef = useRef(false);

  // Track if we're in initialization mode to prevent sync events during setup
  const isInitializingRef = useRef(false);

  // Queue for play commands when video isn't ready
  const playCommandQueueRef = useRef<{
    action: "play" | "pause";
    currentTime: number;
    timestamp: number;
  } | null>(null);

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
    const playerId = `youtube-player-${widgetId}`;

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
          start: startTime,
        },
        events: {
          onReady: (event: YTEvent) => {
            console.log("🎬 YouTube player ready");
            setIsPlayerReady(true);

            // Mark that we're initializing to prevent sync events
            isInitializingRef.current = true;

            // Set initial state from last interaction
            if (
              lastInteraction?.currentTime &&
              lastInteraction.currentTime > 0
            ) {
              event.target.seekTo(lastInteraction.currentTime, true);
            }
            if (lastInteraction?.isPlaying) {
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
            const canExecuteCommands =
              playerState === window.YT.PlayerState.PAUSED ||
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
              });

              // Execute the queued command
              justSyncedRef.current = true;

              try {
                if (queuedCommand.action === "play") {
                  event.target.seekTo(queuedCommand.currentTime, true);
                  event.target.playVideo();
                } else {
                  event.target.seekTo(queuedCommand.currentTime, true);
                  event.target.pauseVideo();
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
              updateContent({
                lastInteraction: {
                  type: isPlaying ? "play" : "pause",
                  timestamp: Date.now(),
                  currentTime,
                  isPlaying,
                },
              });
            } else {
              if (justSyncedRef.current) {
                console.log(
                  "🔄 Skipping sync - this was our own sync operation",
                );
                justSyncedRef.current = false; // Reset flag
              } else if (isInitializingRef.current) {
                console.log("🔄 Skipping sync - player is initializing");
              }
            }
          },
        },
      });

      playerRef.current = player;
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
  }, [isApiReady, videoId, widgetId, startTime]);

  // Sync player state when content changes from other users
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current || !lastInteraction) {
      return;
    }

    const player = playerRef.current;

    try {
      const currentState = player.getPlayerState();
      const isCurrentlyPlaying = currentState === window.YT.PlayerState.PLAYING;

      // Get target state from last interaction
      const targetIsPlaying = lastInteraction.isPlaying ?? false;
      const targetCurrentTime = lastInteraction.currentTime ?? 0;

      // Refined sync behavior: only sync play/pause interactions
      if (targetIsPlaying !== isCurrentlyPlaying) {
        console.log("🔄 SYNCING: State mismatch detected");

        // Check if we're still initializing
        if (isInitializingRef.current) {
          console.log("🔄 BLOCKED: Cannot sync while initializing");
          return;
        }

        // Check if video is loaded enough to play
        if (
          currentState === window.YT.PlayerState.UNSTARTED ||
          currentState === window.YT.PlayerState.BUFFERING
        ) {
          console.log("🔄 Video not ready for playback, queueing command");

          // Queue the command for when video is ready
          playCommandQueueRef.current = {
            action: targetIsPlaying ? "play" : "pause",
            currentTime: targetCurrentTime,
            timestamp: Date.now(),
          };

          // Seek if we can
          try {
            player.seekTo(targetCurrentTime, true);
          } catch (e) {
            console.log("🔄 Could not seek while video loading");
          }

          return;
        }

        justSyncedRef.current = true; // Mark that we're about to sync

        if (targetIsPlaying) {
          console.log("🔄 Playing video (synced from other user)");
          try {
            player.seekTo(targetCurrentTime, true);
            player.playVideo();
          } catch (error) {
            console.error("🔄 Error executing play command:", error);
          }
        } else {
          console.log("🔄 Pausing video (synced from other user)");
          try {
            player.pauseVideo();
          } catch (error) {
            console.error("🔄 Error executing pause command:", error);
          }
        }
      }

      lastSyncDataRef.current = lastInteraction;
    } catch (error) {
      console.error("🔄 Failed to sync player:", error);
    }
  }, [lastInteraction, isPlayerReady]);

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
// YOUTUBE RENDERER - NEW SELECTIVE REACTIVITY INTERFACE
// ============================================================================

export const YouTubeRenderer: React.FC<SelectiveWidgetRendererProps> = ({
  widgetId,
}) => {
  // Selective subscriptions - only re-render when these specific values change
  const videoId = useWidgetContent(widgetId, (content) => content.data.videoId);
  const title = useWidgetContent(widgetId, (content) => content.data.title);
  const lastInteraction = useWidgetContent(
    widgetId,
    (content) => content.data.lastInteraction,
  );

  // Check loading state
  const isContentLoaded = useWidgetContent(widgetId, () => true) !== undefined;

  // Loading state
  if (!isContentLoaded) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-gray-100">
        <div className="text-gray-500">Loading YouTube player...</div>
      </div>
    );
  }

  // Invalid video ID
  if (!videoId) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-yellow-100">
        <div className="text-yellow-700">Invalid YouTube video ID</div>
      </div>
    );
  }

  return (
    <div className="group relative h-full w-full overflow-hidden rounded-lg bg-black shadow-lg">
      {/* Isolated Player Component */}
      <IsolatedYouTubePlayer widgetId={widgetId} />

      {/* Video info overlay */}
      {title && (
        <div className="pointer-events-none absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black to-transparent p-3 opacity-0 group-hover:opacity-100">
          <div className="font-medium text-sm text-white">{title}</div>

          {/* Party sync status */}
          <div className="mt-1 flex items-center gap-2 text-white text-xs opacity-75">
            {lastInteraction?.isPlaying ? (
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

            {lastInteraction && (
              <span className="ml-2 text-xs opacity-60">
                Last {lastInteraction.type}{" "}
                {Math.round((Date.now() - lastInteraction.timestamp) / 1000)}s
                ago
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Mark this component as using selective reactivity
(YouTubeRenderer as any).selectiveReactivity = true;
