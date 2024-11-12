export type MessagesOptions = {
  limit?: number | undefined
  beforeNs?: number | undefined
  afterNs?: number | undefined
  direction?: MessageOrder | undefined
}

export type MessageOrder = 'ASCENDING' | 'DESCENDING'
export type MessageId = string & { readonly brand: unique symbol }
