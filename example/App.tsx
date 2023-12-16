import { NavigationContainer } from '@react-navigation/native'
import React from 'react'
import { Button, Platform } from 'react-native'
import { QueryClient, QueryClientProvider } from 'react-query'

import ConversationCreateScreen from './src/ConversationCreateScreen'
import ConversationScreen from './src/ConversationScreen'
import HomeScreen from './src/HomeScreen'
import LaunchScreen from './src/LaunchScreen'
import { Navigator } from './src/Navigation'
import TestScreen from './src/TestScreen'
import { XmtpContextProvider } from './src/XmtpContext'

const queryClient = new QueryClient()
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
                title: 'XMTP RN Example',
                headerStyle: {
                  backgroundColor: 'rgb(49 0 110)',
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}
            />
            <Navigator.Screen
              name="test"
              component={TestScreen}
              options={{ title: 'Unit Tests' }}
            />
            <Navigator.Screen
              name="home"
              component={HomeScreen}
              options={({ navigation }) => ({
                title: 'My Conversations',
                headerStyle: {
                  backgroundColor: 'rgb(49 0 110)',
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
                headerRight: () => (
                  <Button
                    onPress={() => navigation.navigate('conversationCreate')}
                    title="New"
                    color={Platform.OS === 'ios' ? '#fff' : 'rgb(49 0 110)'}
                  />
                ),
              })}
            />
            <Navigator.Screen
              name="conversation"
              component={ConversationScreen}
              options={{ title: 'Conversation' }}
              initialParams={{ topic: '' }}
            />
            <Navigator.Screen
              name="conversationCreate"
              component={ConversationCreateScreen}
              options={{ title: 'New Conversation' }}
            />
          </Navigator.Navigator>
        </NavigationContainer>
      </XmtpContextProvider>
    </QueryClientProvider>
  )
}
