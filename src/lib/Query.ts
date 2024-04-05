export type Query = {
  startTime?: number | Date | undefined
  endTime?: number | Date | undefined
  contentTopic: string
  pageSize?: number | undefined
  direction?:
    | 'SORT_DIRECTION_ASCENDING'
    | 'SORT_DIRECTION_DESCENDING'
    | undefined
}
