import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { TVSeerrSettings } from "./TVSeerrSettings";

// Spec: docs/specs/2026-11-16-tv-seerr-settings.md. A Fire TV had no way to
// enter a Seerr address, so Seerr never turned on there.

const mockResolve = jest.fn();
const mockSeerrTest = jest.fn();
const mockLogin = jest.fn();
const mockQuickConnectEnabled = jest.fn<Promise<boolean>, []>();
const mockSignInWithQuickConnect = jest.fn();
const mockSetSeerrUser = jest.fn();
const mockClearAll = jest.fn(async () => undefined);
const mockUpdateSettings = jest.fn();
let mockSeerrUser: { requestCount?: number } | undefined;
let mockSettings: Record<string, unknown> = {};
let mockPluginSettings: Record<string, unknown> | undefined;

jest.mock(
  "react-native-mmkv",
  () => jest.requireActual("@/test-utils/mmkv").mmkvModule,
);
jest.mock("@/utils/log", () => ({
  writeErrorLog: () => undefined,
  writeToLog: () => undefined,
  writeDebugLog: () => undefined,
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/constants/TVTypography", () => ({
  useScaledTVTypography: () => ({ callout: 16 }),
}));
// The TV parts as plain controls: their look is theirs, what they are given
// is this section's.
jest.mock("@/components/tv", () => {
  const { Pressable, Text, TextInput, View } =
    jest.requireActual("react-native");
  return {
    TVSectionHeader: ({ title }: { title: string }) => <Text>{title}</Text>,
    TVSettingsTextInput: (props: {
      label: string;
      value: string;
      onChangeText: (text: string) => void;
      disabledByAdmin?: boolean;
    }) => (
      <View>
        <TextInput
          accessibilityLabel={props.label}
          value={props.value}
          onChangeText={props.onChangeText}
          editable={!props.disabledByAdmin}
        />
        {props.disabledByAdmin ? <Text>locked</Text> : null}
      </View>
    ),
    TVSettingsOptionButton: (props: {
      label: string;
      value: string;
      onPress: () => void;
      disabled?: boolean;
    }) => (
      <Pressable
        accessibilityRole='button'
        accessibilityLabel={props.label}
        accessibilityState={{ disabled: !!props.disabled }}
        onPress={props.disabled ? undefined : props.onPress}
      >
        <Text>{props.value}</Text>
      </Pressable>
    ),
  };
});
jest.mock("@/utils/atoms/api", () => {
  const { atom } = jest.requireActual("jotai");
  return {
    apiAtom: atom({ basePath: "https://jellyfin.example.com" }),
    userAtom: atom({ Id: "user-1", Name: "alice" }),
  };
});
jest.mock("@/utils/store", () => ({
  store: { get: () => ({ Id: "user-1", Name: "alice" }) },
}));
jest.mock("@/utils/atoms/settings", () => ({
  useSettings: () => ({
    settings: mockSettings,
    updateSettings: mockUpdateSettings,
    pluginSettings: mockPluginSettings,
  }),
}));
jest.mock("@/hooks/useIntegrationHeaders", () => ({
  useIntegrationHeaders: () => ({ headers: {}, resolveOptions: {} }),
}));
jest.mock("@/utils/serverUrl/resolve", () => ({
  resolveServerUrl: (url: string) => mockResolve(url),
}));
jest.mock("@/hooks/useSeerr", () => ({
  SeerrApi: jest.fn().mockImplementation(() => ({
    test: () => mockSeerrTest(),
    login: (username: string, password: string) =>
      mockLogin(username, password),
  })),
  useSeerr: () => ({
    seerrUser: mockSeerrUser,
    setSeerrUser: mockSetSeerrUser,
    clearAllSeerrData: mockClearAll,
  }),
}));
jest.mock("@/utils/seerrQuickConnect", () => ({
  ...jest.requireActual("@/utils/seerrQuickConnect"),
  isQuickConnectEnabled: () => mockQuickConnectEnabled(),
  signInWithQuickConnect: () => mockSignInWithQuickConnect(),
}));

const URL_FIELD = "home.settings.plugins.seerr.server_url";
const PASSWORD_FIELD = "home.settings.plugins.seerr.password";
const SIGN_IN = "home.settings.plugins.seerr.login_button";
const SIGN_OUT = "home.settings.plugins.seerr.reset_seerr_config_button";
const FAILED = "seerr.failed_to_login";
const SEERR = "https://seerr.example.com";

const renderSection = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { gcTime: Number.POSITIVE_INFINITY, retry: false },
            mutations: { gcTime: Number.POSITIVE_INFINITY, retry: false },
          },
        })
      }
    >
      <TVSeerrSettings />
    </QueryClientProvider>,
  );

const typeAddressAndSignIn = async () => {
  await fireEvent.changeText(screen.getByLabelText(URL_FIELD), SEERR);
  await fireEvent.press(screen.getByLabelText(SIGN_IN));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSeerrUser = undefined;
  mockSettings = {};
  mockPluginSettings = undefined;
  mockResolve.mockResolvedValue({ ok: true, url: SEERR });
  mockSeerrTest.mockResolvedValue({ isValid: true });
  mockQuickConnectEnabled.mockResolvedValue(true);
  mockSignInWithQuickConnect.mockResolvedValue(undefined);
});

describe("Seerr in the TV settings", () => {
  test("the address field starts empty: nothing in the app is any one person's server", async () => {
    await renderSection();
    expect(screen.getByLabelText(URL_FIELD).props.value).toBe("");
  });

  // Check 1
  test("Quick Connect on: signs in with no password and saves the address", async () => {
    mockSignInWithQuickConnect.mockResolvedValue({ id: 7 });
    await renderSection();
    // Quick Connect is on, so once the server has said so no password is
    // asked for.
    await waitFor(() =>
      expect(screen.queryByLabelText(PASSWORD_FIELD)).toBeNull(),
    );

    await typeAddressAndSignIn();

    await waitFor(() =>
      expect(mockUpdateSettings).toHaveBeenCalledWith({
        seerrServerUrl: SEERR,
        seerrApiKey: undefined,
      }),
    );
    expect(mockSetSeerrUser).toHaveBeenCalledWith({ id: 7 });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  // Check 2
  test("Quick Connect off: asks for the password, and the right one signs in", async () => {
    mockQuickConnectEnabled.mockResolvedValue(false);
    mockLogin.mockResolvedValue({ id: 9 });
    await renderSection();
    await waitFor(() =>
      expect(screen.getByLabelText(PASSWORD_FIELD)).toBeTruthy(),
    );

    await fireEvent.changeText(screen.getByLabelText(PASSWORD_FIELD), "pw");
    await typeAddressAndSignIn();

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith("alice", "pw"));
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      seerrServerUrl: SEERR,
      seerrApiKey: undefined,
    });
  });

  // Check 2
  test("a wrong password shows the error and saves nothing", async () => {
    mockQuickConnectEnabled.mockResolvedValue(false);
    mockLogin.mockRejectedValue(new Error("401"));
    await renderSection();
    await waitFor(() =>
      expect(screen.getByLabelText(PASSWORD_FIELD)).toBeTruthy(),
    );

    await fireEvent.changeText(screen.getByLabelText(PASSWORD_FIELD), "bad");
    await typeAddressAndSignIn();

    await waitFor(() => expect(screen.getByText(FAILED)).toBeTruthy());
    expect(mockUpdateSettings).not.toHaveBeenCalled();
    expect(mockSetSeerrUser).not.toHaveBeenCalled();
  });

  // Check 3
  test("an address that isn't a Seerr server shows the error and saves nothing", async () => {
    mockResolve.mockResolvedValue({ ok: false });
    await renderSection();

    await typeAddressAndSignIn();

    await waitFor(() => expect(screen.getByText(FAILED)).toBeTruthy());
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });

  // Check 4
  test("signed in: shows the address, and Sign out clears the sign-in", async () => {
    mockSeerrUser = { requestCount: 3 };
    mockSettings = { seerrServerUrl: SEERR };
    await renderSection();

    expect(screen.getByText(SEERR)).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(SIGN_OUT));

    await waitFor(() => expect(mockClearAll).toHaveBeenCalled());
    expect(mockSetSeerrUser).toHaveBeenCalledWith(undefined);
  });

  // Check 6
  test("an address the server's plugin locked shows and can't be edited", async () => {
    mockSettings = { seerrServerUrl: SEERR };
    mockPluginSettings = { seerrServerUrl: { locked: true, value: SEERR } };
    await renderSection();

    const field = screen.getByLabelText(URL_FIELD);
    expect(field.props.value).toBe(SEERR);
    expect(field.props.editable).toBe(false);
    expect(screen.getByText("locked")).toBeTruthy();
  });
});
