import { useCallback, useEffect, useState } from 'react'
import EncryptedStorage from 'react-native-encrypted-storage'
import { useMutation, useQuery, UseQueryResult } from 'react-query'
import {
  Conversation,
  DecodedMessage,
  DecryptedLocalAttachment,
  EncryptedLocalAttachment,
  ReactionContent,
  RemoteAttachmentContent,
  useXmtp,
} from 'xmtp-react-native-sdk'
import { Group } from 'xmtp-react-native-sdk/lib/Group'

import { SupportedContentTypes } from './contentTypes/contentTypes'
import { downloadFile, uploadFile } from './storage'

/**
 * List all conversations.
 *
 * Note: this is better done with a DB, but we're using react-query for now.
 */
export function useConversationList(): UseQueryResult<
  Conversation<SupportedContentTypes>[]
> {
  const { client } = useXmtp()
  client?.contacts
    .refreshConsentList()
    .then(() => {
      console.log('Refreshed consent list successfully')
    })
    .catch((error) => {
      console.error('Error refreshing consent list', error)
    })
  return useQuery<Conversation<SupportedContentTypes>[]>(
    ['xmtp', 'conversations', client?.address],
    () => client!.conversations.list(),
    {
      enabled: !!client,
    }
  )
}

export function useGroupsList(): UseQueryResult<
  Group<SupportedContentTypes>[]
> {
  const { client } = useXmtp()
  return useQuery<Group<SupportedContentTypes>[]>(
    ['xmtp', 'groups', client?.address],
    async () => {
      await client?.conversations.syncGroups()
      return (await client?.conversations.listGroups()) || []
    },
    {
      enabled: !!client,
    }
  )
}

export function useGroup({
  groupId,
}: {
  groupId: string
}): UseQueryResult<Group<SupportedContentTypes> | undefined> {
  const { client } = useXmtp()
  return useQuery<
    Group<SupportedContentTypes>[],
    unknown,
    Group<SupportedContentTypes> | undefined
  >(
    ['xmtp', 'group', client?.address, groupId],
    async () => {
      const groups = await client?.conversations.listGroups()
      return groups || []
    },
    {
      select: (groups) => groups.find((g) => g.id === groupId),
      enabled: !!client,
    }
  )
}

/**
 * Get the conversation identified by `topic`.
 *
 * Note: this is better done with a DB, but we're using react-query for now.
 */
export function useConversation({
  topic,
}: {
  topic: string
}): UseQueryResult<Conversation<SupportedContentTypes> | undefined> {
  const { client } = useXmtp()
  // TODO: use a DB instead of scanning the cached conversation list
  return useQuery<
    Conversation<SupportedContentTypes>[],
    unknown,
    Conversation<SupportedContentTypes> | undefined
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
}): UseQueryResult<DecodedMessage<SupportedContentTypes>[]> {
  const { client } = useXmtp()
  const { data: conversation } = useConversation({ topic })
  return useQuery<DecodedMessage<SupportedContentTypes>[]>(
    ['xmtp', 'messages', client?.address, conversation?.topic],
    () => conversation!.messages(),
    {
      enabled: !!client && !!topic && !!conversation,
    }
  )
}

export function useGroupMessages({
  id,
}: {
  id: string
}): UseQueryResult<DecodedMessage<SupportedContentTypes>[]> {
  const { client } = useXmtp()
  const { data: group } = useGroup({ groupId: id })
  return useQuery<DecodedMessage<SupportedContentTypes>[]>(
    ['xmtp', 'groupMessages', client?.address, group?.id],
    async () => {
      await group!.sync()
      const messages = await group!.messages()
      console.log('messages', messages)
      return group!.messages()
    },
    {
      enabled: !!client && !!group,
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
  message: DecodedMessage<SupportedContentTypes> | undefined
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

export function useGroupMessage({
  groupId,
  messageId,
}: {
  groupId: string
  messageId: string
}): {
  message: DecodedMessage<SupportedContentTypes> | undefined
  isSenderMe: boolean
  performReaction:
    | undefined
    | ((action: 'added' | 'removed', content: string) => Promise<void>)
} {
  const { client } = useXmtp()
  const { data: group } = useGroup({ groupId })
  const { data: messages, refetch: refreshMessages } = useGroupMessages({
    id: groupId,
  })
  const message = messages?.find(({ id }) => id === messageId)

  const performReaction =
    group &&
    message &&
    ((action: 'added' | 'removed', content: string) =>
      group!
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
    (message) => message.contentTypeId === 'xmtp.org/reaction:1.0'
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
        .forEach((message) => {
          const { senderAddress } = message
          const reaction = message.content() as ReactionContent
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

export function useGroupReactions({ groupId }: { groupId: string }) {
  const { client } = useXmtp()
  const { data: messages } = useGroupMessages({ id: groupId })
  const reactions = (messages || []).filter(
    (message) => message.contentTypeId === 'xmtp.org/reaction:1.0'
  )
  return useQuery<{
    [messageId: string]: {
      reaction: string
      count: number
      includesMe: boolean
    }[]
  }>(
    ['xmtp', 'reactions', client?.address, groupId, reactions.length],
    () => {
      // SELECT messageId, reaction, senderAddress FROM reactions GROUP BY messageId, reaction
      const byId = {} as {
        [messageId: string]: { [reaction: string]: string[] }
      }
      // Reverse so we apply them in chronological order (adding/removing)
      reactions
        .slice()
        .reverse()
        .forEach((message) => {
          const { senderAddress } = message
          const reaction = message.content() as ReactionContent
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

export function useGroupMessageReactions({
  groupId,
  messageId,
}: {
  groupId: string
  messageId: string
}) {
  const { data: reactionsByMessageId } = useGroupReactions({ groupId })
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
  const [remoteAttachment, setRemoteAttachment] = useState<
    RemoteAttachmentContent | undefined
  >(undefined)
  const { client } = useXmtp()
  const { mutateAsync: encryptAttachment } = useMutation<
    EncryptedLocalAttachment,
    unknown,
    { fileUri?: string; mimeType?: string }
  >(
    ['xmtp', 'remoteAttachment', 'local'],
    ({ fileUri, mimeType }) =>
      client!.encryptAttachment({
        fileUri: fileUri!,
        mimeType,
      }),
    {}
  )
  const { mutateAsync: uploadAttachment } = useMutation<
    string,
    unknown,
    EncryptedLocalAttachment
  >(
    ['xmtp', 'remoteAttachment', 'upload'],
    (attachement: EncryptedLocalAttachment) =>
      uploadFile(
        attachement!.encryptedLocalFileUri,
        attachement?.metadata?.contentDigest
      )
  )

  const callback = useCallback(
    async ({ fileUri, mimeType }: { fileUri: string; mimeType?: string }) => {
      const encrypted = await encryptAttachment({
        fileUri,
        mimeType,
      })
      const url = await uploadAttachment(encrypted)
      return {
        url,
        metadata: encrypted.metadata,
      }
    },
    [encryptAttachment, uploadAttachment]
  )

  useEffect(() => {
    console.log('Preparing remote attachment', { fileUri, mimeType })
    if (!fileUri) {
      setRemoteAttachment(undefined)
      return
    }
    callback({ fileUri, mimeType })
      .then((res) => {
        setRemoteAttachment({
          url: res.url,
          scheme: 'https://',
          ...res.metadata,
        })
      })
      .catch((err) => {
        console.log('Error preparing remote attachment', err)
      })
  }, [fileUri, mimeType, callback])

  return { remoteAttachment }
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
