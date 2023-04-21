import React, { useEffect, useState } from "react";
import { NativeModules, Text, View } from "react-native";

import * as XMTPModule from "xmtp-react-native-sdk";

function HomeHeaderView(): JSX.Element {
  const [address, setAddress] = useState<string>("");

  useEffect(() => {
    (async () => {
      setAddress(XMTPModule.address());
    })();
  }, []);

  return (
    <View style={{ flexDirection: "row" }}>
      <Text>Authed as {address}</Text>
    </View>
  );
}

export default HomeHeaderView;
