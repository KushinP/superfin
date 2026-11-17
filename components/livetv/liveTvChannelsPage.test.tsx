// Spec for app/(auth)/(tabs)/(home,libraries,search,more,tv-favorites,tv-watchlists,livetv)/livetv/channels.tsx.
// It lives here rather than next to the page because Expo Router turns every
// file under app/ into a route.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import LiveTvChannelsPage from "@/app/(auth)/(tabs)/(home,libraries,search,more,tv-favorites,tv-watchlists,livetv)/livetv/channels";
import { apiAtom } from "@/providers/JellyfinProvider";
import { makeApi } from "@/test-utils/jellyfinApi";

jest.mock("@/providers/JellyfinProvider", () => {
  const { atom } = jest.requireActual("jotai");
  return {
    apiAtom: atom(null),
    userAtom: atom({ Id: "user-1" }),
  };
});
// The now/next hook reads the same atoms from their own module.
jest.mock("@/utils/atoms/api", () =>
  jest.requireMock("@/providers/JellyfinProvider"),
);
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      values ? `${key} ${Object.values(values).join(" | ")}` : key,
  }),
}));
jest.mock("@/components/common/ItemImage", () => ({ ItemImage: () => null }));
const mockPush = jest.fn();
jest.mock("@/hooks/useAppRouter", () => ({
  __esModule: true,
  default: () => ({ push: mockPush }),
}));
const mockPlay = jest.fn();
jest.mock("@/hooks/usePlayMedia", () => ({ usePlayMedia: () => mockPlay }));

const NOW = Date.parse("2026-11-03T20:15:00Z");
const iso = (hhmm: string) => `2026-11-03T${hhmm}:00.000Z`;

const CHANNELS = {
  Items: [
    {
      Id: "news",
      Name: "Northline News",
      Type: "TvChannel",
      ChannelNumber: "101",
      UserData: { IsFavorite: true },
      CurrentProgram: {
        Name: "Evening Bulletin",
        StartDate: iso("20:00"),
        EndDate: iso("21:00"),
      },
    },
    {
      Id: "sport",
      Name: "Arena Sports",
      Type: "TvChannel",
      UserData: { IsFavorite: false },
    },
  ],
  TotalRecordCount: 2,
};
const PROGRAMS = {
  Items: [
    {
      Id: "p1",
      ChannelId: "news",
      Name: "World Tonight",
      StartDate: iso("21:00"),
    },
  ],
};

const renderPage = async () => {
  const api = makeApi();
  api.mock.onGet(/\/LiveTv\/Channels\?/).reply(200, CHANNELS);
  api.mock.onPost(/\/LiveTv\/Programs$/).reply(200, PROGRAMS);
  const client = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Number.POSITIVE_INFINITY, retry: false },
    },
  });
  const store = createStore();
  store.set(apiAtom as never, api as never);
  await render(
    <QueryClientProvider client={client}>
      <JotaiProvider store={store}>
        <LiveTvChannelsPage />
      </JotaiProvider>
    </QueryClientProvider>,
  );
  await act(async () => {});
  return { api, client };
};

describe("LiveTvChannelsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, "now").mockReturnValue(NOW);
  });
  afterEach(() => jest.restoreAllMocks());

  test("shows what is on now and next on each channel", async () => {
    const { api, client } = await renderPage();
    await waitFor(() =>
      expect(screen.getByText("Evening Bulletin")).toBeTruthy(),
    );
    expect(screen.getByText("101")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByText(/live_tv\.next_at .*World Tonight/)).toBeTruthy(),
    );
    // The current program rides along with the channels.
    expect(api.mock.history.get[0].url).toContain("addCurrentProgram=true");
    expect(JSON.parse(api.mock.history.post[0].data)).toMatchObject({
      ChannelIds: ["news", "sport"],
    });
    expect(screen.getAllByTestId("channel-progress")).toHaveLength(1);
    client.clear();
  });

  test("tapping a channel plays it", async () => {
    // Reported: the rows did nothing when tapped.
    const { client } = await renderPage();
    await waitFor(() => expect(screen.getByText("Arena Sports")).toBeTruthy());
    fireEvent.press(screen.getByText("Arena Sports"));
    expect(mockPlay).toHaveBeenCalledWith(
      { itemId: "sport", offline: false },
      expect.objectContaining({
        item: expect.objectContaining({ Id: "sport" }),
      }),
    );
    client.clear();
  });

  test("the Favorites filter shows only favourite channels", async () => {
    const { client } = await renderPage();
    await waitFor(() => expect(screen.getByText("Arena Sports")).toBeTruthy());
    fireEvent.press(screen.getByText("live_tv.filter_favorites"));
    await waitFor(() => expect(screen.queryByText("Arena Sports")).toBeNull());
    expect(screen.getByText("Northline News")).toBeTruthy();
    client.clear();
  });

  test("the Multiview chip opens multiview", async () => {
    const { client } = await renderPage();
    fireEvent.press(screen.getByLabelText("multiview.open"));
    expect(mockPush).toHaveBeenCalledWith("/multiview");
    client.clear();
  });
});
