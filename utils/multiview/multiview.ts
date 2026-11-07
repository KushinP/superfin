import {
  MULTIVIEW_FOCUS_MAIN_RATIO,
  MULTIVIEW_MAX_TILES,
  MULTIVIEW_TILE_GAP,
} from "@/constants/Multiview";

/**
 * "grid" gives every tile the same size (side by side for two, 2x2 for more).
 * "focus" makes the first tile big and stacks the rest down the right side;
 * switching to it brings the tile being heard first.
 */
export type MultiviewLayout = "grid" | "focus";

/** Which tile is heard: one tile's key, or every tile at once. */
export type MultiviewAudio = string | "all" | null;

export interface MultiviewTile {
  /** Stable per tile, so a tile keeps its player across layout changes. */
  key: string;
  itemId: string;
  /**
   * This tile's own quality cap, over the "Multiview quality" setting. Unset,
   * the tile follows the setting. One channel can need less than the others:
   * a weak or heavy broadcast stalls at a rate the rest play fine at.
   */
  quality?: TileQuality;
  /** Counts reconnects; part of the tile's React key, so a bump reopens it. */
  generation?: number;
}

/** A quality cap: its label and bits per second, undefined for no cap. */
export interface TileQuality {
  key: string;
  value: number | undefined;
}

export interface MultiviewState {
  tiles: MultiviewTile[];
  audio: MultiviewAudio;
  layout: MultiviewLayout;
}

export interface TileFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const emptyMultiview: MultiviewState = {
  tiles: [],
  audio: null,
  layout: "grid",
};

/**
 * Adds an item as a new tile. Refuses (returns the state unchanged) when the
 * screen is full or the item is already up: two tiles of one live channel
 * would hold a second tuner for the same picture. The first tile is heard.
 */
export const addTile = (
  state: MultiviewState,
  itemId: string,
  key: string,
): MultiviewState => {
  if (state.tiles.length >= MULTIVIEW_MAX_TILES) return state;
  if (state.tiles.some((tile) => tile.itemId === itemId)) return state;
  return {
    ...state,
    tiles: [...state.tiles, { key, itemId }],
    audio: state.audio ?? key,
  };
};

/**
 * Removes a tile. When it was the one being heard, the sound moves to the
 * first tile left rather than going silent.
 */
export const removeTile = (
  state: MultiviewState,
  key: string,
): MultiviewState => {
  const tiles = state.tiles.filter((tile) => tile.key !== key);
  if (tiles.length === state.tiles.length) return state;
  const audio =
    state.audio === key || tiles.length === 0
      ? (tiles[0]?.key ?? null)
      : state.audio;
  return { ...state, tiles, audio };
};

/**
 * Plays another item in a tile's place, as the next episode does when one
 * ends. The tile keeps its spot and its sound. Refuses an item already on
 * screen, for the same reason as {@link addTile}.
 */
export const replaceTile = (
  state: MultiviewState,
  key: string,
  itemId: string,
): MultiviewState => {
  if (!state.tiles.some((tile) => tile.key === key)) return state;
  if (state.tiles.some((tile) => tile.itemId === itemId)) return state;
  return {
    ...state,
    tiles: state.tiles.map((tile) =>
      tile.key === key ? { ...tile, itemId } : tile,
    ),
  };
};

/**
 * What "Play next" does in a finished tile. Normally the next item takes the
 * tile's place. When it is already up in another tile, the finished tile goes
 * and the sound moves to that one, rather than the press doing nothing.
 */
export const playNext = (
  state: MultiviewState,
  key: string,
  itemId: string,
): MultiviewState => {
  const existing = state.tiles.find((t) => t.itemId === itemId);
  if (!existing) return replaceTile(state, key, itemId);
  const removed = removeTile(state, key);
  return removed.audio === "all" ? removed : selectAudio(removed, existing.key);
};

/**
 * Gives one tile its own quality cap, or with `quality` undefined puts it back
 * on the shared setting. The tile reopens its stream at the new cap.
 */
export const setTileQuality = (
  state: MultiviewState,
  key: string,
  quality: TileQuality | undefined,
): MultiviewState => ({
  ...state,
  tiles: state.tiles.map((tile) => {
    if (tile.key !== key) return tile;
    const { quality: _old, ...rest } = tile;
    return quality ? { ...rest, quality } : rest;
  }),
});

/**
 * Puts every tile back on the shared setting: what choosing a quality for all
 * tiles means, or a tile set lower earlier would quietly stay lower.
 */
export const clearTileQualities = (state: MultiviewState): MultiviewState =>
  state.tiles.some((tile) => tile.quality)
    ? {
        ...state,
        tiles: state.tiles.map(({ quality: _old, ...tile }) => tile),
      }
    : state;

/**
 * Reopens a tile's stream from scratch, keeping its spot, sound and quality:
 * a live channel stuck loading comes back at the live point.
 */
export const reconnectTile = (
  state: MultiviewState,
  key: string,
): MultiviewState => ({
  ...state,
  tiles: state.tiles.map((tile) =>
    tile.key === key
      ? { ...tile, generation: (tile.generation ?? 0) + 1 }
      : tile,
  ),
});

/** The React key of a tile's player: a new one closes and reopens the stream. */
export const tilePlayerKey = (tile: MultiviewTile): string =>
  `${tile.key}:${tile.itemId}:${tile.generation ?? 0}`;

/** Makes a tile the only one heard. */
export const selectAudio = (
  state: MultiviewState,
  key: string,
): MultiviewState =>
  state.tiles.some((tile) => tile.key === key)
    ? { ...state, audio: key }
    : state;

/**
 * Switches between hearing every tile and hearing one. Coming back from "all"
 * picks the main tile, since there is no earlier choice to restore.
 */
export const toggleAllAudio = (state: MultiviewState): MultiviewState => {
  if (state.audio === "all") {
    return { ...state, audio: state.tiles[0]?.key ?? null };
  }
  return state.tiles.length > 0 ? { ...state, audio: "all" } : state;
};

/** Whether a tile's player should be muted. */
export const isTileMuted = (state: MultiviewState, key: string): boolean =>
  state.audio !== "all" && state.audio !== key;

/**
 * Moves a tile to the front, which is the big one in the focus layout. The
 * sound follows it: promoting a tile is choosing to watch it.
 */
export const promoteTile = (
  state: MultiviewState,
  key: string,
): MultiviewState => {
  const tile = state.tiles.find((t) => t.key === key);
  if (!tile) return state;
  return {
    ...state,
    tiles: [tile, ...state.tiles.filter((t) => t.key !== key)],
    audio: state.audio === "all" ? "all" : key,
  };
};

/**
 * Switches between the grid and the focus layout. Going to focus enlarges the
 * tile being heard, since that is the one being watched; with every tile heard
 * there is no such tile, so the first one keeps its place.
 */
export const toggleLayout = (state: MultiviewState): MultiviewState => {
  if (state.layout === "focus") return { ...state, layout: "grid" };
  const heard =
    state.audio === "all" || state.audio === null
      ? state
      : promoteTile(state, state.audio);
  return { ...heard, layout: "focus" };
};

/**
 * What a tap on a tile does. In the focus layout a small tile is one level
 * away from being watched, so a tap brings it to the big spot (as in Apple TV
 * multiview); otherwise a tap picks which tile is heard. Hearing every tile
 * stays a choice the tap does not undo.
 */
/**
 * A tap on a tile, given whether the toolbar is showing. With it hidden the
 * tap is a request to see the controls, so it changes nothing else.
 */
export const tapWhileToolbar = (
  state: MultiviewState,
  key: string,
  toolbarVisible: boolean,
): MultiviewState => (toolbarVisible ? tapTile(state, key) : state);

export const tapTile = (state: MultiviewState, key: string): MultiviewState => {
  if (state.layout === "focus" && state.tiles[0]?.key !== key) {
    return promoteTile(state, key);
  }
  return state.audio === "all" ? state : selectAudio(state, key);
};

/** Largest 16:9 box that fits in the given cell, centred in it. */
const fit169 = (
  left: number,
  top: number,
  width: number,
  height: number,
): TileFrame => {
  const w = Math.min(width, (height * 16) / 9);
  const h = (w * 9) / 16;
  return {
    left: left + (width - w) / 2,
    top: top + (height - h) / 2,
    width: w,
    height: h,
  };
};

/**
 * Two columns, and one row for two tiles or two rows for more. Every tile
 * takes the largest 16:9 size the cells allow, and the tiles are packed one
 * gap apart with the whole block centred: centring each tile in its own cell
 * instead opens a wide gap down the middle of a screen wider than 16:9, such
 * as a phone on its side. A short last row is centred under the one above.
 */
const gridFrames = (
  count: number,
  width: number,
  height: number,
  gap: number,
): TileFrame[] => {
  if (count === 1) return [fit169(0, 0, width, height)];
  const columns = 2;
  const rows = Math.ceil(count / columns);
  const cellWidth = (width - gap * (columns - 1)) / columns;
  const cellHeight = (height - gap * (rows - 1)) / rows;
  const tileWidth = Math.min(cellWidth, (cellHeight * 16) / 9);
  const tileHeight = (tileWidth * 9) / 16;
  const blockHeight = rows * tileHeight + (rows - 1) * gap;
  const top = (height - blockHeight) / 2;
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / columns);
    const inRow = Math.min(columns, count - row * columns);
    const rowWidth = inRow * tileWidth + (inRow - 1) * gap;
    return {
      left: (width - rowWidth) / 2 + (i % columns) * (tileWidth + gap),
      top: top + row * (tileHeight + gap),
      width: tileWidth,
      height: tileHeight,
    };
  });
};

const focusFrames = (
  count: number,
  width: number,
  height: number,
  gap: number,
): TileFrame[] => {
  if (count === 1) return [fit169(0, 0, width, height)];
  const mainWidth = width * MULTIVIEW_FOCUS_MAIN_RATIO;
  const sideLeft = mainWidth + gap;
  const sideWidth = width - sideLeft;
  const others = count - 1;
  // Each small tile is as wide as the column unless the column is too short
  // to stack them all at 16:9; the stack is centred vertically.
  const tileHeight = Math.min(
    (sideWidth * 9) / 16,
    (height - gap * (others - 1)) / others,
  );
  const stackHeight = tileHeight * others + gap * (others - 1);
  const stackTop = (height - stackHeight) / 2;
  return [
    fit169(0, 0, mainWidth, height),
    ...Array.from({ length: others }, (_, i) =>
      fit169(
        sideLeft,
        stackTop + i * (tileHeight + gap),
        sideWidth,
        tileHeight,
      ),
    ),
  ];
};

/**
 * Where each tile sits on a screen of the given size, in tile order. Tiles are
 * positioned absolutely from these frames instead of by flex layout so that a
 * layout change or a promotion only moves the players, never remounts them:
 * a remount would close and reopen the stream, and a live one its tuner.
 */
export const tileFrames = (
  layout: MultiviewLayout,
  count: number,
  width: number,
  height: number,
  gap: number = MULTIVIEW_TILE_GAP,
): TileFrame[] => {
  if (count <= 0 || width <= 0 || height <= 0) return [];
  return layout === "focus"
    ? focusFrames(count, width, height, gap)
    : gridFrames(count, width, height, gap);
};

/** Ids of multiview's keyboard shortcuts (iPad and the Mac). */
export const MULTIVIEW_HEAR_KEY_PREFIX = "multiview-hear-";
export const MULTIVIEW_LAYOUT_KEY = "multiview-layout";

/**
 * What a multiview shortcut does: the number keys hear tile N, counted from
 * the main tile as the screen shows them, and G switches the layout. An id it
 * does not know, or a tile that is not there, leaves the state as it is.
 */
export const applyMultiviewKey = (
  state: MultiviewState,
  id: string,
): MultiviewState => {
  if (id === MULTIVIEW_LAYOUT_KEY) {
    return state.tiles.length >= 2 ? toggleLayout(state) : state;
  }
  if (!id.startsWith(MULTIVIEW_HEAR_KEY_PREFIX)) return state;
  const tile =
    state.tiles[Number(id.slice(MULTIVIEW_HEAR_KEY_PREFIX.length)) - 1];
  return tile ? selectAudio(state, tile.key) : state;
};
