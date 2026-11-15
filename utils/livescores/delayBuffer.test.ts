import {
  addSnapshot,
  clampDelaySeconds,
  delayedSnapshot,
  type Snapshot,
} from "./delayBuffer";

const at = (seconds: number) => 1_000_000 + seconds * 1000;
const snap = (seconds: number, data: string): Snapshot<string> => ({
  fetchedAt: at(seconds),
  data,
});

describe("delayedSnapshot", () => {
  const buffer = [snap(0, "BUF 14"), snap(15, "BUF 14"), snap(30, "BUF 21")];

  // A2: the touchdown arrives at :30; with a 30 s delay it shows at 1:00.
  test("shows the old score one second before the delay has passed", () => {
    expect(delayedSnapshot(buffer, at(59), 30_000)?.data).toBe("BUF 14");
  });

  test("shows the new score once the delay has passed", () => {
    expect(delayedSnapshot(buffer, at(60), 30_000)?.data).toBe("BUF 21");
  });

  test("shows nothing until the first fetch is old enough", () => {
    expect(delayedSnapshot(buffer, at(29), 30_000)).toBeNull();
    expect(delayedSnapshot([], at(100), 30_000)).toBeNull();
  });

  test("with no delay, shows the newest", () => {
    expect(delayedSnapshot(buffer, at(30), 0)?.data).toBe("BUF 21");
  });
});

describe("addSnapshot", () => {
  test("keeps snapshots oldest first, whatever order they arrive in", () => {
    const buffer = addSnapshot([snap(30, "b")], snap(15, "a"), at(30), 30_000);
    expect(buffer.map((s) => s.data)).toEqual(["a", "b"]);
  });

  test("drops what can never be shown again, keeping the one on screen", () => {
    let buffer: Snapshot<string>[] = [];
    for (const s of [0, 15, 30, 45, 60, 75]) {
      buffer = addSnapshot(buffer, snap(s, `t${s}`), at(s), 30_000);
    }
    // At 1:15 with a 30 s delay, 0:45 is on screen; 0:00 to 0:30 are gone.
    expect(buffer.map((s) => s.data)).toEqual(["t45", "t60", "t75"]);
    expect(delayedSnapshot(buffer, at(75), 30_000)?.data).toBe("t45");
  });

  test("never holds more than the cap, dropping the oldest", () => {
    let buffer: Snapshot<string>[] = [];
    for (let s = 0; s < 30; s++) {
      buffer = addSnapshot(buffer, snap(s, `t${s}`), at(s), 90_000, 20);
    }
    expect(buffer).toHaveLength(20);
    expect(buffer[19].data).toBe("t29");
  });

  test("does not change the buffer it was given", () => {
    const original = [snap(0, "a")];
    addSnapshot(original, snap(15, "b"), at(15), 30_000);
    expect(original).toHaveLength(1);
  });
});

describe("clampDelaySeconds", () => {
  test.each([
    [30, 30],
    [33, 35],
    [32, 30],
    [-10, 0],
    [200, 90],
    [Number.NaN, 30],
  ])("%p becomes %p", (input, expected) => {
    expect(clampDelaySeconds(input)).toBe(expected);
  });
});
