export type MessagesOptions = {
  limit?: number | undefined
  beforeNs?: number | undefined
  afterNs?: number | undefined
  direction?: MessageOrder | undefined
  excludeContentTypes?: string[] | undefined
  excludeSenderInboxIds?: string[] | undefined
  insertedAfterNs?: number | undefined
  insertedBeforeNs?: number | undefined
  sortBy?: MessageSortBy | undefined
}

export type MessageOrder = 'ASCENDING' | 'DESCENDING'
export type MessageSortBy = 'SENT' | 'INSERTED'
export type MessageId = string & { readonly brand: unique symbol }
