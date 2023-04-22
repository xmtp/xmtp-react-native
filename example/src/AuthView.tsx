/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */
import { ConnectWallet, useSigner } from "@thirdweb-dev/react-native";
import React, { useEffect, Dispatch, SetStateAction } from "react";
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
        const client = await XMTP.Client.create(signer);
        setClient(client);
      }
    })();
  }, [signer]);

  return <ConnectWallet />;
}

export default AuthView;
