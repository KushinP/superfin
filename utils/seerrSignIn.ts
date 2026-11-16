import type { Api } from "@jellyfin/sdk";
import type { UserDto } from "@jellyfin/sdk/lib/generated-client/models";
import { SeerrApi } from "@/hooks/useSeerr";
import { markExpectedError } from "@/utils/errors";
import type { User as SeerrUser } from "@/utils/seerr/types";
import { signInWithQuickConnect } from "@/utils/seerrQuickConnect";
import { seerrProbe } from "@/utils/serverUrl/probes/seerr";
import { resolveServerUrl } from "@/utils/serverUrl/resolve";

export interface SeerrSignInInput {
  /** The signed-in Jellyfin user and client. */
  user: UserDto | null | undefined;
  api: Api | null | undefined;
  /** The address as typed, the one already checked, and the saved one. */
  typedUrl: string;
  resolvedUrl: string | undefined;
  savedUrl: string | undefined;
  /** The server's plugin pinned the address: sign in to that one. */
  urlLocked: boolean;
  customHeaders: Record<string, string> | undefined;
  /** A key from the plugin or the form, which stands in for a password. */
  apiKey: string | undefined;
  apiKeyLocked: boolean;
  password: string | undefined;
  /** Whether the form showed a password field. */
  askedForPassword: boolean;
  /**
   * Who is signed in to Jellyfin now, read again after each wait: the
   * account can change while a sign-in is under way.
   */
  currentUserId: () => string | null | undefined;
}

export interface SeerrSignInResult {
  user: SeerrUser;
  url: string;
  apiKey: string | undefined;
}

/**
 * Signs the Jellyfin user in to Seerr: checks the address is a Seerr server,
 * then tries Quick Connect, an API key, and last the password. Shared by the
 * phone's and the TV's Seerr settings, so both sign in the same way.
 * Everything it throws is a user-facing outcome of what was typed, marked as
 * expected so it never reaches Sentry.
 */
export const signInToSeerr = async ({
  user,
  api,
  typedUrl,
  resolvedUrl,
  savedUrl,
  urlLocked,
  customHeaders,
  apiKey,
  apiKeyLocked,
  password,
  askedForPassword,
  currentUserId,
}: SeerrSignInInput): Promise<SeerrSignInResult> => {
  if (!user?.Name)
    throw markExpectedError(
      new Error("Missing required information for login"),
    );

  // When the URL is admin-pinned, target that server directly. Otherwise
  // trust resolvedUrl only while it matches the field (the field adopts the
  // canonical URL after a successful resolve); any other input is resolved
  // fresh here, so signing in right after editing can never silently target
  // the previous server.
  let finalUrl = "";
  if (urlLocked) {
    finalUrl = savedUrl ?? "";
  } else if (resolvedUrl && resolvedUrl === typedUrl) {
    finalUrl = resolvedUrl;
  } else if (typedUrl) {
    const resolved = await resolveServerUrl(typedUrl, seerrProbe, {
      headers: customHeaders,
    });
    if (!resolved.ok) throw markExpectedError(new Error("Invalid server url"));
    finalUrl = resolved.url;
  }
  if (!finalUrl) throw markExpectedError(new Error("Missing server url"));

  const seerrTempApi = new SeerrApi(finalUrl, customHeaders, apiKey);
  const testResult = await seerrTempApi.test();
  if (!testResult.isValid)
    throw markExpectedError(new Error("Invalid server url"));

  const startedFor = user.Id;
  const stillCurrent = () => currentUserId() === startedFor;

  // Quick Connect before either credential: it needs neither, and when it
  // opens a session there is no reason for a key or a password to be on this
  // device at all.
  if (api) {
    const quickConnected = await signInWithQuickConnect(
      seerrTempApi,
      api,
      stillCurrent,
    );
    if (quickConnected)
      return {
        user: quickConnected,
        url: finalUrl,
        // A key the plugin locked stays the plugin's to manage. One typed
        // here is dropped, because nothing reads it any more.
        apiKey: apiKeyLocked ? apiKey : undefined,
      };
  }

  // Neither credential for an account that has since been left: replayed
  // now, it would sign the next user in as the previous one.
  if (!stillCurrent())
    throw markExpectedError(new Error("Signed-in account changed"));

  if (apiKey) {
    if (!user.Id)
      throw markExpectedError(
        new Error("Missing required information for login"),
      );
    const loggedInUser = await seerrTempApi.loginWithApiKey(user.Id);
    return { user: loggedInUser, url: finalUrl, apiKey };
  }

  // The form did not ask for a password and Quick Connect did not sign in.
  // Seerr hands the password to Jellyfin as a login for the user's own
  // account, so the empty one would be a failed login there, counted towards
  // the account's lockout. Failing here brings the field up instead. Once it
  // is on screen an empty password is sent as typed: a Jellyfin account can
  // have none.
  if (!password && !askedForPassword)
    throw markExpectedError(new Error("Password needed"));

  const loggedInUser = await seerrTempApi.login(user.Name, password || "");
  return { user: loggedInUser, url: finalUrl, apiKey: undefined };
};
