import { NavigationParamList } from "./Navigation";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useXmtp } from "./XmtpContext";
import { useConversationList, useLastMessage, useMessages } from "./hooks";
import {
  Button,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import React, { useContext } from "react";
import { Conversation } from "xmtp-react-native-sdk";
import { NavigationContext } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack/src/types";
import moment from "moment";

/// Show the user's list of conversations.

export default function HomeScreen() {
  let { client } = useXmtp();
  let {
    data: conversations,
    refetch,
    isFetching,
    isRefetching,
  } = useConversationList();
  return (
    <FlatList
      refreshing={isFetching || isRefetching}
      onRefresh={refetch}
      data={conversations || []}
      keyExtractor={(item) => item.topic}
      renderItem={({ item: conversation }) => (
        <ConversationItem conversation={conversation} />
      )}
      ListHeaderComponent={
        <View
          style={{
            paddingTop: 8,
            paddingBottom: 8,
            paddingLeft: 16,
            paddingRight: 16,
            backgroundColor: "#eee",
            borderBottomColor: "gray",
            borderBottomWidth: StyleSheet.hairlineWidth,
          }}
        >
          <Text style={{ fontSize: 14 }}>Connected as</Text>
          <Text style={{ fontSize: 14, fontWeight: "bold" }}>
            {client?.address}
          </Text>
        </View>
      }
    />
  );
}

function ConversationItem({ conversation }: { conversation: Conversation }) {
  const navigation = useContext(NavigationContext);
  const { data: messages } = useMessages({ topic: conversation.topic });
  const lastMessage = messages?.[0];
  return (
    <Pressable
      onPress={() =>
        navigation!.navigate("conversation", {
          topic: conversation.topic,
        })
      }
    >
      <View
        style={{
          flexDirection: "row",
          padding: 8,
        }}
      >
        <View style={{ padding: 4 }}>
          <Text style={{ fontWeight: "bold" }}>
            ({messages?.length} messages)
          </Text>
        </View>
        <View style={{ padding: 4 }}>
          <Text numberOfLines={1} ellipsizeMode="tail">
            {lastMessage?.content.text}
          </Text>
          <Text>{lastMessage?.senderAddress}:</Text>
          <Text>{moment(lastMessage?.sent).fromNow()}</Text>
        </View>
      </View>
    </Pressable>
  );
}
