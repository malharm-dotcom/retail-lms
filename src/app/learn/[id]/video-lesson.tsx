"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type YTPlayer = {
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
};

declare global {
  interface Window {
    YT?: { Player: new (element: HTMLElement, options: object) => YTPlayer; PlayerState: { PLAYING: number } };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve();
  apiPromise ??= new Promise<void>((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiPromise;
}

const PLAYING = 1;
const PAUSED = 2;
const ENDED = 0;

/** Wraps an uploaded video in the same shape as the YouTube player, so tracking is shared. */
function nativePlayer(
  container: HTMLElement,
  src: string,
  startAt: number,
  onStateChange: (state: number) => void,
  onError: () => void,
): YTPlayer {
  const video = document.createElement("video");
  video.src = src;
  video.controls = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.disablePictureInPicture = true;
  video.setAttribute("controlsList", "nodownload noplaybackrate");
  video.addEventListener("loadedmetadata", () => {
    if (startAt > 0 && startAt < video.duration - 1) video.currentTime = startAt;
  });
  // Same 2x ceiling the server enforces.
  video.addEventListener("ratechange", () => {
    if (video.playbackRate > 2) video.playbackRate = 2;
  });
  video.addEventListener("playing", () => onStateChange(PLAYING));
  video.addEventListener("pause", () => onStateChange(video.ended ? ENDED : PAUSED));
  video.addEventListener("ended", () => onStateChange(ENDED));
  video.addEventListener("error", onError);
  container.replaceChildren(video);
  return {
    getCurrentTime: () => video.currentTime,
    getDuration: () => (Number.isFinite(video.duration) ? video.duration : 0),
    getPlayerState: () => (video.ended ? ENDED : video.paused ? PAUSED : PLAYING),
    destroy: () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    },
  };
}

export function VideoLesson({
  enrollmentId,
  lessonId,
  videoId,
  src,
  startAt,
  initialPercent,
  required,
  alreadyComplete,
}: {
  enrollmentId: string;
  lessonId: string;
  /** YouTube id, or `src` for an uploaded file. */
  videoId?: string;
  src?: string;
  startAt: number;
  initialPercent: number;
  required: number;
  alreadyComplete: boolean;
}) {
  const router = useRouter();
  const mount = useRef<HTMLDivElement>(null);
  // Refreshing the page after completion changes these props; the player must not restart.
  const initial = useRef({ startAt, alreadyComplete });
  const [percent, setPercent] = useState(initialPercent);
  const [complete, setComplete] = useState(alreadyComplete);
  const [status, setStatus] = useState<"idle" | "playing" | "paused-hidden" | "error">("idle");

  useEffect(() => {
    const container = mount.current;
    let player: YTPlayer | null = null;
    let last: number | null = null;
    let pending: [number, number][] = [];
    let sinceFlush = 0;
    let finished = initial.current.alreadyComplete;
    let cancelled = false;

    const payload = () => ({
      enrollmentId,
      lessonId,
      ranges: pending,
      position: player?.getCurrentTime?.() ?? 0,
      duration: player?.getDuration?.() || undefined,
    });

    async function flush() {
      if (!player || pending.length === 0) return;
      const body = payload();
      pending = [];
      sinceFlush = 0;
      try {
        const response = await fetch("/api/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!response.ok) return;
        const result = (await response.json()) as { percent: number; completed: boolean };
        setPercent(result.percent);
        if (result.completed && !finished) {
          finished = true;
          setComplete(true);
          router.refresh();
        }
      } catch {
        // Network blip: ranges for this window are dropped; the learner simply keeps watching.
      }
    }

    function flushOnLeave() {
      if (player && pending.length) navigator.sendBeacon("/api/progress", new Blob([JSON.stringify(payload())], { type: "application/json" }));
      pending = [];
    }

    // Sample once a second. Only contiguous forward playback in a visible tab is credited.
    const ticker = window.setInterval(() => {
      if (!player?.getPlayerState) return;
      const playing = player.getPlayerState() === PLAYING;
      const visible = document.visibilityState === "visible";
      const now = player.getCurrentTime();
      if (playing && visible) {
        if (last !== null && now > last && now - last <= 2.5) pending.push([last, now]);
        // The first sample lands up to a second after playback starts; credit a start from 0.
        else if (last === null && now <= 1.5) pending.push([0, now]);
        last = now;
        setStatus("playing");
      } else {
        last = null;
        setStatus(playing && !visible ? "paused-hidden" : "idle");
      }
      sinceFlush += 1;
      if (sinceFlush >= 10) void flush();
    }, 1000);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushOnLeave();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flushOnLeave);

    // Ended: credit the final second the 1s sampler cannot see.
    const onStateChange = (state: number) => {
      const duration = player?.getDuration?.() ?? 0;
      if (state === ENDED && last !== null && duration - last <= 2.5) pending.push([last, duration]);
      if (state !== PLAYING) void flush();
    };

    if (src) {
      if (container) player = nativePlayer(container, src, initial.current.startAt, onStateChange, () => setStatus("error"));
    } else loadYouTubeApi()
      .then(() => {
        if (cancelled || !container || !window.YT) return;
        // YouTube swaps the host element for an iframe, so give it a node React does not own.
        const host = document.createElement("div");
        container.replaceChildren(host);
        player = new window.YT.Player(host, {
          videoId,
          playerVars: { start: Math.floor(initial.current.startAt), rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onStateChange: (event: { data: number }) => onStateChange(event.data),
            onError: () => setStatus("error"),
          },
        });
      })
      .catch(() => setStatus("error"));

    return () => {
      cancelled = true;
      window.clearInterval(ticker);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flushOnLeave);
      flushOnLeave();
      player?.destroy?.();
      container?.replaceChildren();
    };
  }, [enrollmentId, lessonId, videoId, src, router]);

  return (
    <div>
      <div className="video-frame">
        <div ref={mount} />
      </div>
      <div className="watch-bar">
        <span className="meter" aria-label={`${percent}% watched`}>
          <span className="meter-track">
            <span className="meter-fill" style={{ width: `${percent}%`, background: complete ? "var(--moss)" : "var(--rust)" }} />
          </span>
          <span className="meter-value">{percent}%</span>
        </span>
        <span className="muted">
          {complete
            ? "Watched — lesson complete."
            : status === "paused-hidden"
              ? "Tracking paused while this tab is in the background."
              : status === "error"
                ? "The video could not load. Check your connection or tell HR."
                : `Watch at least ${required}% to complete. Skipped parts don't count.`}
        </span>
      </div>
    </div>
  );
}
