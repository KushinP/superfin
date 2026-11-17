import { BITRATES } from "@/components/BitrateSelector";
import { DEFAULT_MULTIVIEW_BITRATE, tileMaxBitrate } from "./tileBitrate";

// BITRATES lives in the selector, whose dropdown loads native code.
jest.mock("@/components/PlatformDropdown", () => ({
  PlatformDropdown: () => null,
}));

describe("tileMaxBitrate", () => {
  test("caps a tile at 8 Mb/s until the user picks otherwise", () => {
    // Live channels arrive at the broadcast's full rate (15 to 19 Mb/s for
    // over-the-air MPEG-2) and stalled side by side on a Fire TV.
    expect(DEFAULT_MULTIVIEW_BITRATE.value).toBe(8_000_000);
    expect(tileMaxBitrate({})).toBe(8_000_000);
  });

  test("follows the multiview quality the user chose", () => {
    const four = BITRATES.find((b) => b.key === "4 Mb/s");
    expect(tileMaxBitrate({ multiviewMaxBitrate: four })).toBe(4_000_000);
  });

  test("Max lifts the cap", () => {
    expect(
      tileMaxBitrate({ multiviewMaxBitrate: BITRATES[0] }),
    ).toBeUndefined();
  });

  test("ignores the full player's quality", () => {
    const one = BITRATES.find((b) => b.key === "1 Mb/s");
    expect(tileMaxBitrate({ defaultBitrate: one })).toBe(8_000_000);
  });

  test("its default is one of the choices the settings offer", () => {
    expect(BITRATES).toContainEqual(
      expect.objectContaining(DEFAULT_MULTIVIEW_BITRATE),
    );
  });
});

describe("tileMaxBitrate with a tile's own quality", () => {
  test("a tile's own quality wins over the setting", () => {
    expect(
      tileMaxBitrate(
        { multiviewMaxBitrate: { key: "Max", value: undefined } },
        { key: "4 Mb/s", value: 4_000_000 },
      ),
    ).toBe(4_000_000);
  });

  test("a tile set to Max streams uncapped even under a capped setting", () => {
    expect(
      tileMaxBitrate(
        { multiviewMaxBitrate: { key: "4 Mb/s", value: 4_000_000 } },
        { key: "Max", value: undefined },
      ),
    ).toBeUndefined();
  });
});

// Upstream's Auto quality measures the connection for one player; four tiles
// share that connection, so a tile never streams at Auto
// (docs/specs/2026-11-16-upstream-catchup-plan.md, section 2, step 3).
describe("tileMaxBitrate and Auto", () => {
  const { AUTO_BITRATE } = jest.requireActual("@/utils/bitrate");

  test("the full player's Auto default does not reach a tile", () => {
    expect(tileMaxBitrate({ defaultBitrate: AUTO_BITRATE })).toBe(
      DEFAULT_MULTIVIEW_BITRATE.value,
    );
  });

  test("an Auto that reaches the setting or a tile is the tile cap", () => {
    expect(tileMaxBitrate({ multiviewMaxBitrate: AUTO_BITRATE })).toBe(
      DEFAULT_MULTIVIEW_BITRATE.value,
    );
    expect(tileMaxBitrate({}, AUTO_BITRATE)).toBe(
      DEFAULT_MULTIVIEW_BITRATE.value,
    );
  });
});
