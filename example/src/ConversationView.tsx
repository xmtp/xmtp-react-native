import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { content as protoContent } from "@xmtp/proto";
import React, { useEffect, useState } from "react";
import {
  Text,
  ScrollView,
  RefreshControl,
  TextInput,
  View,
  Button,
} from "react-native";
import { Conversation } from "xmtp-react-native-sdk";

import { RootStackParamList } from "./HomeView";
import { TextCodec } from "./test_utils";
import {
  CodecRegistry,
  ContentCodecInterface,
} from "../../src/lib/CodecRegistry";

type Props = NativeStackScreenProps<RootStackParamList, "Conversation View">;

type DecodedMessage = {
  content: string;
  id: string;
  senderAddress: string;
  sent: Date;
};

export default function ConversationView({ route }: Props): JSX.Element {
  const conversation = new Conversation(route.params.conversation);

  const [messages, setMessages] = useState<DecodedMessage[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [content, onChangeContent] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);

  async function loadMessages() {
    try {
      const messages = await conversation.messages();
      const textCodec = new TextCodec();
      const mappedMessages = messages.map((msg) => {
        return {
          ...msg,
          content: textCodec.decode(msg.content),
        };
      });
      setMessages(
        mappedMessages.sort((a, b) => {
          return a.sent > b.sent ? 1 : -1;
        })
      );
    } catch (e) {
      console.info("ERROR LOADING MESSAGES:", conversation, e);
    }
  }

  useEffect(() => {
    (async () => {
      loadMessages();
    })();
  }, []);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    loadMessages();
    setRefreshing(false);
  }, []);

  async function sendMessage() {
    setIsSending(true);
    let codec: ContentCodecInterface<string | number> = new TextCodec();

    const registry = new CodecRegistry();
    registry.register(codec);

    const encodedContent = codec.encode(content);
    const data = protoContent.EncodedContent.encode(encodedContent).finish();
    const message = await conversation.send(data);

    const uniqueMessages = [
      ...new Map(
        [message, ...messages].map((item: DecodedMessage) => [item.id, item])
      ).values(),
    ].sort((a, b) => {
      return a.sent > b.sent ? 1 : -1;
    });

    setMessages(uniqueMessages);

    setIsSending(false);
    onChangeContent("");
  }

  useEffect(() => {
    const unsubscribe = conversation.streamMessages(async (message) => {
      await loadMessages();
    });

    return unsubscribe;
  }, []);

  return (
    <>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {messages.map((message) => {
          return (
            <Text style={{ marginTop: 12, padding: 12 }} key={message.id}>
              {message.senderAddress}: {message.content}
            </Text>
          );
        })}

        {messages.length === 0 && (
          <Text style={{ padding: 12 }}>No messages yet.</Text>
        )}
      </ScrollView>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <TextInput
          onSubmitEditing={sendMessage}
          editable={!isSending}
          value={content}
          onChangeText={onChangeContent}
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
        <Button title="Send" onPress={sendMessage} disabled={isSending} />
      </View>
    </>
  );
}
