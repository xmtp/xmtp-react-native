import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { NavigationParamList } from "./Navigation";
import { Button, ScrollView, StyleSheet, Text, View } from "react-native";
import React from "react";
import { useXmtp } from "./XmtpContext";
import * as XMTP from "xmtp-react-native-sdk";
import { useSavedKeys } from "./hooks";

const appVersion = "XMTP_RN_EX/0.0.1";

/// Prompt the user to run the tests, generate a wallet, or connect a wallet.
export default function LaunchScreen({
  navigation,
}: NativeStackScreenProps<NavigationParamList, "launch">) {
  let { setClient } = useXmtp();
  let savedKeys = useSavedKeys();
  const configureWallet = (
    label: string,
    configuring: Promise<XMTP.Client>
  ) => {
    console.log("Connecting XMTP client", label);
    configuring
      .then(async (client) => {
        console.log("Connected XMTP client", label, {
          address: client.address,
        });
        setClient(client);
        navigation.navigate("home");
        // Save the configured client keys for use in later sessions.
        let keyBundle = await client.exportKeyBundle();
        await savedKeys.save(keyBundle);
      })
      .catch((err) => console.log("Unable to connect XMTP client", label, err));
  };
  return (
    <ScrollView>
      <Text
        style={{
          fontSize: 16,
          textAlign: "right",
          textTransform: "uppercase",
          color: "#333",
          marginTop: 16,
          paddingHorizontal: 16,
          marginHorizontal: 16,
        }}
      >
        Testing
      </Text>
      <View key="run-tests" style={{ margin: 16, marginTop: 16 }}>
        <Button
          title="Run Unit Tests"
          onPress={() => navigation.navigate("test")}
          accessibilityLabel="Unit-tests"
        />
      </View>
      <Divider key="divider-generated" />
      <Text
        style={{
          fontSize: 16,
          textAlign: "right",
          textTransform: "uppercase",
          color: "#333",
          paddingHorizontal: 16,
          marginHorizontal: 16,
        }}
      >
        Random Wallet
      </Text>
      <View key={`generated-dev`} style={{ margin: 16 }}>
        <Button
          title={`Use Generated Wallet (dev)`}
          color="green"
          onPress={() => {
            configureWallet(
              "dev",
              XMTP.Client.createRandom({ env: "dev", appVersion })
            );
          }}
        />
      </View>
      <View key={`generated-local`} style={{ margin: 16 }}>
        <Button
          title={`Use Generated Wallet (local)`}
          color="purple"
          onPress={() => {
            configureWallet(
              "local",
              XMTP.Client.createRandom({ env: "local", appVersion })
            );
          }}
        />
      </View>
      {!!savedKeys.keyBundle && (
        <>
          <Divider key="divider-saved" />
          <Text
            style={{
              fontSize: 16,
              textAlign: "right",
              textTransform: "uppercase",
              color: "#333",
              paddingHorizontal: 16,
              marginHorizontal: 16,
            }}
          >
            Saved Wallet
          </Text>
          <View key="saved-dev" style={{ margin: 16 }}>
            <Button
              title="Use Saved Wallet (dev)"
              color="green"
              onPress={() => {
                configureWallet(
                  "dev",
                  XMTP.Client.createFromKeyBundle(savedKeys.keyBundle!, {
                    env: "dev",
                    appVersion,
                  })
                );
              }}
            />
          </View>
          <View key="saved-local" style={{ margin: 16 }}>
            <Button
              title="Use Saved Wallet (local)"
              color="purple"
              onPress={() => {
                configureWallet(
                  "local",
                  XMTP.Client.createFromKeyBundle(savedKeys.keyBundle!, {
                    env: "local",
                    appVersion,
                  })
                );
              }}
            />
          </View>
          <View key="saved-clear" style={{ margin: 16 }}>
            <Button
              title="Clear Saved Wallet"
              // color={"black"}
              onPress={() => savedKeys.clear()}
            />
          </View>
        </>
      )}

      <Button
        title="Test Stream"
        onPress={async () => {
          console.log("testing streamsies");
          const client1 = await XMTP.Client.createRandom();
          const client2 = await XMTP.Client.createRandom();
          const client3 = await XMTP.Client.createRandom();

          const convo1 = await client3.conversations.newConversation(
            client1.address
          );

          const convo2 = await client3.conversations.newConversation(
            client2.address
          );

          await Promise.all([
            client1.conversations.streamAllMessages(async (message) => {
              console.log("client1 message", message);
            }),

            client2.conversations.streamAllMessages(async (message) => {
              console.log("client2 message", message);
            }),

            async () => {
              setTimeout(async () => {
                console.log("sending message");
                await convo1.send("hi");
              }, 1000);
            },
          ]);
        }}
      />
    </ScrollView>
  );
}

function Divider() {
  return (
    <View
      style={{
        borderBottomColor: "black",
        margin: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
      }}
    />
  );
}
