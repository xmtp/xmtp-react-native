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
}
