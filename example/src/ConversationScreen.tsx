import { FontAwesome } from '@expo/vector-icons'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import 'react-native-url-polyfill/auto'
import { Buffer } from 'buffer'
import * as DocumentPicker from 'expo-document-picker'
import type { DocumentPickerAsset } from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import type { ImagePickerAsset } from 'expo-image-picker'
import { PermissionStatus } from 'expo-modules-core'
import moment from 'moment'
import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  Button,
  FlatList,
  KeyboardAvoidingView,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableHighlight,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ScrollView,
} from 'react-native'
import {
  MultiRemoteAttachmentContent,
  RemoteAttachmentContent,
  DecodedMessage,
  StaticAttachmentContent,
  ReplyContent,
  useClient,
  Client,
} from 'xmtp-react-native-sdk'
import { ConversationSendPayload } from 'xmtp-react-native-sdk/lib/types'

import { NavigationParamList } from './Navigation'
import { SupportedContentTypes } from './contentTypes/contentTypes'
import {
  useConversation,
  useMessage,
  useMessageReactions,
  useMessages,
  useLoadRemoteAttachment,
  useLoadMultiRemoteAttachment,
  // usePrepareRemoteAttachment,
  usePrepareMultiRemoteAttachment,
} from './hooks'

type Attachment = {
  file?: DocumentPickerAsset
  image?: ImagePickerAsset
}
const hiddenMessageTypes = ['xmtp.org/reaction:1.0']

/// Show the messages in a conversation.
export default function ConversationScreen({
  route,
}: NativeStackScreenProps<NavigationParamList, 'conversation'>) {
  const { topic } = route.params
  const messageListRef = useRef<FlatList>(null)
  const {
    data: messages,
    refetch: refreshMessages,
    isFetching,
    isRefetching,
  } = useMessages({ topic })
  const { data: conversation } = useConversation({ topic })
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [isShowingAttachmentModal, setShowingAttachmentModal] = useState(false)
  const [attachment, setAttachment] = useState<Attachment | null>(null)

  const [isAttachmentPreviewing, setAttachmentPreviewing] = useState(false)
  const [isSending, setSending] = useState(false)
  // const { remoteAttachment } = usePrepareRemoteAttachment({
  //   fileUri: attachment?.image?.uri || attachment?.file?.uri,
  //   mimeType: attachment?.file?.mimeType,
  // })
  // Update state to handle multiple attachments
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [previewingAttachmentIndex, setPreviewingAttachmentIndex] = useState<
    number | null
  >(null)
  const { remoteAttachments } = usePrepareMultiRemoteAttachment({
    files: attachments
      .filter((a) => a.image?.uri || a.file?.uri) // Filter out any attachments without URIs
      .map((a) => {
        const uri = a.image?.uri || a.file?.uri || ''
        // Ensure URI has file:// prefix if it doesn't already
        const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`
        return {
          fileUri,
          mimeType:
            a.file?.mimeType ||
            (a.image ? 'image/jpeg' : 'application/octet-stream'),
        }
      }),
  })

  // const sendRemoteAttachmentMessages = () => {
  //   if (remoteAttachments && remoteAttachments.length) {
  //     Promise.all(
  //       remoteAttachments.map(attachment =>
  //         sendMessage({ remoteAttachment: attachment })
  //       )
  //     )
  //       .then(() => setAttachments([]))
  //       .catch((e) => {
  //         console.error('Error sending messages: ', e)
  //       })
  //   }
  // }

  const sendMultiRemoteAttachmentMessage = () => {
    if (remoteAttachments && remoteAttachments.length) {
      sendMessage({
        multiRemoteAttachment: {
          attachments: remoteAttachments.map((a) => ({
            ...a,
            contentLength: a.contentLength || '0',
          })),
        },
      })
        .then(() => setAttachments([]))
        .catch((e) => {
          console.error('Error sending message: ', e)
        })
    }
  }

  const filteredMessages = useMemo(
    () =>
      (messages ?? [])?.filter(
        (message) => !hiddenMessageTypes.includes(message.contentTypeId)
      ),
    [messages]
  )

  const sendMessage = async (
    content: ConversationSendPayload<SupportedContentTypes>
  ) => {
    setSending(true)
    console.log('Sending message', content)
    try {
      content = replyingTo
        ? ({
            reply: {
              reference: replyingTo,
              content,
            },
          } as ConversationSendPayload<SupportedContentTypes>)
        : content
      await conversation!.send(content)
      await refreshMessages()
      setReplyingTo(null)
    } catch (e) {
      console.log('Error sending message', e)
    } finally {
      setSending(false)
    }
  }
  // const sendRemoteAttachmentMessage = () => {
  //   if (remoteAttachment) {
  //     sendMessage({ remoteAttachment })
  //       .then(() => setAttachment(null))
  //       .catch((e) => {
  //         console.error('Error sending message: ', e)
  //       })
  //   }
  // }
  const sendTextMessage = () => sendMessage({ text }).then(() => setText(''))
  const scrollToMessageId = useCallback(
    (messageId: string) => {
      const index = (filteredMessages || []).findIndex(
        (m) => m.id === messageId
      )
      if (index === -1) {
        return
      }
      return messageListRef.current?.scrollToIndex({
        index,
        animated: true,
      })
    },
    [filteredMessages]
  )

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        style={{ flex: 1, flexDirection: 'column' }}
      >
        <View style={{ flex: 1 }}>
          <AttachmentModal
            visible={isShowingAttachmentModal}
            onAttachedImageFromCamera={(image) => {
              console.log('from camera', image)
              setAttachments((prev) => [...prev, { image }])
              setShowingAttachmentModal(false)
            }}
            onAttachedImageFromLibrary={(images) => {
              setAttachments((prev) => [
                ...prev,
                ...images.map((img) => ({ image: img })),
              ])
              setShowingAttachmentModal(false)
            }}
            onAttachedFile={(file) => {
              setAttachments((prev) => [...prev, { file }])
              setShowingAttachmentModal(false)
            }}
            onRequestClose={() => setShowingAttachmentModal(false)}
          />
          <FlatList
            ref={messageListRef}
            style={{ flexGrow: 1 }}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshing={isFetching || isRefetching}
            onRefresh={refreshMessages}
            data={filteredMessages}
            inverted
            keyboardDismissMode="none"
            keyExtractor={(message) => message.id}
            ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
            renderItem={({ item: message, index }) => (
              <MessageItem
                topic={topic}
                messageId={message.id}
                onReply={() => setReplyingTo(message.id)}
                onMessageReferencePress={scrollToMessageId}
                showSender={
                  index === (filteredMessages || []).length - 1 ||
                  (index + 1 < (filteredMessages || []).length &&
                    filteredMessages![index + 1].senderInboxId !==
                      message.senderInboxId)
                }
              />
            )}
            stickyHeaderIndices={[0]}
            invertStickyHeaders
            stickyHeaderHiddenOnScroll={false}
            ListHeaderComponent={
              <View
                style={{
                  flexDirection: 'column',
                  marginTop: 16,
                  paddingTop: 8,
                  borderTopWidth: 2,
                  borderColor: '#aaa',
                }}
              >
                {replyingTo && (
                  <ReplyInputHeader
                    topic={topic}
                    replyingToMessageId={replyingTo}
                    onCancel={() => setReplyingTo(null)}
                    onPress={() => scrollToMessageId(replyingTo!)}
                  />
                )}
                {attachment && (
                  <>
                    <AttachmentInputHeader
                      topic={topic}
                      attachment={attachment}
                      onPress={() => setAttachmentPreviewing(true)}
                      onRemove={() => setAttachment(null)}
                    />
                    <AttachmentPreviewModal
                      attachment={attachment}
                      visible={isAttachmentPreviewing}
                      onRequestClose={() => setAttachmentPreviewing(false)}
                    />
                  </>
                )}
                {attachments.length > 0 && (
                  <>
                    <AttachmentInputHeader
                      attachments={attachments}
                      onPress={(index) => {
                        setPreviewingAttachmentIndex(index)
                        setAttachmentPreviewing(true)
                      }}
                      onRemove={(index) => {
                        setAttachments((prev) =>
                          prev.filter((_, i) => i !== index)
                        )
                      }}
                    />
                    <AttachmentPreviewModal
                      attachment={
                        previewingAttachmentIndex !== null
                          ? attachments[previewingAttachmentIndex]
                          : null
                      }
                      visible={isAttachmentPreviewing}
                      onRequestClose={() => {
                        setAttachmentPreviewing(false)
                        setPreviewingAttachmentIndex(null)
                      }}
                    />
                  </>
                )}
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
                >
                  <FontAwesome.Button
                    name="plus-circle"
                    backgroundColor="transparent"
                    color="#999"
                    size={32}
                    borderRadius={0}
                    style={{ marginLeft: 10, paddingRight: 0 }}
                    iconStyle={{ margin: 0 }}
                    onPress={() => setShowingAttachmentModal(true)}
                  />
                  {attachments.length > 0 ? (
                    <>
                      <View
                        style={{
                          height: 40,
                          marginRight: 0,
                          borderWidth: 1,
                          padding: 10,
                          backgroundColor: 'white',
                          flexGrow: 1,
                        }}
                      />
                      <Button
                        title="Send"
                        onPress={sendMultiRemoteAttachmentMessage}
                        disabled={
                          isSending ||
                          !conversation ||
                          !remoteAttachments?.length
                        }
                      />
                    </>
                  ) : (
                    <>
                      <TextInput
                        onSubmitEditing={sendTextMessage}
                        editable={!isSending}
                        value={text}
                        onChangeText={setText}
                        style={{
                          height: 40,
                          marginRight: 0,
                          borderWidth: 1,
                          padding: 10,
                          backgroundColor: 'white',
                          flexGrow: 1,
                          opacity: isSending ? 0.5 : 1,
                        }}
                      />
                      <Button
                        title="Send"
                        onPress={sendTextMessage}
                        disabled={isSending || !conversation || !text.length}
                      />
                    </>
                  )}
                </View>
              </View>
            }
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function AttachmentPreviewModal({
  attachment,
  visible,
  onRequestClose,
}: {
  attachment: Attachment | null
  visible: boolean
  onRequestClose: () => void
}) {
  const isImage = attachment?.image?.type === 'image'
  return (
    <CenteredModal visible={visible} onRequestClose={onRequestClose}>
      {isImage && attachment?.image && (
        <Image
          source={attachment.image}
          style={{
            width: 300,
            height: 300,
            borderWidth: 1,
            borderColor: '#aaa',
            borderRadius: 4,
            backgroundColor: '#eee',
          }}
          resizeMethod="auto"
          resizeMode="cover"
        />
      )}
      {!isImage && (
        <View
          style={{
            width: 300,
            height: 300,
            borderWidth: 1,
            borderColor: '#aaa',
            borderRadius: 4,
            backgroundColor: '#eee',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <FontAwesome name="file" size={64} color="#999" />
        </View>
      )}
    </CenteredModal>
  )
}

function AttachmentInputHeader({
  attachments,
  onPress,
  onRemove,
}: {
  attachments: Attachment[]
  onPress: (index: number) => void
  onRemove: (index: number) => void
}) {
  return (
    <ScrollView
      horizontal
      style={{
        marginTop: 8,
        marginLeft: 16,
        marginBottom: 16,
      }}
    >
      {attachments.map((attachment, index) => {
        const isImage = attachment.image?.type === 'image'
        return (
          <View
            key={`attachment-${index}`}
            style={{
              width: 110,
              height: 110,
              marginRight: 8,
            }}
          >
            <TouchableOpacity onPress={() => onPress(index)}>
              {isImage && attachment?.image && (
                <Image
                  source={attachment.image}
                  style={{
                    marginTop: 16,
                    width: 100,
                    height: 100,
                    borderWidth: 1,
                    borderColor: '#aaa',
                    borderRadius: 4,
                    backgroundColor: '#eee',
                  }}
                  resizeMethod="auto"
                  resizeMode="cover"
                />
              )}
              {!isImage && (
                <View
                  style={{
                    marginTop: 16,
                    width: 100,
                    height: 100,
                    borderWidth: 1,
                    borderColor: '#aaa',
                    borderRadius: 4,
                    backgroundColor: '#f4f4f4',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <FontAwesome name="file" size={32} color="#999" />
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: '#999',
                position: 'absolute',
                padding: 8,
                right: 0,
                top: 0,
              }}
              onPress={() => onRemove(index)}
            >
              <FontAwesome
                name="close"
                size={16}
                backgroundColor="transparent"
                style={{ alignSelf: 'center' }}
                color="white"
              />
            </TouchableOpacity>
          </View>
        )
      })}
    </ScrollView>
  )
}

function ReplyInputHeader({
  topic,
  replyingToMessageId,
  onCancel,
  onPress,
}: {
  topic: string
  replyingToMessageId: string
  onCancel: () => void
  onPress: () => void
}) {
  const { message, isSenderMe } = useMessage({
    topic,
    messageId: replyingToMessageId,
  })
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ddd',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#333',
      }}
    >
      <TouchableHighlight onPress={onCancel} underlayColor="#eee">
        <Text style={{ color: 'black', fontSize: 16, padding: 16 }}>X</Text>
      </TouchableHighlight>
      <TouchableHighlight
        style={{ flexGrow: 1 }}
        onPress={onPress}
        underlayColor="#eee"
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            paddingLeft: 0,
          }}
        >
          <Text style={{ color: '#777', fontSize: 16, marginRight: 8 }}>
            Replying to
          </Text>
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: isSenderMe ? 'green' : 'gray',
            }}
          />
          <Text style={{ fontSize: 12, fontWeight: 'bold' }}>
            {message?.senderInboxId.slice(0, 6)}…
            {message?.senderInboxId.slice(-4)}
          </Text>
        </View>
      </TouchableHighlight>
    </View>
  )
}

function PillButton({
  highlighted,
  style,
  onPress,
  children,
}: {
  highlighted?: boolean
  style?: object
  onPress: () => void
  children: React.ReactNode
}) {
  return (
    <TouchableHighlight
      style={{
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 4,
        borderColor: highlighted ? '#aa9' : '#aaa',
        backgroundColor: highlighted ? '#ffd' : '#fff',
        padding: 3,
        ...style,
      }}
      onPress={onPress}
    >
      <View
        style={{
          backgroundColor: 'transparent',
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {children}
      </View>
    </TouchableHighlight>
  )
}

function AttachmentModal({
  onRequestClose,
  onAttachedImageFromLibrary,
  onAttachedImageFromCamera,
  onAttachedFile,
  visible,
}: {
  visible: boolean
  onRequestClose: () => void
  onAttachedImageFromLibrary: (images: ImagePickerAsset[]) => void
  onAttachedImageFromCamera: (image: ImagePickerAsset) => void
  onAttachedFile: (file: DocumentPickerAsset) => void
}) {
  const [libraryPerm, requestLibrary] = ImagePicker.useMediaLibraryPermissions()
  const [cameraPerm, requestCamera] = ImagePicker.useCameraPermissions()
  // Update image picker to allow multiple selection
  const pickImages = async () => {
    console.log('pickImages')
    if (libraryPerm?.status !== PermissionStatus.GRANTED) {
      if (!libraryPerm?.canAskAgain) {
        return
      }
      const updated = await requestLibrary()
      if (updated?.status !== PermissionStatus.GRANTED) {
        return
      }
    }
    console.log('libraryPerm', libraryPerm.status)
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      aspect: [4, 3],
      quality: 1,
    })
    if (result.assets?.length) {
      onAttachedImageFromLibrary(result.assets)
    }
  }

  return (
    <Modal transparent visible={visible} onRequestClose={onRequestClose}>
      <TouchableWithoutFeedback onPress={onRequestClose}>
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
          }}
        />
      </TouchableWithoutFeedback>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          margin: '5%',
        }}
      >
        <View
          style={{
            margin: 20,
            backgroundColor: '#f1f1f1',
            borderRadius: 4,
            padding: 24,
            shadowColor: '#000',
            shadowOffset: {
              width: 0,
              height: 2,
            },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5,
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-evenly' }}
          >
            <FontAwesome.Button
              name="image"
              backgroundColor="transparent"
              color="#666"
              size={32}
              style={{ alignSelf: 'center' }}
              iconStyle={{ marginLeft: 8, marginRight: 8 }}
              onPress={pickImages}
            />
            <FontAwesome.Button
              name="camera"
              backgroundColor="transparent"
              color="#666"
              size={32}
              style={{ alignSelf: 'center' }}
              iconStyle={{ marginLeft: 8, marginRight: 8 }}
              onPress={async () => {
                console.log('cameraPerm', cameraPerm)
                if (cameraPerm?.status !== PermissionStatus.GRANTED) {
                  if (!cameraPerm?.canAskAgain) {
                    return
                  }
                  const updated = await requestCamera()
                  if (updated?.status !== PermissionStatus.GRANTED) {
                    return
                  }
                }
                const result = await ImagePicker.launchCameraAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  allowsMultipleSelection: false, // TODO
                  aspect: [4, 3],
                  quality: 1,
                })
                if (result.assets?.length) {
                  onAttachedImageFromCamera(result.assets[0])
                }
              }}
            />
            <FontAwesome.Button
              name="paperclip"
              backgroundColor="transparent"
              color="#666"
              size={32}
              style={{ alignSelf: 'center' }}
              iconStyle={{ marginLeft: 8, marginRight: 8 }}
              onPress={async () => {
                const result = await DocumentPicker.getDocumentAsync({
                  type: '*/*',
                  copyToCacheDirectory: true,
                  multiple: false,
                })
                if (!result.canceled && result.assets?.length) {
                  onAttachedFile(result.assets[0])
                }
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}

function CenteredModal({
  visible,
  onRequestClose,
  children,
}: {
  visible: boolean
  onRequestClose: () => void
  children: React.ReactNode
}) {
  return (
    <Modal transparent visible={visible} onRequestClose={onRequestClose}>
      <TouchableWithoutFeedback onPress={onRequestClose}>
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
          }}
        />
      </TouchableWithoutFeedback>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          margin: '5%',
        }}
      >
        <View
          style={{
            margin: 20,
            backgroundColor: '#f1f1f1',
            borderRadius: 4,
            padding: 24,
            shadowColor: '#000',
            shadowOffset: {
              width: 0,
              height: 2,
            },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5,
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {children}
        </View>
      </View>
    </Modal>
  )
}

function ReactionModal({
  onRequestClose,
  onReaction,
  onReply,
  visible,
}: {
  onRequestClose: () => void
  onReaction: (reaction: string) => void
  onReply: () => void
  visible: boolean
}) {
  return (
    <CenteredModal visible={visible} onRequestClose={onRequestClose}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
        }}
      >
        {['👍', '👋', '❤️', '👎'].map((reaction) => (
          <PillButton
            key={`reaction-${reaction}`}
            style={{
              borderWidth: 0,
              borderRadius: 8,
              backgroundColor: '#fff',
            }}
            onPress={() => onReaction(reaction)}
          >
            <Text style={{ fontSize: 32, padding: 4 }}>{reaction}</Text>
          </PillButton>
        ))}
      </View>
      <Button title="Reply" onPress={onReply} />
    </CenteredModal>
  )
}

function MessageReactions({
  reactions,
  onAddReaction,
  onRemoveReaction,
  onNewReaction,
}: {
  reactions: { reaction: string; count: number; includesMe: boolean }[]
  onAddReaction: (reaction: string) => void
  onRemoveReaction: (reaction: string) => void
  onNewReaction: () => void
}) {
  if (!reactions || reactions.length === 0) {
    return null
  }
  return (
    <View
      style={{
        flexDirection: 'row',
        paddingVertical: 4,
        gap: 8,
        alignItems: 'center',
      }}
    >
      {(reactions || []).map(({ reaction, count, includesMe }) => (
        <PillButton
          key={`reaction-${reaction}`}
          highlighted={includesMe}
          onPress={() =>
            includesMe ? onRemoveReaction(reaction) : onAddReaction(reaction)
          }
        >
          <Text style={{ paddingLeft: 4, paddingRight: 2 }}>{reaction}</Text>
          <Text style={{ paddingLeft: 2, paddingRight: 4 }}>{count}</Text>
        </PillButton>
      ))}
      <PillButton onPress={onNewReaction}>
        <Text style={{ paddingLeft: 8, paddingRight: 8, opacity: 0.5 }}>+</Text>
      </PillButton>
    </View>
  )
}

function ReplyMessageHeader({
  topic,
  parentMessageId,
  onPress,
}: {
  topic: string
  parentMessageId: string
  onPress: () => void
}) {
  const { isSenderMe, message } = useMessage({
    topic,
    messageId: parentMessageId,
  })
  if (!message) {
    return (
      <View
        style={{
          height: 32,
          marginTop: 8,
          marginBottom: 4,
        }}
      />
    )
  }
  const content = message.content()
  return (
    <TouchableHighlight onPress={onPress} underlayColor="#eee">
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 2,
          marginBottom: 2,
        }}
      >
        <View
          style={{
            overflow: 'hidden',
            width: 56,
            height: 32,
            paddingTop: 12,
            paddingLeft: 27,
            paddingBottom: 2,
          }}
        >
          <View
            style={{
              width: 56 - 24 + 2,
              height: 32 - 16 + 2,
              borderTopWidth: 2,
              borderLeftWidth: 2,
              borderColor: '#aaa',
              borderTopLeftRadius: 6,
              // backgroundColor: "red",
            }}
          />
        </View>
        <View
          style={{
            flexDirection: 'row',
            height: 36,
            gap: 6,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: isSenderMe ? 'green' : 'gray',
            }}
          />
          <Text style={{ fontSize: 12, fontWeight: 'bold' }}>
            {message.senderInboxId.slice(0, 6)}…
            {message.senderInboxId.slice(-4)}
          </Text>
          {typeof content !== 'string' && 'text' in content && content.text ? (
            <Text
              style={{ fontSize: 12, color: 'gray' }}
              ellipsizeMode="tail"
              numberOfLines={1}
            >
              {content.text as string}
            </Text>
          ) : (
            <Text style={{ fontSize: 12, color: 'gray', fontStyle: 'italic' }}>
              Tap to see
            </Text>
          )}
        </View>
      </View>
    </TouchableHighlight>
  )
}

function MessageItem({
  topic,
  messageId,
  showSender,
  onReply,
  onMessageReferencePress,
}: {
  topic: string
  messageId: string
  showSender: boolean
  onReply: () => void
  onMessageReferencePress: (messageId: string) => void
}) {
  const [showNewReaction, setShowNewReaction] = useState(false)
  const { reactions } = useMessageReactions({ topic, messageId })
  const { message, isSenderMe, performReaction } = useMessage({
    topic,
    messageId,
  })
  if (!(message instanceof DecodedMessage)) {
    return null
  }
  let content = message.content()
  const replyingTo = (content as ReplyContent)?.reference
  if (replyingTo) {
    const replyContent = (content as ReplyContent).content
    content = replyContent as typeof content
  }
  showSender = !!(replyingTo || showSender)
  return (
    <View>
      {replyingTo && (
        <ReplyMessageHeader
          onPress={() => onMessageReferencePress(replyingTo!)}
          topic={topic}
          parentMessageId={replyingTo!}
        />
      )}
      <TouchableHighlight
        onLongPress={() => setShowNewReaction(true)}
        underlayColor="#eee"
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          {showSender ? (
            <View
              style={{
                marginLeft: 12,
                marginRight: 12,
                marginTop: replyingTo ? 0 : 8,
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: isSenderMe ? 'green' : 'gray',
              }}
            />
          ) : (
            <View style={{ width: 32, marginLeft: 12, marginRight: 12 }} />
          )}
          <View>
            {showSender && (
              <View
                style={{
                  flexDirection: 'row',
                  marginTop: replyingTo ? 0 : 8,
                  gap: 8,
                  alignItems: 'flex-start',
                }}
              >
                <Text style={{ fontWeight: 'bold' }}>
                  {message.senderInboxId.slice(0, 6)}…
                  {message.senderInboxId.slice(-4)}
                </Text>
                <Text style={{ fontWeight: '300' }}>
                  {moment(message.sentNs / 1000000).fromNow()}
                </Text>
              </View>
            )}
            <MessageContents
              contentTypeId={message.contentTypeId}
              content={message.content()}
            />
            <MessageReactions
              reactions={reactions || []}
              onAddReaction={(reaction) =>
                performReaction && performReaction('added', reaction)
              }
              onRemoveReaction={(reaction) =>
                performReaction && performReaction('removed', reaction)
              }
              onNewReaction={() => setShowNewReaction(true)}
            />
            <ReactionModal
              onRequestClose={() => setShowNewReaction(false)}
              onReply={() => {
                setShowNewReaction(false)
                onReply()
              }}
              visible={showNewReaction}
              onReaction={(reaction) => {
                setShowNewReaction(false)
                performReaction &&
                  performReaction('added', reaction)
                    .then(() => {
                      console.log('Reaction added successfully')
                    })
                    .catch((error) => {
                      console.error('Error adding reaction', error)
                    })
              }}
            />
          </View>
        </View>
      </TouchableHighlight>
    </View>
  )
}

function MultiRemoteAttachmentMessageContents({
  remoteAttachments,
}: {
  remoteAttachments: RemoteAttachmentContent[]
}) {
  const [isLoading, setIsLoading] = useState(false)
  const { decrypted } = useLoadMultiRemoteAttachment({
    remoteAttachments,
    enabled: isLoading,
  })

  if (decrypted) {
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {decrypted.map((attachment, index) => (
          <TouchableOpacity key={`decrypted-${index}`}>
            <Image
              source={{ uri: attachment.fileUri }}
              style={{
                marginTop: 16,
                width: 100,
                height: 100,
                borderWidth: 1,
                borderColor: '#aaa',
                borderRadius: 4,
                backgroundColor: '#eee',
              }}
              resizeMethod="auto"
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
      </View>
    )
  }

  return (
    <TouchableOpacity onPress={() => setIsLoading(true)}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {remoteAttachments.map((attachment, index) => (
          <View
            key={`remote-${index}`}
            style={{
              marginTop: 16,
              width: 100,
              height: 100,
              borderWidth: 1,
              borderColor: '#aaa',
              borderRadius: 4,
              backgroundColor: '#eee',
              paddingHorizontal: 4,
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Text
              numberOfLines={1}
              ellipsizeMode="middle"
              style={{ marginTop: 8, fontSize: 12 }}
            >
              {attachment.filename}
            </Text>
            <Text
              style={{ marginBottom: 8, fontSize: 10, fontStyle: 'italic' }}
            >
              {new URL(attachment.url).host}
            </Text>
            <Text
              style={{ marginBottom: 4, fontSize: 10, textAlign: 'center' }}
            >
              {Number(attachment.contentLength).toLocaleString()} bytes
            </Text>
            <FontAwesome name="download" size={24} />
          </View>
        ))}
      </View>
    </TouchableOpacity>
  )
}

function RemoteAttachmentMessageContents({
  remoteAttachment,
  onPress,
}: {
  remoteAttachment: RemoteAttachmentContent
  onPress?: () => void
}) {
  const [isLoading, setIsLoading] = useState(false)
  const { decrypted } = useLoadRemoteAttachment({
    remoteAttachment,
    enabled: isLoading,
  })
  if (decrypted) {
    return (
      <TouchableOpacity onPress={onPress}>
        <Image
          source={{ uri: decrypted.fileUri }}
          style={{
            marginTop: 16,
            width: 100,
            height: 100,
            borderWidth: 1,
            borderColor: '#aaa',
            borderRadius: 4,
            backgroundColor: '#eee',
          }}
          resizeMethod="auto"
          resizeMode="cover"
        />
      </TouchableOpacity>
    )
  }
  return (
    <TouchableOpacity onPress={() => setIsLoading(true)}>
      <View
        style={{
          marginTop: 16,
          width: 100,
          height: 100,
          borderWidth: 1,
          borderColor: '#aaa',
          borderRadius: 4,
          backgroundColor: '#eee',
          paddingHorizontal: 4,
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Text
          numberOfLines={1}
          ellipsizeMode="middle"
          style={{ marginTop: 8, fontSize: 12 }}
        >
          {remoteAttachment.filename}
        </Text>
        <Text style={{ marginBottom: 8, fontSize: 10, fontStyle: 'italic' }}>
          {new URL(remoteAttachment.url).host}
        </Text>
        <Text style={{ marginBottom: 4, fontSize: 10, textAlign: 'center' }}>
          {Number(remoteAttachment.contentLength).toLocaleString()} bytes
        </Text>
        <FontAwesome name="download" size={24} />
      </View>
    </TouchableOpacity>
  )
}

function MessageContents({
  contentTypeId,
  content,
}: {
  contentTypeId: string
  content: any
}) {
  useClient<SupportedContentTypes>()

  if (contentTypeId === 'xmtp.org/text:1.0') {
    const text: string = content
    return (
      <>
        <Text>{text}</Text>
      </>
    )
  }

  if (contentTypeId === 'xmtp.org/multiRemoteStaticAttachment:1.0') {
    const multiAttachment = content as MultiRemoteAttachmentContent
    return (
      <MultiRemoteAttachmentMessageContents
        remoteAttachments={multiAttachment.attachments}
      />
    )
  }

  if (contentTypeId === 'xmtp.org/multiRemoteStaticAttachment:1.0') {
    const multiAttachment = content as MultiRemoteAttachmentContent
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {multiAttachment.attachments.map((attachment, index) => (
          <RemoteAttachmentMessageContents
            key={`attachment-${index}`}
            remoteAttachment={attachment}
          />
        ))}
      </View>
    )
  }

  if (contentTypeId === 'xmtp.org/attachment:1.0') {
    const attachment: StaticAttachmentContent = content
    return (
      <>
        <Text style={{ fontStyle: 'italic' }}>
          Attachment: {attachment.filename} ({attachment.mimeType}) (
          {new Buffer(attachment.data, 'base64').length} bytes)
        </Text>
      </>
    )
  }

  if (contentTypeId === 'xmtp.org/reply:1.0') {
    const replyContent: ReplyContent = content
    const replyContentType = replyContent.contentType
    const codec = Client.codecRegistry[replyContentType]
    const actualReplyContent = codec?.decode(replyContent.content)

    return (
      <View>
        <Text style={{ color: 'gray' }}>Reply</Text>
        <MessageContents
          contentTypeId={replyContentType}
          content={actualReplyContent}
        />
      </View>
    )
  }

  // console.log("unsupported content", content);
  return (
    <>
      <Text style={{ opacity: 0.5, fontStyle: 'italic' }}>
        unsupported message content {contentTypeId}
      </Text>
    </>
  )
}
