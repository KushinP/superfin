import { MULTIVIEW_LIVE_REOPEN_GAP } from "@/constants/Multiview";

// One clock for every tile: a dual tuner is shared, so any channel's stop
// frees the tuner another channel may be about to ask for.
let lastLiveStopSentAt: number | null = null;

/** A live stream's stop report is on its way: the tuner is being closed. */
export const noteLiveStopSent = (now = Date.now()) => {
  lastLiveStopSentAt = now;
};

/** Milliseconds a live channel should still wait before it opens a stream. */
export const liveReopenWait = (now = Date.now()) =>
  lastLiveStopSentAt === null
    ? 0
    : Math.max(0, lastLiveStopSentAt + MULTIVIEW_LIVE_REOPEN_GAP - now);

/** Forgets the last stop; for specs, which share this module's state. */
export const resetLiveReopenGap = () => {
  lastLiveStopSentAt = null;
};
