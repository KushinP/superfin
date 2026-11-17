// SuperFin's tabs on upstream's tab layout (app/(auth)/(tabs)/_layout.tsx):
// the Live TV tab and the Mac's sidebar. Spec:
// docs/specs/2026-11-16-upstream-catchup.md, checks A2, A4 and A13.
import { render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { stubReactNative } from "@/test-utils/reactNative";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock(
  "react-native-mmkv",
  () => jest.requireActual("@/test-utils/mmkv").mmkvModule,
);
jest.mock("@/components/tv/TVNavBar", () => ({ TVNavBar: () => null }));
// The unit config maps expo-router to a stub with no navigators; these tests
// sit on the Home tab and look only at the tab bar.
jest.mock("expo-router", () => ({
  ...jest.requireActual("@/test-utils/expoRouterModule"),
  Redirect: () => null,
  Stack: () => null,
  useSegments: () => ["(auth)", "(tabs)", "(home)"],
}));
jest.mock("@/utils/atoms/settings", () => ({
  useSettings: () => ({ settings: {} }),
}));
jest.mock("@/components/music/MiniPlayerBar", () => ({
  MiniPlayerBar: () => null,
}));
jest.mock("@/components/music/MusicPlaybackEngine", () => ({
  MusicPlaybackEngine: () => null,
}));
jest.mock("@/components/AppKeyCommands", () => ({
  AppKeyCommands: () => null,
}));
jest.mock("@/components/MacWindowSize", () => ({ MacWindowSize: () => null }));
jest.mock("@/components/MacSidebar", () => ({
  MacSidebar: () => {
    const { Text: MockText } = require("react-native");
    return <MockText testID='mac-sidebar'>sidebar</MockText>;
  },
}));
let mockLiveTv = false;
jest.mock("@/hooks/useLiveTvAvailable", () => ({
  useLiveTvAvailable: () => mockLiveTv,
}));
let mockMac = false;
jest.mock("@/utils/platform", () => ({
  isMac: () => mockMac,
  usesNativeSidebar: () => false,
}));

// The native tab bar is not in Jest: a stand-in that keeps the props the bar
// and each trigger were given.
const mockTriggers: Record<string, Record<string, unknown>> = {};
const mockBar: { props: Record<string, unknown> } = { props: {} };
jest.mock("expo-router/native-tabs", () => {
  const Trigger = ({
    children,
    ...props
  }: {
    name: string;
    children?: ReactNode;
  }) => {
    mockTriggers[props.name] = props;
    return null;
  };
  Trigger.Label = () => null;
  Trigger.Icon = () => null;
  const NativeTabs = ({ children, ...props }: { children?: ReactNode }) => {
    mockBar.props = props;
    return children;
  };
  NativeTabs.Trigger = Trigger;
  return { NativeTabs };
});

const renderTabs = async () => {
  const TabsLayout = jest.requireActual("@/app/(auth)/(tabs)/_layout").default;
  await render(<TabsLayout />);
};

beforeEach(() => {
  for (const name of Object.keys(mockTriggers)) delete mockTriggers[name];
  mockBar.props = {};
  mockLiveTv = false;
  mockMac = false;
  stubReactNative({ OS: "ios" });
});

describe("the Live TV tab", () => {
  test("shows when the server has Live TV", async () => {
    mockLiveTv = true;
    await renderTabs();
    expect(mockTriggers["(livetv)"]).toBeDefined();
    expect(mockTriggers["(livetv)"].hidden).toBe(false);
  });

  test("stays hidden without Live TV", async () => {
    await renderTabs();
    expect(mockTriggers["(livetv)"].hidden).toBe(true);
  });

  // The phone bar reads Home, Search, Live TV, Library, More: the TV-only
  // tabs between them are hidden there.
  test("sits between Search and Library", async () => {
    mockLiveTv = true;
    await renderTabs();
    const order = Object.keys(mockTriggers);
    expect(order.indexOf("(livetv)")).toBeGreaterThan(
      order.indexOf("(search)"),
    );
    expect(order.indexOf("(livetv)")).toBeLessThan(
      order.indexOf("(libraries)"),
    );
  });
});

describe("the Mac", () => {
  test("hides the tab bar and draws the sidebar", async () => {
    mockMac = true;
    await renderTabs();
    expect(mockBar.props.hidden).toBe(true);
    expect(screen.getByTestId("mac-sidebar")).toBeTruthy();
  });

  test("an iPhone or iPad keeps the tab bar, with no sidebar", async () => {
    await renderTabs();
    expect(mockBar.props.hidden).toBe(false);
    expect(screen.queryByTestId("mac-sidebar")).toBeNull();
  });
});
