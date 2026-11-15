import {
  LIVE_SCORES_BUFFER_MAX,
  LIVE_SCORES_DELAY_DEFAULT_S,
  LIVE_SCORES_DELAY_MAX_S,
  LIVE_SCORES_DELAY_MIN_S,
  LIVE_SCORES_DELAY_STEP_S,
} from "@/constants/LiveScores";

/** One fetch, stamped with when it arrived on this device. */
export interface Snapshot<T> {
  fetchedAt: number;
  data: T;
}

/**
 * The newest snapshot that is at least `delayMs` old at `now`, or null when
 * none is yet. This is the whole spoiler guard: it can only ever pick
 * something old enough, so a score shows late, never early.
 */
export const delayedSnapshot = <T>(
  buffer: readonly Snapshot<T>[],
  now: number,
  delayMs: number,
): Snapshot<T> | null => {
  const cutoff = now - delayMs;
  let shown: Snapshot<T> | null = null;
  for (const snapshot of buffer) {
    if (snapshot.fetchedAt <= cutoff) shown = snapshot;
    else break;
  }
  return shown;
};

/**
 * The buffer with `snapshot` added, oldest first. Drops what can never be
 * shown again (older than the one on screen now) and caps the length.
 */
export const addSnapshot = <T>(
  buffer: readonly Snapshot<T>[],
  snapshot: Snapshot<T>,
  now: number,
  delayMs: number,
  max: number = LIVE_SCORES_BUFFER_MAX,
): Snapshot<T>[] => {
  const sorted = [...buffer, snapshot].sort(
    (a, b) => a.fetchedAt - b.fetchedAt,
  );
  const shown = delayedSnapshot(sorted, now, delayMs);
  const kept = shown ? sorted.slice(sorted.indexOf(shown)) : sorted;
  return kept.slice(-max);
};

/**
 * A delay setting brought into range, on its 5 s steps. Settings can come
 * from an older build or the server plugin, so they are not trusted as is.
 */
export const clampDelaySeconds = (seconds: number): number => {
  if (!Number.isFinite(seconds)) return LIVE_SCORES_DELAY_DEFAULT_S;
  const stepped =
    Math.round(seconds / LIVE_SCORES_DELAY_STEP_S) * LIVE_SCORES_DELAY_STEP_S;
  return Math.min(
    LIVE_SCORES_DELAY_MAX_S,
    Math.max(LIVE_SCORES_DELAY_MIN_S, stepped),
  );
};
