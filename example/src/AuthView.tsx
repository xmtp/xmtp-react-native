/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */
import { ConnectWallet, useSigner } from "@thirdweb-dev/react-native";
import { utils } from "ethers";
import React, { useEffect } from "react";
import * as XMTPModule from "xmtp-react-native-sdk";

function hexToBytes(s: string): Uint8Array {
  if (s.startsWith("0x")) {
    s = s.slice(2);
  }
  const bytes = new Uint8Array(s.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const j = i * 2;
    bytes[i] = Number.parseInt(s.slice(j, j + 2), 16);
  }
  return bytes;
}

function AuthView(): JSX.Element {
  const signer = useSigner();

  XMTPModule.emitter.addListener(
    "sign",
    async (message: { id: string; message: string }) => {
      const request: { id: string; message: string } = message;

      if (signer) {
        const signatureString = await signer.signMessage(request.message);
        const eSig = utils.splitSignature(signatureString);
        const r = hexToBytes(eSig.r);
        const s = hexToBytes(eSig.s);
        const sigBytes = new Uint8Array(65);
        sigBytes.set(r);
        sigBytes.set(s, r.length);
        sigBytes[64] = eSig.recoveryParam;

        const signature = Buffer.from(sigBytes).toString("base64");

        XMTPModule.receiveSignature(request.id, signature);
      }
    }
  );

  useEffect(() => {
    (async () => {
      if (signer) {
        console.info("Authing with XMTP");
        XMTPModule.auth(await signer.getAddress());
      }
    })();
  }, [signer]);

  return <ConnectWallet />;
}

export default AuthView;
