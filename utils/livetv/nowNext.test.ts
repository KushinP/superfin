import {
  channelNumber,
  currentProgramByChannel,
  nextProgramByChannel,
  programProgress,
} from "./nowNext";

const at = (hhmm: string) => Date.parse(`2026-11-03T${hhmm}:00Z`);
const iso = (hhmm: string) => new Date(at(hhmm)).toISOString();

describe("programProgress", () => {
  const show = { StartDate: iso("20:00"), EndDate: iso("21:00") };

  test("is how far the show has run", () => {
    expect(programProgress(show, at("20:15"))).toBeCloseTo(0.25);
  });

  test("is nothing before it starts or once it has ended", () => {
    expect(programProgress(show, at("19:59"))).toBeNull();
    expect(programProgress(show, at("21:00"))).toBeNull();
  });

  test("is nothing without usable times", () => {
    expect(
      programProgress({ StartDate: iso("20:00") }, at("20:15")),
    ).toBeNull();
    expect(
      programProgress({ StartDate: iso("21:00"), EndDate: iso("20:00") }, 0),
    ).toBeNull();
    expect(programProgress(null, at("20:15"))).toBeNull();
  });
});

describe("nextProgramByChannel", () => {
  test("picks each channel's earliest program after now", () => {
    const next = nextProgramByChannel(
      [
        { ChannelId: "a", Name: "Late", StartDate: iso("22:00") },
        { ChannelId: "a", Name: "Soon", StartDate: iso("21:00") },
        { ChannelId: "b", Name: "Only", StartDate: iso("20:30") },
      ],
      at("20:10"),
    );
    expect(next.get("a")?.Name).toBe("Soon");
    expect(next.get("b")?.Name).toBe("Only");
  });

  test("skips the program on now", () => {
    const next = nextProgramByChannel(
      [
        { ChannelId: "a", Name: "Current", StartDate: iso("20:00") },
        { ChannelId: "a", Name: "After", StartDate: iso("21:00") },
      ],
      at("20:10"),
    );
    expect(next.get("a")?.Name).toBe("After");
  });

  test("ignores programs with no channel or start", () => {
    expect(
      nextProgramByChannel(
        [{ Name: "x", StartDate: iso("21:00") }, { ChannelId: "a" }],
        at("20:00"),
      ).size,
    ).toBe(0);
    expect(nextProgramByChannel(undefined, 0).size).toBe(0);
  });
});

describe("currentProgramByChannel", () => {
  test("picks the program on now for each channel", () => {
    const current = currentProgramByChannel(
      [
        {
          ChannelId: "a",
          Name: "Before",
          StartDate: iso("19:00"),
          EndDate: iso("20:00"),
        },
        {
          ChannelId: "a",
          Name: "Now",
          StartDate: iso("20:00"),
          EndDate: iso("21:00"),
        },
        {
          ChannelId: "b",
          Name: "Also now",
          StartDate: iso("19:30"),
          EndDate: iso("20:30"),
        },
      ],
      at("20:10"),
    );
    expect(current.get("a")?.Name).toBe("Now");
    expect(current.get("b")?.Name).toBe("Also now");
  });

  test("a program that ends at now is over; one that starts at now is on", () => {
    const current = currentProgramByChannel(
      [
        {
          ChannelId: "a",
          Name: "Ended",
          StartDate: iso("19:00"),
          EndDate: iso("20:00"),
        },
        {
          ChannelId: "a",
          Name: "Started",
          StartDate: iso("20:00"),
          EndDate: iso("21:00"),
        },
      ],
      at("20:00"),
    );
    expect(current.get("a")?.Name).toBe("Started");
  });

  test("a channel with nothing on now has no entry", () => {
    const current = currentProgramByChannel(
      [
        {
          ChannelId: "a",
          StartDate: iso("21:00"),
          EndDate: iso("22:00"),
        },
        { ChannelId: "b", StartDate: iso("19:00") },
      ],
      at("20:00"),
    );
    expect(current.size).toBe(0);
    expect(currentProgramByChannel(undefined, 0).size).toBe(0);
  });
});

describe("channelNumber", () => {
  test("prefers the channel number, then the number", () => {
    expect(channelNumber({ ChannelNumber: "101", Number: "9" })).toBe("101");
    expect(channelNumber({ Number: "9" })).toBe("9");
    expect(channelNumber({})).toBeNull();
  });
});
