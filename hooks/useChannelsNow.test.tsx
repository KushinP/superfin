import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryWrapper } from "@/test-utils/queryWrapper";
import { useChannelsNow } from "./useChannelsNow";

const mockGetPrograms = jest.fn();

jest.mock("@/utils/atoms/api", () => ({ apiAtom: "apiAtom" }));
jest.mock("jotai", () => ({
  ...jest.requireActual("jotai"),
  useAtomValue: () => ({ basePath: "https://jf.example.com" }),
}));
jest.mock("@jellyfin/sdk/lib/utils/api", () => ({
  getLiveTvApi: () => ({ getPrograms: mockGetPrograms }),
}));

const NOW = new Date("2026-11-15T18:30:00Z");

describe("useChannelsNow", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ["nextTick", "setImmediate"] });
    mockGetPrograms.mockReset();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test("asks once for every channel's current program, with its overview", async () => {
    mockGetPrograms.mockResolvedValue({
      data: {
        Items: [
          {
            ChannelId: "ch-b",
            Name: "NFL Football",
            EpisodeTitle: "Chiefs at Falcons",
            StartDate: "2026-11-15T18:00:00Z",
            EndDate: "2026-11-15T21:00:00Z",
          },
        ],
      },
    });
    const { result } = await renderHook(
      () => useChannelsNow(["ch-b", "ch-a"]),
      { wrapper: QueryWrapper },
    );

    await waitFor(() =>
      expect(result.current.get("ch-b")?.EpisodeTitle).toBe(
        "Chiefs at Falcons",
      ),
    );
    expect(result.current.has("ch-a")).toBe(false);
    expect(mockGetPrograms).toHaveBeenCalledTimes(1);
    const dto = mockGetPrograms.mock.calls[0][0].getProgramsDto;
    expect(dto.ChannelIds).toEqual(["ch-a", "ch-b"]);
    expect(dto.MaxStartDate).toBe(NOW.toISOString());
    expect(dto.MinEndDate).toBe(NOW.toISOString());
    expect(dto.Fields).toEqual(["Overview"]);
  });

  test("asks nothing with no channels", async () => {
    const { result } = await renderHook(() => useChannelsNow([]), {
      wrapper: QueryWrapper,
    });
    expect(result.current.size).toBe(0);
    expect(mockGetPrograms).not.toHaveBeenCalled();
  });
});
