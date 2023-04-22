import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Button, Text, TextInput, View } from "react-native";
import { Client } from "xmtp-react-native-sdk";

import { RootStackParamList } from "./HomeView";

function NewConversationView({
  client,
  navigation,
  onSuccess,
}: {
  client: Client;
  navigation: NativeStackNavigationProp<
    RootStackParamList,
    "Conversation List"
  >;
  onSuccess: () => void;
}): JSX.Element {
  const [address, setAddress] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [isCreating, setIsCreating] = useState<boolean>(false);

  async function startConverstation() {
    setIsCreating(true);
    try {
      const conversation = await client.conversations.newConversation(address);
      setIsCreating(false);
      onSuccess();
      navigation.navigate("Conversation View", { conversation });
    } catch (e) {
      setIsCreating(false);

      if (e instanceof Error) {
        setErr(e.message);
      } else {
        setErr("could not create conversation");
      }
    }
  }

  return (
    <View style={{ padding: 12 }}>
      <Text>New conversation</Text>
      <TextInput
        value={address}
        onChangeText={setAddress}
        editable={!isCreating}
        style={{
          height: 40,
          margin: 12,
          marginRight: 0,
          borderWidth: 1,
          padding: 10,
          backgroundColor: "white",
          flexGrow: 1,
          opacity: isCreating ? 0.5 : 1,
        }}
      />
      {err && <Text>{err}</Text>}
      <Button
        title="Start conversation"
        onPress={startConverstation}
        disabled={isCreating}
      />
    </View>
  );
}

function HomeHeaderView({
  client,
  navigation,
}: {
  client: Client;
  navigation: NativeStackNavigationProp<
    RootStackParamList,
    "Conversation List"
  >;
}): JSX.Element {
  const [isShowingNewConversation, setIsShowingNewConversation] =
    useState<boolean>(false);

  return (
    <View>
      <View style={{ flexDirection: "row", padding: 12 }}>
        <Text>Authed as</Text>
        <Text selectable>{client.address}</Text>
      </View>
      <View style={{ padding: 12 }}>
        <Button
          title="New Conversation"
          onPress={() => {
            setIsShowingNewConversation(!isShowingNewConversation);
          }}
        />
      </View>
      {isShowingNewConversation && (
        <NewConversationView
          client={client}
          navigation={navigation}
          onSuccess={() => {
            setIsShowingNewConversation(false);
          }}
        />
      )}
    </View>
  );
}

export default HomeHeaderView;
