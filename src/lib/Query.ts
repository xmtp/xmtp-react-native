export type Query = {
  startTime?: Date | undefined;
  endTime?: Date | undefined;
  contentTopic: string;
  pageSize?: number | undefined;
  direction?: "ascending" | "descending" | undefined;
};
