export type ArchiveStats = {
  posts: number;
  threads: number;
  tags: number;
};

export type GetArchiveStatsMessage = {
  type: "viewer/get-archive-stats";
};

export type ArchiveStatsResponse = {
  type: "viewer/archive-stats";
  stats: ArchiveStats;
};

export type RuntimeMessage = GetArchiveStatsMessage;
export type RuntimeResponse = ArchiveStatsResponse;
