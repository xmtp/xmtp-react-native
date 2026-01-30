export enum EventTypes {
  // Auth
  Sign = 'sign',
  Authed = 'authed',
  PreAuthenticateToInboxCallback = 'preAuthenticateToInboxCallback',
  // Conversations Events
  /**
   * Current user is in a newly created conversation
   */
  Conversation = 'conversation',
  /**
   * Current user receives a new message in any conversation
   */
  Message = 'message',
  // Conversation Events
  /**
   * A new message is sent to a specific conversation
   */
  ConversationMessage = 'conversationMessage',
  /**
   * A inboxId or conversation has been approved or denied
   */
  Consent = 'consent',
  /**
   * A new installation has been added making new hmac keys
   */
  PreferenceUpdates = 'preferences',

  // Stream Closed Events
  /**
   * A conversation stream was closed
   */
  ConversationClosed = 'conversationClosed',
  /**
   * A all messages stream was closed
   */
  MessageClosed = 'messageClosed',
  /**
   * A conversation stream was closed
   */
  ConversationMessageClosed = 'conversationMessageClosed',
  /**
   * A consent stream was closed
   */
  ConsentClosed = 'consentClosed',
  /**
   * A preference stream was closed
   */
  PreferenceUpdatesClosed = 'preferencesClosed',
  /**
   * A message deletion event
   */
  MessageDeletion = 'messageDeletion',
  /**
   * A message deletion stream was closed
   */
  MessageDeletionClosed = 'messageDeletionClosed',
}
