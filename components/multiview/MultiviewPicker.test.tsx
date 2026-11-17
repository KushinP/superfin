import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { QueryWrapper } from "@/test-utils/queryWrapper";

const mockChannels = jest.fn();
const mockResume = jest.fn();
const mockSearch = jest.fn();

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { query?: string }) =>
      values?.query ? `${key}:${values.query}` : key,
  }),
}));
jest.mock("@/utils/atoms/api", () => ({
  apiAtom: "apiAtom",
  userAtom: "userAtom",
}));
jest.mock("jotai", () => ({
  ...jest.requireActual("jotai"),
  useAtomValue: (atom: unknown) =>
    atom === "apiAtom" ? { basePath: "https://jf.example.com" } : { Id: "u-1" },
}));
jest.mock("@jellyfin/sdk/lib/utils/api", () => ({
  getLiveTvApi: () => ({ getLiveTvChannels: mockChannels }),
  getLibraryApi: () => ({ getResumeItems: mockResume, getItems: mockSearch }),
}));
jest.mock("@/components/common/ItemImage", () => ({ ItemImage: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
// The shared Input pulls in the TV typography setting and, through it, the
// whole settings store and its native modules; a plain TextInput is enough here.
jest.mock("@/components/common/Input", () => ({
  Input: jest.requireActual("react-native").TextInput,
}));

import { Platform } from "react-native";
import { MultiviewColors } from "@/constants/Colors";
import { MultiviewPicker } from "./MultiviewPicker";

const items = (...list: object[]) => Promise.resolve({ data: { Items: list } });

beforeEach(() => {
  mockChannels.mockReturnValue(
    items(
      { Id: "c-1", Name: "WBZ-DT", CurrentProgram: { Name: "WBZ News" } },
      { Id: "c-2", Name: "WFXT", CurrentProgram: { Name: "The Simpsons" } },
    ),
  );
  mockResume.mockReturnValue(
    items({
      Id: "e-5",
      Name: "Episode 5",
      SeriesName: "Top Gear",
      Type: "Episode",
    }),
  );
  mockSearch.mockReturnValue(items({ Id: "m-1", Name: "Dune", Type: "Movie" }));
});

const renderPicker = (onPick = jest.fn()) =>
  render(
    <QueryWrapper>
      <MultiviewPicker
        visible
        onScreen={[]}
        onPick={onPick}
        onClose={jest.fn()}
      />
    </QueryWrapper>,
  );

test("opens on the live channels and filters them as you type", async () => {
  await renderPicker();
  expect(await screen.findByText("WBZ-DT")).toBeTruthy();
  expect(screen.queryByText("Top Gear: Episode 5")).toBeNull();

  await fireEvent.changeText(
    screen.getByPlaceholderText("multiview.search_channels"),
    "simpsons",
  );
  expect(screen.getByText("WFXT")).toBeTruthy();
  expect(screen.queryByText("WBZ-DT")).toBeNull();
});

test("says so when no channel matches", async () => {
  await renderPicker();
  await screen.findByText("WBZ-DT");
  await fireEvent.changeText(
    screen.getByPlaceholderText("multiview.search_channels"),
    "zzz",
  );
  expect(screen.getByText("multiview.no_matches:zzz")).toBeTruthy();
});

test("the Media tab shows what you are part way through until you search", async () => {
  await renderPicker();
  await fireEvent.press(screen.getByText("multiview.tab_media"));
  expect(await screen.findByText("Top Gear: Episode 5")).toBeTruthy();
  expect(screen.queryByText("WBZ-DT")).toBeNull();
  expect(mockSearch).not.toHaveBeenCalled();
});

test("searching on the Media tab asks the server for movies and episodes", async () => {
  const onPick = jest.fn();
  await renderPicker(onPick);
  await fireEvent.press(screen.getByText("multiview.tab_media"));
  await fireEvent.changeText(
    screen.getByPlaceholderText("multiview.search_media"),
    "dune",
  );

  expect(await screen.findByText("Dune")).toBeTruthy();
  expect(mockSearch).toHaveBeenCalledWith(
    expect.objectContaining({
      searchTerm: "dune",
      includeItemTypes: ["Movie", "Episode"],
      recursive: true,
    }),
    // The abort signal, so a newer keystroke cancels this search.
    expect.objectContaining({ signal: expect.anything() }),
  );
  // A search replaces the list it started from.
  expect(screen.queryByText("Top Gear: Episode 5")).toBeNull();

  await fireEvent.press(screen.getByText("Dune"));
  expect(onPick).toHaveBeenCalledWith("m-1");
});

test("a search on the Media tab that finds nothing says so", async () => {
  mockSearch.mockReturnValue(items());
  await renderPicker();
  await fireEvent.press(screen.getByText("multiview.tab_media"));
  await fireEvent.changeText(
    screen.getByPlaceholderText("multiview.search_media"),
    "zzz",
  );
  await waitFor(() =>
    expect(screen.getByText("multiview.no_matches:zzz")).toBeTruthy(),
  );
});

describe("with a TV remote", () => {
  beforeEach(() => {
    jest.spyOn(Platform, "isTV", "get").mockReturnValue(true);
  });
  afterEach(() => jest.restoreAllMocks());

  // Fire TV, 2026-11-17, screenshot: "Search channels" showed only its lower
  // half. On TV the shared Input is a fixed-height pill sized for TV text, and
  // the picker's phone padding (py-2.5) ate into that height and pushed the
  // text up out of the box. Kush: "search bar in multiview when adding media
  // appears weird".
  test("the search field gets no phone padding, so its text isn't clipped", async () => {
    await renderPicker();
    await screen.findByText("WBZ-DT");
    const field = screen.getByPlaceholderText("multiview.search_channels");
    expect(field.props.extraClassName ?? "").not.toMatch(/\bpy-/);
  });

  test("the dimmed side can't take focus: selecting it would close the picker", async () => {
    await renderPicker();
    await screen.findByText("WBZ-DT");
    expect(
      screen.getByTestId("multiview-picker-backdrop").props.focusable,
    ).toBe(false);
  });

  test("starts on the first channel, and a focused row stands out", async () => {
    await renderPicker();
    await screen.findByText("WBZ-DT");
    const first = screen.getByTestId("multiview-pick-c-1");
    expect(first.props.hasTVPreferredFocus).toBe(true);
    expect(
      screen.getByTestId("multiview-pick-c-2").props.hasTVPreferredFocus,
    ).toBe(false);
    await fireEvent(first, "focus");
    expect(first).toHaveStyle({ backgroundColor: MultiviewColors.focused });
  });

  test("starts on the first channel not already on screen", async () => {
    await render(
      <QueryWrapper>
        <MultiviewPicker
          visible
          onScreen={["c-1"]}
          onPick={jest.fn()}
          onClose={jest.fn()}
        />
      </QueryWrapper>,
    );
    await screen.findByText("WBZ-DT");
    expect(
      screen.getByTestId("multiview-pick-c-1").props.hasTVPreferredFocus,
    ).toBe(false);
    expect(
      screen.getByTestId("multiview-pick-c-2").props.hasTVPreferredFocus,
    ).toBe(true);
  });
});
