// This contains the contents of a message.
// Each of these corresponds to a codec supported by the native libraries.
// This is a one-of or union type: only one of these fields will be present.

export type ConversationContext = {
  conversationID: string
  metadata: { [key: string]: string }
}
