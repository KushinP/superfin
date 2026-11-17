// Spec for app/(auth)/(tabs)/(home,libraries,search,more,tv-favorites,tv-watchlists,livetv)/livetv/guide.tsx.
// It lives here rather than next to the page because Expo Router turns every
// file under app/ into a route.
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import LiveTvGuidePage from "@/app/(auth)/(tabs)/(home,libraries,search,more,tv-favorites,tv-watchlists,livetv)/livetv/guide";
import { apiAtom } from "@/providers/JellyfinProvider";
import { makeApi } from "@/test-utils/jellyfinApi";

jest.mock("@/providers/JellyfinProvider", () => {
  const { atom } = jest.requireActual("jotai");
  return {
    apiAtom: atom(null),
    userAtom: atom({ Id: "user-1" }),
  };
});
jest.mock(
  "react-native-reanimated",
  () => jest.requireActual("@/test-utils/reanimated").reanimatedModule,
);
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/components/common/ItemImage", () => ({ ItemImage: () => null }));
// The row layout is not what is under test; a channel shows up as the names
// of its programs.
jest.mock("@/components/livetv/LiveTVGuideRow", () => ({
  LiveTVGuideRow: ({
    channel,
    programs,
  }: {
    channel: BaseItemDto;
    programs?: BaseItemDto[] | null;
  }) => {
    const { Text: RowText } = jest.requireActual("react-native");
    return programs
      ?.filter((program) => program.ChannelId === channel.Id)
      .map((program) => <RowText key={program.Id}>{program.Name}</RowText>);
  },
}));

const CHANNELS = {
  Items: [{ Id: "channel-1", Name: "One", Type: "TvChannel" }],
  TotalRecordCount: 1,
};
const PROGRAMS = {
  Items: [{ Id: "program-1", Name: "Evening News", ChannelId: "channel-1" }],
};

const guideApi = () => {
  const api = makeApi();
  // The SDK writes the query into the url.
  api.mock.onGet(/\/LiveTv\/Channels\?/).reply(200, CHANNELS);
  api.mock.onPost(/\/LiveTv\/Programs$/).reply(200, PROGRAMS);
  return api;
};

/** Lets the responses to requests already sent render before a test ends. */
const settle = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, 0)));

const renderGuide = async (seed?: (client: QueryClient) => void) => {
  /** What the app's own query cache would have handed to Sentry. */
  const errors: Error[] = [];
  // No garbage collection timer nor retry: either keeps Jest from exiting.
  const client = new QueryClient({
    queryCache: new QueryCache({ onError: (error) => errors.push(error) }),
    defaultOptions: {
      queries: { gcTime: Number.POSITIVE_INFINITY, retry: false },
    },
  });
  seed?.(client);
  const store = createStore();
  await render(
    <QueryClientProvider client={client}>
      <JotaiProvider store={store}>
        <LiveTvGuidePage />
      </JotaiProvider>
    </QueryClientProvider>,
  );
  // Lets a query that started on mount settle.
  await act(async () => {});
  return { store, errors };
};

describe("LiveTvGuidePage", () => {
  // Sentry REACT-NATIVE-FG: the guide mounted before the api was restored and
  // handed the null api to the SDK, which threw "Cannot read property
  // 'configuration' of null".
  test("does not ask for the channels before the api is there", async () => {
    const { errors } = await renderGuide();

    expect(errors).toEqual([]);
  });

  // The app persists its query cache, so the channels can be there from the
  // last launch while the api is not: the programs wait for both. The query
  // key does not carry the api, so programs settled without one never load.
  test("loads the programs of restored channels only once the api is there", async () => {
    const api = guideApi();
    const { store, errors } = await renderGuide((client) =>
      client.setQueryData(["livetv", "guide", "channels"], {
        pages: [CHANNELS],
        pageParams: [0],
      }),
    );

    expect(errors).toEqual([]);

    await act(async () => store.set(apiAtom, api));

    await waitFor(() => expect(screen.getByText("Evening News")).toBeTruthy());
    expect(api.mock.history.post).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test("loads the channels, then their programs, once the api arrives", async () => {
    const api = guideApi();
    const { store, errors } = await renderGuide();

    await act(async () => store.set(apiAtom, api));

    await waitFor(() => expect(screen.getByText("Evening News")).toBeTruthy());
    expect(api.mock.history.get).toHaveLength(1);
    expect(api.mock.history.get[0].url).toContain("userId=user-1");
    expect(api.mock.history.post).toHaveLength(1);
    expect(JSON.parse(api.mock.history.post[0].data)).toMatchObject({
      ChannelIds: ["channel-1"],
    });
    expect(errors).toEqual([]);
  });

  describe("with the clock at 20:15", () => {
    const NOW = new Date(2026, 10, 3, 20, 15).getTime();
    beforeEach(() => jest.spyOn(Date, "now").mockReturnValue(NOW));
    afterEach(() => jest.restoreAllMocks());

    test("asks for the whole of today and draws the now line", async () => {
      const api = guideApi();
      const { store } = await renderGuide();
      await act(async () => store.set(apiAtom, api));

      await waitFor(() => expect(api.mock.history.post).toHaveLength(1));
      expect(JSON.parse(api.mock.history.post[0].data)).toMatchObject({
        // The day, not the window: the window moves on every hour, and a
        // query keyed on it emptied every row until the refetch landed.
        MinEndDate: new Date(2026, 10, 3).toISOString(),
        MaxStartDate: new Date(2026, 10, 4).toISOString(),
      });
      // A quarter of the way into the first hour.
      expect(screen.getByTestId("guide-now-line")).toHaveStyle({ left: 50 });
      await settle();
    });

    test("another day's chip asks for that whole day, with no now line", async () => {
      const api = guideApi();
      const { store } = await renderGuide();
      await act(async () => store.set(apiAtom, api));
      await waitFor(() => expect(api.mock.history.post).toHaveLength(1));

      // The second chip is tomorrow; its label is the locale's weekday.
      await act(async () => fireEvent.press(screen.getAllByRole("button")[1]));

      await waitFor(() => expect(api.mock.history.post).toHaveLength(2));
      expect(JSON.parse(api.mock.history.post[1].data)).toMatchObject({
        MinEndDate: new Date(2026, 10, 4).toISOString(),
        MaxStartDate: new Date(2026, 10, 5).toISOString(),
      });
      expect(screen.queryByTestId("guide-now-line")).toBeNull();
      await settle();
    });
  });

  // Reported: the guide showed 20 channels a page behind Next/Previous
  // buttons. It now loads the next channels as it nears the bottom.
  test("loads more channels when scrolled near the bottom", async () => {
    const api = makeApi();
    const page = (from: number, count: number) => ({
      Items: Array.from({ length: count }, (_, i) => ({
        Id: `channel-${from + i}`,
        Name: `Channel ${from + i}`,
        Type: "TvChannel",
      })),
    });
    api.mock
      .onGet(/\/LiveTv\/Channels\?.*startIndex=0/)
      .reply(200, page(0, 50))
      .onGet(/\/LiveTv\/Channels\?.*startIndex=50/)
      .reply(200, page(50, 3));
    api.mock.onPost(/\/LiveTv\/Programs$/).reply(200, { Items: [] });
    const { store } = await renderGuide();
    await act(async () => store.set(apiAtom, api));
    // The first page is on screen once its programs are asked for.
    await waitFor(() => expect(api.mock.history.post).toHaveLength(1));

    await act(async () =>
      fireEvent.scroll(screen.getByTestId("guide-scroll"), {
        nativeEvent: {
          contentOffset: { y: 2800, x: 0 },
          contentSize: { height: 3300, width: 400 },
          layoutMeasurement: { height: 400, width: 400 },
        },
      }),
    );

    await waitFor(() => expect(api.mock.history.get).toHaveLength(2));
    expect(api.mock.history.get[1].url).toContain("startIndex=50");
    await waitFor(() => expect(api.mock.history.post).toHaveLength(2));
    expect(JSON.parse(api.mock.history.post[1].data).ChannelIds).toEqual([
      "channel-50",
      "channel-51",
      "channel-52",
    ]);
    await settle();
  });
});
