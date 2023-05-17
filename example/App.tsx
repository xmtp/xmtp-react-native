import { ThirdwebProvider } from "@thirdweb-dev/react-native";
import React, { useState } from "react";
import { Button, SafeAreaView, View } from "react-native";
import * as XMTP from "xmtp-react-native-sdk";

import AuthView from "./src/AuthView";
import HomeView from "./src/HomeView";
import TestsView from "./src/TestsView";
import { XMTPProvider } from "@xmtp/react-sdk";

export default function App() {
  const [client, setClient] = useState<XMTP.Client | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  return isTesting ? (
    <SafeAreaView style={{ flexGrow: 1 }}>
      <TestsView />
    </SafeAreaView>
  ) : (
    <ThirdwebProvider activeChain="mainnet">
      <XMTPProvider>
        <SafeAreaView style={{ flexGrow: 1 }}>
          {client != null ? (
            <HomeView client={client} />
          ) : (
            <View>
              <AuthView setClient={setClient} />
              <Button
                onPress={() => setIsTesting(true)}
                title="Unit tests"
                accessibilityLabel="Unit-tests"
              />
            </View>
          )}
        </SafeAreaView>
      </XMTPProvider>
    </ThirdwebProvider>
  );
}
