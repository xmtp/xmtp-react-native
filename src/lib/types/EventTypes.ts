export enum EventTypes {
  // Auth
  Sign = 'sign',
  Authed = 'authed',
  PreCreateIdentityCallback = 'preCreateIdentityCallback',
  PreEnableIdentityCallback = 'preEnableIdentityCallback',
  // Conversations Events
  /**
   * Current user is in a newly created conversation
   */
  Conversation = 'conversation',
  /**
   * Current user is in a newly created group
   */
  Group = 'group',
  /**
   * Current user is in a newly created group or conversation
   */
  ConversationContainer = 'conversationContainer',
  /**
   * Current user receives a new message in any conversation
   */
  Message = 'message',
  /**
   * Current user receives a new message in any group
   * Current limitation, only groups created before listener is added will be received
   */
  AllGroupMessage = 'allGroupMessage',

  // Conversation Events
  /**
   * A new message is sent to a specific conversation
   */
  ConversationMessage = 'conversationMessage',
  // Group Events
  /**
   * A new message is sent to a specific group
   */
  GroupMessage = 'groupMessage',
}
