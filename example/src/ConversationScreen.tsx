import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { NavigationParamList } from "./Navigation";
import {
  Button,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableHighlight,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Buffer } from "buffer";
import React, { useRef, useState } from "react";
import {
  useConversation,
  useMessage,
  useMessageReactions,
  useMessages,
} from "./hooks";
import { MessageContent } from "xmtp-react-native-sdk";
import moment from "moment";

/// Show the messages in a conversation.
export default function ConversationScreen({
  route,
}: NativeStackScreenProps<NavigationParamList, "conversation">) {
  let { topic } = route.params;
  let messageListRef = useRef<FlatList>();
  let {
    data: messages,
    refetch: refreshMessages,
    isFetching,
    isRefetching,
  } = useMessages({ topic });
  let { data: conversation } = useConversation({ topic });
  let [replyingTo, setReplyingTo] = useState<string | null>(null);
  let [text, setText] = useState("");
  let [isSending, setSending] = useState(false);

  messages = (messages || []).filter(({ content }) => !content.reaction);
  // console.log("messages", JSON.stringify(messages, null, 2));
  const sendMessage = async (content: MessageContent) => {
    setSending(true);
    console.log("Sending message", content);
    try {
      await conversation!.send(content);
      await refreshMessages();
    } catch (e) {
      console.log("Error sending message", e);
    } finally {
      setSending(false);
    }
  };
  const sendTextMessage = () =>
    sendMessage(
      replyingTo
        ? {
            reply: {
              reference: replyingTo,
              content: { text },
            },
          }
        : { text },
    ).then(() => {
      setText("");
      setReplyingTo(null);
    });
  const scrollToMessageId = (messageId: string) => {
    let index = (messages || []).findIndex((m) => m.id === messageId);
    if (index == -1) {
      return;
    }
    return messageListRef.current?.scrollToIndex({
      index,
      animated: true,
    });
  };
  // const sendAttachment = () => sendMessage({
  //     attachment: {
  //         mimeType: "text/plain",
  //         filename: "hello.txt",
  //         data: new Buffer("Hello Hello Hello Hello Hello Hello").toString("base64"),
  //     }
  // });
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        behavior={"padding"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
        style={{ flex: 1, flexDirection: "column" }}
      >
        <View style={{ flex: 1 }}>
          <FlatList
            ref={messageListRef}
            style={{ flexGrow: 1 }}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshing={isFetching || isRefetching}
            onRefresh={refreshMessages}
            data={messages}
            inverted
            keyboardDismissMode={"none"}
            keyExtractor={(message) => message.id}
            ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
            renderItem={({ item: message, index }) => (
              <MessageItem
                topic={topic}
                messageId={message.id}
                onReply={() => setReplyingTo(message.id)}
                onMessageReferencePress={scrollToMessageId}
                showSender={
                  index === (messages || []).length - 1 ||
                  (index + 1 < (messages || []).length &&
                    messages![index + 1].senderAddress !==
                      message.senderAddress)
                }
              />
            )}
            stickyHeaderIndices={[0]}
            invertStickyHeaders
            stickyHeaderHiddenOnScroll={false}
            ListHeaderComponent={
              <View style={{ flexDirection: "column" }}>
                {replyingTo && (
                  <ReplyInputHeader
                    topic={topic}
                    replyingToMessageId={replyingTo}
                    onCancel={() => setReplyingTo(null)}
                    onPress={() => scrollToMessageId(replyingTo!)}
                  />
                )}
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <TextInput
                    onSubmitEditing={sendTextMessage}
                    editable={!isSending}
                    value={text}
                    onChangeText={setText}
                    style={{
                      height: 40,
                      margin: 12,
                      marginRight: 0,
                      borderWidth: 1,
                      padding: 10,
                      backgroundColor: "white",
                      flexGrow: 1,
                      opacity: isSending ? 0.5 : 1,
                    }}
                  />
                  <Button
                    title="Send"
                    onPress={sendTextMessage}
                    disabled={isSending || !conversation || !text.length}
                  />
                </View>
              </View>
            }
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ReplyInputHeader({
  topic,
  replyingToMessageId,
  onCancel,
  onPress,
}: {
  topic: string;
  replyingToMessageId: string;
  onCancel: () => void;
  onPress: () => void;
}) {
  let { message, isSenderMe } = useMessage({
    topic,
    messageId: replyingToMessageId,
  });
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#ddd",
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#333",
      }}
    >
      <TouchableHighlight onPress={onCancel} underlayColor="#eee">
        <Text style={{ color: "black", fontSize: 16, padding: 16 }}>X</Text>
      </TouchableHighlight>
      <TouchableHighlight
        style={{ flexGrow: 1 }}
        onPress={onPress}
        underlayColor="#eee"
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: 16,
            paddingLeft: 0,
          }}
        >
          <Text style={{ color: "#777", fontSize: 16, marginRight: 8 }}>
            Replying to
          </Text>
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: isSenderMe ? "green" : "gray",
            }}
          />
          <Text style={{ fontSize: 12, fontWeight: "bold" }}>
            {message?.senderAddress.slice(0, 6)}…
            {message?.senderAddress.slice(-4)}
          </Text>
        </View>
      </TouchableHighlight>
    </View>
  );
}

function PillButton({
  highlighted,
  style,
  onPress,
  children,
}: {
  highlighted?: boolean;
  style?: {};
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <TouchableHighlight
      style={{
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 4,
        borderColor: highlighted ? "#aa9" : "#aaa",
        backgroundColor: highlighted ? "#ffd" : "#fff",
        padding: 3,
        ...style,
      }}
      onPress={onPress}
    >
      <View
        style={{
          backgroundColor: "transparent",
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        {children}
      </View>
    </TouchableHighlight>
  );
}

function ReactionModal({
  onRequestClose,
  onReaction,
  onReply,
  visible,
}: {
  onRequestClose: () => void;
  onReaction: (reaction: string) => void;
  onReply: () => void;
  visible: boolean;
}) {
  return (
    <Modal transparent visible={visible} onRequestClose={onRequestClose}>
      <TouchableWithoutFeedback onPress={onRequestClose}>
        <View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        />
      </TouchableWithoutFeedback>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          margin: "5%",
        }}
      >
        <View
          style={{
            margin: 20,
            backgroundColor: "#f1f1f1",
            borderRadius: 4,
            padding: 24,
            shadowColor: "#000",
            shadowOffset: {
              width: 0,
              height: 2,
            },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5,
            flexDirection: "column",
            gap: 16,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-around",
            }}
          >
            {["👍", "👋", "❤️", "👎"].map((reaction) => (
              <PillButton
                key={`reaction-${reaction}`}
                style={{
                  borderWidth: 0,
                  borderRadius: 8,
                  backgroundColor: "#fff",
                }}
                onPress={() => onReaction(reaction)}
              >
                <Text style={{ fontSize: 32, padding: 4 }}>{reaction}</Text>
              </PillButton>
            ))}
          </View>
          <Button title={"Reply"} onPress={onReply} />
        </View>
      </View>
    </Modal>
  );
}

function MessageReactions({
  reactions,
  onAddReaction,
  onRemoveReaction,
  onNewReaction,
}: {
  reactions: { reaction: string; count: number; includesMe: boolean }[];
  onAddReaction: (reaction: string) => void;
  onRemoveReaction: (reaction: string) => void;
  onNewReaction: () => void;
}) {
  if (!reactions || reactions.length === 0) {
    return null;
  }
  return (
    <View
      style={{
        flexDirection: "row",
        paddingVertical: 4,
        gap: 8,
        alignItems: "center",
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
  );
}

function ReplyMessageHeader({
  topic,
  parentMessageId,
  onPress,
}: {
  topic: string;
  parentMessageId: string;
  onPress: () => void;
}) {
  let { isSenderMe, message } = useMessage({
    topic,
    messageId: parentMessageId,
  });
  if (!message) {
    return (
      <View
        style={{
          height: 32,
          marginTop: 8,
          marginBottom: 4,
        }}
      />
    );
  }
  return (
    <TouchableHighlight onPress={onPress} underlayColor="#eee">
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 2,
          marginBottom: 2,
        }}
      >
        <View
          style={{
            overflow: "hidden",
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
              borderColor: "#aaa",
              borderTopLeftRadius: 6,
              // backgroundColor: "red",
            }}
          />
        </View>
        <View
          style={{
            flexDirection: "row",
            height: 36,
            gap: 6,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: isSenderMe ? "green" : "gray",
            }}
          />
          <Text style={{ fontSize: 12, fontWeight: "bold" }}>
            {message.senderAddress.slice(0, 6)}…
            {message.senderAddress.slice(-4)}
          </Text>
          {message.content.text ? (
            <Text
              style={{ fontSize: 12, color: "gray" }}
              ellipsizeMode="tail"
              numberOfLines={1}
            >
              {message.content.text}
            </Text>
          ) : (
            <Text style={{ fontSize: 12, color: "gray", fontStyle: "italic" }}>
              Tap to see
            </Text>
          )}
        </View>
      </View>
    </TouchableHighlight>
  );
}

function MessageItem({
  topic,
  messageId,
  showSender,
  onReply,
  onMessageReferencePress,
}: {
  topic: string;
  messageId: string;
  showSender: boolean;
  onReply: () => void;
  onMessageReferencePress: (messageId: string) => void;
}) {
  let [showNewReaction, setShowNewReaction] = useState(false);
  let { reactions } = useMessageReactions({ topic, messageId });
  let { message, isSenderMe, performReaction } = useMessage({
    topic,
    messageId,
  });
  if (!message) {
    return null;
  }
  let content = message.content;
  let replyingTo = content.reply?.reference;
  if (content.reply) {
    content = content.reply.content;
  }
  showSender = !!(replyingTo || showSender);
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
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          {showSender ? (
            <View
              style={{
                marginLeft: 12,
                marginRight: 12,
                marginTop: replyingTo ? 0 : 8,
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: isSenderMe ? "green" : "gray",
              }}
            />
          ) : (
            <View style={{ width: 32, marginLeft: 12, marginRight: 12 }} />
          )}
          <View>
            {showSender && (
              <View
                style={{
                  flexDirection: "row",
                  marginTop: replyingTo ? 0 : 8,
                  gap: 8,
                  alignItems: "flex-start",
                }}
              >
                <Text style={{ fontWeight: "bold" }}>
                  {message.senderAddress.slice(0, 6)}…
                  {message.senderAddress.slice(-4)}
                </Text>
                <Text style={{ fontWeight: "300" }}>
                  {moment(message.sent).fromNow()}
                </Text>
              </View>
            )}
            <MessageContents content={content} />
            <MessageReactions
              reactions={reactions || []}
              onAddReaction={(reaction) =>
                performReaction && performReaction("added", reaction)
              }
              onRemoveReaction={(reaction) =>
                performReaction && performReaction("removed", reaction)
              }
              onNewReaction={() => setShowNewReaction(true)}
            />
            <ReactionModal
              onRequestClose={() => setShowNewReaction(false)}
              onReply={() => {
                setShowNewReaction(false);
                onReply();
              }}
              visible={showNewReaction}
              onReaction={(reaction) => {
                setShowNewReaction(false);
                performReaction && performReaction("added", reaction);
              }}
            />
          </View>
        </View>
      </TouchableHighlight>
    </View>
  );
}

function MessageContents({ content }: { content: MessageContent }) {
  if (content.text) {
    return (
      <>
        <Text>{content.text}</Text>
      </>
    );
  }
  if (content.attachment) {
    return (
      <>
        <Text style={{ fontStyle: "italic" }}>
          Attachment: {content.attachment.filename} (
          {content.attachment.mimeType}) (
          {new Buffer(content.attachment.data, "base64").length} bytes)
        </Text>
      </>
    );
  }
  // console.log("unsupported content", content);
  return (
    <>
      <Text style={{ opacity: 0.5, fontStyle: "italic" }}>
        unsupported message content
      </Text>
    </>
  );
}
