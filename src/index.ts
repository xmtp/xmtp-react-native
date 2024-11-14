import { EventEmitter, NativeModulesProxy } from 'expo-modules-core'

import { Client } from '.'
import XMTPModule from './XMTPModule'
import { Address, InboxId, XMTPEnvironment } from './lib/Client'
import {
  ConsentListEntry,
  ConsentListEntryType,
  ConsentState,
} from './lib/ConsentListEntry'
import {
  ContentCodec,
  DecryptedLocalAttachment,
  EncryptedLocalAttachment,
} from './lib/ContentCodec'
import { Conversation, ConversationVersion } from './lib/Conversation'
import { DecodedMessage, MessageDeliveryStatus } from './lib/DecodedMessage'
import { Dm } from './lib/Dm'
import { Group, PermissionUpdateOption } from './lib/Group'
import { InboxState } from './lib/InboxState'
import { Member } from './lib/Member'
import { WalletType } from './lib/Signer'
import {
  ConversationOrder,
  ConversationOptions,
  ConversationType,
  ConversationId,
  ConversationTopic,
} from './lib/types/ConversationOptions'
import { DefaultContentTypes } from './lib/types/DefaultContentType'
import { MessageId, MessageOrder } from './lib/types/MessagesOptions'
import { PermissionPolicySet } from './lib/types/PermissionPolicySet'
import { getAddress } from './utils/address'
import { EncodedContent } from '@xmtp/proto/ts/dist/types/message_contents/content.pb'

export * from './context'
export * from './hooks'
export { GroupUpdatedCodec } from './lib/NativeCodecs/GroupUpdatedCodec'
export { ReactionCodec } from './lib/NativeCodecs/ReactionCodec'
export { ReadReceiptCodec } from './lib/NativeCodecs/ReadReceiptCodec'
export { RemoteAttachmentCodec } from './lib/NativeCodecs/RemoteAttachmentCodec'
export { ReplyCodec } from './lib/NativeCodecs/ReplyCodec'
export { StaticAttachmentCodec } from './lib/NativeCodecs/StaticAttachmentCodec'
export { TextCodec } from './lib/NativeCodecs/TextCodec'
export * from './lib/Signer'

export function address(): string {
  return XMTPModule.address()
}

export function inboxId(): InboxId {
  return XMTPModule.inboxId()
}

export async function findInboxIdFromAddress(
  inboxId: InboxId,
  address: string
): Promise<InboxId | undefined> {
  return XMTPModule.findInboxIdFromAddress(inboxId, address)
}

export async function deleteLocalDatabase(inboxId: InboxId) {
  return XMTPModule.deleteLocalDatabase(inboxId)
}

export async function dropLocalDatabaseConnection(inboxId: InboxId) {
  return XMTPModule.dropLocalDatabaseConnection(inboxId)
}

export async function reconnectLocalDatabase(inboxId: InboxId) {
  return XMTPModule.reconnectLocalDatabase(inboxId)
}

export async function requestMessageHistorySync(inboxId: InboxId) {
  return XMTPModule.requestMessageHistorySync(inboxId)
}

export async function revokeAllOtherInstallations(inboxId: InboxId) {
  return XMTPModule.revokeAllOtherInstallations(inboxId)
}

export async function getInboxState(
  inboxId: InboxId,
  refreshFromNetwork: boolean
): Promise<InboxState> {
  const inboxState = await XMTPModule.getInboxState(inboxId, refreshFromNetwork)
  return InboxState.from(inboxState)
}

export async function getInboxStates(
  inboxId: InboxId,
  refreshFromNetwork: boolean,
  inboxIds: InboxId[],
): Promise<InboxState[]> {
  const inboxStates = await XMTPModule.getInboxStates(inboxId, refreshFromNetwork, inboxIds)
  return inboxStates.map((json: string) => {
    return InboxState.from(json)
  })
}

export function preAuthenticateToInboxCallbackCompleted() {
  XMTPModule.preAuthenticateToInboxCallbackCompleted()
}

export async function receiveSignature(requestID: string, signature: string) {
  return await XMTPModule.receiveSignature(requestID, signature)
}

export async function receiveSCWSignature(
  requestID: string,
  signature: string
) {
  return await XMTPModule.receiveSCWSignature(requestID, signature)
}

export async function createRandom(
  environment: 'local' | 'dev' | 'production',
  dbEncryptionKey: Uint8Array,
  appVersion?: string | undefined,
  hasPreAuthenticateToInboxCallback?: boolean | undefined,
  dbDirectory?: string | undefined,
  historySyncUrl?: string | undefined
): Promise<string> {
  const authParams: AuthParams = {
    environment,
    appVersion,
    dbDirectory,
    historySyncUrl,
  }
  return await XMTPModule.createRandom(
    hasPreAuthenticateToInboxCallback,
    Array.from(dbEncryptionKey),
    JSON.stringify(authParams)
  )
}

export async function create(
  address: Address,
  environment: 'local' | 'dev' | 'production',
  dbEncryptionKey: Uint8Array,
  appVersion?: string | undefined,
  hasPreAuthenticateToInboxCallback?: boolean | undefined,
  dbDirectory?: string | undefined,
  historySyncUrl?: string | undefined,
  walletType?: WalletType | undefined,
  chainId?: number | undefined,
  blockNumber?: number | undefined
): Promise<string> {
  const authParams: AuthParams = {
    environment,
    appVersion,
    dbDirectory,
    historySyncUrl,
    walletType,
    chainId: typeof chainId === 'number' ? chainId : undefined,
    blockNumber: typeof blockNumber === 'number' ? blockNumber : undefined,
  }
  return await XMTPModule.create(
    address,
    hasPreAuthenticateToInboxCallback,
    Array.from(dbEncryptionKey),
    JSON.stringify(authParams)
  )
}

export async function build(
  address: Address,
  environment: 'local' | 'dev' | 'production',
  dbEncryptionKey: Uint8Array,
  appVersion?: string | undefined,
  dbDirectory?: string | undefined,
  historySyncUrl?: string | undefined
): Promise<string> {
  const authParams: AuthParams = {
    environment,
    appVersion,
    dbDirectory,
    historySyncUrl,
  }
  return await XMTPModule.build(
    address,
    Array.from(dbEncryptionKey),
    JSON.stringify(authParams)
  )
}

export async function dropClient(inboxId: InboxId) {
  return await XMTPModule.dropClient(inboxId)
}

export async function canMessage(
  inboxId: InboxId,
  peerAddresses: Address[]
): Promise<{ [key: Address]: boolean }> {
  return await XMTPModule.canMessage(inboxId, peerAddresses)
}

export async function getOrCreateInboxId(
  address: Address,
  environment: XMTPEnvironment
): Promise<InboxId> {
  return await XMTPModule.getOrCreateInboxId(getAddress(address), environment)
}

export async function encryptAttachment(
  inboxId: InboxId,
  file: DecryptedLocalAttachment
): Promise<EncryptedLocalAttachment> {
  const fileJson = JSON.stringify(file)
  const encryptedFileJson = await XMTPModule.encryptAttachment(
    inboxId,
    fileJson
  )
  return JSON.parse(encryptedFileJson)
}

export async function decryptAttachment(
  inboxId: InboxId,
  encryptedFile: EncryptedLocalAttachment
): Promise<DecryptedLocalAttachment> {
  const encryptedFileJson = JSON.stringify(encryptedFile)
  const fileJson = await XMTPModule.decryptAttachment(
    inboxId,
    encryptedFileJson
  )
  return JSON.parse(fileJson)
}

export async function listGroups<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  opts?: ConversationOptions | undefined,
  order?: ConversationOrder | undefined,
  limit?: number | undefined
): Promise<Group<ContentTypes>[]> {
  return (
    await XMTPModule.listGroups(
      client.inboxId,
      JSON.stringify(opts),
      order,
      limit
    )
  ).map((json: string) => {
    const group = JSON.parse(json)

    const lastMessage = group['lastMessage']
      ? DecodedMessage.from(group['lastMessage'], client)
      : undefined
    return new Group(client, group, lastMessage)
  })
}

export async function listDms<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  opts?: ConversationOptions | undefined,
  order?: ConversationOrder | undefined,
  limit?: number | undefined
): Promise<Dm<ContentTypes>[]> {
  return (
    await XMTPModule.listDms(client.inboxId, JSON.stringify(opts), order, limit)
  ).map((json: string) => {
    const group = JSON.parse(json)

    const lastMessage = group['lastMessage']
      ? DecodedMessage.from(group['lastMessage'], client)
      : undefined
    return new Dm(client, group, lastMessage)
  })
}

export async function listConversations<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  opts?: ConversationOptions | undefined,
  order?: ConversationOrder | undefined,
  limit?: number | undefined
): Promise<Conversation<ContentTypes>[]> {
  return (
    await XMTPModule.listConversations(
      client.inboxId,
      JSON.stringify(opts),
      order,
      limit
    )
  ).map((json: string) => {
    const jsonObj = JSON.parse(json)

    const lastMessage = jsonObj['lastMessage']
      ? DecodedMessage.from(jsonObj['lastMessage'], client)
      : undefined

    if (jsonObj.version === ConversationVersion.GROUP) {
      return new Group(client, jsonObj, lastMessage)
    } else {
      return new Dm(client, jsonObj, lastMessage)
    }
  })
}

export async function conversationMessages<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  conversationId: ConversationId,
  limit?: number | undefined,
  beforeNs?: number | undefined,
  afterNs?: number | undefined,
  direction?: MessageOrder | undefined
): Promise<DecodedMessage<ContentTypes>[]> {
  const messages = await XMTPModule.conversationMessages(
    client.inboxId,
    conversationId,
    limit,
    beforeNs,
    afterNs,
    direction
  )
  return messages.map((json: string) => {
    return DecodedMessage.from(json, client)
  })
}

export async function findMessage<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  messageId: MessageId
): Promise<DecodedMessage<ContentTypes> | undefined> {
  const message = await XMTPModule.findMessage(client.inboxId, messageId)
  return DecodedMessage.from(message, client)
}

export async function findGroup<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  groupId: ConversationId
): Promise<Group<ContentTypes> | undefined> {
  const json = await XMTPModule.findGroup(client.inboxId, groupId)
  const group = JSON.parse(json)
  if (!group || Object.keys(group).length === 0) {
    return undefined
  }

  return new Group(client, group)
}

export async function findConversation<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  conversationId: ConversationId
): Promise<Conversation<ContentTypes> | undefined> {
  const json = await XMTPModule.findConversation(client.inboxId, conversationId)
  const conversation = JSON.parse(json)
  if (!conversation || Object.keys(conversation).length === 0) {
    return undefined
  }

  if (conversation.version === ConversationVersion.GROUP) {
    return new Group(client, conversation)
  } else {
    return new Dm(client, conversation)
  }
}

export async function findConversationByTopic<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  topic: ConversationTopic
): Promise<Conversation<ContentTypes> | undefined> {
  const json = await XMTPModule.findConversationByTopic(client.inboxId, topic)
  const conversation = JSON.parse(json)
  if (!conversation || Object.keys(conversation).length === 0) {
    return undefined
  }

  if (conversation.version === ConversationVersion.GROUP) {
    return new Group(client, conversation)
  } else {
    return new Dm(client, conversation)
  }
}

export async function findDmByInboxId<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  peerInboxId: InboxId
): Promise<Dm<ContentTypes> | undefined> {
  const json = await XMTPModule.findDmByInboxId(client.inboxId, peerInboxId)
  const dm = JSON.parse(json)
  if (!dm || Object.keys(dm).length === 0) {
    return undefined
  }

  return new Dm(client, dm)
}

export async function findDmByAddress<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  address: Address
): Promise<Dm<ContentTypes> | undefined> {
  const json = await XMTPModule.findDmByAddress(client.inboxId, address)
  const dm = JSON.parse(json)
  if (!dm || Object.keys(dm).length === 0) {
    return undefined
  }

  return new Dm(client, dm)
}

export async function sendWithContentType<T>(
  inboxId: InboxId,
  conversationId: ConversationId,
  content: T,
  codec: ContentCodec<T>
): Promise<MessageId> {
  if ('contentKey' in codec) {
    const contentJson = JSON.stringify(content)
    return await XMTPModule.sendMessage(inboxId, conversationId, contentJson)
  } else {
    const encodedContent = codec.encode(content)
    encodedContent.fallback = codec.fallback(content)
    const encodedContentData = EncodedContent.encode(encodedContent).finish()

    return await XMTPModule.sendEncodedContent(
      inboxId,
      conversationId,
      Array.from(encodedContentData)
    )
  }
}

export async function sendMessage(
  inboxId: InboxId,
  conversationId: ConversationId,
  content: any
): Promise<MessageId> {
  const contentJson = JSON.stringify(content)
  return await XMTPModule.sendMessage(inboxId, conversationId, contentJson)
}

export async function publishPreparedMessages(
  inboxId: InboxId,
  conversationId: ConversationId
) {
  return await XMTPModule.publishPreparedMessages(inboxId, conversationId)
}

export async function prepareMessage(
  inboxId: InboxId,
  conversationId: ConversationId,
  content: any
): Promise<MessageId> {
  const contentJson = JSON.stringify(content)
  return await XMTPModule.prepareMessage(inboxId, conversationId, contentJson)
}

export async function findOrCreateDm<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  peerAddress: Address
): Promise<Dm<ContentTypes>> {
  const dm = JSON.parse(
    await XMTPModule.findOrCreateDm(client.inboxId, peerAddress)
  )
  return new Dm(client, dm)
}

export async function createGroup<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  peerAddresses: Address[],
  permissionLevel: 'all_members' | 'admin_only' = 'all_members',
  name: string = '',
  imageUrlSquare: string = '',
  description: string = '',
  pinnedFrameUrl: string = ''
): Promise<Group<ContentTypes>> {
  const options: CreateGroupParams = {
    name,
    imageUrlSquare,
    description,
    pinnedFrameUrl,
  }
  const group = JSON.parse(
    await XMTPModule.createGroup(
      client.inboxId,
      peerAddresses,
      permissionLevel,
      JSON.stringify(options)
    )
  )

  return new Group(client, group)
}

export async function createGroupCustomPermissions<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  peerAddresses: Address[],
  permissionPolicySet: PermissionPolicySet,
  name: string = '',
  imageUrlSquare: string = '',
  description: string = '',
  pinnedFrameUrl: string = ''
): Promise<Group<ContentTypes>> {
  const options: CreateGroupParams = {
    name,
    imageUrlSquare,
    description,
    pinnedFrameUrl,
  }
  const group = JSON.parse(
    await XMTPModule.createGroupCustomPermissions(
      client.inboxId,
      peerAddresses,
      JSON.stringify(permissionPolicySet),
      JSON.stringify(options)
    )
  )

  return new Group(client, group)
}

export async function listMemberInboxIds<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(client: Client<ContentTypes>, id: ConversationId): Promise<InboxId[]> {
  return XMTPModule.listMemberInboxIds(client.inboxId, id)
}

export async function dmPeerInboxId<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(client: Client<ContentTypes>, dmId: ConversationId): Promise<InboxId> {
  return XMTPModule.dmPeerInboxId(client.inboxId, dmId)
}

export async function listConversationMembers(
  inboxId: InboxId,
  id: ConversationId
): Promise<Member[]> {
  const members = await XMTPModule.listConversationMembers(inboxId, id)

  return members.map((json: string) => {
    return Member.from(json)
  })
}

export async function syncConversations(inboxId: InboxId) {
  await XMTPModule.syncConversations(inboxId)
}

export async function syncAllConversations(inboxId: InboxId): Promise<number> {
  return await XMTPModule.syncAllConversations(inboxId)
}

export async function syncConversation(inboxId: InboxId, id: ConversationId) {
  await XMTPModule.syncConversation(inboxId, id)
}

export async function addGroupMembers(
  inboxId: InboxId,
  id: ConversationId,
  addresses: Address[]
): Promise<void> {
  return XMTPModule.addGroupMembers(inboxId, id, addresses)
}

export async function removeGroupMembers(
  inboxId: InboxId,
  id: ConversationId,
  addresses: Address[]
): Promise<void> {
  return XMTPModule.removeGroupMembers(inboxId, id, addresses)
}

export async function addGroupMembersByInboxId(
  inboxId: InboxId,
  id: ConversationId,
  inboxIds: InboxId[]
): Promise<void> {
  return XMTPModule.addGroupMembersByInboxId(inboxId, id, inboxIds)
}

export async function removeGroupMembersByInboxId(
  inboxId: InboxId,
  id: ConversationId,
  inboxIds: InboxId[]
): Promise<void> {
  return XMTPModule.removeGroupMembersByInboxId(inboxId, id, inboxIds)
}

export function groupName(
  inboxId: InboxId,
  id: ConversationId
): string | PromiseLike<string> {
  return XMTPModule.groupName(inboxId, id)
}

export function updateGroupName(
  inboxId: InboxId,
  id: ConversationId,
  groupName: string
): Promise<void> {
  return XMTPModule.updateGroupName(inboxId, id, groupName)
}

export function groupImageUrlSquare(
  inboxId: InboxId,
  id: ConversationId
): string | PromiseLike<string> {
  return XMTPModule.groupImageUrlSquare(inboxId, id)
}

export function updateGroupImageUrlSquare(
  inboxId: InboxId,
  id: ConversationId,
  imageUrlSquare: string
): Promise<void> {
  return XMTPModule.updateGroupImageUrlSquare(inboxId, id, imageUrlSquare)
}

export function groupDescription(
  inboxId: InboxId,
  id: ConversationId
): string | PromiseLike<string> {
  return XMTPModule.groupDescription(inboxId, id)
}

export function updateGroupDescription(
  inboxId: InboxId,
  id: ConversationId,
  description: string
): Promise<void> {
  return XMTPModule.updateGroupDescription(inboxId, id, description)
}

export function groupPinnedFrameUrl(
  inboxId: InboxId,
  id: ConversationId
): string | PromiseLike<string> {
  return XMTPModule.groupPinnedFrameUrl(inboxId, id)
}

export function updateGroupPinnedFrameUrl(
  inboxId: InboxId,
  id: ConversationId,
  pinnedFrameUrl: string
): Promise<void> {
  return XMTPModule.updateGroupPinnedFrameUrl(inboxId, id, pinnedFrameUrl)
}

export function isGroupActive(
  inboxId: InboxId,
  id: ConversationId
): Promise<boolean> {
  return XMTPModule.isGroupActive(inboxId, id)
}

export async function addedByInboxId(
  inboxId: InboxId,
  id: ConversationId
): Promise<InboxId> {
  return XMTPModule.addedByInboxId(inboxId, id) as InboxId
}

export async function creatorInboxId(
  inboxId: InboxId,
  id: ConversationId
): Promise<InboxId> {
  return XMTPModule.creatorInboxId(inboxId, id) as InboxId
}

export async function isAdmin(
  clientInboxId: InboxId,
  id: ConversationId,
  inboxId: InboxId
): Promise<boolean> {
  return XMTPModule.isAdmin(clientInboxId, id, inboxId)
}

export async function isSuperAdmin(
  clientInboxId: InboxId,
  id: ConversationId,
  inboxId: InboxId
): Promise<boolean> {
  return XMTPModule.isSuperAdmin(clientInboxId, id, inboxId)
}

export async function listAdmins(
  inboxId: InboxId,
  id: ConversationId
): Promise<InboxId[]> {
  return XMTPModule.listAdmins(inboxId, id)
}

export async function listSuperAdmins(
  inboxId: InboxId,
  id: ConversationId
): Promise<InboxId[]> {
  return XMTPModule.listSuperAdmins(inboxId, id)
}

export async function addAdmin(
  clientInboxId: InboxId,
  id: ConversationId,
  inboxId: InboxId
): Promise<void> {
  return XMTPModule.addAdmin(clientInboxId, id, inboxId)
}

export async function addSuperAdmin(
  clientInboxId: InboxId,
  id: ConversationId,
  inboxId: InboxId
): Promise<void> {
  return XMTPModule.addSuperAdmin(clientInboxId, id, inboxId)
}

export async function removeAdmin(
  clientInboxId: InboxId,
  id: ConversationId,
  inboxId: InboxId
): Promise<void> {
  return XMTPModule.removeAdmin(clientInboxId, id, inboxId)
}

export async function removeSuperAdmin(
  clientInboxId: InboxId,
  id: ConversationId,
  inboxId: InboxId
): Promise<void> {
  return XMTPModule.removeSuperAdmin(clientInboxId, id, inboxId)
}

export async function updateAddMemberPermission(
  clientInboxId: InboxId,
  id: ConversationId,
  permissionOption: PermissionUpdateOption
): Promise<void> {
  return XMTPModule.updateAddMemberPermission(
    clientInboxId,
    id,
    permissionOption
  )
}

export async function updateRemoveMemberPermission(
  clientInboxId: InboxId,
  id: ConversationId,
  permissionOption: PermissionUpdateOption
): Promise<void> {
  return XMTPModule.updateRemoveMemberPermission(
    clientInboxId,
    id,
    permissionOption
  )
}

export async function updateAddAdminPermission(
  clientInboxId: InboxId,
  id: ConversationId,
  permissionOption: PermissionUpdateOption
): Promise<void> {
  return XMTPModule.updateAddAdminPermission(
    clientInboxId,
    id,
    permissionOption
  )
}

export async function updateRemoveAdminPermission(
  clientInboxId: InboxId,
  id: ConversationId,
  permissionOption: PermissionUpdateOption
): Promise<void> {
  return XMTPModule.updateRemoveAdminPermission(
    clientInboxId,
    id,
    permissionOption
  )
}

export async function updateGroupNamePermission(
  clientInboxId: InboxId,
  id: ConversationId,
  permissionOption: PermissionUpdateOption
): Promise<void> {
  return XMTPModule.updateGroupNamePermission(
    clientInboxId,
    id,
    permissionOption
  )
}

export async function updateGroupImageUrlSquarePermission(
  clientInboxId: InboxId,
  id: ConversationId,
  permissionOption: PermissionUpdateOption
): Promise<void> {
  return XMTPModule.updateGroupImageUrlSquarePermission(
    clientInboxId,
    id,
    permissionOption
  )
}

export async function updateGroupDescriptionPermission(
  clientInboxId: InboxId,
  id: ConversationId,
  permissionOption: PermissionUpdateOption
): Promise<void> {
  return XMTPModule.updateGroupDescriptionPermission(
    clientInboxId,
    id,
    permissionOption
  )
}

export async function updateGroupPinnedFrameUrlPermission(
  clientInboxId: InboxId,
  id: ConversationId,
  permissionOption: PermissionUpdateOption
): Promise<void> {
  return XMTPModule.updateGroupPinnedFrameUrlPermission(
    clientInboxId,
    id,
    permissionOption
  )
}

export async function permissionPolicySet(
  clientInboxId: InboxId,
  id: ConversationId
): Promise<PermissionPolicySet> {
  const json = await XMTPModule.permissionPolicySet(clientInboxId, id)
  return JSON.parse(json)
}

export async function processMessage<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  id: ConversationId,
  encryptedMessage: string
): Promise<DecodedMessage<ContentTypes>> {
  const json = XMTPModule.processMessage(client.inboxId, id, encryptedMessage)
  return DecodedMessage.from(json, client)
}

export async function processWelcomeMessage<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  encryptedMessage: string
): Promise<Promise<Conversation<ContentTypes>>> {
  const json = await XMTPModule.processWelcomeMessage(
    client.inboxId,
    encryptedMessage
  )
  const conversation = JSON.parse(json)

  if (conversation.version === ConversationVersion.GROUP) {
    return new Group(client, conversation)
  } else {
    return new Dm(client, conversation)
  }
}

export async function setConsentState(
  inboxId: InboxId,
  value: string,
  entryType: ConsentListEntryType,
  consentType: ConsentState
): Promise<void> {
  return await XMTPModule.setConsentState(
    inboxId,
    value,
    entryType,
    consentType
  )
}

export async function consentAddressState(
  inboxId: InboxId,
  address: Address
): Promise<ConsentState> {
  return await XMTPModule.consentAddressState(inboxId, address)
}
export async function consentInboxIdState(
  inboxId: InboxId,
  peerInboxId: InboxId
): Promise<ConsentState> {
  return await XMTPModule.consentInboxIdState(inboxId, peerInboxId)
}
export async function consentConversationIdState(
  inboxId: InboxId,
  conversationId: ConversationId
): Promise<ConsentState> {
  return await XMTPModule.consentConversationIdState(inboxId, conversationId)
}
export async function conversationConsentState(
  inboxId: InboxId,
  conversationId: ConversationId
): Promise<ConsentState> {
  return await XMTPModule.conversationConsentState(inboxId, conversationId)
}

export async function updateConversationConsent(
  inboxId: InboxId,
  conversationId: ConversationId,
  state: ConsentState
): Promise<void> {
  return XMTPModule.updateConversationConsent(inboxId, conversationId, state)
}

export function subscribeToConversations(
  inboxId: InboxId,
  type: ConversationType
) {
  return XMTPModule.subscribeToConversations(inboxId, type)
}

export function subscribeToAllMessages(
  inboxId: InboxId,
  type: ConversationType
) {
  return XMTPModule.subscribeToAllMessages(inboxId, type)
}

export async function subscribeToMessages(
  inboxId: InboxId,
  id: ConversationId
) {
  return await XMTPModule.subscribeToMessages(inboxId, id)
}

export function unsubscribeFromConversations(inboxId: InboxId) {
  return XMTPModule.unsubscribeFromConversations(inboxId)
}

export function unsubscribeFromAllMessages(inboxId: InboxId) {
  return XMTPModule.unsubscribeFromAllMessages(inboxId)
}

export async function unsubscribeFromMessages(
  inboxId: InboxId,
  id: ConversationId
) {
  return await XMTPModule.unsubscribeFromMessages(inboxId, id)
}

export function registerPushToken(pushServer: string, token: string) {
  return XMTPModule.registerPushToken(pushServer, token)
}

export function subscribePushTopics(topics: ConversationTopic[]) {
  return XMTPModule.subscribePushTopics(topics)
}

export async function exportNativeLogs() {
  return XMTPModule.exportNativeLogs()
}

export const emitter = new EventEmitter(XMTPModule ?? NativeModulesProxy.XMTP)

interface AuthParams {
  environment: string
  appVersion?: string
  dbDirectory?: string
  historySyncUrl?: string
  walletType?: string
  chainId?: number
  blockNumber?: number
}

interface CreateGroupParams {
  name: string
  imageUrlSquare: string
  description: string
  pinnedFrameUrl: string
}

export { Client } from './lib/Client'
export * from './lib/ContentCodec'
export { Conversation, ConversationVersion } from './lib/Conversation'
export { XMTPPush } from './lib/XMTPPush'
export { ConsentListEntry, DecodedMessage, MessageDeliveryStatus, ConsentState }
export { Group } from './lib/Group'
export { Dm } from './lib/Dm'
export { Member } from './lib/Member'
export { Address, InboxId, XMTPEnvironment } from './lib/Client'
export {
  ConversationOptions,
  ConversationOrder,
  ConversationId,
  ConversationTopic,
  ConversationType,
} from './lib/types/ConversationOptions'
export { MessageId, MessageOrder } from './lib/types/MessagesOptions'
