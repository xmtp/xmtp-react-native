export type Query = {
  startTime?: Date | undefined;
  endTime?: Date | undefined;
  contentTopic: string;
  pageSize?: number | undefined;
  direction?: "SORT_DIRECTION_ASCENDING" | "SORT_DIRECTION_DESCENDING" | undefined;
};
