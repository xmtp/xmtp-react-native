import { content, invitation, keystore } from '@xmtp/proto'
import { EventEmitter, NativeModulesProxy } from 'expo-modules-core'

import { Client } from '.'
import { ConversationContext } from './XMTP.types'
import XMTPModule from './XMTPModule'
import { InboxId } from './lib/Client'
import { ConsentListEntry, ConsentState } from './lib/ConsentListEntry'
import {
  ContentCodec,
  DecryptedLocalAttachment,
  EncryptedLocalAttachment,
  PreparedLocalMessage,
} from './lib/ContentCodec'
import { Conversation } from './lib/Conversation'
import {
  ConversationContainer,
  ConversationVersion,
} from './lib/ConversationContainer'
import { DecodedMessage, MessageDeliveryStatus } from './lib/DecodedMessage'
import { Dm } from './lib/Dm'
import { Group, PermissionUpdateOption } from './lib/Group'
import { InboxState } from './lib/InboxState'
import { Member } from './lib/Member'
import type { Query } from './lib/Query'
import { WalletType } from './lib/Signer'
import { ConversationSendPayload } from './lib/types'
import { DefaultContentTypes } from './lib/types/DefaultContentType'
import { ConversationOrder, GroupOptions } from './lib/types/GroupOptions'
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

export function inboxId(): string {
  return XMTPModule.inboxId()
}

export async function findInboxIdFromAddress(
  inboxId: string,
  address: string
): Promise<InboxId | undefined> {
  return XMTPModule.findInboxIdFromAddress(inboxId, address)
}

export async function deleteLocalDatabase(inboxId: string) {
  return XMTPModule.deleteLocalDatabase(inboxId)
}

export async function dropLocalDatabaseConnection(inboxId: string) {
  return XMTPModule.dropLocalDatabaseConnection(inboxId)
}

export async function reconnectLocalDatabase(inboxId: string) {
  return XMTPModule.reconnectLocalDatabase(inboxId)
}

export async function requestMessageHistorySync(inboxId: string) {
  return XMTPModule.requestMessageHistorySync(inboxId)
}

export async function getInboxState(
  inboxId: string,
  refreshFromNetwork: boolean
): Promise<InboxState> {
  const inboxState = await XMTPModule.getInboxState(inboxId, refreshFromNetwork)
  return InboxState.from(inboxState)
}

export async function revokeAllOtherInstallations(inboxId: string) {
  return XMTPModule.revokeAllOtherInstallations(inboxId)
}

export async function auth(
  address: string,
  environment: 'local' | 'dev' | 'production',
  appVersion?: string | undefined,
  hasCreateIdentityCallback?: boolean | undefined,
  hasEnableIdentityCallback?: boolean | undefined,
  hasPreAuthenticateToInboxCallback?: boolean | undefined,
  enableV3?: boolean | undefined,
  dbEncryptionKey?: Uint8Array | undefined,
  dbDirectory?: string | undefined,
  historySyncUrl?: string | undefined
) {
  const encryptionKey = dbEncryptionKey
    ? Array.from(dbEncryptionKey)
    : undefined

  const authParams: AuthParams = {
    environment,
    appVersion,
    enableV3,
    dbDirectory,
    historySyncUrl,
  }
  return await XMTPModule.auth(
    address,
    hasCreateIdentityCallback,
    hasEnableIdentityCallback,
    hasPreAuthenticateToInboxCallback,
    encryptionKey,
    JSON.stringify(authParams)
  )
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
  appVersion?: string | undefined,
  hasCreateIdentityCallback?: boolean | undefined,
  hasEnableIdentityCallback?: boolean | undefined,
  hasPreAuthenticateToInboxCallback?: boolean | undefined,
  enableV3?: boolean | undefined,
  dbEncryptionKey?: Uint8Array | undefined,
  dbDirectory?: string | undefined,
  historySyncUrl?: string | undefined
): Promise<string> {
  const encryptionKey = dbEncryptionKey
    ? Array.from(dbEncryptionKey)
    : undefined

  const authParams: AuthParams = {
    environment,
    appVersion,
    enableV3,
    dbDirectory,
    historySyncUrl,
  }
  return await XMTPModule.createRandom(
    hasCreateIdentityCallback,
    hasEnableIdentityCallback,
    hasPreAuthenticateToInboxCallback,
    encryptionKey,
    JSON.stringify(authParams)
  )
}

export async function createFromKeyBundle(
  keyBundle: string,
  environment: 'local' | 'dev' | 'production',
  appVersion?: string | undefined,
  enableV3?: boolean | undefined,
  dbEncryptionKey?: Uint8Array | undefined,
  dbDirectory?: string | undefined,
  historySyncUrl?: string | undefined
): Promise<string> {
  const encryptionKey = dbEncryptionKey
    ? Array.from(dbEncryptionKey)
    : undefined

  const authParams: AuthParams = {
    environment,
    appVersion,
    enableV3,
    dbDirectory,
    historySyncUrl,
  }
  return await XMTPModule.createFromKeyBundle(
    keyBundle,
    encryptionKey,
    JSON.stringify(authParams)
  )
}

export async function createFromKeyBundleWithSigner(
  address: string,
  keyBundle: string,
  environment: 'local' | 'dev' | 'production',
  appVersion?: string | undefined,
  enableV3?: boolean | undefined,
  dbEncryptionKey?: Uint8Array | undefined,
  dbDirectory?: string | undefined,
  historySyncUrl?: string | undefined
): Promise<string> {
  const encryptionKey = dbEncryptionKey
    ? Array.from(dbEncryptionKey)
    : undefined

  const authParams: AuthParams = {
    environment,
    appVersion,
    enableV3,
    dbDirectory,
    historySyncUrl,
  }
  return await XMTPModule.createFromKeyBundleWithSigner(
    address,
    keyBundle,
    encryptionKey,
    JSON.stringify(authParams)
  )
}

export async function createRandomV3(
  environment: 'local' | 'dev' | 'production',
  appVersion?: string | undefined,
  hasCreateIdentityCallback?: boolean | undefined,
  hasEnableIdentityCallback?: boolean | undefined,
  hasPreAuthenticateToInboxCallback?: boolean | undefined,
  enableV3?: boolean | undefined,
  dbEncryptionKey?: Uint8Array | undefined,
  dbDirectory?: string | undefined,
  historySyncUrl?: string | undefined
): Promise<string> {
  const encryptionKey = dbEncryptionKey
    ? Array.from(dbEncryptionKey)
    : undefined

  const authParams: AuthParams = {
    environment,
    appVersion,
    enableV3,
    dbDirectory,
    historySyncUrl,
  }
  return await XMTPModule.createRandomV3(
    hasCreateIdentityCallback,
    hasEnableIdentityCallback,
    hasPreAuthenticateToInboxCallback,
    encryptionKey,
    JSON.stringify(authParams)
  )
}

export async function createV3(
  address: string,
  environment: 'local' | 'dev' | 'production',
  appVersion?: string | undefined,
  hasCreateIdentityCallback?: boolean | undefined,
  hasEnableIdentityCallback?: boolean | undefined,
  hasPreAuthenticateToInboxCallback?: boolean | undefined,
  enableV3?: boolean | undefined,
  dbEncryptionKey?: Uint8Array | undefined,
  dbDirectory?: string | undefined,
  historySyncUrl?: string | undefined,
  walletType?: WalletType | undefined,
  chainId?: number | undefined,
  blockNumber?: number | undefined
) {
  const encryptionKey = dbEncryptionKey
    ? Array.from(dbEncryptionKey)
    : undefined

  const authParams: AuthParams = {
    environment,
    appVersion,
    enableV3,
    dbDirectory,
    historySyncUrl,
    walletType,
    chainId,
    blockNumber,
  }
  return await XMTPModule.createV3(
    address,
    hasCreateIdentityCallback,
    hasEnableIdentityCallback,
    hasPreAuthenticateToInboxCallback,
    encryptionKey,
    JSON.stringify(authParams)
  )
}

export async function buildV3(
  address: string,
  environment: 'local' | 'dev' | 'production',
  appVersion?: string | undefined,
  enableV3?: boolean | undefined,
  dbEncryptionKey?: Uint8Array | undefined,
  dbDirectory?: string | undefined,
  historySyncUrl?: string | undefined
) {
  const encryptionKey = dbEncryptionKey
    ? Array.from(dbEncryptionKey)
    : undefined

  const authParams: AuthParams = {
    environment,
    appVersion,
    enableV3,
    dbDirectory,
    historySyncUrl,
  }
  return await XMTPModule.buildV3(
    address,
    encryptionKey,
    JSON.stringify(authParams)
  )
}

export async function dropClient(inboxId: string) {
  return await XMTPModule.dropClient(inboxId)
}

export async function findOrCreateDm<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  peerAddress: string
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
  peerAddresses: string[],
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
  peerAddresses: string[],
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

export async function listGroups<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  opts?: GroupOptions | undefined,
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

export async function listV3Conversations<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  opts?: GroupOptions | undefined,
  order?: ConversationOrder | undefined,
  limit?: number | undefined
): Promise<ConversationContainer<ContentTypes>[]> {
  return (
    await XMTPModule.listV3Conversations(
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

export async function listMemberInboxIds<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(client: Client<ContentTypes>, id: string): Promise<InboxId[]> {
  return XMTPModule.listMemberInboxIds(client.inboxId, id)
}

export async function listPeerInboxId<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(client: Client<ContentTypes>, dmId: string): Promise<InboxId> {
  return XMTPModule.listPeerInboxId(client.inboxId, dmId)
}

export async function listConversationMembers(
  inboxId: string,
  id: string
): Promise<Member[]> {
  const members = await XMTPModule.listConversationMembers(inboxId, id)

  return members.map((json: string) => {
    return Member.from(json)
  })
}

export async function prepareConversationMessage(
  inboxId: string,
  conversationId: string,
  content: any
): Promise<string> {
  const contentJson = JSON.stringify(content)
  return await XMTPModule.prepareConversationMessage(
    inboxId,
    conversationId,
    contentJson
  )
}

export async function sendMessageToConversation(
  inboxId: string,
  conversationId: string,
  content: any
): Promise<string> {
  const contentJson = JSON.stringify(content)
  return await XMTPModule.sendMessageToConversation(
    inboxId,
    conversationId,
    contentJson
  )
}

export async function publishPreparedGroupMessages(
  inboxId: string,
  groupId: string
) {
  return await XMTPModule.publishPreparedGroupMessages(inboxId, groupId)
}

export async function conversationMessages<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  conversationId: string,
  limit?: number | undefined,
  before?: number | Date | undefined,
  after?: number | Date | undefined,
  direction?:
    | 'SORT_DIRECTION_ASCENDING'
    | 'SORT_DIRECTION_DESCENDING'
    | undefined
): Promise<DecodedMessage<ContentTypes>[]> {
  const messages = await XMTPModule.conversationMessages(
    client.inboxId,
    conversationId,
    limit,
    before,
    after,
    direction
  )
  return messages.map((json: string) => {
    return DecodedMessage.from(json, client)
  })
}

export async function findGroup<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  groupId: string
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
  conversationId: string
): Promise<ConversationContainer<ContentTypes> | undefined> {
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
  topic: string
): Promise<ConversationContainer<ContentTypes> | undefined> {
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

export async function findDm<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  address: string
): Promise<Dm<ContentTypes> | undefined> {
  const json = await XMTPModule.findDm(client.inboxId, address)
  const dm = JSON.parse(json)
  if (!dm || Object.keys(dm).length === 0) {
    return undefined
  }

  return new Dm(client, dm)
}

export async function findV3Message<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  messageId: string
): Promise<DecodedMessage<ContentTypes> | undefined> {
  const message = await XMTPModule.findV3Message(client.inboxId, messageId)
  return DecodedMessage.from(message, client)
}

export async function syncConversations(inboxId: string) {
  await XMTPModule.syncConversations(inboxId)
}

export async function syncAllConversations(inboxId: string): Promise<number> {
  return await XMTPModule.syncAllConversations(inboxId)
}

export async function syncConversation(inboxId: string, id: string) {
  await XMTPModule.syncConversation(inboxId, id)
}

export async function subscribeToGroupMessages(inboxId: string, id: string) {
  return await XMTPModule.subscribeToGroupMessages(inboxId, id)
}

export async function unsubscribeFromGroupMessages(
  inboxId: string,
  id: string
) {
  return await XMTPModule.unsubscribeFromGroupMessages(inboxId, id)
}

export async function addGroupMembers(
  inboxId: string,
  id: string,
  addresses: string[]
): Promise<void> {
  return XMTPModule.addGroupMembers(inboxId, id, addresses)
}

export async function removeGroupMembers(
  inboxId: string,
  id: string,
  addresses: string[]
): Promise<void> {
  return XMTPModule.removeGroupMembers(inboxId, id, addresses)
}

export async function addGroupMembersByInboxId(
  inboxId: string,
  id: string,
  inboxIds: string[]
): Promise<void> {
  return XMTPModule.addGroupMembersByInboxId(inboxId, id, inboxIds)
}

export async function removeGroupMembersByInboxId(
  inboxId: string,
  id: string,
  inboxIds: string[]
): Promise<void> {
  return XMTPModule.removeGroupMembersByInboxId(inboxId, id, inboxIds)
}

export function groupDescription(
  inboxId: string,
  id: string
): string | PromiseLike<string> {
  return XMTPModule.groupDescription(inboxId, id)
}

export function updateGroupDescription(
  inboxId: string,
  id: string,
  description: string
): Promise<void> {
  return XMTPModule.updateGroupDescription(inboxId, id, description)
}

export function groupImageUrlSquare(
  inboxId: string,
  id: string
): string | PromiseLike<string> {
  return XMTPModule.groupImageUrlSquare(inboxId, id)
}

export function updateGroupImageUrlSquare(
  inboxId: string,
  id: string,
  imageUrlSquare: string
): Promise<void> {
  return XMTPModule.updateGroupImageUrlSquare(inboxId, id, imageUrlSquare)
}

export function groupName(
  inboxId: string,
  id: string
): string | PromiseLike<string> {
  return XMTPModule.groupName(inboxId, id)
}

export function updateGroupName(
  inboxId: string,
  id: string,
  groupName: string
): Promise<void> {
  return XMTPModule.updateGroupName(inboxId, id, groupName)
}

export function groupPinnedFrameUrl(
  inboxId: string,
  id: string
): string | PromiseLike<string> {
  return XMTPModule.groupPinnedFrameUrl(inboxId, id)
}

export function updateGroupPinnedFrameUrl(
  inboxId: string,
  id: string,
  pinnedFrameUrl: string
): Promise<void> {
  return XMTPModule.updateGroupPinnedFrameUrl(inboxId, id, pinnedFrameUrl)
}

export async function sign(
  inboxId: string,
  digest: Uint8Array,
  keyType: string,
  preKeyIndex: number = 0
): Promise<Uint8Array> {
  const signatureArray = await XMTPModule.sign(
    inboxId,
    Array.from(digest),
    keyType,
    preKeyIndex
  )
  return new Uint8Array(signatureArray)
}

export async function exportPublicKeyBundle(
  inboxId: string
): Promise<Uint8Array> {
  const publicBundleArray = await XMTPModule.exportPublicKeyBundle(inboxId)
  return new Uint8Array(publicBundleArray)
}

export async function exportKeyBundle(inboxId: string): Promise<string> {
  return await XMTPModule.exportKeyBundle(inboxId)
}

export async function exportConversationTopicData(
  inboxId: string,
  conversationTopic: string
): Promise<string> {
  return await XMTPModule.exportConversationTopicData(
    inboxId,
    conversationTopic
  )
}

export async function getHmacKeys(
  inboxId: string
): Promise<keystore.GetConversationHmacKeysResponse> {
  const hmacKeysArray = await XMTPModule.getHmacKeys(inboxId)
  const array = new Uint8Array(hmacKeysArray)
  return keystore.GetConversationHmacKeysResponse.decode(array)
}

export async function importConversationTopicData<
  ContentTypes extends ContentCodec<unknown>[],
>(
  client: Client<ContentTypes>,
  topicData: string
): Promise<Conversation<ContentTypes>> {
  const json = await XMTPModule.importConversationTopicData(
    client.inboxId,
    topicData
  )
  return new Conversation(client, JSON.parse(json))
}

export async function canMessage(
  inboxId: string,
  peerAddress: string
): Promise<boolean> {
  return await XMTPModule.canMessage(inboxId, getAddress(peerAddress))
}

export async function canGroupMessage(
  inboxId: string,
  peerAddresses: string[]
): Promise<{ [key: string]: boolean }> {
  return await XMTPModule.canGroupMessage(inboxId, peerAddresses)
}

export async function staticCanMessage(
  peerAddress: string,
  environment: 'local' | 'dev' | 'production',
  appVersion?: string | undefined
): Promise<boolean> {
  return await XMTPModule.staticCanMessage(
    getAddress(peerAddress),
    environment,
    appVersion
  )
}

export async function getOrCreateInboxId(
  address: string,
  environment: 'local' | 'dev' | 'production'
): Promise<InboxId> {
  return await XMTPModule.getOrCreateInboxId(getAddress(address), environment)
}

export async function encryptAttachment(
  inboxId: string,
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
  inboxId: string,
  encryptedFile: EncryptedLocalAttachment
): Promise<DecryptedLocalAttachment> {
  const encryptedFileJson = JSON.stringify(encryptedFile)
  const fileJson = await XMTPModule.decryptAttachment(
    inboxId,
    encryptedFileJson
  )
  return JSON.parse(fileJson)
}

export async function listConversations<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(client: Client<ContentTypes>): Promise<Conversation<ContentTypes>[]> {
  return (await XMTPModule.listConversations(client.inboxId)).map(
    (json: string) => {
      return new Conversation(client, JSON.parse(json))
    }
  )
}

export async function listAll<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>
): Promise<ConversationContainer<ContentTypes>[]> {
  const list = await XMTPModule.listAll(client.inboxId)
  return list.map((json: string) => {
    const jsonObj = JSON.parse(json)
    if (jsonObj.version === ConversationVersion.GROUP) {
      return new Group(client, jsonObj)
    } else {
      return new Conversation(client, jsonObj)
    }
  })
}

export async function listMessages<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  conversationTopic: string,
  limit?: number | undefined,
  before?: number | Date | undefined,
  after?: number | Date | undefined,
  direction?:
    | 'SORT_DIRECTION_ASCENDING'
    | 'SORT_DIRECTION_DESCENDING'
    | undefined
): Promise<DecodedMessage<ContentTypes>[]> {
  const messages = await XMTPModule.loadMessages(
    client.inboxId,
    conversationTopic,
    limit,
    typeof before === 'number' ? before : before?.getTime(),
    typeof after === 'number' ? after : after?.getTime(),
    direction || 'SORT_DIRECTION_DESCENDING'
  )

  return messages.map((json: string) => {
    return DecodedMessage.from(json, client)
  })
}

export async function listBatchMessages<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  queries: Query[]
): Promise<DecodedMessage<ContentTypes>[]> {
  const topics = queries.map((item) => {
    return JSON.stringify({
      limit: item.pageSize || 0,
      topic: item.contentTopic,
      after:
        (typeof item.startTime === 'number'
          ? item.startTime
          : item.startTime?.getTime()) || 0,
      before:
        (typeof item.endTime === 'number'
          ? item.endTime
          : item.endTime?.getTime()) || 0,
      direction: item.direction || 'SORT_DIRECTION_DESCENDING',
    })
  })
  const messages = await XMTPModule.loadBatchMessages(client.inboxId, topics)

  return messages.map((json: string) => {
    return DecodedMessage.from(json, client)
  })
}

// TODO: support conversation ID
export async function createConversation<
  ContentTypes extends ContentCodec<any>[],
>(
  client: Client<ContentTypes>,
  peerAddress: string,
  context?: ConversationContext,
  consentProofPayload?: invitation.ConsentProofPayload
): Promise<Conversation<ContentTypes>> {
  const consentProofData = consentProofPayload
    ? Array.from(
        invitation.ConsentProofPayload.encode(consentProofPayload).finish()
      )
    : []
  return new Conversation(
    client,
    JSON.parse(
      await XMTPModule.createConversation(
        client.inboxId,
        getAddress(peerAddress),
        JSON.stringify(context || {}),
        consentProofData
      )
    )
  )
}

export async function sendWithContentType<T>(
  inboxId: string,
  conversationTopic: string,
  content: T,
  codec: ContentCodec<T>
): Promise<string> {
  if ('contentKey' in codec) {
    const contentJson = JSON.stringify(content)
    return await XMTPModule.sendMessage(inboxId, conversationTopic, contentJson)
  } else {
    const encodedContent = codec.encode(content)
    encodedContent.fallback = codec.fallback(content)
    const encodedContentData = EncodedContent.encode(encodedContent).finish()

    return await XMTPModule.sendEncodedContent(
      inboxId,
      conversationTopic,
      Array.from(encodedContentData)
    )
  }
}

export async function sendMessage<
  SendContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  inboxId: string,
  conversationTopic: string,
  content: ConversationSendPayload<SendContentTypes>
): Promise<string> {
  // TODO: consider eager validating of `MessageContent` here
  //       instead of waiting for native code to validate
  const contentJson = JSON.stringify(content)
  return await XMTPModule.sendMessage(inboxId, conversationTopic, contentJson)
}

export async function prepareMessage<
  PrepareContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  inboxId: string,
  conversationTopic: string,
  content: ConversationSendPayload<PrepareContentTypes>
): Promise<PreparedLocalMessage> {
  // TODO: consider eager validating of `MessageContent` here
  //       instead of waiting for native code to validate
  const contentJson = JSON.stringify(content)
  const preparedJson = await XMTPModule.prepareMessage(
    inboxId,
    conversationTopic,
    contentJson
  )
  return JSON.parse(preparedJson)
}

export async function prepareMessageWithContentType<T>(
  inboxId: string,
  conversationTopic: string,
  content: any,
  codec: ContentCodec<T>
): Promise<PreparedLocalMessage> {
  if ('contentKey' in codec) {
    return prepareMessage(inboxId, conversationTopic, content)
  }
  const encodedContent = codec.encode(content)
  encodedContent.fallback = codec.fallback(content)
  const encodedContentData = EncodedContent.encode(encodedContent).finish()
  const preparedJson = await XMTPModule.prepareEncodedMessage(
    inboxId,
    conversationTopic,
    Array.from(encodedContentData)
  )
  return JSON.parse(preparedJson)
}

export async function sendPreparedMessage(
  inboxId: string,
  preparedLocalMessage: PreparedLocalMessage
): Promise<string> {
  const preparedLocalMessageJson = JSON.stringify(preparedLocalMessage)
  return await XMTPModule.sendPreparedMessage(inboxId, preparedLocalMessageJson)
}

export function subscribeToConversations(inboxId: string) {
  return XMTPModule.subscribeToConversations(inboxId)
}

export function subscribeToAll(inboxId: string) {
  return XMTPModule.subscribeToAll(inboxId)
}

export function subscribeToGroups(inboxId: string) {
  return XMTPModule.subscribeToGroups(inboxId)
}

export function subscribeToAllMessages(
  inboxId: string,
  includeGroups: boolean
) {
  return XMTPModule.subscribeToAllMessages(inboxId, includeGroups)
}

export function subscribeToAllGroupMessages(inboxId: string) {
  return XMTPModule.subscribeToAllGroupMessages(inboxId)
}

export async function subscribeToMessages(inboxId: string, topic: string) {
  return await XMTPModule.subscribeToMessages(inboxId, topic)
}

export function unsubscribeFromConversations(inboxId: string) {
  return XMTPModule.unsubscribeFromConversations(inboxId)
}

export function unsubscribeFromGroups(inboxId: string) {
  return XMTPModule.unsubscribeFromGroups(inboxId)
}

export function unsubscribeFromAllMessages(inboxId: string) {
  return XMTPModule.unsubscribeFromAllMessages(inboxId)
}

export function unsubscribeFromAllGroupMessages(inboxId: string) {
  return XMTPModule.unsubscribeFromAllGroupMessages(inboxId)
}

export async function unsubscribeFromMessages(inboxId: string, topic: string) {
  return await XMTPModule.unsubscribeFromMessages(inboxId, topic)
}

export function subscribeToV3Conversations(inboxId: string) {
  return XMTPModule.subscribeToV3Conversations(inboxId)
}

export function subscribeToAllConversationMessages(inboxId: string) {
  return XMTPModule.subscribeToAllConversationMessages(inboxId)
}

export async function subscribeToConversationMessages(
  inboxId: string,
  id: string
) {
  return await XMTPModule.subscribeToConversationMessages(inboxId, id)
}

export function unsubscribeFromAllConversationMessages(inboxId: string) {
  return XMTPModule.unsubscribeFromAllConversationMessages(inboxId)
}

export function unsubscribeFromV3Conversations(inboxId: string) {
  return XMTPModule.unsubscribeFromV3Conversations(inboxId)
}

export async function unsubscribeFromConversationMessages(
  inboxId: string,
  id: string
) {
  return await XMTPModule.unsubscribeFromConversationMessages(inboxId, id)
}

export function registerPushToken(pushServer: string, token: string) {
  return XMTPModule.registerPushToken(pushServer, token)
}

export function subscribePushTopics(inboxId: string, topics: string[]) {
  return XMTPModule.subscribePushTopics(inboxId, topics)
}

export async function decodeMessage<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  inboxId: string,
  topic: string,
  encryptedMessage: string
): Promise<DecodedMessage<ContentTypes>> {
  return JSON.parse(
    await XMTPModule.decodeMessage(inboxId, topic, encryptedMessage)
  )
}

export async function conversationConsentState(
  inboxId: string,
  conversationTopic: string
): Promise<ConsentState> {
  return await XMTPModule.conversationConsentState(inboxId, conversationTopic)
}

export async function conversationV3ConsentState(
  inboxId: string,
  conversationId: string
): Promise<ConsentState> {
  return await XMTPModule.conversationV3ConsentState(inboxId, conversationId)
}

export async function isAllowed(
  inboxId: string,
  address: string
): Promise<boolean> {
  return await XMTPModule.isAllowed(inboxId, address)
}

export async function isDenied(
  inboxId: string,
  address: string
): Promise<boolean> {
  return await XMTPModule.isDenied(inboxId, address)
}

export async function denyContacts(
  inboxId: string,
  addresses: string[]
): Promise<void> {
  return await XMTPModule.denyContacts(inboxId, addresses)
}

export async function allowContacts(
  inboxId: string,
  addresses: string[]
): Promise<void> {
  return await XMTPModule.allowContacts(inboxId, addresses)
}

export async function refreshConsentList(
  inboxId: string
): Promise<ConsentListEntry[]> {
  const consentList = await XMTPModule.refreshConsentList(inboxId)

  return consentList.map((json: string) => {
    return ConsentListEntry.from(json)
  })
}

export async function consentList(
  inboxId: string
): Promise<ConsentListEntry[]> {
  const consentList = await XMTPModule.consentList(inboxId)

  return consentList.map((json: string) => {
    return ConsentListEntry.from(json)
  })
}

export function preEnableIdentityCallbackCompleted() {
  XMTPModule.preEnableIdentityCallbackCompleted()
}

export function preCreateIdentityCallbackCompleted() {
  XMTPModule.preCreateIdentityCallbackCompleted()
}

export function preAuthenticateToInboxCallbackCompleted() {
  XMTPModule.preAuthenticateToInboxCallbackCompleted()
}

export async function isGroupActive(
  inboxId: string,
  id: string
): Promise<boolean> {
  return XMTPModule.isGroupActive(inboxId, id)
}

export async function addedByInboxId(
  inboxId: string,
  id: string
): Promise<InboxId> {
  return XMTPModule.addedByInboxId(inboxId, id) as InboxId
}

export async function creatorInboxId(
  inboxId: string,
  id: string
): Promise<InboxId> {
  return XMTPModule.creatorInboxId(inboxId, id) as InboxId
}

export async function isAdmin(
  clientInboxId: string,
  id: string,
  inboxId: string
): Promise<boolean> {
  return XMTPModule.isAdmin(clientInboxId, id, inboxId)
}

export async function isSuperAdmin(
  clientInboxId: string,
  id: string,
  inboxId: string
): Promise<boolean> {
  return XMTPModule.isSuperAdmin(clientInboxId, id, inboxId)
}

export async function listAdmins(
  inboxId: string,
  id: string
): Promise<InboxId[]> {
  return XMTPModule.listAdmins(inboxId, id)
}

export async function listSuperAdmins(
  inboxId: string,
  id: string
): Promise<InboxId[]> {
  return XMTPModule.listSuperAdmins(inboxId, id)
}

export async function addAdmin(
  clientInboxId: string,
  id: string,
  inboxId: string
): Promise<void> {
  return XMTPModule.addAdmin(clientInboxId, id, inboxId)
}

export async function addSuperAdmin(
  clientInboxId: string,
  id: string,
  inboxId: string
): Promise<void> {
  return XMTPModule.addSuperAdmin(clientInboxId, id, inboxId)
}

export async function removeAdmin(
  clientInboxId: string,
  id: string,
  inboxId: string
): Promise<void> {
  return XMTPModule.removeAdmin(clientInboxId, id, inboxId)
}

export async function removeSuperAdmin(
  clientInboxId: string,
  id: string,
  inboxId: string
): Promise<void> {
  return XMTPModule.removeSuperAdmin(clientInboxId, id, inboxId)
}

export async function updateAddMemberPermission(
  clientInboxId: string,
  id: string,
  permissionOption: PermissionUpdateOption
): Promise<void> {
  return XMTPModule.updateAddMemberPermission(
    clientInboxId,
    id,
    permissionOption
  )
}

export async function updateRemoveMemberPermission(
  clientInboxId: string,
  id: string,
  permissionOption: PermissionUpdateOption
): Promise<void> {
  return XMTPModule.updateRemoveMemberPermission(
    clientInboxId,
    id,
    permissionOption
  )
}

export async function updateAddAdminPermission(
  clientInboxId: string,
  id: string,
  permissionOption: PermissionUpdateOption
): Promise<void> {
  return XMTPModule.updateAddAdminPermission(
    clientInboxId,
    id,
    permissionOption
  )
}

export async function updateRemoveAdminPermission(
  clientInboxId: string,
  id: string,
  permissionOption: PermissionUpdateOption
): Promise<void> {
  return XMTPModule.updateRemoveAdminPermission(
    clientInboxId,
    id,
    permissionOption
  )
}

export async function updateGroupNamePermission(
  clientInboxId: string,
  id: string,
  permissionOption: PermissionUpdateOption
): Promise<void> {
  return XMTPModule.updateGroupNamePermission(
    clientInboxId,
    id,
    permissionOption
  )
}

export async function updateGroupImageUrlSquarePermission(
  clientInboxId: string,
  id: string,
  permissionOption: PermissionUpdateOption
): Promise<void> {
  return XMTPModule.updateGroupImageUrlSquarePermission(
    clientInboxId,
    id,
    permissionOption
  )
}

export async function updateGroupDescriptionPermission(
  clientInboxId: string,
  id: string,
  permissionOption: PermissionUpdateOption
): Promise<void> {
  return XMTPModule.updateGroupDescriptionPermission(
    clientInboxId,
    id,
    permissionOption
  )
}

export async function updateGroupPinnedFrameUrlPermission(
  clientInboxId: string,
  id: string,
  permissionOption: PermissionUpdateOption
): Promise<void> {
  return XMTPModule.updateGroupPinnedFrameUrlPermission(
    clientInboxId,
    id,
    permissionOption
  )
}

export async function permissionPolicySet(
  clientInboxId: string,
  id: string
): Promise<PermissionPolicySet> {
  const json = await XMTPModule.permissionPolicySet(clientInboxId, id)
  return JSON.parse(json)
}

export async function allowGroups(
  inboxId: string,
  groupIds: string[]
): Promise<void> {
  return XMTPModule.allowGroups(inboxId, groupIds)
}

export async function denyGroups(
  inboxId: string,
  groupIds: string[]
): Promise<void> {
  return XMTPModule.denyGroups(inboxId, groupIds)
}

export async function isGroupAllowed(
  inboxId: string,
  groupId: string
): Promise<boolean> {
  return XMTPModule.isGroupAllowed(inboxId, groupId)
}

export async function isGroupDenied(
  inboxId: string,
  groupId: string
): Promise<boolean> {
  return XMTPModule.isGroupDenied(inboxId, groupId)
}

export async function updateConversationConsent(
  inboxId: string,
  conversationId: string,
  state: string
): Promise<void> {
  return XMTPModule.updateConversationConsent(inboxId, conversationId, state)
}

export async function allowInboxes(
  inboxId: string,
  inboxIds: string[]
): Promise<void> {
  return XMTPModule.allowInboxes(inboxId, inboxIds)
}

export async function denyInboxes(
  inboxId: string,
  inboxIds: string[]
): Promise<void> {
  return XMTPModule.denyInboxes(inboxId, inboxIds)
}

export async function isInboxAllowed(
  clientInboxId: string,
  inboxId: string
): Promise<boolean> {
  return XMTPModule.isInboxAllowed(clientInboxId, inboxId)
}

export async function isInboxDenied(
  clientInboxId: string,
  inboxId: string
): Promise<boolean> {
  return XMTPModule.isInboxDenied(clientInboxId, inboxId)
}

export async function processConversationMessage<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  id: string,
  encryptedMessage: string
): Promise<DecodedMessage<ContentTypes>> {
  const json = await XMTPModule.processConversationMessage(
    client.inboxId,
    id,
    encryptedMessage
  )
  return DecodedMessage.fromObject(json, client)
}

export async function processWelcomeMessage<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  encryptedMessage: string
): Promise<Group<ContentTypes>> {
  const json = await XMTPModule.processWelcomeMessage(
    client.inboxId,
    encryptedMessage
  )
  const group = JSON.parse(json)
  return new Group(client, group)
}

export async function processConversationWelcomeMessage<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  encryptedMessage: string
): Promise<Promise<ConversationContainer<ContentTypes>>> {
  const json = await XMTPModule.processConversationWelcomeMessage(
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

export async function exportNativeLogs() {
  return XMTPModule.exportNativeLogs()
}

export const emitter = new EventEmitter(XMTPModule ?? NativeModulesProxy.XMTP)

interface AuthParams {
  environment: string
  appVersion?: string
  enableV3?: boolean
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

export * from './XMTP.types'
export { Client } from './lib/Client'
export * from './lib/ContentCodec'
export { Conversation } from './lib/Conversation'
export {
  ConversationContainer,
  ConversationVersion,
} from './lib/ConversationContainer'
export { Query } from './lib/Query'
export { XMTPPush } from './lib/XMTPPush'
export { ConsentListEntry, DecodedMessage, MessageDeliveryStatus }
export { Group } from './lib/Group'
export { Dm } from './lib/Dm'
export { Member } from './lib/Member'
export { InboxId } from './lib/Client'
export { GroupOptions, ConversationOrder } from './lib/types/GroupOptions'
