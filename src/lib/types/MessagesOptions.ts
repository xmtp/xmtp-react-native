export type MessagesOptions = {
  limit?: number | undefined
  beforeNs?: number | undefined
  afterNs?: number | undefined
  direction?: MessageOrder | undefined
  excludeContentTypes?: string[] | undefined
  excludeSenderInboxIds?: string[] | undefined
  sortBy?: MessageSortBy | undefined
  insertedAfterNs?: number | undefined
  insertedBeforeNs?: number | undefined
}

export type MessageOrder = 'ASCENDING' | 'DESCENDING'
export type MessageSortBy = 'SENT_TIME' | 'INSERTED_TIME'
export type MessageId = string & { readonly brand: unique symbol }
