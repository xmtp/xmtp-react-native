import React, { useEffect, useState } from "react";
import { Text, ScrollView } from "react-native";
import { Client, Conversation } from "xmtp-react-native-sdk";

import HomeHeaderView from "./HomeHeaderView";

const HomeView = ({ client }: { client: Client }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    (async () => {
      const conversations = await client.conversations.list();
      setConversations(conversations);
    })();
  }, [client]);

  return (
    <>
      <HomeHeaderView />
      <ScrollView>
        <Text>Convo list goes here</Text>

        {conversations.map((conversation) => {
          return (
            <Text>
              {conversation.peerAddress}, topic: {conversation.topic}
            </Text>
          );
        })}
      </ScrollView>
    </>
  );
};

export default HomeView;
