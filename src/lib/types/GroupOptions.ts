export type GroupOptions = {
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
