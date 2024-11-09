export type MessagesOptions = {
  limit?: number | undefined
  before?: number | Date | undefined
  after?: number | Date | undefined
  direction?: MessageOrder | undefined
}

export type MessageOrder = 'ASCENDING' | 'DESCENDING'
export type MessageId = string & { readonly brand: unique symbol }
