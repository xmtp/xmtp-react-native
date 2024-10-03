import {
  createConnectorFromWallet,
  Wallets,
} from '@mobile-wallet-protocol/wagmi-connectors'
import { Client, DecodedMessage, Group } from '@xmtp/react-native-sdk'
import * as Linking from 'expo-linking'
import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  http,
  createConfig,
  useAccount,
  useConnect,
  useSignMessage,
  useDisconnect,
  useWalletClient,
} from 'wagmi'
import { base } from 'wagmi/chains'

import Section from './components/section'
import { SupportedContentTypes, useCreateClient } from './hooks/useCreateClient'
import { useCreateGroup } from './hooks/useCreateGroup'
import { useListMessages } from './hooks/useListMessages'

polyfillForWagmi()

const PREFIX_URL = Linking.createURL('/')

export const config = createConfig({
  chains: [base],
  connectors: [
    createConnectorFromWallet({
      metadata: {
        appName: 'Wagmi Demo',
        appDeeplinkUrl: PREFIX_URL,
      },
      wallet: Wallets.CoinbaseSmartWallet,
    }),
  ],
  transports: {
    [base.id]: http(),
  },
})

export default function WagmiDemo() {
  const [client, setClient] = useState<
    Client<SupportedContentTypes> | undefined
  >(undefined)
  const [group, setGroup] = useState<Group<SupportedContentTypes> | undefined>(
    undefined
  )
  const [messages, setMessages] = useState<
    DecodedMessage<SupportedContentTypes>[] | undefined
  >(undefined)
  const insets = useSafeAreaInsets()
  const { address, chainId } = useAccount()

  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { reset } = useSignMessage()
  const { data: walletClient } = useWalletClient()
  const createClient = useCreateClient(walletClient)
  const createGroup = useCreateGroup(client)
  const listMessages = useListMessages(group)

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
        Smart Wallet Wagmi Demo
      </Text>
      {address && (
        <Text style={{ fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
          Connected ✅
        </Text>
      )}
      <Section
        key="connect"
        title="useConnect"
        result={JSON.stringify({ address, chainId })}
        buttonLabel="Connect"
        onPress={() => connect({ connector: connectors[0] })}
      />
      {address && (
        <>
          <Section
            key="useDisconnect"
            title="useDisconnect"
            buttonLabel="Disconnect"
            onPress={() => {
              disconnect({ connector: connectors[0] })
              reset()
              void client?.deleteLocalDatabase()
            }}
          />
          <Section
            key="useCreateClient"
            title="useCreateClient"
            buttonLabel="Create Client"
            result={client?.address ?? 'No client created'}
            onPress={async () => {
              console.log('hi there')

              const client = await createClient()
              console.log(client?.address)
              setClient(client)
            }}
          />
          <Section
            key="useCreateGroup"
            title="useCreateGroup"
            buttonLabel="Create Group"
            result={group?.id ?? 'No group created'}
            onPress={async () => {
              const group = await createGroup()
              setGroup(group)
            }}
          />
          <Section
            key="useListMessages"
            title="useListMessages"
            buttonLabel="List Messages"
            result={JSON.stringify(messages)}
            onPress={async () => {
              const messages = await listMessages()
              setMessages(messages)
            }}
          />
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scrollView: {
    width: '100%',
    height: '100%',
  },
})

function polyfillForWagmi() {
  const noop = (() => {}) as any

  window.addEventListener = noop
  window.dispatchEvent = noop
  window.removeEventListener = noop
  window.CustomEvent = function CustomEvent() {
    return {}
  } as any
}
