import { useCallback, useEffect, useRef, useState } from 'react'
import EncryptedStorage from 'react-native-encrypted-storage'
import RNFS from 'react-native-fs';
import crypto from 'react-native-quick-crypto';
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
  return useQuery<Conversation<SupportedContentTypes>[]>(
    ['xmtp', 'conversations', client?.address],
    async () => {
      await client?.conversations.sync()
      return (await client?.conversations.list()) || []
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
}): UseQueryResult<DecodedMessage[]> {
  const { client } = useXmtp()
  const { data: conversation } = useConversation({ topic })
  return useQuery<DecodedMessage[]>(
    ['xmtp', 'messages', client?.address, conversation?.topic],
    async () => {
      await conversation!.sync()
      return conversation!.messages()
    },
    {
      enabled: !!client && !!topic && !!conversation,
    }
  )
}

export function useGroupMessages({
  id,
}: {
  id: string
}): UseQueryResult<DecodedMessage[]> {
  const { client } = useXmtp()
  const { data: group } = useGroup({ groupId: id })
  return useQuery<DecodedMessage[]>(
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
  const isSenderMe = message?.senderInboxId === client?.address
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
  message: DecodedMessage | undefined
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
  const isSenderMe = message?.senderInboxId === client?.address
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
      // SELECT messageId, reaction, senderInboxId FROM reactions GROUP BY messageId, reaction
      const byId = {} as {
        [messageId: string]: { [reaction: string]: string[] }
      }
      // Reverse so we apply them in chronological order (adding/removing)
      reactions
        .slice()
        .reverse()
        .forEach((message) => {
          const { senderInboxId } = message
          const reaction = message.content() as ReactionContent
          const messageId = reaction!.reference
          const reactionText = reaction!.content
          const v = byId[messageId] || ({} as { [reaction: string]: string[] })
          // DELETE FROM reactions WHERE messageId = ? AND reaction = ? AND senderInboxId = ?
          let prior = (v[reactionText] || [])
            // This removes any prior instances of the sender using this reaction.
            .filter((address) => address !== senderInboxId)
          if (reaction!.action === 'added') {
            // INSERT INTO reactions (messageId, reaction, senderInboxId) VALUES (?, ?, ?)
            prior = prior.concat([senderInboxId])
          }
          v[reactionText] = prior
          byId[messageId] = v
        })
      // SELECT messageId, reaction, COUNT(*) AS count, COUNT(senderInboxId = ?) AS includesMe
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
      // SELECT messageId, reaction, senderInboxId FROM reactions GROUP BY messageId, reaction
      const byId = {} as {
        [messageId: string]: { [reaction: string]: string[] }
      }
      // Reverse so we apply them in chronological order (adding/removing)
      reactions
        .slice()
        .reverse()
        .forEach((message) => {
          const { senderInboxId } = message
          const reaction = message.content() as ReactionContent
          const messageId = reaction!.reference
          const reactionText = reaction!.content
          const v = byId[messageId] || ({} as { [reaction: string]: string[] })
          // DELETE FROM reactions WHERE messageId = ? AND reaction = ? AND senderInboxId = ?
          let prior = (v[reactionText] || [])
            // This removes any prior instances of the sender using this reaction.
            .filter((address) => address !== senderInboxId)
          if (reaction!.action === 'added') {
            // INSERT INTO reactions (messageId, reaction, senderInboxId) VALUES (?, ?, ?)
            prior = prior.concat([senderInboxId])
          }
          v[reactionText] = prior
          byId[messageId] = v
        })
      // SELECT messageId, reaction, COUNT(*) AS count, COUNT(senderInboxId = ?) AS includesMe
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

export function useLoadMultiRemoteAttachment({
  remoteAttachments,
  enabled,
}: {
  remoteAttachments?: RemoteAttachmentContent[]
  enabled: boolean
}): { decrypted: DecryptedLocalAttachment[] | undefined } {
  const { client } = useXmtp()
  const [decrypted, setDecrypted] = useState<DecryptedLocalAttachment[] | undefined>(undefined)

  useEffect(() => {
    if (!enabled || !remoteAttachments?.length) {
      setDecrypted(undefined)
      return
    }

    const loadAttachments = async () => {
      try {
        const results = await Promise.all(
          remoteAttachments.map(async (attachment) => {
            console.log('Processing attachment:', {
              url: attachment.url,
              contentDigest: attachment.contentDigest,
            })
            
            const encryptedLocalFileUri = await downloadFile(attachment.url)
            console.log('Downloaded attachment to:', {
              encryptedLocalFileUri,
              fileExists: await fileExists(encryptedLocalFileUri),
              fileSize: await getFileSize(encryptedLocalFileUri),
            })

            // Verify the downloaded file before decryption
            const downloadedDigest = await calculateFileDigest(encryptedLocalFileUri) // You'll need to implement this
            console.log('Verifying content digest:', {
              expected: attachment.contentDigest,
              actual: downloadedDigest,
              match: attachment.contentDigest === downloadedDigest
            })
            
            const decryptedAttachment = await client!.decryptAttachment({
              encryptedLocalFileUri,
              metadata: attachment,
            })
            return decryptedAttachment
          })
        )
        setDecrypted(results)
      } catch (err) {
        console.log('Error loading remote attachments:', {
          error: err,
          remoteAttachments: remoteAttachments.map(a => ({
            url: a.url,
            contentDigest: a.contentDigest,
            contentLength: a.contentLength,
          }))
        })
        setDecrypted(undefined)
      }
    }

    loadAttachments()
  }, [enabled, remoteAttachments, client])

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

export function usePrepareMultiRemoteAttachment({
  files,
}: {
  files: { fileUri: string; mimeType?: string }[]
}): {
  remoteAttachments: RemoteAttachmentContent[] | undefined
} {
  const [remoteAttachments, setRemoteAttachments] = useState<
    RemoteAttachmentContent[] | undefined
  >(undefined)
  const { client } = useXmtp()

  const filesRef = useRef(files)
  
  // Compare files and only update ref if they're different
  useEffect(() => {
    if (JSON.stringify(filesRef.current) !== JSON.stringify(files)) {
      filesRef.current = files
    }
  }, [files])

  const { mutateAsync: encryptAttachment } = useMutation<
    EncryptedLocalAttachment,
    unknown,
    { fileUri: string; mimeType?: string }
  >(
    ['xmtp', 'remoteAttachment', 'local'],
    ({ fileUri, mimeType }) =>
      client!.encryptAttachment({
        fileUri: fileUri,
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
    (attachment: EncryptedLocalAttachment) =>
      uploadFile(
        attachment.encryptedLocalFileUri,
        attachment.metadata?.contentDigest
      )
  )

  useEffect(() => {
      console.log('Preparing multiple remote attachments', { files: filesRef.current })
      if (!filesRef.current.length) {
        setRemoteAttachments(undefined)
        return
      }
  
      const prepareAttachments = async () => {
        try {
          const results = await Promise.all(
            filesRef.current.map(async ({ fileUri, mimeType }) => {
              console.log('Encrypting attachment:', { fileUri, mimeType })
              const encrypted = await encryptAttachment({
                fileUri,
                mimeType: mimeType || 'application/octet-stream', // Ensure we always have a mimeType
              })
              
              console.log('Encrypted attachment:', {
                contentDigest: encrypted.metadata?.contentDigest,
              })
              
              const url = await uploadAttachment(encrypted)
              return {
                url,
                metadata: encrypted.metadata,
              }
            })
          )
          
          const attachments = results.map((res) => ({
            url: res.url,
            scheme: 'https://',
            ...res.metadata,
          }))
          
          console.log('Prepared attachments:', attachments)
          setRemoteAttachments(attachments as RemoteAttachmentContent[])
        } catch (err) {
          console.log('Error preparing remote attachments', err)
          setRemoteAttachments(undefined)
        }
      }
  
      prepareAttachments()
    }, [filesRef.current, encryptAttachment, uploadAttachment])
  
    return { remoteAttachments }
  }

/**
 * Load or save a keyBundle for future use.
 */
export function useSavedAddress(): {
  address: string | null | undefined
  save: (address: string) => void
  clear: () => void
} {
  const { data: address, refetch } = useQuery<string | null>(
    ['xmtp', 'address'],
    () => EncryptedStorage.getItem('xmtp.address')
  )
  return {
    address,
    save: async (address: string) => {
      await EncryptedStorage.setItem('xmtp.address', address)
      await refetch()
    },
    clear: async () => {
      await EncryptedStorage.removeItem('xmtp.address')
      await refetch()
    },
  }
}

export async function getDbEncryptionKey(
  network: string,
  clear: boolean = false
): Promise<Uint8Array> {
  const key = `xmtp-${network}`

  const result = await EncryptedStorage.getItem(key)
  if ((result && clear === true) || !result) {
    if (result) {
      console.log('Removing existing dbEncryptionKey', key)
      await EncryptedStorage.removeItem(key)
    }

    const randomBytes = crypto.getRandomValues(new Uint8Array(32))
    const randomBytesString = uint8ArrayToHexString(randomBytes)
    await EncryptedStorage.setItem(key, randomBytesString)
    return randomBytes
  } else {
    return hexStringToUint8Array(result)
  }
}

function uint8ArrayToHexString(byteArray: Uint8Array): string {
  return Array.from(byteArray, function (byte) {
    return ('0' + (byte & 0xff).toString(16)).slice(-2)
  }).join('')
}

function hexStringToUint8Array(hexString: string): Uint8Array {
  // Ensure the hex string has an even number of characters for proper parsing
  if (hexString.length % 2 !== 0) {
    console.error('The hex string must have an even number of characters')
    return new Uint8Array()
  }
  // Split the hex string into an array of byte-sized (2 characters) hex strings
  const byteStrings = hexString.match(/.{1,2}/g) || []
  // Convert each byte-sized hex string into a numeric byte value
  const byteArray = byteStrings.map((byteStr) => parseInt(byteStr, 16))
  // Create a new Uint8Array from the array of numeric byte values
  return new Uint8Array(byteArray)
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return await RNFS.exists(path);
  } catch (error) {
    console.error('Error checking file existence:', error);
    return false;
  }
}

async function getFileSize(path: string): Promise<number> {
  try {
    const stats = await RNFS.stat(path);
    return stats.size;
  } catch (error) {
    console.error('Error getting file size:', error);
    return 0;
  }
}

async function calculateFileDigest(path: string): Promise<string> {
  try {
    // Read the file content
    const fileContent = await RNFS.readFile(path, 'base64');
    const buffer = Buffer.from(fileContent, 'base64');
    
    // Create SHA-256 hash using react-native-quick-crypto
    const hash = crypto.createHash('sha256');
    hash.update(buffer.buffer);
    return hash.digest('hex');
  } catch (error) {
    console.error('Error calculating file digest:', error);
    throw error;
  }
}
