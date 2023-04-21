import { ThirdwebProvider } from "@thirdweb-dev/react-native";
import React, { useState } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import * as XMTPModule from "xmtp-react-native-sdk";

import AuthView from "./src/AuthView";
import HomeView from "./src/HomeView";

export default function App() {
  const [authed, setAuthed] = useState<boolean>(false);

  XMTPModule.emitter.addListener("authed", () => {
    setAuthed(true);
  });

  return (
    <ThirdwebProvider activeChain="mainnet">
      <SafeAreaView style={{ flexGrow: 1 }}>
        {authed ? <HomeView /> : <AuthView />}
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
