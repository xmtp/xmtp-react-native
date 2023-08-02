import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { NavigationParamList } from "./Navigation";
import { Button, ScrollView, StyleSheet, Text, View } from "react-native";
import React from "react";
import { useXmtp } from "./XmtpContext";
import * as XMTP from "xmtp-react-native-sdk";
import { ConnectWallet, useSigner } from "@thirdweb-dev/react-native";
import { useSavedKeys } from "./hooks";

const appVersion = "XMTP_RN_EX/0.0.1";

/// Prompt the user to run the tests, generate a wallet, or connect a wallet.
export default function LaunchScreen({
  navigation,
}: NativeStackScreenProps<NavigationParamList, "launch">) {
  let { setClient } = useXmtp();
  let signer = useSigner();
  let savedKeys = useSavedKeys();
  const configureWallet = (configuring: Promise<XMTP.Client>) => {
    configuring
      .then(async (client) => {
        console.log("configured", { address: client.address });
        setClient(client);
        navigation.navigate("home");
        let keyBundle = await client.exportKeyBundle();
        await savedKeys.save(keyBundle);
      })
      .catch((err) => console.log("Error creating client", err));
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
      {["dev", "local"].map((env) => (
        <View key={`generated-${env}`} style={{ margin: 16 }}>
          <Button
            title={`Use Generated Wallet (${env})`}
            color={env === "dev" ? "green" : "purple"}
            onPress={() => {
              configureWallet(XMTP.Client.createRandom({ env, appVersion }));
            }}
          />
        </View>
      ))}
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
          {["dev", "local"].map((env) => (
            <View key={`saved-${env}`} style={{ margin: 16 }}>
              <Button
                title={`Use Saved Wallet (${env})`}
                color={env === "dev" ? "green" : "purple"}
                onPress={() => {
                  configureWallet(
                    XMTP.Client.createFromKeyBundle(savedKeys.keyBundle!, {
                      env,
                      appVersion,
                    }),
                  );
                }}
              />
            </View>
          ))}
          <View key={`saved-clear`} style={{ margin: 16 }}>
            <Button
              title={`Clear Saved Wallet`}
              // color={"black"}
              onPress={() => savedKeys.clear()}
            />
          </View>
        </>
      )}
      <Divider key="divider-connected" />
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
        Real Wallet
      </Text>
      <View key="connect-wallet" style={{ margin: 16 }}>
        <ConnectWallet />
      </View>
      {["dev", "local"].map(
        (env) =>
          signer && (
            <View key={`connected-${env}`} style={{ margin: 16 }}>
              <Button
                title={`Use Connected Wallet (${env})`}
                onPress={() => {
                  configureWallet(
                    XMTP.Client.create(signer!, { env, appVersion }),
                  );
                }}
              />
            </View>
          ),
      )}
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
