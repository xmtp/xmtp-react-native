import { content, keystore } from '@xmtp/proto'
import { EventEmitter, NativeModulesProxy } from 'expo-modules-core'

import XMTPModule from './XMTPModule'
import {
  Address,
  Client,
  InboxId,
  InstallationId,
  SignatureType,
  XMTPEnvironment,
} from './lib/Client'
import { ConsentRecord, ConsentState, ConsentType } from './lib/ConsentRecord'
import {
  ContentCodec,
  DecryptedLocalAttachment,
  EncryptedLocalAttachment,
} from './lib/ContentCodec'
import { Conversation, ConversationVersion } from './lib/Conversation'
import { ConversationDebugInfo } from './lib/ConversationDebugInfo'
import { DecodedMessage, MessageDeliveryStatus } from './lib/DecodedMessage'
import { DisappearingMessageSettings } from './lib/DisappearingMessageSettings'
import { Dm } from './lib/Dm'
import { Group, PermissionUpdateOption } from './lib/Group'
import { InboxState } from './lib/InboxState'
import { Member, MembershipResult } from './lib/Member'
import { PublicIdentity } from './lib/PublicIdentity'
import { SignerType } from './lib/Signer'
import {
  KeyPackageStatuses,
  NetworkDebugInfo,
} from './lib/XMTPDebugInformation'
import {
  ConversationOptions,
  ConversationFilterType,
  ConversationId,
  ConversationTopic,
} from './lib/types/ConversationOptions'
import { DecodedMessageUnion } from './lib/types/DecodedMessageUnion'
import { DefaultContentTypes } from './lib/types/DefaultContentType'
import { LogLevel, LogRotation } from './lib/types/LogTypes'
import { MessageId, MessageOrder } from './lib/types/MessagesOptions'
import { PermissionPolicySet } from './lib/types/PermissionPolicySet'
import { ArchiveMetadata } from './lib/ArchiveOptions'

export * from './context'
export * from './hooks'
export { GroupUpdatedCodec } from './lib/NativeCodecs/GroupUpdatedCodec'
export { ReactionCodec } from './lib/NativeCodecs/ReactionCodec'
export { ReactionV2Codec } from './lib/NativeCodecs/ReactionV2Codec'
export { ReadReceiptCodec } from './lib/NativeCodecs/ReadReceiptCodec'
export { RemoteAttachmentCodec } from './lib/NativeCodecs/RemoteAttachmentCodec'
export { MultiRemoteAttachmentCodec } from './lib/NativeCodecs/MultiRemoteAttachmentCodec'
export { ReplyCodec } from './lib/NativeCodecs/ReplyCodec'
export { StaticAttachmentCodec } from './lib/NativeCodecs/StaticAttachmentCodec'
export { TextCodec } from './lib/NativeCodecs/TextCodec'
export * from './lib/Signer'
const EncodedContent = content.EncodedContent

export function inboxId(): InboxId {
  return XMTPModule.inboxId()
}

export async function findInboxIdFromIdentity(
  installationId: InstallationId,
  publicIdentity: PublicIdentity
): Promise<InboxId | undefined> {
  return XMTPModule.findInboxIdFromIdentity(
    installationId,
    JSON.stringify(publicIdentity)
  )
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

export async function createRandom(
  environment: 'local' | 'dev' | 'production',
  dbEncryptionKey: Uint8Array,
  hasPreAuthenticateToInboxCallback?: boolean | undefined,
  dbDirectory?: string | undefined,
  historySyncUrl?: string | undefined,
  customLocalHost?: string | undefined,
  deviceSyncEnabled?: boolean | undefined,
  debugEventsEnabled?: boolean | undefined,
  appVersion?: string | undefined
): Promise<string> {
  const authParams: AuthParams = {
    environment,
    dbDirectory,
    historySyncUrl,
    customLocalHost,
    deviceSyncEnabled,
    debugEventsEnabled,
    appVersion,
  }
  return await XMTPModule.createRandom(
    hasPreAuthenticateToInboxCallback,
    Array.from(dbEncryptionKey),
    JSON.stringify(authParams)
  )
}

export async function create(
  identity: PublicIdentity,
  environment: 'local' | 'dev' | 'production',
  dbEncryptionKey: Uint8Array,
  hasPreAuthenticateToInboxCallback?: boolean | undefined,
  dbDirectory?: string | undefined,
  historySyncUrl?: string | undefined,
  signerType?: SignerType | undefined,
  chainId?: number | undefined,
  blockNumber?: number | undefined,
  customLocalHost?: string | undefined,
  deviceSyncEnabled?: boolean | undefined,
  debugEventsEnabled?: boolean | undefined,
  appVersion?: string | undefined
): Promise<string> {
  const authParams: AuthParams = {
    environment,
    dbDirectory,
    historySyncUrl,
    customLocalHost,
    deviceSyncEnabled,
    debugEventsEnabled,
    appVersion,
  }
  const signerParams: SignerParams = {
    signerType,
    chainId: typeof chainId === 'number' ? chainId : undefined,
    blockNumber: typeof blockNumber === 'number' ? blockNumber : undefined,
  }
  return await XMTPModule.create(
    JSON.stringify(identity),
    hasPreAuthenticateToInboxCallback,
    Array.from(dbEncryptionKey),
    JSON.stringify(authParams),
    JSON.stringify(signerParams)
  )
}

export async function build(
  identity: PublicIdentity,
  environment: 'local' | 'dev' | 'production',
  dbEncryptionKey: Uint8Array,
  dbDirectory?: string | undefined,
  historySyncUrl?: string | undefined,
  inboxId?: InboxId | undefined,
  customLocalHost?: string | undefined,
  deviceSyncEnabled?: boolean | undefined,
  debugEventsEnabled?: boolean | undefined,
  appVersion?: string | undefined
): Promise<string> {
  const authParams: AuthParams = {
    environment,
    dbDirectory,
    historySyncUrl,
    customLocalHost,
    deviceSyncEnabled,
    debugEventsEnabled,
    appVersion,
  }
  return await XMTPModule.build(
    JSON.stringify(identity),
    inboxId,
    Array.from(dbEncryptionKey),
    JSON.stringify(authParams)
  )
}

export async function ffiCreateClient(
  identity: PublicIdentity,
  environment: 'local' | 'dev' | 'production',
  dbEncryptionKey: Uint8Array,
  dbDirectory?: string | undefined,
  historySyncUrl?: string | undefined,
  customLocalHost?: string | undefined,
  deviceSyncEnabled?: boolean | undefined,
  debugEventsEnabled?: boolean | undefined,
  appVersion?: string | undefined
): Promise<string> {
  const authParams: AuthParams = {
    environment,
    dbDirectory,
    historySyncUrl,
    customLocalHost,
    deviceSyncEnabled,
    debugEventsEnabled,
    appVersion,
  }
  return await XMTPModule.ffiCreateClient(
    JSON.stringify(identity),
    Array.from(dbEncryptionKey),
    JSON.stringify(authParams)
  )
}

export async function ffiCreateSignatureText(
  installationId: InstallationId
): Promise<string> {
  return await XMTPModule.ffiCreateSignatureText(installationId)
}

export async function ffiAddEcdsaSignature(
  installationId: InstallationId,
  signatureBytes: Uint8Array
): Promise<void> {
  return await XMTPModule.ffiAddEcdsaSignature(
    installationId,
    Array.from(signatureBytes)
  )
}

export async function ffiAddScwSignature(
  installationId: InstallationId,
  signatureBytes: Uint8Array,
  address: Address,
  chainId: number,
  blockNumber?: number | undefined
): Promise<void> {
  return await XMTPModule.ffiAddScwSignature(
    installationId,
    Array.from(signatureBytes),
    address,
    chainId,
    blockNumber
  )
}

export async function ffiRegisterIdentity(
  installationId: InstallationId
): Promise<void> {
  return await XMTPModule.ffiRegisterIdentity(installationId)
}

export async function revokeInstallations(
  installationId: InstallationId,
  installationIds: InstallationId[],
  identity: PublicIdentity,
  signerType?: SignerType | undefined,
  chainId?: number | undefined,
  blockNumber?: number | undefined
) {
  const signerParams: SignerParams = {
    signerType,
    chainId: typeof chainId === 'number' ? chainId : undefined,
    blockNumber: typeof blockNumber === 'number' ? blockNumber : undefined,
  }
  return XMTPModule.revokeInstallations(
    installationId,
    JSON.stringify(signerParams),
    installationIds,
    JSON.stringify(identity)
  )
}

export async function revokeAllOtherInstallations(
  installationId: InstallationId,
  identity: PublicIdentity,
  signerType?: SignerType | undefined,
  chainId?: number | undefined,
  blockNumber?: number | undefined
) {
  const signerParams: SignerParams = {
    signerType,
    chainId: typeof chainId === 'number' ? chainId : undefined,
    blockNumber: typeof blockNumber === 'number' ? blockNumber : undefined,
  }
  return XMTPModule.revokeAllOtherInstallations(
    installationId,
    JSON.stringify(signerParams),
    JSON.stringify(identity)
  )
}

export async function addAccount(
  installationId: InstallationId,
  newIdentity: PublicIdentity,
  signerType?: SignerType | undefined,
  chainId?: number | undefined,
  blockNumber?: number | undefined,
  allowReassignInboxId: boolean = false
) {
  const signerParams: SignerParams = {
    signerType,
    chainId: typeof chainId === 'number' ? chainId : undefined,
    blockNumber: typeof blockNumber === 'number' ? blockNumber : undefined,
  }
  return XMTPModule.addAccount(
    installationId,
    JSON.stringify(newIdentity),
    JSON.stringify(signerParams),
    allowReassignInboxId
  )
}

export async function removeAccount(
  installationId: InstallationId,
  identityToRemove: PublicIdentity,
  identity: PublicIdentity,
  signerType?: SignerType | undefined,
  chainId?: number | undefined,
  blockNumber?: number | undefined
) {
  const signerParams: SignerParams = {
    signerType,
    chainId: typeof chainId === 'number' ? chainId : undefined,
    blockNumber: typeof blockNumber === 'number' ? blockNumber : undefined,
  }
  return XMTPModule.removeAccount(
    installationId,
    JSON.stringify(identityToRemove),
    JSON.stringify(signerParams),
    JSON.stringify(identity)
  )
}

export async function ffiRevokeInstallationsSignatureText(
  installationId: InstallationId,
  installationIds: InstallationId[]
): Promise<string> {
  return await XMTPModule.ffiRevokeInstallationsSignatureText(
    installationId,
    installationIds
  )
}

export async function ffiRevokeAllOtherInstallationsSignatureText(
  installationId: InstallationId
): Promise<string> {
  return await XMTPModule.ffiRevokeAllOtherInstallationsSignatureText(
    installationId
  )
}

export async function ffiRevokeWalletSignatureText(
  installationId: InstallationId,
  identityToRemove: PublicIdentity
): Promise<string> {
  return await XMTPModule.ffiRevokeWalletSignatureText(
    installationId,
    JSON.stringify(identityToRemove)
  )
}

export async function ffiAddWalletSignatureText(
  installationId: InstallationId,
  identityToAdd: PublicIdentity,
  allowReassignInboxId: boolean
): Promise<string> {
  return await XMTPModule.ffiAddWalletSignatureText(
    installationId,
    JSON.stringify(identityToAdd),
    allowReassignInboxId
  )
}

export async function ffiApplySignatureRequest(
  installationId: InstallationId
): Promise<void> {
  return await XMTPModule.ffiApplySignatureRequest(installationId)
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
  peerIdentities: PublicIdentity[]
): Promise<{ [key: string]: boolean }> {
  const identities = peerIdentities.map((identity) => JSON.stringify(identity))
  return await XMTPModule.canMessage(installationId, identities)
}

export async function staticCanMessage(
  environment: XMTPEnvironment,
  peerIdentities: PublicIdentity[]
): Promise<{ [key: string]: boolean }> {
  const identities = peerIdentities.map((identity) => JSON.stringify(identity))
  return await XMTPModule.staticCanMessage(environment, identities)
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

export async function staticRevokeInstallations(
  environment: XMTPEnvironment,
  identity: PublicIdentity,
  inboxId: InboxId,
  installationIds: InstallationId[],
  signerType?: SignerType | undefined,
  chainId?: number | undefined,
  blockNumber?: number | undefined
): Promise<void> {
  const walletParams: SignerParams = {
    signerType,
    chainId: typeof chainId === 'number' ? chainId : undefined,
    blockNumber: typeof blockNumber === 'number' ? blockNumber : undefined,
  }
  await XMTPModule.staticRevokeInstallations(
    environment,
    JSON.stringify(identity),
    inboxId,
    JSON.stringify(walletParams),
    installationIds
  )
}

export async function ffiStaticRevokeInstallationsSignatureText(
  environment: XMTPEnvironment,
  identity: PublicIdentity,
  inboxId: InboxId,
  installationIds: InstallationId[]
): Promise<string> {
  return await XMTPModule.ffiStaticRevokeInstallationsSignatureText(
    environment,
    JSON.stringify(identity),
    inboxId,
    installationIds
  )
}

export async function ffiStaticApplySignature(
  environment: XMTPEnvironment,
  signatureType: SignatureType
): Promise<void> {
  await XMTPModule.ffiStaticApplySignature(environment, signatureType)
}

export async function ffiStaticAddEcdsaSignature(
  signatureType: SignatureType,
  signatureBytes: Uint8Array
): Promise<void> {
  return await XMTPModule.ffiStaticAddEcdsaSignature(
    signatureType,
    Array.from(signatureBytes)
  )
}

export async function ffiStaticAddScwSignature(
  signatureType: SignatureType,
  signatureBytes: Uint8Array,
  address: Address,
  chainId: number,
  blockNumber?: number | undefined
): Promise<void> {
  return await XMTPModule.ffiStaticAddScwSignature(
    signatureType,
    Array.from(signatureBytes),
    address,
    chainId,
    blockNumber
  )
}

export async function staticKeyPackageStatuses(
  environment: XMTPEnvironment,
  installationIds: InstallationId[]
): Promise<KeyPackageStatuses> {
  const info = await XMTPModule.staticKeyPackageStatuses(
    environment,
    installationIds
  )
  return KeyPackageStatuses.from(info)
}

export function staticActivatePersistentLibXMTPLogWriter(
  logLevel: LogLevel,
  logRotation: LogRotation,
  logMaxFiles: number
) {
  XMTPModule.staticActivatePersistentLibXMTPLogWriter(
    logLevel,
    logRotation,
    logMaxFiles
  )
}

export function staticDeactivatePersistentLibXMTPLogWriter() {
  XMTPModule.staticDeactivatePersistentLibXMTPLogWriter()
}

export function staticIsLogWriterActive() {
  return XMTPModule.isLogWriterActive()
}

export function staticGetXMTPLogFilePaths(): string[] {
  return XMTPModule.staticGetXMTPLogFilePaths()
}

export function readXMTPLogFile(filePath: string): Promise<string> {
  return XMTPModule.readXMTPLogFile(filePath)
}

export function staticClearXMTPLogs(): number {
  return XMTPModule.staticClearXMTPLogs()
}

export async function getOrCreateInboxId(
  publicIdentity: PublicIdentity,
  environment: XMTPEnvironment
): Promise<InboxId> {
  return await XMTPModule.getOrCreateInboxId(
    JSON.stringify(publicIdentity),
    environment
  )
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
  client: Client<ContentTypes>,
  opts?: ConversationOptions | undefined,
  limit?: number | undefined,
  consentStates?: ConsentState[] | undefined
): Promise<Group<ContentTypes>[]> {
  return (
    await XMTPModule.listGroups(
      client.installationId,
      JSON.stringify(opts),
      limit,
      consentStates
    )
  ).map((json: string) => {
    const group = JSON.parse(json)

    const lastMessage = group['lastMessage']
      ? (DecodedMessage.from<ContentTypes[number], ContentTypes>(
          group['lastMessage']
        ) as DecodedMessageUnion<ContentTypes> | undefined)
      : undefined
    return new Group(client, group, lastMessage)
  })
}

export async function listDms<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  opts?: ConversationOptions | undefined,
  limit?: number | undefined,
  consentStates?: ConsentState[] | undefined
): Promise<Dm<ContentTypes>[]> {
  return (
    await XMTPModule.listDms(
      client.installationId,
      JSON.stringify(opts),
      limit,
      consentStates
    )
  ).map((json: string) => {
    const group = JSON.parse(json)

    const lastMessage = group['lastMessage']
      ? (DecodedMessage.from<ContentTypes[number], ContentTypes>(
          group['lastMessage']
        ) as DecodedMessageUnion<ContentTypes> | undefined)
      : undefined
    return new Dm(client, group, lastMessage)
  })
}

export async function listConversations<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  opts?: ConversationOptions | undefined,
  limit?: number | undefined,
  consentStates?: ConsentState[] | undefined
): Promise<Conversation<ContentTypes>[]> {
  return (
    await XMTPModule.listConversations(
      client.installationId,
      JSON.stringify(opts),
      limit,
      consentStates
    )
  ).map((json: string) => {
    const jsonObj = JSON.parse(json)

    const lastMessage = jsonObj['lastMessage']
      ? (DecodedMessage.from<ContentTypes[number], ContentTypes>(
          jsonObj['lastMessage']
        ) as DecodedMessageUnion<ContentTypes> | undefined)
      : undefined

    if (jsonObj.version === ConversationVersion.GROUP) {
      return new Group(client, jsonObj, lastMessage)
    } else {
      return new Dm(client, jsonObj, lastMessage)
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

export async function getAllPushTopics(
  installationId: InstallationId
): Promise<ConversationTopic[]> {
  return await XMTPModule.getAllPushTopics(installationId)
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

export async function conversationMessagesWithReactions<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  clientInstallationId: InstallationId,
  conversationId: ConversationId,
  limit?: number | undefined,
  beforeNs?: number | undefined,
  afterNs?: number | undefined,
  direction?: MessageOrder | undefined
): Promise<DecodedMessageUnion<ContentTypes>[]> {
  const messages = await XMTPModule.conversationMessagesWithReactions(
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
  client: Client<ContentTypes>,
  groupId: ConversationId
): Promise<Group<ContentTypes> | undefined> {
  const json = await XMTPModule.findGroup(client.installationId, groupId)
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
  const json = await XMTPModule.findConversation(
    client.installationId,
    conversationId
  )
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
  const json = await XMTPModule.findConversationByTopic(
    client.installationId,
    topic
  )
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
  const json = await XMTPModule.findDmByInboxId(
    client.installationId,
    peerInboxId
  )
  const dm = JSON.parse(json)
  if (!dm || Object.keys(dm).length === 0) {
    return undefined
  }

  return new Dm(client, dm)
}

export async function findDmByIdentity<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  publicIdentity: PublicIdentity
): Promise<Dm<ContentTypes> | undefined> {
  const json = await XMTPModule.findDmByIdentity(
    client.installationId,
    JSON.stringify(publicIdentity)
  )
  const dm = JSON.parse(json)
  if (!dm || Object.keys(dm).length === 0) {
    return undefined
  }

  return new Dm(client, dm)
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
  client: Client<ContentTypes>,
  peerInboxId: InboxId,
  disappearStartingAtNs: number | undefined,
  retentionDurationInNs: number | undefined
): Promise<Dm<ContentTypes>> {
  const dm = JSON.parse(
    await XMTPModule.findOrCreateDm(
      client.installationId,
      peerInboxId,
      disappearStartingAtNs,
      retentionDurationInNs
    )
  )
  return new Dm(client, dm)
}

export async function findOrCreateDmWithIdentity<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  peerIdentity: PublicIdentity,
  disappearStartingAtNs: number | undefined,
  retentionDurationInNs: number | undefined
): Promise<Dm<ContentTypes>> {
  const dm = JSON.parse(
    await XMTPModule.findOrCreateDmWithIdentity(
      client.installationId,
      JSON.stringify(peerIdentity),
      disappearStartingAtNs,
      retentionDurationInNs
    )
  )
  return new Dm(client, dm)
}

export async function createGroup<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  peerInboxIds: InboxId[],
  permissionLevel: 'all_members' | 'admin_only' = 'all_members',
  name: string = '',
  imageUrl: string = '',
  description: string = '',
  disappearStartingAtNs: number = 0,
  retentionDurationInNs: number = 0
): Promise<Group<ContentTypes>> {
  const options: CreateGroupParams = {
    name,
    imageUrl,
    description,
    disappearStartingAtNs,
    retentionDurationInNs,
  }
  const group = JSON.parse(
    await XMTPModule.createGroup(
      client.installationId,
      peerInboxIds,
      permissionLevel,
      JSON.stringify(options)
    )
  )

  return new Group(client, group)
}

export async function createGroupCustomPermissionsWithIdentities<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  peerIdentities: PublicIdentity[],
  permissionPolicySet: PermissionPolicySet,
  name: string = '',
  imageUrl: string = '',
  description: string = '',
  disappearStartingAtNs: number = 0,
  retentionDurationInNs: number = 0
): Promise<Group<ContentTypes>> {
  const options: CreateGroupParams = {
    name,
    imageUrl,
    description,
    disappearStartingAtNs,
    retentionDurationInNs,
  }
  const identities = peerIdentities.map((identity) => JSON.stringify(identity))
  const group = JSON.parse(
    await XMTPModule.createGroupCustomPermissionsWithIdentities(
      client.installationId,
      identities,
      JSON.stringify(permissionPolicySet),
      JSON.stringify(options)
    )
  )

  return new Group(client, group)
}

export async function createGroupWithIdentities<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  peerIdentities: PublicIdentity[],
  permissionLevel: 'all_members' | 'admin_only' = 'all_members',
  name: string = '',
  imageUrl: string = '',
  description: string = '',
  disappearStartingAtNs: number = 0,
  retentionDurationInNs: number = 0
): Promise<Group<ContentTypes>> {
  const options: CreateGroupParams = {
    name,
    imageUrl,
    description,
    disappearStartingAtNs,
    retentionDurationInNs,
  }
  const identities = peerIdentities.map((identity) => JSON.stringify(identity))
  const group = JSON.parse(
    await XMTPModule.createGroupWithIdentities(
      client.installationId,
      identities,
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
  inboxIds: InboxId[],
  permissionPolicySet: PermissionPolicySet,
  name: string = '',
  imageUrl: string = '',
  description: string = '',
  disappearStartingAtNs: number = 0,
  retentionDurationInNs: number = 0
): Promise<Group<ContentTypes>> {
  const options: CreateGroupParams = {
    name,
    imageUrl,
    description,
    disappearStartingAtNs,
    retentionDurationInNs,
  }
  const group = JSON.parse(
    await XMTPModule.createGroupCustomPermissions(
      client.installationId,
      inboxIds,
      JSON.stringify(permissionPolicySet),
      JSON.stringify(options)
    )
  )

  return new Group(client, group)
}

export async function createGroupOptimistic<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  client: Client<ContentTypes>,
  permissionLevel: 'all_members' | 'admin_only' = 'all_members',
  name: string = '',
  imageUrl: string = '',
  description: string = '',
  disappearStartingAtNs: number = 0,
  retentionDurationInNs: number = 0
): Promise<Group<ContentTypes>> {
  const options: CreateGroupParams = {
    name,
    imageUrl,
    description,
    disappearStartingAtNs,
    retentionDurationInNs,
  }
  const group = JSON.parse(
    await XMTPModule.createGroupOptimistic(
      client.installationId,
      permissionLevel,
      JSON.stringify(options)
    )
  )

  return new Group(client, group)
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
  consentStates?: ConsentState[] | undefined
): Promise<number> {
  return await XMTPModule.syncAllConversations(installationId, consentStates)
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
  inboxIds: InboxId[]
): Promise<MembershipResult> {
  const result = await XMTPModule.addGroupMembers(installationId, id, inboxIds)
  return MembershipResult.from(result)
}

export async function removeGroupMembers(
  installationId: InstallationId,
  id: ConversationId,
  inboxIds: InboxId[]
): Promise<void> {
  return await XMTPModule.removeGroupMembers(installationId, id, inboxIds)
}

export async function addGroupMembersByIdentity(
  installationId: InstallationId,
  id: ConversationId,
  identities: PublicIdentity[]
): Promise<MembershipResult> {
  const ids = identities.map((identity) => JSON.stringify(identity))
  const result = await XMTPModule.addGroupMembersByIdentity(
    installationId,
    id,
    ids
  )
  return MembershipResult.from(result)
}

export async function removeGroupMembersByIdentity(
  installationId: InstallationId,
  id: ConversationId,
  identities: PublicIdentity[]
): Promise<void> {
  const ids = identities.map((identity) => JSON.stringify(identity))
  return await XMTPModule.removeGroupMembersByIdentity(installationId, id, ids)
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

export function groupImageUrl(
  installationId: InstallationId,
  id: ConversationId
): string | PromiseLike<string> {
  return XMTPModule.groupImageUrl(installationId, id)
}

export function updateGroupImageUrl(
  installationId: InstallationId,
  id: ConversationId,
  imageUrl: string
): Promise<void> {
  return XMTPModule.updateGroupImageUrl(installationId, id, imageUrl)
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

export async function disappearingMessageSettings(
  installationId: string,
  conversationId: string
): Promise<DisappearingMessageSettings | undefined> {
  const settings = JSON.parse(
    await XMTPModule.disappearingMessageSettings(installationId, conversationId)
  )

  if (!settings) {
    return undefined
  } else {
    return new DisappearingMessageSettings(
      settings.disappearStartingAtNs,
      settings.retentionDurationInNs
    )
  }
}

export async function isDisappearingMessagesEnabled(
  installationId: string,
  conversationId: string
): Promise<boolean> {
  return await XMTPModule.isDisappearingMessagesEnabled(
    installationId,
    conversationId
  )
}

export async function clearDisappearingMessageSettings(
  installationId: string,
  conversationId: string
): Promise<void> {
  return await XMTPModule.clearDisappearingMessageSettings(
    installationId,
    conversationId
  )
}

export async function updateDisappearingMessageSettings(
  installationId: string,
  conversationId: string,
  startAtNs: number,
  durationInNs: number
): Promise<void> {
  return await XMTPModule.updateDisappearingMessageSettings(
    installationId,
    conversationId,
    startAtNs,
    durationInNs
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

export async function updateGroupImageUrlPermission(
  clientInstallationId: InstallationId,
  id: ConversationId,
  permissionOption: PermissionUpdateOption
): Promise<void> {
  return XMTPModule.updateGroupImageUrlPermission(
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
  client: Client<ContentTypes>,
  encryptedMessage: string
): Promise<Promise<Conversation<ContentTypes>>> {
  const json = await XMTPModule.processWelcomeMessage(
    client.installationId,
    encryptedMessage
  )
  const conversation = JSON.parse(json)

  if (conversation.version === ConversationVersion.GROUP) {
    return new Group(client, conversation)
  } else {
    return new Dm(client, conversation)
  }
}

export async function syncConsent(
  installationId: InstallationId
): Promise<void> {
  return await XMTPModule.syncConsent(installationId)
}

export async function syncPreferences(
  installationId: InstallationId
): Promise<void> {
  return await XMTPModule.syncPreferences(installationId)
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

export async function setConsentStates(
  installationId: InstallationId,
  records: string[]
): Promise<void> {
  return await XMTPModule.setConsentStates(installationId, records)
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
  type: ConversationFilterType
) {
  return XMTPModule.subscribeToConversations(installationId, type)
}

export function subscribeToAllMessages(
  installationId: InstallationId,
  type: ConversationFilterType,
  consentStates?: ConsentState[] | undefined
) {
  return XMTPModule.subscribeToAllMessages(installationId, type, consentStates)
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

export async function pausedForVersion(
  installationId: InstallationId,
  id: ConversationId
) {
  return XMTPModule.pausedForVersion(installationId, id)
}

export async function getConversationHmacKeys(
  installationId: InstallationId,
  id: ConversationId
): Promise<keystore.GetConversationHmacKeysResponse> {
  const hmacKeysArray = await XMTPModule.getConversationHmacKeys(
    installationId,
    id
  )
  const array = new Uint8Array(hmacKeysArray)
  return keystore.GetConversationHmacKeysResponse.decode(array)
}

export async function getConversationPushTopics(
  installationId: InstallationId,
  id: ConversationId
): Promise<ConversationTopic[]> {
  return await XMTPModule.getConversationPushTopics(installationId, id)
}

export async function getDebugInformation(
  installationId: InstallationId,
  id: ConversationId
): Promise<ConversationDebugInfo> {
  const info = await XMTPModule.getDebugInformation(installationId, id)
  return ConversationDebugInfo.from(info)
}

export async function getNetworkDebugInformation(
  installationId: InstallationId
): Promise<NetworkDebugInfo> {
  const info = await XMTPModule.getNetworkDebugInformation(installationId)
  return NetworkDebugInfo.from(info)
}

export async function clearAllNetworkStatistics(
  installationId: InstallationId
): Promise<void> {
  return await XMTPModule.clearAllNetworkStatistics(installationId)
}

export async function uploadDebugInformation(
  installationId: InstallationId,
  serverUrl?: string
): Promise<string> {
  const key = await XMTPModule.uploadDebugInformation(installationId, serverUrl)
  return key
}

export async function createArchive(
  path: string,
  encryptionKey: Uint8Array,
  startNs?: number | undefined,
  endNs?: number | undefined,
  archiveElements?: string[] | undefined
): Promise<void> {
  return await XMTPModule.createArchive(
    path,
    Array.from(encryptionKey),
    startNs,
    endNs,
    archiveElements
  )
}
export async function importArchive(
  path: string,
  encryptionKey: Uint8Array
): Promise<void> {
  return await XMTPModule.importArchive(path, Array.from(encryptionKey))
}

export async function archiveMetadata(
  path: string,
  encryptionKey: Uint8Array
): Promise<ArchiveMetadata> {
  return await XMTPModule.archiveMetadata(path, Array.from(encryptionKey))
}

export const emitter = new EventEmitter(XMTPModule ?? NativeModulesProxy.XMTP)

interface AuthParams {
  environment: string
  dbDirectory?: string
  historySyncUrl?: string
  customLocalHost?: string
  deviceSyncEnabled?: boolean
  debugEventsEnabled?: boolean
  appVersion?: string
}

interface SignerParams {
  signerType?: string
  chainId?: number
  blockNumber?: number
}

interface CreateGroupParams {
  name: string
  imageUrl: string
  description: string
  disappearStartingAtNs: number
  retentionDurationInNs: number
}

export { Client } from './lib/Client'
export * from './lib/ContentCodec'
export { Conversation, ConversationVersion } from './lib/Conversation'
export { XMTPPush } from './lib/XMTPPush'
export {
  ConsentRecord,
  DecodedMessage,
  MessageDeliveryStatus,
  ConsentState,
  ConversationDebugInfo,
}
export { Group } from './lib/Group'
export { Dm } from './lib/Dm'
export { Member, MembershipResult } from './lib/Member'
export { Address, InboxId, XMTPEnvironment } from './lib/Client'
export {
  ConversationOptions,
  ConversationId,
  ConversationTopic,
  ConversationFilterType,
} from './lib/types/ConversationOptions'
export { MessageId, MessageOrder } from './lib/types/MessagesOptions'
export { DecodedMessageUnion } from './lib/types/DecodedMessageUnion'
export { DisappearingMessageSettings } from './lib/DisappearingMessageSettings'
export { PublicIdentity } from './lib/PublicIdentity'
