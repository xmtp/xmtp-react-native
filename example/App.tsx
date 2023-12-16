import { NavigationContainer } from '@react-navigation/native'
import { Button, Platform } from 'react-native'
import { QueryClient, QueryClientProvider } from 'react-query'
import { XmtpProvider } from 'xmtp-react-native-sdk'

import ConversationCreateScreen from './src/ConversationCreateScreen'
import ConversationScreen from './src/ConversationScreen'
import HomeScreen from './src/HomeScreen'
import LaunchScreen from './src/LaunchScreen'
import { Navigator } from './src/Navigation'
import TestScreen from './src/TestScreen'

const queryClient = new QueryClient()
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <XmtpProvider>
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
      </XmtpProvider>
    </QueryClientProvider>
  )
}
