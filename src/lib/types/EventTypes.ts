export enum EventTypes {
  // Auth
  Sign = 'sign',
  Authed = 'authed',
  AuthedV3 = 'authedV3',
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
  // Conversation Events
  /**
   * A new message is sent to a specific conversation
   */
  ConversationV3 = 'conversationV3',
  // All Conversation Message Events
  /**
   * A new message is sent to any V3 conversation
   */
  AllConversationMessages = 'allConversationMessages',
  // Conversation Events
  /**
   * A new V3 conversation is created
   */
  ConversationV3Message = 'conversationV3Message',
}
