import { ThirdwebProvider } from "@thirdweb-dev/react-native";
import React, { useState } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import * as XMTP from "xmtp-react-native-sdk";

import AuthView from "./src/AuthView";
import HomeView from "./src/HomeView";

export default function App() {
  const [client, setClient] = useState<XMTP.Client | null>(null);

  return (
    <ThirdwebProvider activeChain="mainnet">
      <SafeAreaView style={{ flexGrow: 1 }}>
        {client != null ? (
          <HomeView client={client} />
        ) : (
          <AuthView setClient={setClient} />
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
