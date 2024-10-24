import { EIP1193Provider, Wallets } from '@mobile-wallet-protocol/client'
import * as Linking from 'expo-linking'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Section from './components/section'

// exp://x.x.x.x:8000/--/
// This is using Expo Go's custom scheme, which is allowed on Smart Wallet exceptionally
// for the purpose of this demo. In production, you should use universal links.
const PREFIX_URL = Linking.createURL('/')

// Step 1. Initialize SDK and create provider
const provider = new EIP1193Provider({
  metadata: {
    appName: 'Smart Wallet Expo',
    appDeeplinkUrl: PREFIX_URL,
  },
  wallet: Wallets.CoinbaseSmartWallet,
})

export default function EIP1193Demo() {
  const insets = useSafeAreaInsets()
  const [addresses, setAddresses] = useState<string[] | Error | null>()

  const address = addresses && Array.isArray(addresses) ? addresses[0] : null

  const [ethAccountResult, setEthAccountResult] = useState<
    string | Error | null
  >(null)
  const [personalSignResult, setPersonalSignResult] = useState<
    string | Error | null
  >(null)
  const [walletGetCapabilitiesResult, setWalletGetCapabilitiesResult] =
    useState<string | Error | null>(null)

  useEffect(() => {
    provider.addListener('accountsChanged', (accounts) => {
      if (accounts && Array.isArray(accounts)) setAddresses(accounts)
    })

    provider.addListener('disconnect', () => {
      setAddresses([])
    })
    ;() => {
      provider.removeListener('accountsChanged')
      provider.removeListener('disconnect')
    }
  }, [])

  // Step 2: start requesting using provider
  const handleConnect = useCallback(async () => {
    try {
      const result = await provider.request({ method: 'eth_requestAccounts' })
      if (result && Array.isArray(result)) {
        setAddresses(result as string[])
      }
    } catch (err) {
      if (err instanceof Error) setAddresses(err)
    }
  }, [])

  const handleAccounts = useCallback(async () => {
    try {
      const result = await provider.request({ method: 'eth_accounts' })
      setEthAccountResult(stringify(result))
    } catch (err) {
      if (err instanceof Error) setEthAccountResult(err)
    }
  }, [])

  const handlePersonalSign = useCallback(async () => {
    try {
      const result = await provider.request({
        method: 'personal_sign',
        params: ['0x48656c6c6f2c20776f726c6421', address],
      })
      setPersonalSignResult(stringify(result))
    } catch (err) {
      if (err instanceof Error) setPersonalSignResult(err)
    }
  }, [addresses])

  const handleWalletGetCapabilities = useCallback(async () => {
    try {
      const result = await provider.request({
        method: 'wallet_getCapabilities',
      })
      setWalletGetCapabilitiesResult(stringify(result))
    } catch (err) {
      if (err instanceof Error) setWalletGetCapabilitiesResult(err)
    }
  }, [])

  const handleDisconnect = useCallback(async () => {
    await provider.disconnect()
    setAddresses(null)
    setEthAccountResult(null)
    setPersonalSignResult(null)
    setWalletGetCapabilitiesResult(null)
  }, [])

  const contentContainerStyle = useMemo(
    () => ({
      paddingTop: insets.top + 16,
      paddingBottom: insets.bottom + 16,
      paddingLeft: insets.left + 16,
      paddingRight: insets.right + 16,
      gap: 16,
    }),
    [insets]
  )

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={contentContainerStyle}
    >
      <Text style={{ fontSize: 24, fontWeight: '600', textAlign: 'center' }}>
        Smart Wallet EIP-1193 Demo
      </Text>
      {address && (
        <Text style={{ fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
          Connected ✅
        </Text>
      )}
      <Section
        key="connect"
        title="eth_requestAccounts"
        result={addresses ? stringify(addresses) : null}
        buttonLabel="Connect"
        onPress={handleConnect}
      />
      {address && (
        <>
          <Section
            key="disconnect"
            title="@disconnect"
            buttonLabel="Disconnect"
            onPress={handleDisconnect}
          />
          <Section
            key="accounts"
            title="eth_accounts"
            result={ethAccountResult}
            onPress={handleAccounts}
          />
          <Section
            key="personal_sign"
            title="personal_sign"
            result={personalSignResult}
            onPress={handlePersonalSign}
          />
          <Section
            key="wallet_getCapabilities"
            title="wallet_getCapabilities"
            result={walletGetCapabilitiesResult}
            onPress={handleWalletGetCapabilities}
          />
        </>
      )}
    </ScrollView>
  )
}

function stringify(result: unknown): string {
  if (typeof result === 'string') {
    return result
  }
  return JSON.stringify(result, null, 2)
}

const styles = StyleSheet.create({
  scrollView: {
    width: '100%',
    height: '100%',
  },
})
