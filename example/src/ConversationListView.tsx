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

  async function refreshConversations() {
    // Write code to time this function and divide by number of conversations
    // to get an idea of how long it takes to load a conversation.
    let start = Date.now();
    const conversations = await client.conversations.list();
    let end = Date.now();
    console.log(
      `Loaded ${conversations.length} conversations in ${end - start}ms`
    );
    setConversations(conversations);
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

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <HomeHeaderView client={client} navigation={navigation} />

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
