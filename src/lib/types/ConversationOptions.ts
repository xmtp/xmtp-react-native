export type ConversationOptions = {
  isActive?: boolean
  addedByInboxId?: boolean
  name?: boolean
  imageUrlSquare?: boolean
  description?: boolean
  consentState?: boolean
  lastMessage?: boolean
}

export type ConversationOrder =
  | 'lastMessage' // Ordered by the last message that was sent
  | 'createdAt' // DEFAULT: Ordered by the date the conversation was created

export type ConversationType = 'all' | 'groups' | 'dms'

export type ConversationId = string & { readonly brand: unique symbol }
export type ConversationTopic = string & { readonly brand: unique symbol }
