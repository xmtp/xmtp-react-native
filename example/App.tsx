import { ThirdwebProvider } from "@thirdweb-dev/react-native";
import React, { useState } from "react";
import { Button, SafeAreaView, StyleSheet, View } from "react-native";
import * as XMTP from "xmtp-react-native-sdk";

import AuthView from "./src/AuthView";
import HomeView from "./src/HomeView";
import TestView from "./src/TestView";

export default function App() {
  const [client, setClient] = useState<XMTP.Client | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  return isTesting ? (
    <SafeAreaView style={{ flexGrow: 1 }}>
      <TestView />
    </SafeAreaView>
  ) : (
    <ThirdwebProvider activeChain="mainnet">
      <SafeAreaView style={{ flexGrow: 1 }}>
        {client != null ? (
          <HomeView client={client} />
        ) : (
          <View>
            <AuthView setClient={setClient} />
            <Button
              onPress={() => setIsTesting(true)}
              title="Enable Test Mode"
            />
          </View>
        )}
      </SafeAreaView>
    </ThirdwebProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
