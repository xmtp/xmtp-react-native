import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { Text, ScrollView, RefreshControl } from "react-native";
import { Conversation } from "xmtp-react-native-sdk";

import HomeHeaderView from "./HomeHeaderView";
import { RootStackParamList } from "./HomeView";

type Props = NativeStackScreenProps<RootStackParamList, "Conversation List">;

export default function ConversationListView({
  route,
  navigation,
}: Props): JSX.Element {
  const client = route.params.client;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messageCount, setMessageCount] = useState<number>(0);

  async function refreshConversations() {
    const conversations = await client.conversations.list();
    const allMessages = await client.listBatchMessages(
        conversations.map((conversation) => conversation.topic),
        conversations.map((conversation) => conversation.conversationID)
    );
    setConversations(conversations);
    setMessageCount(allMessages.length);
  }

  useEffect(() => {
    refreshConversations();
  }, [client]);

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    refreshConversations();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    client.conversations.stream(async (conversation) => {
      const uniqueConversations = [
        ...new Map(
          [conversation, ...conversations].map((item: Conversation) => [
            item.topic,
            item,
          ])
        ).values(),
      ];

      setConversations(uniqueConversations);
    });
  }, [client]);

  useEffect(() => {
    client.conversations.streamAllMessages(async (message) => {
      console.log(message.content);
    });
  }, [client]);

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <HomeHeaderView client={client} navigation={navigation} />
      <Text style={{marginLeft: 12}}>{messageCount} messages in {conversations.length} conversations</Text>

      {conversations.map((conversation) => {
        return (
          <Text
            onPress={() => {
              navigation.navigate("Conversation View", { conversation });
            }}
            style={{ marginTop: 12, padding: 12 }}
            key={conversation.topic}
          >
            {conversation.peerAddress}, topic: {conversation.topic}
          </Text>
        );
      })}

      {conversations.length === 0 && (
        <Text style={{ padding: 12 }}>No conversations yet.</Text>
      )}
    </ScrollView>
  );
}
