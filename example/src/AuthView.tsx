/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */
import { ConnectWallet, useSigner } from "@thirdweb-dev/react-native";
import React, { useEffect, Dispatch, SetStateAction } from "react";
import { SafeAreaView, Button, ScrollView } from "react-native";
import * as XMTP from "xmtp-react-native-sdk";

function AuthView({
  setClient,
}: {
  setClient: Dispatch<SetStateAction<XMTP.Client | null>>;
}): JSX.Element {
  const signer = useSigner();

  useEffect(() => {
    (async () => {
      if (signer) {
        const client = await XMTP.Client.create(signer, "dev");
        setClient(client);
      }
    })();
  }, [signer]);

  const generateWallet = async () => {
    const client = await XMTP.Client.createRandom("dev");
    setClient(client);
  };

  return (
    <SafeAreaView style={{ flexGrow: 1 }}>
      <ScrollView style={{ flexGrow: 1 }}>
        <ConnectWallet />
        <Button title="Generate Wallet" onPress={generateWallet} />
      </ScrollView>
    </SafeAreaView>
  );
}

export default AuthView;
