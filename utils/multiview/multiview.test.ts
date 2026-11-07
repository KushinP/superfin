import { MULTIVIEW_MAX_TILES } from "@/constants/Multiview";
import {
  addTile,
  applyMultiviewKey,
  clearTileQualities,
  emptyMultiview,
  isTileMuted,
  type MultiviewState,
  playNext,
  promoteTile,
  reconnectTile,
  removeTile,
  replaceTile,
  selectAudio,
  setTileQuality,
  tapTile,
  tapWhileToolbar,
  tileFrames,
  tilePlayerKey,
  toggleAllAudio,
  toggleLayout,
} from "./multiview";

const withTiles = (...ids: string[]): MultiviewState =>
  ids.reduce((state, id) => addTile(state, id, `k-${id}`), emptyMultiview);

describe("multiview tiles", () => {
  test("the first tile added is the one heard", () => {
    const state = withTiles("game-1", "game-2");
    expect(state.audio).toBe("k-game-1");
    expect(isTileMuted(state, "k-game-1")).toBe(false);
    expect(isTileMuted(state, "k-game-2")).toBe(true);
  });

  test("refuses the same item twice, so one channel never holds two tuners", () => {
    const state = withTiles("game-1");
    expect(addTile(state, "game-1", "other-key")).toBe(state);
  });

  test("refuses a tile past the maximum", () => {
    const ids = Array.from({ length: MULTIVIEW_MAX_TILES }, (_, i) => `i${i}`);
    const full = withTiles(...ids);
    expect(addTile(full, "one-more", "k").tiles).toHaveLength(
      MULTIVIEW_MAX_TILES,
    );
  });

  test("removing the heard tile moves the sound to the first one left", () => {
    const state = selectAudio(withTiles("a", "b", "c"), "k-b");
    expect(removeTile(state, "k-b").audio).toBe("k-a");
  });

  test("removing a muted tile keeps the sound where it is", () => {
    const state = selectAudio(withTiles("a", "b", "c"), "k-c");
    expect(removeTile(state, "k-a").audio).toBe("k-c");
  });

  test("removing the last tile leaves nothing heard", () => {
    expect(removeTile(withTiles("a"), "k-a")).toEqual(emptyMultiview);
  });

  test("hearing every tile unmutes all of them, and coming back picks the main one", () => {
    const state = selectAudio(withTiles("a", "b"), "k-b");
    const all = toggleAllAudio(state);
    expect(isTileMuted(all, "k-a")).toBe(false);
    expect(isTileMuted(all, "k-b")).toBe(false);
    expect(toggleAllAudio(all).audio).toBe("k-a");
  });

  test("selecting a tile that is not on screen changes nothing", () => {
    const state = withTiles("a");
    expect(selectAudio(state, "missing")).toBe(state);
  });

  test("promoting a tile puts it first and makes it the one heard", () => {
    const state = promoteTile(withTiles("a", "b", "c"), "k-c");
    expect(state.tiles.map((t) => t.itemId)).toEqual(["c", "a", "b"]);
    expect(state.audio).toBe("k-c");
  });

  test("promoting keeps every tile heard when that was the choice", () => {
    const state = toggleAllAudio(withTiles("a", "b"));
    expect(promoteTile(state, "k-b").audio).toBe("all");
  });

  test("the layout toggles between grid and focus", () => {
    const focus = toggleLayout(emptyMultiview);
    expect(focus.layout).toBe("focus");
    expect(toggleLayout(focus).layout).toBe("grid");
  });

  test("switching to focus makes the tile being heard the big one", () => {
    // Reported: only the left tile could be made bigger, because the focus
    // layout always enlarged the first tile whatever was being watched.
    const heard = selectAudio(withTiles("a", "b"), "k-b");
    const focus = toggleLayout(heard);
    expect(focus.tiles.map((t) => t.itemId)).toEqual(["b", "a"]);
    expect(focus.audio).toBe("k-b");
  });

  test("switching to focus keeps the order when every tile is heard", () => {
    const all = toggleAllAudio(withTiles("a", "b"));
    expect(toggleLayout(all).tiles.map((t) => t.itemId)).toEqual(["a", "b"]);
  });

  test("switching back to grid keeps the order", () => {
    const focus = toggleLayout(selectAudio(withTiles("a", "b"), "k-b"));
    expect(toggleLayout(focus).tiles.map((t) => t.itemId)).toEqual(["b", "a"]);
  });
});

describe("replaceTile", () => {
  test("puts a new item in the tile's place, keeping its spot and sound", () => {
    const heard = selectAudio(withTiles("a", "b"), "k-b");
    const state = replaceTile(heard, "k-b", "c");
    expect(state.tiles).toEqual([
      { key: "k-a", itemId: "a" },
      { key: "k-b", itemId: "c" },
    ]);
    expect(state.audio).toBe("k-b");
  });

  test("refuses an item already on screen", () => {
    const state = withTiles("a", "b");
    expect(replaceTile(state, "k-b", "a")).toBe(state);
  });

  test("changes nothing for a tile that is not there", () => {
    const state = withTiles("a");
    expect(replaceTile(state, "missing", "c")).toBe(state);
  });
});

describe("playNext", () => {
  test("plays the next item in the finished tile's place", () => {
    const state = playNext(withTiles("a", "b"), "k-b", "c");
    expect(state.tiles.map((t) => t.itemId)).toEqual(["a", "c"]);
  });

  test("when the next item is already up, closes the finished tile and hears that one", () => {
    // Reported in review: Play next did nothing when the next episode was
    // already in another tile.
    const heard = selectAudio(withTiles("a", "b"), "k-b");
    const state = playNext(heard, "k-b", "a");
    expect(state.tiles.map((t) => t.itemId)).toEqual(["a"]);
    expect(state.audio).toBe("k-a");
  });
});

describe("tapWhileToolbar", () => {
  test("with the toolbar hidden a tap only brings it back", () => {
    // Reported in review: the tap meant to show the controls also moved the
    // sound, and in focus swapped the big tile.
    const focus = toggleLayout(withTiles("a", "b"));
    expect(tapWhileToolbar(focus, "k-b", false)).toBe(focus);
  });

  test("with the toolbar up a tap does what a tap does", () => {
    const focus = toggleLayout(withTiles("a", "b"));
    expect(tapWhileToolbar(focus, "k-b", true)).toEqual(tapTile(focus, "k-b"));
  });
});

describe("tapTile", () => {
  test("in the grid, a tap only changes which tile is heard", () => {
    const state = tapTile(withTiles("a", "b"), "k-b");
    expect(state.tiles.map((t) => t.itemId)).toEqual(["a", "b"]);
    expect(state.audio).toBe("k-b");
  });

  test("in focus, tapping a small tile makes it the big one and heard", () => {
    const focus = toggleLayout(withTiles("a", "b", "c"));
    const state = tapTile(focus, "k-c");
    expect(state.tiles.map((t) => t.itemId)).toEqual(["c", "a", "b"]);
    expect(state.audio).toBe("k-c");
  });

  test("in focus, tapping the big tile leaves the layout alone", () => {
    const focus = toggleLayout(withTiles("a", "b"));
    expect(tapTile(focus, "k-a")).toEqual(focus);
  });

  test("a tap keeps every tile heard when that was the choice", () => {
    const all = toggleAllAudio(withTiles("a", "b"));
    expect(tapTile(all, "k-b").audio).toBe("all");
    const focus = toggleLayout(all);
    expect(tapTile(focus, "k-b").audio).toBe("all");
  });
});

describe("tileFrames", () => {
  const W = 1920;
  const H = 1080;

  test("one tile fills a 16:9 screen", () => {
    expect(tileFrames("grid", 1, W, H, 0)).toEqual([
      { left: 0, top: 0, width: W, height: H },
    ]);
  });

  test("two tiles in the grid sit side by side, at 16:9, without overlapping", () => {
    const [a, b] = tileFrames("grid", 2, W, H, 0);
    expect(a.width).toBe(W / 2);
    expect(a.height).toBeCloseTo((W / 2) * (9 / 16));
    expect(b.left).toBeGreaterThanOrEqual(a.left + a.width);
    expect(a.top).toBe(b.top);
  });

  test("four tiles in the grid make a 2x2", () => {
    const frames = tileFrames("grid", 4, W, H, 0);
    expect(frames.map((f) => [f.left, f.top])).toEqual([
      [0, 0],
      [W / 2, 0],
      [0, H / 2],
      [W / 2, H / 2],
    ]);
  });

  test("the focus layout gives the first tile most of the screen", () => {
    const [main, ...rest] = tileFrames("focus", 3, W, H);
    for (const small of rest) {
      expect(main.width).toBeGreaterThan(small.width * 2);
      expect(small.left).toBeGreaterThan(main.left + main.width);
    }
  });

  test("small tiles in the focus layout never run off the screen", () => {
    for (const count of [2, 3, 4]) {
      for (const frame of tileFrames("focus", count, W, H)) {
        expect(frame.top).toBeGreaterThanOrEqual(0);
        expect(frame.top + frame.height).toBeLessThanOrEqual(H + 0.001);
        expect(frame.left + frame.width).toBeLessThanOrEqual(W + 0.001);
      }
    }
  });

  describe("on a phone in landscape, wider than 16:9", () => {
    // An iPhone 18 Pro on its side. Its 2x2 cells are wider than 16:9, so
    // the tiles cannot fill them across. Reported: a wide black gap opened
    // down the middle, because each tile was centred in its own cell.
    const PW = 874;
    const PH = 402;
    const GAP = 4;

    test("the grid's tiles sit one gap apart, the block centred", () => {
      const [a, b, c, d] = tileFrames("grid", 4, PW, PH, GAP);
      expect(b.left - (a.left + a.width)).toBeCloseTo(GAP);
      expect(c.top - (a.top + a.height)).toBeCloseTo(GAP);
      expect(a.left).toBeCloseTo(PW - (b.left + b.width));
      expect(d.left).toBeCloseTo(b.left);
    });

    test("a third tile sits centred under the first two", () => {
      const [a, b, c] = tileFrames("grid", 3, PW, PH, GAP);
      const blockCentre = (a.left + b.left + b.width) / 2;
      expect(c.left + c.width / 2).toBeCloseTo(blockCentre);
      expect(c.top - (a.top + a.height)).toBeCloseTo(GAP);
      expect(c.width).toBeCloseTo(a.width);
    });

    test("two tiles side by side still sit one gap apart", () => {
      const [a, b] = tileFrames("grid", 2, PW, PH, GAP);
      expect(b.left - (a.left + a.width)).toBeCloseTo(GAP);
      expect(a.top).toBeCloseTo(b.top);
    });
  });

  test("a screen not measured yet has no frames", () => {
    expect(tileFrames("grid", 2, 0, 0)).toEqual([]);
  });
});

describe("applyMultiviewKey", () => {
  const three = ["a", "b", "c"].reduce(
    (s, id, i) => addTile(s, id, `tile-${i}`),
    emptyMultiview,
  );

  test("a number key hears that tile, counting from the main one", () => {
    expect(applyMultiviewKey(three, "multiview-hear-2").audio).toBe("tile-1");
    expect(applyMultiviewKey(three, "multiview-hear-3").audio).toBe("tile-2");
  });

  test("a number past the last tile changes nothing", () => {
    expect(applyMultiviewKey(three, "multiview-hear-4")).toBe(three);
  });

  test("G switches the layout once there are two tiles to arrange", () => {
    expect(applyMultiviewKey(three, "multiview-layout").layout).toBe("focus");
    const one = addTile(emptyMultiview, "a", "tile-0");
    expect(applyMultiviewKey(one, "multiview-layout")).toBe(one);
  });

  test("an id it does not know changes nothing", () => {
    expect(applyMultiviewKey(three, "tab-home")).toBe(three);
  });
});

describe("per-tile quality and reconnect", () => {
  const four = { key: "4 Mb/s", value: 4_000_000 };
  const two = (): MultiviewState =>
    addTile(addTile(emptyMultiview, "fox", "k-fox"), "abc", "k-abc");

  test("one tile can stream lower than the rest", () => {
    // Fox stalled at a rate ABC played fine at.
    const state = setTileQuality(two(), "k-fox", four);
    expect(state.tiles.find((t) => t.key === "k-fox")?.quality).toEqual(four);
    expect(state.tiles.find((t) => t.key === "k-abc")?.quality).toBeUndefined();
  });

  test("an unset quality puts the tile back on the shared setting", () => {
    const state = setTileQuality(
      setTileQuality(two(), "k-fox", four),
      "k-fox",
      undefined,
    );
    expect("quality" in state.tiles[0]).toBe(false);
  });

  test("choosing a quality for all tiles clears the per-tile ones", () => {
    const state = clearTileQualities(setTileQuality(two(), "k-fox", four));
    expect(state.tiles.every((t) => t.quality === undefined)).toBe(true);
  });

  test("clearing with no per-tile quality changes nothing", () => {
    const state = two();
    expect(clearTileQualities(state)).toBe(state);
  });

  test("reconnecting gives the tile a new player key and keeps the rest", () => {
    const before = setTileQuality(two(), "k-fox", four);
    const after = reconnectTile(before, "k-fox");
    expect(tilePlayerKey(after.tiles[0])).not.toBe(
      tilePlayerKey(before.tiles[0]),
    );
    expect(tilePlayerKey(after.tiles[1])).toBe(tilePlayerKey(before.tiles[1]));
    expect(after.tiles[0].quality).toEqual(four);
    expect(after.audio).toBe(before.audio);
  });
});
