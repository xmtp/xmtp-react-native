import { content } from '@xmtp/proto'
import { EventEmitter, NativeModulesProxy } from 'expo-modules-core'

import { Client } from '.'
import { ConversationContext } from './XMTP.types'
import XMTPModule from './XMTPModule'
import { ConsentListEntry, ConsentState } from './lib/ConsentListEntry'
import {
  DecryptedLocalAttachment,
  EncryptedLocalAttachment,
  PreparedLocalMessage,
  ContentCodec,
} from './lib/ContentCodec'
import { Conversation } from './lib/Conversation'
import { DecodedMessage } from './lib/DecodedMessage'
import type { Query } from './lib/Query'
import { getAddress } from './utils/address'

export { ReactionCodec } from './lib/NativeCodecs/ReactionCodec'
export { ReplyCodec } from './lib/NativeCodecs/ReplyCodec'
export { ReadReceiptCodec } from './lib/NativeCodecs/ReadReceiptCodec'
export { StaticAttachmentCodec } from './lib/NativeCodecs/StaticAttachmentCodec'
export { RemoteAttachmentCodec } from './lib/NativeCodecs/RemoteAttachmentCodec'
export { TextCodec } from './lib/NativeCodecs/TextCodec'
export * from './hooks'
export * from './context'

const EncodedContent = content.EncodedContent

export function address(): string {
  return XMTPModule.address()
}

export async function auth(
  address: string,
  environment: 'local' | 'dev' | 'production',
  appVersion?: string | undefined,
  hasCreateIdentityCallback?: boolean | undefined,
  hasEnableIdentityCallback?: boolean | undefined
) {
  return await XMTPModule.auth(
    address,
    environment,
    appVersion,
    hasCreateIdentityCallback,
    hasEnableIdentityCallback
  )
}

export async function receiveSignature(requestID: string, signature: string) {
  return await XMTPModule.receiveSignature(requestID, signature)
}

export async function createRandom(
  environment: 'local' | 'dev' | 'production',
  appVersion?: string | undefined,
  hasCreateIdentityCallback?: boolean | undefined,
  hasEnableIdentityCallback?: boolean | undefined
): Promise<string> {
  return await XMTPModule.createRandom(
    environment,
    appVersion,
    hasCreateIdentityCallback,
    hasEnableIdentityCallback
  )
}

export async function createFromKeyBundle(
  keyBundle: string,
  environment: 'local' | 'dev' | 'production',
  appVersion?: string | undefined
): Promise<string> {
  return await XMTPModule.createFromKeyBundle(
    keyBundle,
    environment,
    appVersion
  )
}

export async function exportKeyBundle(clientAddress: string): Promise<string> {
  return await XMTPModule.exportKeyBundle(clientAddress)
}

export async function exportConversationTopicData(
  clientAddress: string,
  conversationTopic: string
): Promise<string> {
  return await XMTPModule.exportConversationTopicData(
    clientAddress,
    conversationTopic
  )
}

export async function importConversationTopicData<ContentTypes>(
  client: Client<ContentTypes>,
  topicData: string
): Promise<Conversation<ContentTypes>> {
  const json = await XMTPModule.importConversationTopicData(
    client.address,
    topicData
  )
  return new Conversation(client, JSON.parse(json))
}

export async function canMessage(
  clientAddress: string,
  peerAddress: string
): Promise<boolean> {
  return await XMTPModule.canMessage(clientAddress, getAddress(peerAddress))
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

export async function encryptAttachment(
  clientAddress: string,
  file: DecryptedLocalAttachment
): Promise<EncryptedLocalAttachment> {
  const fileJson = JSON.stringify(file)
  const encryptedFileJson = await XMTPModule.encryptAttachment(
    clientAddress,
    fileJson
  )
  return JSON.parse(encryptedFileJson)
}

export async function decryptAttachment(
  clientAddress: string,
  encryptedFile: EncryptedLocalAttachment
): Promise<DecryptedLocalAttachment> {
  const encryptedFileJson = JSON.stringify(encryptedFile)
  const fileJson = await XMTPModule.decryptAttachment(
    clientAddress,
    encryptedFileJson
  )
  return JSON.parse(fileJson)
}

export async function listConversations<ContentTypes>(
  client: Client<ContentTypes>
): Promise<Conversation<ContentTypes>[]> {
  return (await XMTPModule.listConversations(client.address)).map(
    (json: string) => {
      return new Conversation(client, JSON.parse(json))
    }
  )
}

export async function listMessages<ContentTypes>(
  client: Client<ContentTypes>,
  conversationTopic: string,
  limit?: number | undefined,
  before?: number | Date | undefined,
  after?: number | Date | undefined,
  direction?:
    | 'SORT_DIRECTION_ASCENDING'
    | 'SORT_DIRECTION_DESCENDING'
    | undefined
): Promise<DecodedMessage[]> {
  const messages = await XMTPModule.loadMessages(
    client.address,
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

export async function listBatchMessages<ContentTypes>(
  client: Client<ContentTypes>,
  queries: Query[]
): Promise<DecodedMessage[]> {
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
  const messages = await XMTPModule.loadBatchMessages(client.address, topics)

  return messages.map((json: string) => {
    return DecodedMessage.from(json, client)
  })
}

// TODO: support conversation ID
export async function createConversation<ContentTypes>(
  client: Client<ContentTypes>,
  peerAddress: string,
  context?: ConversationContext
): Promise<Conversation<ContentTypes>> {
  return new Conversation(
    client,
    JSON.parse(
      await XMTPModule.createConversation(
        client.address,
        getAddress(peerAddress),
        JSON.stringify(context || {})
      )
    )
  )
}

export async function sendWithContentType<T>(
  clientAddress: string,
  conversationTopic: string,
  content: T,
  codec: ContentCodec<T>
): Promise<string> {
  if ('contentKey' in codec) {
    const contentJson = JSON.stringify(content)
    return await XMTPModule.sendMessage(
      clientAddress,
      conversationTopic,
      contentJson
    )
  } else {
    const encodedContent = codec.encode(content)
    encodedContent.fallback = codec.fallback(content)
    const encodedContentData = EncodedContent.encode(encodedContent).finish()

    return await XMTPModule.sendEncodedContent(
      clientAddress,
      conversationTopic,
      Array.from(encodedContentData)
    )
  }
}

export async function sendMessage(
  clientAddress: string,
  conversationTopic: string,
  content: any
): Promise<string> {
  // TODO: consider eager validating of `MessageContent` here
  //       instead of waiting for native code to validate
  const contentJson = JSON.stringify(content)
  return await XMTPModule.sendMessage(
    clientAddress,
    conversationTopic,
    contentJson
  )
}

export async function prepareMessage(
  clientAddress: string,
  conversationTopic: string,
  content: any
): Promise<PreparedLocalMessage> {
  // TODO: consider eager validating of `MessageContent` here
  //       instead of waiting for native code to validate
  const contentJson = JSON.stringify(content)
  const preparedJson = await XMTPModule.prepareMessage(
    clientAddress,
    conversationTopic,
    contentJson
  )
  return JSON.parse(preparedJson)
}

export async function prepareMessageWithContentType<T>(
  clientAddress: string,
  conversationTopic: string,
  content: any,
  codec: ContentCodec<T>
): Promise<PreparedLocalMessage> {
  if ('contentKey' in codec) {
    return prepareMessage(clientAddress, conversationTopic, content)
  }
  const encodedContent = codec.encode(content)
  encodedContent.fallback = codec.fallback(content)
  const encodedContentData = EncodedContent.encode(encodedContent).finish()
  const preparedJson = await XMTPModule.prepareEncodedMessage(
    clientAddress,
    conversationTopic,
    Array.from(encodedContentData)
  )
  return JSON.parse(preparedJson)
}

export async function sendPreparedMessage(
  clientAddress: string,
  preparedLocalMessage: PreparedLocalMessage
): Promise<string> {
  const preparedLocalMessageJson = JSON.stringify(preparedLocalMessage)
  return await XMTPModule.sendPreparedMessage(
    clientAddress,
    preparedLocalMessageJson
  )
}

export function subscribeToConversations(clientAddress: string) {
  return XMTPModule.subscribeToConversations(clientAddress)
}

export function subscribeToAllMessages(clientAddress: string) {
  return XMTPModule.subscribeToAllMessages(clientAddress)
}

export async function subscribeToMessages(
  clientAddress: string,
  topic: string
) {
  return await XMTPModule.subscribeToMessages(clientAddress, topic)
}

export function unsubscribeFromConversations(clientAddress: string) {
  return XMTPModule.unsubscribeFromConversations(clientAddress)
}

export function unsubscribeFromAllMessages(clientAddress: string) {
  return XMTPModule.unsubscribeFromAllMessages(clientAddress)
}

export async function unsubscribeFromMessages(
  clientAddress: string,
  topic: string
) {
  return await XMTPModule.unsubscribeFromMessages(clientAddress, topic)
}

export function registerPushToken(pushServer: string, token: string) {
  return XMTPModule.registerPushToken(pushServer, token)
}

export function subscribePushTopics(topics: string[]) {
  return XMTPModule.subscribePushTopics(topics)
}

export async function decodeMessage(
  clientAddress: string,
  topic: string,
  encryptedMessage: string
): Promise<DecodedMessage> {
  return JSON.parse(
    await XMTPModule.decodeMessage(clientAddress, topic, encryptedMessage)
  )
}

export async function conversationConsentState(
  clientAddress: string,
  conversationTopic: string
): Promise<ConsentState> {
  return await XMTPModule.conversationConsentState(
    clientAddress,
    conversationTopic
  )
}

export async function isAllowed(
  clientAddress: string,
  address: string
): Promise<boolean> {
  return await XMTPModule.isAllowed(clientAddress, address)
}

export async function isDenied(
  clientAddress: string,
  address: string
): Promise<boolean> {
  return await XMTPModule.isDenied(clientAddress, address)
}

export async function denyContacts(
  clientAddress: string,
  addresses: string[]
): Promise<void> {
  return await XMTPModule.denyContacts(clientAddress, addresses)
}

export async function allowContacts(
  clientAddress: string,
  addresses: string[]
): Promise<void> {
  return await XMTPModule.allowContacts(clientAddress, addresses)
}

export async function refreshConsentList(
  clientAddress: string
): Promise<ConsentListEntry[]> {
  const consentList = await XMTPModule.refreshConsentList(clientAddress)

  return consentList.map((json: string) => {
    return ConsentListEntry.from(json)
  })
}

export async function consentList(
  clientAddress: string
): Promise<ConsentListEntry[]> {
  const consentList = await XMTPModule.consentList(clientAddress)

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

export const emitter = new EventEmitter(XMTPModule ?? NativeModulesProxy.XMTP)

export * from './lib/ContentCodec'
export { Client } from './lib/Client'
export { Conversation } from './lib/Conversation'
export * from './XMTP.types'
export { Query } from './lib/Query'
export { XMTPPush } from './lib/XMTPPush'
export { DecodedMessage }
export { ConsentListEntry }
