import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { NavigationParamList } from "./Navigation";
import { Button, ScrollView, Text, TextInput } from "react-native";
import React, { useState } from "react";
import { useXmtp } from "./XmtpContext";

export default function ConversationCreateScreen({
  route,
  navigation,
}: NativeStackScreenProps<NavigationParamList, "conversationCreate">) {
  const [toAddress, setToAddress] = useState<string>("");
  const [alert, setAlert] = useState<string>("");
  const [isCreating, setCreating] = useState<boolean>(false);
  const { client } = useXmtp();
  const startNewConversation = async (toAddress: string) => {
    if (!client) {
      setAlert("Client not initialized");
      return;
    }
    let canMessage = await client.canMessage(toAddress);
    if (!canMessage) {
      setAlert(`${toAddress} is not on the XMTP network yet`);
      return;
    }
    let convo = await client.conversations.newConversation(toAddress);
    navigation.navigate("conversation", { topic: convo.topic });
  };
  return (
    <>
      <ScrollView>
        <TextInput
          value={toAddress}
          placeholder="Enter an address"
          onChangeText={(toAddress) => {
            setToAddress(toAddress);
            setAlert(""); // clear any previous alert
          }}
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
        <Button
          title="Start conversation"
          onPress={() => {
            setCreating(true);
            setAlert("");
            startNewConversation(toAddress)
              .catch((err) => setAlert(err.message))
              .finally(() => setCreating(false));
          }}
          disabled={isCreating || !toAddress}
        />
        {alert && (
          <Text
            style={{
              margin: 16,
              padding: 16,
              backgroundColor: "#fee",
              textAlign: "left",
            }}
          >
            {alert}
          </Text>
        )}
      </ScrollView>
    </>
  );
}
