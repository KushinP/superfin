import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";

/**
 * What the TV's screen reader says for a card: the show and episode for an
 * episode, else the item's name. On the Fire TV the hero cards on Home were
 * read as "" (2026-11-16, ADB), as TVPosterCard's were before #27.
 */
export const cardAccessibleName = (item: BaseItemDto): string | undefined =>
  item.Type === "Episode" && item.SeriesName
    ? `${item.SeriesName}, ${item.Name ?? ""}`
    : (item.Name ?? undefined);
