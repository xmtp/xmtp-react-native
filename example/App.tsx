import { NavigationContainer } from '@react-navigation/native'
import { Ethereum } from '@thirdweb-dev/chains'
import {
  ThirdwebProvider,
  metamaskWallet,
  rainbowWallet,
} from '@thirdweb-dev/react-native'
import { Button, Platform } from 'react-native'
import Config from 'react-native-config'
// Used to polyfill webCrypto in react-native
import PolyfillCrypto from 'react-native-webview-crypto'
import { QueryClient, QueryClientProvider } from 'react-query'
import { XmtpProvider } from 'xmtp-react-native-sdk'

import ConversationCreateScreen from './src/ConversationCreateScreen'
import ConversationScreen from './src/ConversationScreen'
import HomeScreen from './src/HomeScreen'
import LaunchScreen from './src/LaunchScreen'
import { Navigator } from './src/Navigation'
import StreamScreen from './src/StreamScreen'
import TestScreen from './src/TestScreen'

const queryClient = new QueryClient()

export default function App() {
  // Uncomment below to ensure correct id loaded from .env
  // console.log("Thirdweb client id: " + Config.THIRD_WEB_CLIENT_ID)
  return (
    <ThirdwebProvider
      activeChain={Ethereum}
      supportedChains={[Ethereum]}
      clientId={Config.THIRD_WEB_CLIENT_ID}
      dAppMeta={{
        name: 'XMTP Example',
        description: 'Example app from xmtp-react-native repo',
        logoUrl:
          'https://pbs.twimg.com/profile_images/1668323456935510016/2c_Ue8dF_400x400.jpg',
        url: 'https://xmtp.org',
      }}
      supportedWallets={[metamaskWallet(), rainbowWallet()]}
    >
      <PolyfillCrypto />
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
                      testID="new-conversation-button"
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
              <Navigator.Screen
                name="streamTest"
                component={StreamScreen}
                options={{ title: 'Stream Tests' }}
              />
            </Navigator.Navigator>
          </NavigationContainer>
        </XmtpProvider>
      </QueryClientProvider>
    </ThirdwebProvider>
  )
}
