import { fireEvent, render, screen } from "@testing-library/react-native";
import { MacSidebar } from "./MacSidebar";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("@/utils/atoms/api", () => ({
  apiAtom: require("jotai").atom({}),
  userAtom: require("jotai").atom({ Id: "user" }),
}));
jest.mock("@/components/common/TouchableItemRouter", () => ({
  itemRouter: (item: { Id: string }) => `/(auth)/(tabs)/(libraries)/${item.Id}`,
}));
jest.mock("@/components/library/LibraryItemCard", () => ({
  libraryIcons: { movies: "film" },
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: [
      { Id: "movies", Name: "Movies", CollectionType: "movies" },
      { Id: "books", Name: "Books", CollectionType: "books" },
      { Id: "live", Name: "Live TV", CollectionType: "livetv" },
    ],
  }),
}));
jest.mock("@/hooks/useLiveTvAvailable", () => ({
  useLiveTvAvailable: () => true,
}));
const mockRouter = { navigate: jest.fn(), push: jest.fn() };
jest.mock("@/hooks/useAppRouter", () => ({
  __esModule: true,
  default: () => mockRouter,
}));
let mockSegments = ["(auth)", "(tabs)", "(home)"];
let mockPathname = "/";
jest.mock("expo-router", () => ({
  useSegments: () => mockSegments,
  usePathname: () => mockPathname,
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => `t:${key}` }),
}));
jest.mock("@/utils/atoms/settings", () => ({
  useSettings: () => ({ settings: { showCustomMenuLinks: true } }),
}));
const mockEmit = jest.fn();
jest.mock("@/utils/eventBus", () => ({
  eventBus: { emit: (name: string) => mockEmit(name) },
}));

describe("MacSidebar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSegments = ["(auth)", "(tabs)", "(home)"];
    mockPathname = "/";
  });

  test("lists the libraries, without books, and opens one", async () => {
    await render(<MacSidebar />);
    expect(screen.getByText("t:mac_sidebar.libraries")).toBeTruthy();
    expect(screen.queryByText("Books")).toBeNull();
    // Live TV is a section of its own, not a library row.
    expect(screen.queryByTestId("mac-sidebar-library-live")).toBeNull();
    expect(screen.getByTestId("mac-sidebar-livetv")).toBeTruthy();
    fireEvent.press(screen.getByTestId("mac-sidebar-library-movies"));
    expect(mockRouter.navigate).toHaveBeenCalledWith(
      "/(auth)/(tabs)/(libraries)/movies",
    );
  });

  test("an open library is marked instead of the Library tab", async () => {
    mockSegments = ["(auth)", "(tabs)", "(libraries)", "[libraryId]"];
    mockPathname = "/movies";
    await render(<MacSidebar />);
    expect(
      screen.getByTestId("mac-sidebar-library-movies").props.accessibilityState,
    ).toEqual({ selected: true });
    expect(
      screen.getByTestId("mac-sidebar-libraries").props.accessibilityState,
    ).toEqual({ selected: false });
  });

  test("lists the tabs and marks the one on screen", async () => {
    await render(<MacSidebar />);
    expect(screen.getByText("t:tabs.home")).toBeTruthy();
    // Upstream took Custom links out of the TV bar; the Mac follows it.
    expect(screen.queryByText("t:tabs.custom_links")).toBeNull();
    expect(
      screen.getByTestId("mac-sidebar-home").props.accessibilityState,
    ).toEqual({ selected: true });
    expect(
      screen.getByTestId("mac-sidebar-search").props.accessibilityState,
    ).toEqual({ selected: false });
  });

  test("a section opens its tab", async () => {
    await render(<MacSidebar />);
    fireEvent.press(screen.getByTestId("mac-sidebar-libraries"));
    expect(mockRouter.navigate).toHaveBeenCalledWith(
      "/(auth)/(tabs)/(libraries)",
    );
  });

  test("Home again scrolls it to the top, as the tab bar's tab does", async () => {
    await render(<MacSidebar />);
    fireEvent.press(screen.getByTestId("mac-sidebar-home"));
    expect(mockEmit).toHaveBeenCalledWith("scrollToTop");
  });

  // Favorites lives in More's stack now; the sidebar marks its own row, not
  // Watchlists, which shares the group.
  test("Favorites opens inside More and is marked there", async () => {
    mockSegments = ["(auth)", "(tabs)", "(more)", "favorites"];
    await render(<MacSidebar />);
    expect(
      screen.getByTestId("mac-sidebar-favorites").props.accessibilityState,
    ).toEqual({ selected: true });
    expect(
      screen.getByTestId("mac-sidebar-home").props.accessibilityState,
    ).toEqual({ selected: false });
  });

  test("a section in More opens its page", async () => {
    await render(<MacSidebar />);
    fireEvent.press(screen.getByTestId("mac-sidebar-favorites"));
    expect(mockRouter.navigate).toHaveBeenCalledWith(
      "/(auth)/(tabs)/(more)/favorites",
    );
  });

  test("Settings opens the settings screen", async () => {
    await render(<MacSidebar />);
    fireEvent.press(screen.getByTestId("mac-sidebar-settings"));
    expect(mockRouter.push).toHaveBeenCalledWith("/(auth)/settings");
  });
});
