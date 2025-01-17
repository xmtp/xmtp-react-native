import { content, keystore } from '@xmtp/proto'
import { EventEmitter, NativeModulesProxy } from 'expo-modules-core'

import XMTPModule from './XMTPModule'
import { Address, InboxId, InstallationId, XMTPEnvironment } from './lib/Client'
import { ConsentRecord, ConsentState, ConsentType } from './lib/ConsentRecord'
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
  ConversationOptions,
  ConversationType,
  ConversationId,
  ConversationTopic,
} from './lib/types/ConversationOptions'
import { DecodedMessageUnion } from './lib/types/DecodedMessageUnion'
import { DefaultContentTypes } from './lib/types/DefaultContentType'
import { MessageId, MessageOrder } from './lib/types/MessagesOptions'
import { PermissionPolicySet } from './lib/types/PermissionPolicySet'
import { getAddress } from './utils/address'

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

const EncodedContent = content.EncodedContent

export function address(): string {
  return XMTPModule.address()
}

export function inboxId(): InboxId {
  return XMTPModule.inboxId()
}

export async function findInboxIdFromAddress(
  installationId: InstallationId,
  address: string
): Promise<InboxId | undefined> {
  return XMTPModule.findInboxIdFromAddress(installationId, address)
}

export async function deleteLocalDatabase(installationId: InstallationId) {
  return XMTPModule.deleteLocalDatabase(installationId)
}

export async function dropLocalDatabaseConnection(
  installationId: InstallationId
) {
  return XMTPModule.dropLocalDatabaseConnection(installationId)
}

export async function reconnectLocalDatabase(installationId: InstallationId) {
  return XMTPModule.reconnectLocalDatabase(installationId)
}

export async function getInboxState(
  installationId: InstallationId,
  refreshFromNetwork: boolean
): Promise<InboxState> {
  const inboxState = await XMTPModule.getInboxState(
    installationId,
    refreshFromNetwork
  )
  return InboxState.from(inboxState)
}

export async function getInboxStates(
  installationId: InstallationId,
  refreshFromNetwork: boolean,
  inboxIds: InboxId[]
): Promise<InboxState[]> {
  const inboxStates = await XMTPModule.getInboxStates(
    installationId,
    refreshFromNetwork,
    inboxIds
  )
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
  }
  const walletParams: WalletParams = {
    walletType,
    chainId: typeof chainId === 'number' ? chainId : undefined,
    blockNumber: typeof blockNumber === 'number' ? blockNumber : undefined,
  }
  return await XMTPModule.create(
    address,
    hasPreAuthenticateToInboxCallback,
    Array.from(dbEncryptionKey),
    JSON.stringify(authParams),
    JSON.stringify(walletParams)
  )
}

export async function build(
  address: Address,
  environment: 'local' | 'dev' | 'production',
  dbEncryptionKey: Uint8Array,
  appVersion?: string | undefined,
  dbDirectory?: string | undefined,
  historySyncUrl?: string | undefined,
  inboxId?: InboxId | undefined
): Promise<string> {
  const authParams: AuthParams = {
    environment,
    appVersion,
    dbDirectory,
    historySyncUrl,
  }
  return await XMTPModule.build(
    address,
    inboxId,
    Array.from(dbEncryptionKey),
    JSON.stringify(authParams)
  )
}

export async function revokeInstallations(
  installationId: InstallationId,
  installationIds: InstallationId[],
  walletType?: WalletType | undefined,
  chainId?: number | undefined,
  blockNumber?: number | undefined
) {
  const walletParams: WalletParams = {
    walletType,
    chainId: typeof chainId === 'number' ? chainId : undefined,
    blockNumber: typeof blockNumber === 'number' ? blockNumber : undefined,
  }
  return XMTPModule.revokeInstallations(
    installationId,
    JSON.stringify(walletParams),
    installationIds
  )
}

export async function revokeAllOtherInstallations(
  installationId: InstallationId,
  walletType?: WalletType | undefined,
  chainId?: number | undefined,
  blockNumber?: number | undefined
) {
  const walletParams: WalletParams = {
    walletType,
    chainId: typeof chainId === 'number' ? chainId : undefined,
    blockNumber: typeof blockNumber === 'number' ? blockNumber : undefined,
  }
  return XMTPModule.revokeAllOtherInstallations(
    installationId,
    JSON.stringify(walletParams)
  )
}

export async function addAccount(
  installationId: InstallationId,
  newAddress: Address,
  walletType?: WalletType | undefined,
  chainId?: number | undefined,
  blockNumber?: number | undefined
) {
  const walletParams: WalletParams = {
    walletType,
    chainId: typeof chainId === 'number' ? chainId : undefined,
    blockNumber: typeof blockNumber === 'number' ? blockNumber : undefined,
  }
  return XMTPModule.addAccount(
    installationId,
    newAddress,
    JSON.stringify(walletParams)
  )
}

export async function removeAccount(
  installationId: InstallationId,
  addressToRemove: Address,
  walletType?: WalletType | undefined,
  chainId?: number | undefined,
  blockNumber?: number | undefined
) {
  const walletParams: WalletParams = {
    walletType,
    chainId: typeof chainId === 'number' ? chainId : undefined,
    blockNumber: typeof blockNumber === 'number' ? blockNumber : undefined,
  }
  return XMTPModule.removeAccount(
    installationId,
    addressToRemove,
    JSON.stringify(walletParams)
  )
}

export async function dropClient(installationId: InstallationId) {
  return await XMTPModule.dropClient(installationId)
}

export async function signWithInstallationKey(
  installationId: InstallationId,
  message: string
): Promise<Uint8Array> {
  const signatureArray = await XMTPModule.signWithInstallationKey(
    installationId,
    message
  )
  return new Uint8Array(signatureArray)
}

export async function verifySignature(
  installationId: InstallationId,
  message: string,
  signature: Uint8Array
): Promise<boolean> {
  return await XMTPModule.verifySignature(
    installationId,
    message,
    Array.from(signature)
  )
}

export async function canMessage(
  installationId: InstallationId,
  peerAddresses: Address[]
): Promise<{ [key: Address]: boolean }> {
  return await XMTPModule.canMessage(installationId, peerAddresses)
}

export async function staticCanMessage(
  environment: XMTPEnvironment,
  peerAddresses: Address[]
): Promise<{ [key: Address]: boolean }> {
  return await XMTPModule.staticCanMessage(environment, peerAddresses)
}

export async function staticInboxStatesForInboxIds(
  environment: XMTPEnvironment,
  inboxIds: InboxId[]
): Promise<InboxState[]> {
  const inboxStates = await XMTPModule.staticInboxStatesForInboxIds(
    environment,
    inboxIds
  )
  return inboxStates.map((json: string) => {
    return InboxState.from(json)
  })
}

export async function getOrCreateInboxId(
  address: Address,
  environment: XMTPEnvironment
): Promise<InboxId> {
  return await XMTPModule.getOrCreateInboxId(getAddress(address), environment)
}

export async function encryptAttachment(
  installationId: InstallationId,
  file: DecryptedLocalAttachment
): Promise<EncryptedLocalAttachment> {
  const fileJson = JSON.stringify(file)
  const encryptedFileJson = await XMTPModule.encryptAttachment(
    installationId,
    fileJson
  )
  return JSON.parse(encryptedFileJson)
}

export async function decryptAttachment(
  installationId: InstallationId,
  encryptedFile: EncryptedLocalAttachment
): Promise<DecryptedLocalAttachment> {
  const encryptedFileJson = JSON.stringify(encryptedFile)
  const fileJson = await XMTPModule.decryptAttachment(
    installationId,
    encryptedFileJson
  )
  return JSON.parse(fileJson)
}

export async function listGroups<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  clientInstallationId: InstallationId,
  opts?: ConversationOptions | undefined,
  limit?: number | undefined,
  consentStates?: ConsentState[] | undefined
): Promise<Group<ContentTypes>[]> {
  return (
    await XMTPModule.listGroups(
      clientInstallationId,
      JSON.stringify(opts),
      limit,
      consentStates
    )
  ).map((json: string) => {
    const group = JSON.parse(json)

    const lastMessage = group['lastMessage']
      ? DecodedMessage.from(group['lastMessage'])
      : undefined
    return new Group(clientInstallationId, group, lastMessage)
  })
}

export async function listDms<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  clientInstallationId: InstallationId,
  opts?: ConversationOptions | undefined,
  limit?: number | undefined,
  consentState?: ConsentState | undefined
): Promise<Dm<ContentTypes>[]> {
  return (
    await XMTPModule.listDms(
      clientInstallationId,
      JSON.stringify(opts),
      limit,
      consentState
    )
  ).map((json: string) => {
    const group = JSON.parse(json)

    const lastMessage = group['lastMessage']
      ? DecodedMessage.from(group['lastMessage'])
      : undefined
    return new Dm(clientInstallationId, group, lastMessage)
  })
}

export async function listConversations<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  clientInstallationId: InstallationId,
  opts?: ConversationOptions | undefined,
  limit?: number | undefined,
  consentState?: ConsentState | undefined
): Promise<Conversation<ContentTypes>[]> {
  return (
    await XMTPModule.listConversations(
      clientInstallationId,
      JSON.stringify(opts),
      limit,
      consentState
    )
  ).map((json: string) => {
    const jsonObj = JSON.parse(json)

    const lastMessage = jsonObj['lastMessage']
      ? DecodedMessage.from(jsonObj['lastMessage'])
      : undefined

    if (jsonObj.version === ConversationVersion.GROUP) {
      return new Group(clientInstallationId, jsonObj, lastMessage)
    } else {
      return new Dm(clientInstallationId, jsonObj, lastMessage)
    }
  })
}

export async function getHmacKeys(
  installationId: InstallationId
): Promise<keystore.GetConversationHmacKeysResponse> {
  const hmacKeysArray = await XMTPModule.getHmacKeys(installationId)
  const array = new Uint8Array(hmacKeysArray)
  return keystore.GetConversationHmacKeysResponse.decode(array)
}

export async function conversationMessages<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  clientInstallationId: InstallationId,
  conversationId: ConversationId,
  limit?: number | undefined,
  beforeNs?: number | undefined,
  afterNs?: number | undefined,
  direction?: MessageOrder | undefined
): Promise<DecodedMessageUnion<ContentTypes>[]> {
  const messages = await XMTPModule.conversationMessages(
    clientInstallationId,
    conversationId,
    limit,
    beforeNs,
    afterNs,
    direction
  )
  return messages.map((json: string) => {
    return DecodedMessage.from(json)
  })
}

export async function findMessage<
  ContentType extends DefaultContentTypes[number] = DefaultContentTypes[number],
  ContentTypes extends DefaultContentTypes = [ContentType], // Adjusted to work with arrays
>(
  clientInstallationId: InstallationId,
  messageId: MessageId
): Promise<DecodedMessageUnion<ContentTypes> | undefined> {
  const message = await XMTPModule.findMessage(clientInstallationId, messageId)
  return DecodedMessage.from(message)
}

export async function findGroup<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  clientInstallationId: InstallationId,
  groupId: ConversationId
): Promise<Group<ContentTypes> | undefined> {
  const json = await XMTPModule.findGroup(clientInstallationId, groupId)
  const group = JSON.parse(json)
  if (!group || Object.keys(group).length === 0) {
    return undefined
  }

  return new Group(clientInstallationId, group)
}

export async function findConversation<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  clientInstallationId: InstallationId,
  conversationId: ConversationId
): Promise<Conversation<ContentTypes> | undefined> {
  const json = await XMTPModule.findConversation(
    clientInstallationId,
    conversationId
  )
  const conversation = JSON.parse(json)
  if (!conversation || Object.keys(conversation).length === 0) {
    return undefined
  }

  if (conversation.version === ConversationVersion.GROUP) {
    return new Group(clientInstallationId, conversation)
  } else {
    return new Dm(clientInstallationId, conversation)
  }
}

export async function findConversationByTopic<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  clientInstallationId: InstallationId,
  topic: ConversationTopic
): Promise<Conversation<ContentTypes> | undefined> {
  const json = await XMTPModule.findConversationByTopic(
    clientInstallationId,
    topic
  )
  const conversation = JSON.parse(json)
  if (!conversation || Object.keys(conversation).length === 0) {
    return undefined
  }

  if (conversation.version === ConversationVersion.GROUP) {
    return new Group(clientInstallationId, conversation)
  } else {
    return new Dm(clientInstallationId, conversation)
  }
}

export async function findDmByInboxId<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  clientInstallationId: InstallationId,
  peerInboxId: InboxId
): Promise<Dm<ContentTypes> | undefined> {
  const json = await XMTPModule.findDmByInboxId(
    clientInstallationId,
    peerInboxId
  )
  const dm = JSON.parse(json)
  if (!dm || Object.keys(dm).length === 0) {
    return undefined
  }

  return new Dm(clientInstallationId, dm)
}

export async function findDmByAddress<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  clientInstallationId: InstallationId,
  address: Address
): Promise<Dm<ContentTypes> | undefined> {
  const json = await XMTPModule.findDmByAddress(clientInstallationId, address)
  const dm = JSON.parse(json)
  if (!dm || Object.keys(dm).length === 0) {
    return undefined
  }

  return new Dm(clientInstallationId, dm)
}

export async function sendWithContentType<T>(
  installationId: InboxId,
  conversationId: ConversationId,
  content: T,
  codec: ContentCodec<T>
): Promise<MessageId> {
  if ('contentKey' in codec) {
    const contentJson = JSON.stringify(content)
    return await XMTPModule.sendMessage(
      installationId,
      conversationId,
      contentJson
    )
  } else {
    const encodedContent = codec.encode(content)
    encodedContent.fallback = codec.fallback(content)
    const encodedContentData = EncodedContent.encode(encodedContent).finish()

    return await XMTPModule.sendEncodedContent(
      installationId,
      conversationId,
      Array.from(encodedContentData)
    )
  }
}

export async function sendMessage(
  installationId: InstallationId,
  conversationId: ConversationId,
  content: any
): Promise<MessageId> {
  const contentJson = JSON.stringify(content)
  return await XMTPModule.sendMessage(
    installationId,
    conversationId,
    contentJson
  )
}

export async function publishPreparedMessages(
  installationId: InstallationId,
  conversationId: ConversationId
) {
  return await XMTPModule.publishPreparedMessages(
    installationId,
    conversationId
  )
}

export async function prepareMessage(
  installationId: InstallationId,
  conversationId: ConversationId,
  content: any
): Promise<MessageId> {
  const contentJson = JSON.stringify(content)
  return await XMTPModule.prepareMessage(
    installationId,
    conversationId,
    contentJson
  )
}

export async function prepareMessageWithContentType<T>(
  installationId: InstallationId,
  conversationId: ConversationId,
  content: any,
  codec: ContentCodec<T>
): Promise<MessageId> {
  if ('contentKey' in codec) {
    return prepareMessage(installationId, conversationId, content)
  }
  const encodedContent = codec.encode(content)
  encodedContent.fallback = codec.fallback(content)
  const encodedContentData = EncodedContent.encode(encodedContent).finish()
  return await XMTPModule.prepareEncodedMessage(
    installationId,
    conversationId,
    Array.from(encodedContentData)
  )
}

export async function findOrCreateDm<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  clientInstallationId: InstallationId,
  peerAddress: Address
): Promise<Dm<ContentTypes>> {
  const dm = JSON.parse(
    await XMTPModule.findOrCreateDm(clientInstallationId, peerAddress)
  )
  return new Dm(clientInstallationId, dm)
}

export async function findOrCreateDmWithInboxId<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  clientInstallationId: InstallationId,
  peerInboxId: InboxId
): Promise<Dm<ContentTypes>> {
  const dm = JSON.parse(
    await XMTPModule.findOrCreateDmWithInboxId(
      clientInstallationId,
      peerInboxId
    )
  )
  return new Dm(clientInstallationId, dm)
}

export async function createGroup<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  clientInstallationId: InstallationId,
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
      clientInstallationId,
      peerAddresses,
      permissionLevel,
      JSON.stringify(options)
    )
  )

  return new Group(clientInstallationId, group)
}

export async function createGroupCustomPermissionsWithInboxIds<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  clientInstallationId: InstallationId,
  inboxIds: InboxId[],
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
    await XMTPModule.createGroupCustomPermissionsWithInboxIds(
      clientInstallationId,
      inboxIds,
      JSON.stringify(permissionPolicySet),
      JSON.stringify(options)
    )
  )

  return new Group(clientInstallationId, group)
}

export async function createGroupWithInboxIds<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  clientInstallationId: InstallationId,
  inboxIds: InboxId[],
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
    await XMTPModule.createGroupWithInboxIds(
      clientInstallationId,
      inboxIds,
      permissionLevel,
      JSON.stringify(options)
    )
  )

  return new Group(clientInstallationId, group)
}

export async function createGroupCustomPermissions<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  clientInstallationId: InstallationId,
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
      clientInstallationId,
      peerAddresses,
      JSON.stringify(permissionPolicySet),
      JSON.stringify(options)
    )
  )

  return new Group(clientInstallationId, group)
}

export async function listMemberInboxIds(
  clientInstallationId: InstallationId,
  id: ConversationId
): Promise<InboxId[]> {
  return XMTPModule.listMemberInboxIds(clientInstallationId, id)
}

export async function dmPeerInboxId(
  clientInstallationId: InstallationId,
  dmId: ConversationId
): Promise<InboxId> {
  return XMTPModule.dmPeerInboxId(clientInstallationId, dmId)
}

export async function listConversationMembers(
  installationId: InstallationId,
  id: ConversationId
): Promise<Member[]> {
  const members = await XMTPModule.listConversationMembers(installationId, id)

  return members.map((json: string) => {
    return Member.from(json)
  })
}

export async function syncConversations(installationId: InstallationId) {
  await XMTPModule.syncConversations(installationId)
}

export async function syncAllConversations(
  installationId: InstallationId,
  consentState?: ConsentState | undefined
): Promise<number> {
  return await XMTPModule.syncAllConversations(installationId, consentState)
}

export async function syncConversation(
  installationId: InstallationId,
  id: ConversationId
) {
  await XMTPModule.syncConversation(installationId, id)
}

export async function addGroupMembers(
  installationId: InstallationId,
  id: ConversationId,
  addresses: Address[]
): Promise<void> {
  return XMTPModule.addGroupMembers(installationId, id, addresses)
}

export async function removeGroupMembers(
  installationId: InstallationId,
  id: ConversationId,
  addresses: Address[]
): Promise<void> {
  return XMTPModule.removeGroupMembers(installationId, id, addresses)
}

export async function addGroupMembersByInboxId(
  installationId: InstallationId,
  id: ConversationId,
  inboxIds: InboxId[]
): Promise<void> {
  return XMTPModule.addGroupMembersByInboxId(installationId, id, inboxIds)
}

export async function removeGroupMembersByInboxId(
  installationId: InstallationId,
  id: ConversationId,
  inboxIds: InboxId[]
): Promise<void> {
  return XMTPModule.removeGroupMembersByInboxId(installationId, id, inboxIds)
}

export function groupName(
  installationId: InstallationId,
  id: ConversationId
): string | PromiseLike<string> {
  return XMTPModule.groupName(installationId, id)
}

export function updateGroupName(
  installationId: InstallationId,
  id: ConversationId,
  groupName: string
): Promise<void> {
  return XMTPModule.updateGroupName(installationId, id, groupName)
}

export function groupImageUrlSquare(
  installationId: InstallationId,
  id: ConversationId
): string | PromiseLike<string> {
  return XMTPModule.groupImageUrlSquare(installationId, id)
}

export function updateGroupImageUrlSquare(
  installationId: InstallationId,
  id: ConversationId,
  imageUrlSquare: string
): Promise<void> {
  return XMTPModule.updateGroupImageUrlSquare(
    installationId,
    id,
    imageUrlSquare
  )
}

export function groupDescription(
  installationId: InstallationId,
  id: ConversationId
): string | PromiseLike<string> {
  return XMTPModule.groupDescription(installationId, id)
}

export function updateGroupDescription(
  installationId: InstallationId,
  id: ConversationId,
  description: string
): Promise<void> {
  return XMTPModule.updateGroupDescription(installationId, id, description)
}

export function groupPinnedFrameUrl(
  installationId: InstallationId,
  id: ConversationId
): string | PromiseLike<string> {
  return XMTPModule.groupPinnedFrameUrl(installationId, id)
}

export function updateGroupPinnedFrameUrl(
  installationId: InstallationId,
  id: ConversationId,
  pinnedFrameUrl: string
): Promise<void> {
  return XMTPModule.updateGroupPinnedFrameUrl(
    installationId,
    id,
    pinnedFrameUrl
  )
}

export function isGroupActive(
  installationId: InstallationId,
  id: ConversationId
): Promise<boolean> {
  return XMTPModule.isGroupActive(installationId, id)
}

export async function addedByInboxId(
  installationId: InstallationId,
  id: ConversationId
): Promise<InboxId> {
  return XMTPModule.addedByInboxId(installationId, id) as InboxId
}

export async function creatorInboxId(
  installationId: InstallationId,
  id: ConversationId
): Promise<InboxId> {
  return XMTPModule.creatorInboxId(installationId, id) as InboxId
}

export async function isAdmin(
  clientInstallationId: InstallationId,
  id: ConversationId,
  inboxId: InboxId
): Promise<boolean> {
  return XMTPModule.isAdmin(clientInstallationId, id, inboxId)
}

export async function isSuperAdmin(
  clientInstallationId: InstallationId,
  id: ConversationId,
  inboxId: InboxId
): Promise<boolean> {
  return XMTPModule.isSuperAdmin(clientInstallationId, id, inboxId)
}

export async function listAdmins(
  installationId: InstallationId,
  id: ConversationId
): Promise<InboxId[]> {
  return XMTPModule.listAdmins(installationId, id)
}

export async function listSuperAdmins(
  installationId: InstallationId,
  id: ConversationId
): Promise<InboxId[]> {
  return XMTPModule.listSuperAdmins(installationId, id)
}

export async function addAdmin(
  clientInstallationId: InstallationId,
  id: ConversationId,
  inboxId: InboxId
): Promise<void> {
  return XMTPModule.addAdmin(clientInstallationId, id, inboxId)
}

export async function addSuperAdmin(
  clientInstallationId: InstallationId,
  id: ConversationId,
  inboxId: InboxId
): Promise<void> {
  return XMTPModule.addSuperAdmin(clientInstallationId, id, inboxId)
}

export async function removeAdmin(
  clientInstallationId: InstallationId,
  id: ConversationId,
  inboxId: InboxId
): Promise<void> {
  return XMTPModule.removeAdmin(clientInstallationId, id, inboxId)
}

export async function removeSuperAdmin(
  clientInstallationId: InstallationId,
  id: ConversationId,
  inboxId: InboxId
): Promise<void> {
  return XMTPModule.removeSuperAdmin(clientInstallationId, id, inboxId)
}

export async function updateAddMemberPermission(
  clientInstallationId: InstallationId,
  id: ConversationId,
  permissionOption: PermissionUpdateOption
): Promise<void> {
  return XMTPModule.updateAddMemberPermission(
    clientInstallationId,
    id,
    permissionOption
  )
}

export async function updateRemoveMemberPermission(
  clientInstallationId: InstallationId,
  id: ConversationId,
  permissionOption: PermissionUpdateOption
): Promise<void> {
  return XMTPModule.updateRemoveMemberPermission(
    clientInstallationId,
    id,
    permissionOption
  )
}

export async function updateAddAdminPermission(
  clientInstallationId: InstallationId,
  id: ConversationId,
  permissionOption: PermissionUpdateOption
): Promise<void> {
  return XMTPModule.updateAddAdminPermission(
    clientInstallationId,
    id,
    permissionOption
  )
}

export async function updateRemoveAdminPermission(
  clientInstallationId: InstallationId,
  id: ConversationId,
  permissionOption: PermissionUpdateOption
): Promise<void> {
  return XMTPModule.updateRemoveAdminPermission(
    clientInstallationId,
    id,
    permissionOption
  )
}

export async function updateGroupNamePermission(
  clientInstallationId: InstallationId,
  id: ConversationId,
  permissionOption: PermissionUpdateOption
): Promise<void> {
  return XMTPModule.updateGroupNamePermission(
    clientInstallationId,
    id,
    permissionOption
  )
}

export async function updateGroupImageUrlSquarePermission(
  clientInstallationId: InstallationId,
  id: ConversationId,
  permissionOption: PermissionUpdateOption
): Promise<void> {
  return XMTPModule.updateGroupImageUrlSquarePermission(
    clientInstallationId,
    id,
    permissionOption
  )
}

export async function updateGroupDescriptionPermission(
  clientInstallationId: InstallationId,
  id: ConversationId,
  permissionOption: PermissionUpdateOption
): Promise<void> {
  return XMTPModule.updateGroupDescriptionPermission(
    clientInstallationId,
    id,
    permissionOption
  )
}

export async function updateGroupPinnedFrameUrlPermission(
  clientInstallationId: InstallationId,
  id: ConversationId,
  permissionOption: PermissionUpdateOption
): Promise<void> {
  return XMTPModule.updateGroupPinnedFrameUrlPermission(
    clientInstallationId,
    id,
    permissionOption
  )
}

export async function permissionPolicySet(
  clientInstallationId: InstallationId,
  id: ConversationId
): Promise<PermissionPolicySet> {
  const json = await XMTPModule.permissionPolicySet(clientInstallationId, id)
  return JSON.parse(json)
}

export async function processMessage<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  clientInstallationId: InstallationId,
  id: ConversationId,
  encryptedMessage: string
): Promise<DecodedMessageUnion<ContentTypes>> {
  const json = await XMTPModule.processMessage(
    clientInstallationId,
    id,
    encryptedMessage
  )
  return DecodedMessage.from(json)
}

export async function processWelcomeMessage<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  clientInstallationId: InstallationId,
  encryptedMessage: string
): Promise<Promise<Conversation<ContentTypes>>> {
  const json = await XMTPModule.processWelcomeMessage(
    clientInstallationId,
    encryptedMessage
  )
  const conversation = JSON.parse(json)

  if (conversation.version === ConversationVersion.GROUP) {
    return new Group(clientInstallationId, conversation)
  } else {
    return new Dm(clientInstallationId, conversation)
  }
}

export async function syncConsent(
  installationId: InstallationId
): Promise<void> {
  return await XMTPModule.syncConsent(installationId)
}

export async function setConsentState(
  installationId: InstallationId,
  value: string,
  entryType: ConsentType,
  consentType: ConsentState
): Promise<void> {
  return await XMTPModule.setConsentState(
    installationId,
    value,
    entryType,
    consentType
  )
}

export async function consentAddressState(
  installationId: InstallationId,
  address: Address
): Promise<ConsentState> {
  return await XMTPModule.consentAddressState(installationId, address)
}
export async function consentInboxIdState(
  installationId: InstallationId,
  peerInboxId: InboxId
): Promise<ConsentState> {
  return await XMTPModule.consentInboxIdState(installationId, peerInboxId)
}
export async function consentConversationIdState(
  installationId: InstallationId,
  conversationId: ConversationId
): Promise<ConsentState> {
  return await XMTPModule.consentConversationIdState(
    installationId,
    conversationId
  )
}
export async function conversationConsentState(
  installationId: InstallationId,
  conversationId: ConversationId
): Promise<ConsentState> {
  return await XMTPModule.conversationConsentState(
    installationId,
    conversationId
  )
}

export async function updateConversationConsent(
  installationId: InstallationId,
  conversationId: ConversationId,
  state: ConsentState
): Promise<void> {
  return XMTPModule.updateConversationConsent(
    installationId,
    conversationId,
    state
  )
}

export function subscribeToPreferenceUpdates(installationId: InstallationId) {
  return XMTPModule.subscribeToPreferenceUpdates(installationId)
}

export function subscribeToConsent(installationId: InstallationId) {
  return XMTPModule.subscribeToConsent(installationId)
}

export function subscribeToConversations(
  installationId: InstallationId,
  type: ConversationType
) {
  return XMTPModule.subscribeToConversations(installationId, type)
}

export function subscribeToAllMessages(
  installationId: InstallationId,
  type: ConversationType
) {
  return XMTPModule.subscribeToAllMessages(installationId, type)
}

export async function subscribeToMessages(
  installationId: InstallationId,
  id: ConversationId
) {
  return await XMTPModule.subscribeToMessages(installationId, id)
}

export function unsubscribeFromPreferenceUpdates(
  installationId: InstallationId
) {
  return XMTPModule.unsubscribeFromPreferenceUpdates(installationId)
}

export function unsubscribeFromConsent(installationId: InstallationId) {
  return XMTPModule.unsubscribeFromConsent(installationId)
}

export function unsubscribeFromConversations(installationId: InstallationId) {
  return XMTPModule.unsubscribeFromConversations(installationId)
}

export function unsubscribeFromAllMessages(installationId: InstallationId) {
  return XMTPModule.unsubscribeFromAllMessages(installationId)
}

export async function unsubscribeFromMessages(
  installationId: InstallationId,
  id: ConversationId
) {
  return await XMTPModule.unsubscribeFromMessages(installationId, id)
}

export function registerPushToken(pushServer: string, token: string) {
  return XMTPModule.registerPushToken(pushServer, token)
}

export function subscribePushTopics(
  installationId: InstallationId,
  topics: ConversationTopic[]
) {
  return XMTPModule.subscribePushTopics(installationId, topics)
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
}

interface WalletParams {
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
export { ConsentRecord, DecodedMessage, MessageDeliveryStatus, ConsentState }
export { Group } from './lib/Group'
export { Dm } from './lib/Dm'
export { Member } from './lib/Member'
export { Address, InboxId, XMTPEnvironment } from './lib/Client'
export {
  ConversationOptions,
  ConversationId,
  ConversationTopic,
  ConversationType,
} from './lib/types/ConversationOptions'
export { MessageId, MessageOrder } from './lib/types/MessagesOptions'
export { DecodedMessageUnion } from './lib/types/DecodedMessageUnion'
