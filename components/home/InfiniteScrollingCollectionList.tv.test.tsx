import { render, screen } from "@testing-library/react-native";
import { makeItems } from "@/test-utils/baseItems";
import { JotaiQueryWrapper } from "@/test-utils/queryWrapper";
import { stubReactNative } from "@/test-utils/reactNative";

// The fakes the row's speed scenario gets from test-utils/perfSetup.ts.
jest.mock(
  "react-native-mmkv",
  () => jest.requireActual("@/test-utils/mmkv").mmkvModule,
);
jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
jest.mock(
  "react-native-reanimated",
  () => jest.requireActual("@/test-utils/reanimated").reanimatedModule,
);
jest.mock("react-native-device-info", () => ({}));
jest.mock("@gorhom/bottom-sheet", () =>
  jest.requireActual("@gorhom/bottom-sheet/mock"),
);
jest.mock("sonner-native", () => ({
  toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));
jest.mock("expo-notifications", () => ({
  scheduleNotificationAsync: jest.fn(),
}));
jest.mock(
  "@/providers/JellyfinProvider",
  () =>
    jest.requireActual("@/test-utils/jellyfinProvider").jellyfinProviderModule,
);
jest.mock(
  "@/utils/atoms/api",
  () => jest.requireActual("@/test-utils/jellyfinProvider").apiAtomsModule,
);
jest.mock(
  "expo-router",
  () => jest.requireActual("@/test-utils/expoRouter").expoRouterModule,
);
jest.mock(
  "expo-router/react-navigation",
  () => jest.requireActual("@/test-utils/expoRouter").reactNavigationModule,
);
jest.mock("@/modules", () => {
  const { viewStub } = jest.requireActual("@/test-utils/viewStub");
  return {
    HeroCarouselView: viewStub("hero-carousel"),
    isHeroCarouselAvailable: () => true,
    BackgroundDownloader: {
      addStartedListener: () => ({ remove: () => {} }),
      addProgressListener: () => ({ remove: () => {} }),
      addCompleteListener: () => ({ remove: () => {} }),
      addErrorListener: () => ({ remove: () => {} }),
      setLiveActivityEnabled: () => {},
    },
  };
});
jest.mock(
  "@/providers/NetworkStatusProvider",
  () => jest.requireActual("@/test-utils/appProviders").networkStatusModule,
);

stubReactNative({ isTV: true });

const {
  InfiniteScrollingCollectionList,
} = require("./InfiniteScrollingCollectionList.tv");

const items = makeItems(12);

// Fire TV, 2026-11-16, ADB and screenshots at a 1.5 s pace: ↑ from Home's
// "Suggested movies" skipped "Recently added in Shows" and landed on
// "Recently added in Movies". Android picked the next card by position alone,
// across rows scrolled sideways by different amounts. Each row is now a
// focus guide with autoFocus: ↑ and ↓ land on the row, which hands the focus
// to the card last used there, or the first (docs/tv-focus-guide.md).
beforeAll(() => {
  require("@/i18n");
});

describe("a Home poster row on TV", () => {
  test("is a focus guide that takes ↑ and ↓ as a whole row", async () => {
    await render(
      <InfiniteScrollingCollectionList
        title='Recently added in Movies'
        queryKey={["row-focus-test"]}
        queryFn={async () => items}
        pageSize={30}
      />,
      { wrapper: JotaiQueryWrapper },
    );
    await screen.findByText("Movie 0");

    const guide = screen.getByTestId("tv-row-focus-guide");
    expect(guide.props.autoFocus).toBe(true);

    // Every card in the row is inside it.
    let node = screen.getByText("Movie 0").parent;
    let inside = false;
    while (node) {
      if (node === guide) inside = true;
      node = node.parent;
    }
    expect(inside).toBe(true);
  });
});
