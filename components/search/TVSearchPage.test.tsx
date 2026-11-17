import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { TVSearchPage } from "./TVSearchPage";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("@/providers/JellyfinProvider", () => {
  const { atom } = jest.requireActual("jotai");
  return { apiAtom: atom({ basePath: "http://server" }) };
});
// The real module drags the whole settings UI in; the TV sizes only read this.
jest.mock("@/utils/atoms/settings", () => ({
  TVTypographyScale: {
    Small: "small",
    Default: "default",
    Large: "large",
    ExtraLarge: "extraLarge",
  },
  useSettings: () => ({ settings: { tvTypographyScale: "default" } }),
}));
// A poster is its name and its two presses here; its artwork, its glass and
// its focus animation need the native side.
jest.mock("@/components/tv/TVPosterCard", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    TVPosterCard: ({ item, onPress, onLongPress }: any) => (
      <Pressable onPress={onPress} onLongPress={onLongPress}>
        <Text>{item.Name}</Text>
      </Pressable>
    ),
  };
});
jest.mock("@/components/common/ServerImage", () => ({ Image: () => null }));
// The native search field and the Discover rows are not what is under test.
jest.mock("@/modules/tv-search", () => ({ TvSearchView: () => null }));
jest.mock("@/components/seerr/discover/TVDiscover", () => ({
  TVDiscover: () => null,
}));
jest.mock("./TVSeerrSearchResults", () => ({
  TVSeerrSearchResults: () => null,
}));
jest.mock("./TVSearchTabBadges", () => ({ TVSearchTabBadges: () => null }));

const studio: BaseItemDto = { Id: "studio-1", Type: "Studio", Name: "Pixar" };
const actor: BaseItemDto = { Id: "person-1", Type: "Person", Name: "Tom" };

const renderPage = async (
  results: { studios?: BaseItemDto[]; actors?: BaseItemDto[] },
  onItemPress = jest.fn(),
  onItemLongPress = jest.fn(),
) => {
  await render(
    <TVSearchPage
      search='pix'
      setSearch={() => {}}
      debouncedSearch='pix'
      {...results}
      loading={false}
      noResults={false}
      onItemPress={onItemPress}
      onItemLongPress={onItemLongPress}
      searchType='Library'
      setSearchType={() => {}}
      showDiscover={false}
    />,
  );
  return { onItemPress, onItemLongPress };
};

describe("TV search studios", () => {
  test("lists the studios in a section of their own and opens one", async () => {
    const { onItemPress } = await renderPage({ studios: [studio] });

    expect(screen.getByText("search.studios")).toBeTruthy();
    await fireEvent.press(screen.getByText("Pixar"));
    expect(onItemPress).toHaveBeenCalledWith(studio);
  });

  test("shows no studios section when the search found none", async () => {
    await renderPage({ studios: [], actors: [actor] });

    expect(screen.queryByText("search.studios")).toBeNull();
    expect(screen.getByText("search.actors")).toBeTruthy();
  });

  // The long press marks an item played, which means nothing for a studio.
  test("offers the long press on a person but not on a studio", async () => {
    const { onItemLongPress } = await renderPage({
      studios: [studio],
      actors: [actor],
    });

    await fireEvent(screen.getByText("Pixar"), "longPress");
    expect(onItemLongPress).not.toHaveBeenCalled();

    await fireEvent(screen.getByText("Tom"), "longPress");
    expect(onItemLongPress).toHaveBeenCalledWith(actor);
  });
});

// Fire TV, 2026-11-16, with ADB: the search box took the focus as a bare text
// field in typing mode, and ↓ and → stayed in it, so Library / Discover and
// the rows below couldn't be reached; only Back got out. On Android TV it is
// now the login screen's field: a focusable box that types only once it's
// pressed, which the D-pad can leave.
describe("TV search box on Android TV", () => {
  const { Platform } = jest.requireActual("react-native");
  const wasOS = Platform.OS;
  beforeEach(() => {
    Object.defineProperty(Platform, "OS", {
      value: "android",
      configurable: true,
    });
  });
  afterEach(() => {
    Object.defineProperty(Platform, "OS", { value: wasOS, configurable: true });
  });

  test("the text field isn't focusable on its own: its box takes the focus", async () => {
    await renderPage({});
    const field = screen.getByPlaceholderText("search.search");

    expect(field.props.focusable).not.toBe(true);
    let node = field.parent;
    let boxFocusable = false;
    while (node) {
      if (node.props?.focusable === true) boxFocusable = true;
      node = node.parent;
    }
    expect(boxFocusable).toBe(true);
  });

  test("typing still searches", async () => {
    const setSearch = jest.fn();
    await render(
      <TVSearchPage
        search=''
        setSearch={setSearch}
        debouncedSearch=''
        loading={false}
        noResults={false}
        onItemPress={jest.fn()}
        onItemLongPress={jest.fn()}
        searchType='Library'
        setSearchType={() => {}}
        showDiscover={false}
      />,
    );
    await fireEvent.changeText(
      screen.getByPlaceholderText("search.search"),
      "pix",
    );
    expect(setSearch).toHaveBeenCalledWith("pix");
  });
});
