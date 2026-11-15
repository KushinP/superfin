import {
  type BaseItemDto,
  ItemFields,
} from "@jellyfin/sdk/lib/generated-client/models";
import { getLiveTvApi } from "@jellyfin/sdk/lib/utils/api";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import {
  LIVE_SCORES_GUIDE_MIN_REFRESH_MS,
  LIVE_SCORES_GUIDE_REFRESH_MS,
} from "@/constants/LiveScores";
import { useLiveTvClock } from "@/hooks/useLiveTvClock";
import { apiAtom } from "@/utils/atoms/api";
import { currentProgramByChannel } from "@/utils/livetv/nowNext";

/** How long until the first of these programs ends, within the bounds. */
const untilNextEnd = (programs: BaseItemDto[] | undefined): number => {
  const now = Date.now();
  let soonest = LIVE_SCORES_GUIDE_REFRESH_MS;
  for (const program of programs ?? []) {
    const end = program.EndDate ? Date.parse(program.EndDate) : Number.NaN;
    if (!Number.isNaN(end)) soonest = Math.min(soonest, end - now);
  }
  return Math.max(LIVE_SCORES_GUIDE_MIN_REFRESH_MS, soonest);
};

/**
 * The program on now on each of the given channels, in one request for all
 * of them, with the overview that game matching reads. Fetched again when
 * one of them ends, so a tile learns of the next listing on time.
 */
export const useChannelsNow = (
  channelIds: string[],
): Map<string, BaseItemDto> => {
  const api = useAtomValue(apiAtom);
  const now = useLiveTvClock();

  // Sorted so the same channels in another order are the same request.
  const ids = useMemo(() => [...channelIds].sort(), [channelIds]);

  const { data: programs } = useQuery({
    queryKey: ["livetv", "channels", "now", ids],
    queryFn: async ({ signal }) => {
      const at = new Date().toISOString();
      const res = await getLiveTvApi(api!).getPrograms(
        {
          getProgramsDto: {
            ChannelIds: ids,
            MaxStartDate: at,
            MinEndDate: at,
            Fields: [ItemFields.Overview],
            EnableImages: false,
            EnableUserData: false,
            EnableTotalRecordCount: false,
          },
        },
        { signal },
      );
      return res.data.Items ?? [];
    },
    enabled: !!api && ids.length > 0,
    refetchInterval: (query) => untilNextEnd(query.state.data),
  });

  return useMemo(() => currentProgramByChannel(programs, now), [programs, now]);
};
