# Each Merge into develop Cancels develop's Running App Build

**Date**: 2026-11-15
**Category**: build
**Key files**: `.github/workflows/build-apps.yml` (`concurrency: cancel-in-progress`)

## Detail

`build-apps.yml` runs one build per branch and cancels the one in progress
when a new commit lands. On 2026-11-15 three merges into develop in 20
minutes cancelled three Fire TV builds in a row (e96e853a, 363149b0,
13e0fa5f). There was nothing to install for almost an hour.

To get a build onto the TV quickly:
- install the PR branch's own "Build Android APK (TV)" artifact (no merge can
  cancel it), or
- merge everything first, then wait for one develop build, about 22 minutes
  for the TV job.

Before a merge, check `gh run list --workflow build-apps.yml --branch
develop`. A build someone is waiting on will be cancelled.
