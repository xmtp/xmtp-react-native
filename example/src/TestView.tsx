import React from "react";
import { View, Text } from "react-native";

export default function TestView(): JSX.Element {
  return (
    <View>
      <Text>Test View</Text>
      <Text>This view is used by unit tests.</Text>
    </View>
  );
}
