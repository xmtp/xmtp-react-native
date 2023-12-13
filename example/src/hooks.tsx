import EncryptedStorage from 'react-native-encrypted-storage'
import { useQuery, UseQueryResult } from 'react-query'
import {
  Conversation,
  DecodedMessage,
  DecryptedLocalAttachment,
  EncryptedLocalAttachment,
  ReactionContent,
  RemoteAttachmentContent,
  useXmtp,
} from 'xmtp-react-native-sdk'

import { downloadFile, uploadFile } from './storage'

/**
 * List all conversations.
 *
 * Note: this is better done with a DB, but we're using react-query for now.
 */
export function useConversationList<ContentTypes>(): UseQueryResult<
  Conversation<ContentTypes>[]
> {
  const { client } = useXmtp()
  client?.contacts.refreshConsentList()
  return useQuery<Conversation<ContentTypes>[]>(
    ['xmtp', 'conversations', client?.address],
    () => client!.conversations.list(),
    {
      enabled: !!client,
    }
  )
}

/**
 * Get the conversation identified by `topic`.
 *
 * Note: this is better done with a DB, but we're using react-query for now.
 */
export function useConversation<ContentTypes>({
  topic,
}: {
  topic: string
}): UseQueryResult<Conversation<ContentTypes> | undefined> {
  const { client } = useXmtp()
  // TODO: use a DB instead of scanning the cached conversation list
  return useQuery<
    Conversation<ContentTypes>[],
    unknown,
    Conversation<ContentTypes> | undefined
  >(
    ['xmtp', 'conversations', client?.address, topic],
    () => client!.conversations.list(),
    {
      select: (conversations) => conversations.find((c) => c.topic === topic),
      enabled: !!client && !!topic,
    }
  )
}

/**
 * List messages in the conversation identified by `topic`.
 *
 * Note: this is better done with a DB, but we're using react-query for now.
 */
export function useMessages({
  topic,
}: {
  topic: string
}): UseQueryResult<DecodedMessage[]> {
  const { client } = useXmtp()
  const { data: conversation } = useConversation({ topic })
  return useQuery<DecodedMessage[]>(
    ['xmtp', 'messages', client?.address, conversation?.topic],
    () => conversation!.messages(),
    {
      enabled: !!client && !!topic && !!conversation,
    }
  )
}

/**
 * Get the message with the `messageId` from the conversation identified by `topic`.
 *
 * Note: this is better done with a DB, but we're using react-query for now.
 */
export function useMessage({
  topic,
  messageId,
}: {
  topic: string
  messageId: string
}): {
  message: DecodedMessage | undefined
  isSenderMe: boolean
  performReaction:
    | undefined
    | ((action: 'added' | 'removed', content: string) => Promise<void>)
} {
  const { client } = useXmtp()
  const { data: conversation } = useConversation({ topic })
  const { data: messages, refetch: refreshMessages } = useMessages({ topic })
  const message = messages?.find(({ id }) => id === messageId)
  const performReaction =
    conversation &&
    message &&
    ((action: 'added' | 'removed', content: string) =>
      conversation!
        .send({
          reaction: {
            reference: message!.id,
            action,
            schema: 'unicode',
            content,
          },
        })
        .then(() => {
          refreshMessages().catch((err) =>
            console.log('Error refreshing messages', err)
          )
        }))
  const isSenderMe = message?.senderAddress === client?.address
  return {
    message,
    performReaction,
    isSenderMe,
  }
}

/**
 * Get the reactions to the messages in the conversation identified by `topic`.
 *
 * Note: this is better done with a DB, but we're using react-query for now.
 */
export function useConversationReactions({ topic }: { topic: string }) {
  const { client } = useXmtp()
  const { data: messages } = useMessages({ topic })
  const reactions = (messages || []).filter(
    (message: DecodedMessage) =>
      message.contentTypeId === 'xmtp.org/reaction:1.0'
  )
  return useQuery<{
    [messageId: string]: {
      reaction: string
      count: number
      includesMe: boolean
    }[]
  }>(
    ['xmtp', 'reactions', client?.address, topic, reactions.length],
    () => {
      // SELECT messageId, reaction, senderAddress FROM reactions GROUP BY messageId, reaction
      const byId = {} as {
        [messageId: string]: { [reaction: string]: string[] }
      }
      // Reverse so we apply them in chronological order (adding/removing)
      reactions
        .slice()
        .reverse()
        .forEach((message: DecodedMessage) => {
          const { senderAddress } = message
          const reaction: ReactionContent = message.content()
          const messageId = reaction!.reference
          const reactionText = reaction!.content
          const v = byId[messageId] || ({} as { [reaction: string]: string[] })
          // DELETE FROM reactions WHERE messageId = ? AND reaction = ? AND senderAddress = ?
          let prior = (v[reactionText] || [])
            // This removes any prior instances of the sender using this reaction.
            .filter((address) => address !== senderAddress)
          if (reaction!.action === 'added') {
            // INSERT INTO reactions (messageId, reaction, senderAddress) VALUES (?, ?, ?)
            prior = prior.concat([senderAddress])
          }
          v[reactionText] = prior
          byId[messageId] = v
        })
      // SELECT messageId, reaction, COUNT(*) AS count, COUNT(senderAddress = ?) AS includesMe
      // FROM reactions
      // GROUP BY messageId, reaction
      // ORDER BY count DESC
      const result = {} as {
        [messageId: string]: {
          reaction: string
          count: number
          includesMe: boolean
        }[]
      }
      Object.keys(byId).forEach((messageId) => {
        const reactions = byId[messageId]
        result[messageId] = Object.keys(reactions)
          .map((reaction) => {
            const addresses = reactions[reaction]
            return {
              reaction,
              count: addresses.length,
              includesMe: addresses.includes(client!.address),
            }
          })
          .filter(({ count }) => count > 0)
          .sort((a, b) => b.count - a.count)
      })
      return result
    },
    {
      enabled: !!reactions.length,
    }
  )
}

export function useMessageReactions({
  topic,
  messageId,
}: {
  topic: string
  messageId: string
}) {
  const { data: reactionsByMessageId } = useConversationReactions({ topic })
  const reactions = ((reactionsByMessageId || {})[messageId] || []) as {
    reaction: string
    count: number
    includesMe: boolean
  }[]
  return {
    reactions,
  }
}

export function useLoadRemoteAttachment({
  remoteAttachment,
  enabled,
}: {
  remoteAttachment?: RemoteAttachmentContent
  enabled: boolean
}): { decrypted: DecryptedLocalAttachment | undefined } {
  const { client } = useXmtp()
  const { data: encryptedLocalFileUri } = useQuery<string>(
    [
      'xmtp',
      'localAttachment',
      'download',
      remoteAttachment?.url,
      remoteAttachment?.contentDigest,
    ],
    () => downloadFile(remoteAttachment!.url),
    {
      enabled: enabled && !!remoteAttachment?.url,
    }
  )
  const { data: decrypted } = useQuery<DecryptedLocalAttachment>(
    [
      'xmtp',
      'localAttachment',
      'decrypt',
      encryptedLocalFileUri,
      remoteAttachment?.contentDigest,
    ],
    () =>
      client!.decryptAttachment({
        encryptedLocalFileUri: encryptedLocalFileUri!,
        metadata: remoteAttachment!,
      }),
    {
      enabled: enabled && !!encryptedLocalFileUri && !!remoteAttachment,
    }
  )
  return { decrypted }
}

export function usePrepareRemoteAttachment({
  fileUri,
  mimeType,
}: {
  fileUri?: string
  mimeType?: string
}): {
  remoteAttachment: RemoteAttachmentContent | undefined
} {
  const { client } = useXmtp()
  const { data: encrypted } = useQuery<EncryptedLocalAttachment>(
    ['xmtp', 'remoteAttachment', 'local', fileUri, mimeType ?? ''],
    () =>
      client!.encryptAttachment({
        fileUri: fileUri!,
        mimeType,
      }),
    {
      enabled: !!client && !!fileUri,
    }
  )
  const { data: url } = useQuery<string>(
    ['xmtp', 'remoteAttachment', 'upload', encrypted?.metadata?.contentDigest],
    () =>
      uploadFile(
        encrypted!.encryptedLocalFileUri,
        encrypted?.metadata?.contentDigest
      ),
    {
      enabled: !!encrypted,
    }
  )
  return {
    remoteAttachment: url
      ? {
          url,
          scheme: 'https://',
          ...encrypted!.metadata,
        }
      : undefined,
  }
}

/**
 * Load or save a keyBundle for future use.
 */
export function useSavedKeys(): {
  keyBundle: string | null | undefined
  save: (keyBundle: string) => void
  clear: () => void
} {
  const { data: keyBundle, refetch } = useQuery<string | null>(
    ['xmtp', 'keyBundle'],
    () => EncryptedStorage.getItem('xmtp.keyBundle')
  )
  return {
    keyBundle,
    save: async (keyBundle: string) => {
      await EncryptedStorage.setItem('xmtp.keyBundle', keyBundle)
      await refetch()
    },
    clear: async () => {
      await EncryptedStorage.removeItem('xmtp.keyBundle')
      await refetch()
    },
  }
}
