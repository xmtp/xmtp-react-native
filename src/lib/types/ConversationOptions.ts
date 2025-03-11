export type ConversationOptions = {
  isActive?: boolean
  addedByInboxId?: boolean
  name?: boolean
  imageUrl?: boolean
  description?: boolean
  consentState?: boolean
  lastMessage?: boolean
}

export type ConversationFilterType = 'all' | 'groups' | 'dms'

export type ConversationId = string & { readonly brand: unique symbol }
export type ConversationTopic = string & { readonly brand: unique symbol }
