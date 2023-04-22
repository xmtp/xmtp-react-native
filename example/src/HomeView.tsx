import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { Client, Conversation } from "xmtp-react-native-sdk";

import ConversationListView from "./ConversationListView";
import ConversationView from "./ConversationView";

export type RootStackParamList = {
  "Conversation List": { client: Client };
  "Conversation View": { conversation: Conversation };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const HomeView = ({ client }: { client: Client }) => {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Conversation List"
          component={ConversationListView}
          initialParams={{ client }}
        />
        <Stack.Screen name="Conversation View" component={ConversationView} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default HomeView;
