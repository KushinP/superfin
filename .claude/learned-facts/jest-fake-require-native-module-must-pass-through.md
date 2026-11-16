# A Jest Fake of `requireNativeModule` Must Pass Other Names Through

**Date**: 2026-11-15
**Category**: testing
**Key files**: `modules/exoplayer-player/src/mediaKeys.test.ts`

## Detail

`mediaKeys.test.ts` faked `expo-modules-core`'s `requireNativeModule` to
return its ExoPlayer stand-in for every name. It passed on the Mac, and
failed in CI from #17 to #20 with:

```
TypeError: Super expression must either be null or a function
  at node_modules/expo/src/winter/fetch/FetchResponse.ts
  at Object.resetModules (mediaKeys.test.ts)
```

In CI, `jest.resetModules()` reads Expo's lazy global `fetch`. That loads
`FetchResponse`, which extends `requireNativeModule("ExpoFetchModule")
.NativeResponse`, and the fake handed back a module without it. Spreading
`jest.requireActual("expo-modules-core")` into the fake (#19) didn't help,
because the faked function itself still answered every name.

The fix (#20): fake only the one name the test needs, and pass the rest to
the real `requireNativeModule`. The failure never reproduced locally, even
with `--ci --no-cache` or with `EXPO_PUBLIC_USE_RN_FETCH=0`, so a red CI run
on this kind of error needs the CI stack trace, not a local rerun.
