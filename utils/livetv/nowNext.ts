import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";

const time = (date: string | null | undefined): number | null => {
  if (!date) return null;
  const ms = Date.parse(date);
  return Number.isNaN(ms) ? null : ms;
};

/**
 * How far a program has run at `now`, from 0 to 1. Null when its times are
 * missing or it is not on: a bar for a show that has not started, or has
 * ended while the list was open, would only mislead.
 */
export const programProgress = (
  program: Pick<BaseItemDto, "StartDate" | "EndDate"> | null | undefined,
  now: number,
): number | null => {
  const start = time(program?.StartDate);
  const end = time(program?.EndDate);
  if (start === null || end === null || end <= start) return null;
  if (now < start || now >= end) return null;
  return (now - start) / (end - start);
};

/**
 * The first program on each channel that starts after the one on now, from a
 * list of upcoming programs in any order. A program already running is not
 * "next", so a guide that also returns the current one is fine.
 */
export const nextProgramByChannel = (
  programs: BaseItemDto[] | null | undefined,
  now: number,
): Map<string, BaseItemDto> => {
  const next = new Map<string, BaseItemDto>();
  for (const program of programs ?? []) {
    const channel = program.ChannelId;
    const start = time(program.StartDate);
    if (!channel || start === null || start <= now) continue;
    const seen = next.get(channel);
    const seenStart = time(seen?.StartDate);
    if (!seen || (seenStart !== null && start < seenStart)) {
      next.set(channel, program);
    }
  }
  return next;
};

/** The channel's number as the guide shows it, if it has one. */
export const channelNumber = (
  channel: Pick<BaseItemDto, "ChannelNumber" | "Number">,
): string | null => channel.ChannelNumber || channel.Number || null;

/**
 * The program on now on each channel: started at or before `now` and not yet
 * ended. When listings overlap, the one that started last wins.
 */
export const currentProgramByChannel = (
  programs: BaseItemDto[] | null | undefined,
  now: number,
): Map<string, BaseItemDto> => {
  const current = new Map<string, BaseItemDto>();
  for (const program of programs ?? []) {
    const channel = program.ChannelId;
    const start = time(program.StartDate);
    const end = time(program.EndDate);
    if (!channel || start === null || end === null) continue;
    if (start > now || end <= now) continue;
    const seenStart = time(current.get(channel)?.StartDate);
    if (seenStart === null || start > seenStart) current.set(channel, program);
  }
  return current;
};
