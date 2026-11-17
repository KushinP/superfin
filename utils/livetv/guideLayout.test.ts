import {
  guideDays,
  guideHours,
  guideWindow,
  nowLineOffset,
  programBlocks,
} from "./guideLayout";

// Local times: the guide lays out a day as the viewer's clock reads it.
const at = (day: number, hh: number, mm = 0) =>
  new Date(2026, 10, day, hh, mm).getTime();
const iso = (day: number, hh: number, mm = 0) =>
  new Date(at(day, hh, mm)).toISOString();

const PX = 200;

describe("guideWindow", () => {
  test("today starts at the top of the current hour", () => {
    const now = at(3, 20, 15);
    const window = guideWindow(new Date(now), now);
    expect(window.start).toBe(at(3, 20));
    expect(window.end).toBe(at(4, 0));
  });

  // Reported: in India the guide started at 14:30 and labelled every hour
  // at :30, because the hour was rounded in UTC.
  test("starts at the local hour in a zone half an hour off UTC", () => {
    const previous = process.env.TZ;
    process.env.TZ = "Asia/Kolkata";
    try {
      const now = new Date(2026, 10, 3, 14, 40).getTime();
      const start = new Date(guideWindow(new Date(now), now).start);
      expect([start.getHours(), start.getMinutes()]).toEqual([14, 0]);
    } finally {
      process.env.TZ = previous;
    }
  });

  test("another day runs from midnight to midnight", () => {
    const window = guideWindow(new Date(at(4, 9)), at(3, 20, 15));
    expect(window.start).toBe(at(4, 0));
    expect(window.end).toBe(at(5, 0));
  });
});

describe("programBlocks", () => {
  const window = { start: at(3, 20), end: at(4, 0) };

  // Reported: blocks were laid end to end from the left edge, so a channel
  // whose first program starts at 21:00 drew it under the 20:00 label.
  test("places a program by its start time, not after the one before", () => {
    const blocks = programBlocks(
      [
        {
          Id: "late",
          ChannelId: "a",
          StartDate: iso(3, 21),
          EndDate: iso(3, 22),
        },
      ],
      "a",
      window,
      PX,
    );
    expect(blocks).toEqual([expect.objectContaining({ left: PX, width: PX })]);
  });

  test("leaves the gap a channel has between programs", () => {
    const blocks = programBlocks(
      [
        { Id: "1", ChannelId: "a", StartDate: iso(3, 20), EndDate: iso(3, 21) },
        {
          Id: "2",
          ChannelId: "a",
          StartDate: iso(3, 22),
          EndDate: iso(3, 22, 30),
        },
      ],
      "a",
      window,
      PX,
    );
    expect(blocks.map(({ left, width }) => [left, width])).toEqual([
      [0, PX],
      [2 * PX, PX / 2],
    ]);
  });

  test("cuts a program that began before the window at its left edge", () => {
    const [block] = programBlocks(
      [
        {
          Id: "1",
          ChannelId: "a",
          StartDate: iso(3, 19, 30),
          EndDate: iso(3, 20, 30),
        },
      ],
      "a",
      window,
      PX,
    );
    expect(block).toMatchObject({ left: 0, width: PX / 2 });
  });

  test("cuts one that runs past midnight at the right edge", () => {
    const [block] = programBlocks(
      [
        {
          Id: "1",
          ChannelId: "a",
          StartDate: iso(3, 23, 30),
          EndDate: iso(4, 1),
        },
      ],
      "a",
      window,
      PX,
    );
    expect(block).toMatchObject({ left: 3.5 * PX, width: PX / 2 });
  });

  test("keeps only the channel's programs inside the window, in order", () => {
    const blocks = programBlocks(
      [
        { Id: "b", ChannelId: "b", StartDate: iso(3, 20), EndDate: iso(3, 21) },
        { Id: "y", ChannelId: "a", StartDate: iso(3, 22), EndDate: iso(3, 23) },
        { Id: "x", ChannelId: "a", StartDate: iso(3, 20), EndDate: iso(3, 21) },
        {
          Id: "gone",
          ChannelId: "a",
          StartDate: iso(3, 18),
          EndDate: iso(3, 19),
        },
        { Id: "no-end", ChannelId: "a", StartDate: iso(3, 21) },
      ],
      "a",
      window,
      PX,
    );
    expect(blocks.map((block) => block.program.Id)).toEqual(["x", "y"]);
  });

  test("is nothing without programs", () => {
    expect(programBlocks(undefined, "a", window, PX)).toEqual([]);
  });
});

describe("nowLineOffset", () => {
  const window = { start: at(3, 20), end: at(4, 0) };

  test("is where the clock is inside the window", () => {
    expect(nowLineOffset(at(3, 20, 15), window, PX)).toBe(PX / 4);
  });

  test("is nothing on another day", () => {
    expect(nowLineOffset(at(4, 1), window, PX)).toBeNull();
    expect(nowLineOffset(at(3, 19), window, PX)).toBeNull();
  });
});

describe("guideHours", () => {
  test("is one label per hour of the window", () => {
    const hours = guideHours({ start: at(3, 21), end: at(4, 0) });
    expect(hours.map((hour) => hour.getHours())).toEqual([21, 22, 23]);
  });
});

describe("guideDays", () => {
  test("is today and the days after it, each at midnight", () => {
    const days = guideDays(at(3, 20, 15), 3);
    expect(days.map((day) => day.getTime())).toEqual([
      at(3, 0),
      at(4, 0),
      at(5, 0),
    ]);
  });
});

// Upstream's clock-change cases (components/livetv/HourHeader.test.ts, #2448),
// on SuperFin's own guide. The suite runs in New York's time zone
// (test-utils/timeZone.ts), where the clocks went from 2:00 to 3:00 on
// 8 March 2026 and back on 1 November.
describe("guideHours on the days the clocks change", () => {
  const otherDay = new Date(2026, 0, 1).getTime();
  const hoursOf = (day: Date) =>
    guideHours(guideWindow(day, otherDay)).map((hour) => hour.getHours());

  test("skips the hour the clocks skip, without a second 3:00", () => {
    const hours = hoursOf(new Date(2026, 2, 8));
    expect(hours.slice(0, 4)).toEqual([0, 1, 3, 4]);
    expect(hours).toHaveLength(23);
  });

  test("shows the hour the clocks repeat twice", () => {
    const hours = hoursOf(new Date(2026, 10, 1));
    expect(hours.slice(0, 4)).toEqual([0, 1, 1, 2]);
    expect(hours).toHaveLength(25);
  });

  test("keeps one elapsed hour between cells", () => {
    const times = guideHours(guideWindow(new Date(2026, 2, 8), otherDay)).map(
      (hour) => hour.getTime(),
    );
    expect(new Set(times.slice(1).map((t, i) => t - times[i]))).toEqual(
      new Set([3_600_000]),
    );
  });
});
