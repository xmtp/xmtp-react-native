export type MessagesOptions = {
  limit?: number | undefined
  beforeNs?: number | undefined
  afterNs?: number | undefined
  direction?: MessageOrder | undefined
  excludeContentTypes?: string[] | undefined
  excludeSenderInboxIds?: string[] | undefined
}

export type EnrichedMessageDeliveryStatus =
  | 'ALL'
  | 'PUBLISHED'
  | 'UNPUBLISHED'
  | 'FAILED'
export type EnrichedMessageSortBy = 'SENT_TIME' | 'INSERTED_TIME'

export type EnrichedMessagesOptions = {
  limit?: number | undefined
  beforeNs?: number | undefined
  afterNs?: number | undefined
  direction?: MessageOrder | undefined
  excludeSenderInboxIds?: string[] | undefined
  deliveryStatus?: EnrichedMessageDeliveryStatus | undefined
  insertedAfterNs?: number | undefined
  insertedBeforeNs?: number | undefined
  sortBy?: EnrichedMessageSortBy | undefined
}

export type MessageOrder = 'ASCENDING' | 'DESCENDING'
export type MessageId = string & { readonly brand: unique symbol }
