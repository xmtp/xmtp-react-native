// Pre-requisite 1. Polyfill
import './src/polyfill'

import { FontAwesome6 } from '@expo/vector-icons'
import { handleResponse } from '@mobile-wallet-protocol/client'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { NavigationContainer } from '@react-navigation/native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { XmtpProvider } from '@xmtp/react-native-sdk'
import * as Linking from 'expo-linking'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { WagmiProvider } from 'wagmi'

import EIP1193Demo from './src/eip1193Demo'
import WagmiDemo, { config } from './src/wagmiDemo'

const queryClient = new QueryClient()

const Tab = createBottomTabNavigator()

export default function App() {
  // Pre-requisite 2. Setup deeplinking handling
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('incoming deeplink:', url)
      try {
        handleResponse(url)
      } catch (err) {
        console.error(err)
      }
    })

    return () => subscription.remove()
  }, [])

  return (
    <SafeAreaProvider>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <XmtpProvider>
            <WagmiDemo />
          </XmtpProvider>
        </QueryClientProvider>
      </WagmiProvider>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  )
}
