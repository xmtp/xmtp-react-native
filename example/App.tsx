import React from "react";

import LaunchScreen from "./src/LaunchScreen";
import TestScreen from "./src/TestScreen";
import HomeScreen from "./src/HomeScreen";
import ConversationScreen from "./src/ConversationScreen";
import ConversationCreateScreen from "./src/ConversationCreateScreen";
import { NavigationContainer } from "@react-navigation/native";
import { XmtpContextProvider } from "./src/XmtpContext";
import { Navigator } from "./src/Navigation";
import { QueryClient, QueryClientProvider } from "react-query";
import { Button } from "react-native";

const queryClient = new QueryClient();
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <XmtpContextProvider>
        <NavigationContainer>
          <Navigator.Navigator>
            <Navigator.Screen
              name="launch"
              component={LaunchScreen}
              options={{
                title: "XMTP RN Example",
                headerStyle: {
                  backgroundColor: "rgb(49 0 110)",
                },
                headerTintColor: "#fff",
                headerTitleStyle: {
                  fontWeight: "bold",
                },
              }}
            />
            <Navigator.Screen
              name="test"
              component={TestScreen}
              options={{ title: "Unit Tests" }}
            />
            <Navigator.Screen
              name="home"
              component={HomeScreen}
              options={({ navigation }) => ({
                title: "My Conversations",
                headerStyle: {
                  backgroundColor: "rgb(49 0 110)",
                },
                headerTintColor: "#fff",
                headerTitleStyle: {
                  fontWeight: "bold",
                },
                headerRight: () => (
                  <Button
                    onPress={() => navigation.navigate("conversationCreate")}
                    title="New"
                    color="#fff"
                  />
                ),
              })}
            />
            <Navigator.Screen
              name="conversation"
              component={ConversationScreen}
              options={{ title: "Conversation" }}
              initialParams={{ topic: "" }}
            />
            <Navigator.Screen
              name="conversationCreate"
              component={ConversationCreateScreen}
              options={{ title: "New Conversation" }}
            />
          </Navigator.Navigator>
        </NavigationContainer>
      </XmtpContextProvider>
    </QueryClientProvider>
  );
}
