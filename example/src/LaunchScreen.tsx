import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ConnectWallet, useSigner } from '@thirdweb-dev/react-native'
import React, { useCallback, useEffect, useState } from 'react'
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as XMTP from 'xmtp-react-native-sdk'
import { useXmtp } from 'xmtp-react-native-sdk'

import { NavigationParamList } from './Navigation'
import { useSavedKeys } from './hooks'

const appVersion = 'XMTP_RN_EX/0.0.1'

const supportedCodecs = [
  new XMTP.ReactionCodec(),
  new XMTP.ReplyCodec(),
  new XMTP.RemoteAttachmentCodec(),
  new XMTP.StaticAttachmentCodec(),
]

/// Prompt the user to run the tests, generate a wallet, or connect a wallet.
export default function LaunchScreen({
  navigation,
}: NativeStackScreenProps<NavigationParamList, 'launch'>) {
  const signer = useSigner()
  const [signerAddressDisplay, setSignerAddressDisplay] = useState<string>()
  const { setClient } = useXmtp()
  const savedKeys = useSavedKeys()
  const configureWallet = useCallback(
    (label: string, configuring: Promise<XMTP.Client<any>>) => {
      console.log('Connecting XMTP client', label)
      configuring
        .then(async (client) => {
          console.log('Connected XMTP client', label, {
            address: client.address,
          })
          setClient(client)
          navigation.navigate('home')
          // Save the configured client keys for use in later sessions.
          const keyBundle = await client.exportKeyBundle()
          await savedKeys.save(keyBundle)
        })
        .catch((err) =>
          console.log('Unable to connect XMTP client', label, err)
        )
    },
    []
  )

  const preCreateIdentityCallback = () => {
    console.log('Pre Create Identity Callback')
  }

  const preEnableIdentityCallback = () => {
    console.log('Pre Enable Identity Callback')
  }

  useEffect(() => {
    ;(async () => {
      if (signer) {
        const address = await signer.getAddress()
        const addressDisplay = address.slice(0, 6) + '...' + address.slice(-4)
        setSignerAddressDisplay(addressDisplay)
      } else {
        setSignerAddressDisplay('loading...')
      }
    })()
  }, [signer])

  return (
    <ScrollView>
      <ConnectWallet theme="dark" />
      <Text
        style={{
          fontSize: 16,
          textAlign: 'right',
          textTransform: 'uppercase',
          color: '#333',
          marginTop: 16,
          paddingHorizontal: 16,
          marginHorizontal: 16,
        }}
      >
        Testing
      </Text>
      <View key="run-tests" style={{ margin: 16, marginTop: 16 }}>
        <Button
          title="Run Unit Tests"
          onPress={() => navigation.navigate('test')}
          accessibilityLabel="Unit-tests"
        />
      </View>
      <View key="stream-tests" style={{ margin: 16, marginTop: 16 }}>
        <Button
          color="green"
          title="Create Stream Tests"
          onPress={() => navigation.navigate('streamTest')}
          accessibilityLabel="Unit-tests"
        />
      </View>
      {signer && (
        <>
          <Divider key="divider-connected" />
          <Text
            style={{
              fontSize: 16,
              textAlign: 'right',
              textTransform: 'uppercase',
              color: '#333',
              paddingHorizontal: 16,
              marginHorizontal: 16,
            }}
          >
            Connected Wallet ({signerAddressDisplay})
          </Text>
          <View key="connected-dev" style={{ margin: 16 }}>
            <Button
              title="Use Connected Wallet (dev)"
              color="green"
              onPress={() => {
                configureWallet(
                  'dev',
                  XMTP.Client.create(signer, {
                    env: 'dev',
                    appVersion,
                    preCreateIdentityCallback,
                    preEnableIdentityCallback,
                  })
                )
              }}
            />
          </View>
          <View key="connected-local" style={{ margin: 16 }}>
            <Button
              title="Use Connected Wallet (local)"
              color="purple"
              onPress={() => {
                configureWallet(
                  'local',
                  XMTP.Client.create(signer, {
                    env: 'local',
                    appVersion,
                    preCreateIdentityCallback,
                    preEnableIdentityCallback,
                  })
                )
              }}
            />
          </View>
        </>
      )}
      <Divider key="divider-generated" />
      <Text
        style={{
          fontSize: 16,
          textAlign: 'right',
          textTransform: 'uppercase',
          color: '#333',
          paddingHorizontal: 16,
          marginHorizontal: 16,
        }}
      >
        Random Wallet
      </Text>
      <View key="generated-dev" style={{ margin: 16 }}>
        <Button
          title="Use Generated Wallet (dev)"
          color="green"
          onPress={() => {
            configureWallet(
              'dev',
              XMTP.Client.createRandom({
                env: 'dev',
                appVersion,
                codecs: supportedCodecs,
                preCreateIdentityCallback,
                preEnableIdentityCallback,
              })
            )
          }}
        />
      </View>
      <View key="generated-local" style={{ margin: 16 }}>
        <Button
          title="Use Generated Wallet (local)"
          color="purple"
          onPress={() => {
            configureWallet(
              'local',
              XMTP.Client.createRandom({
                env: 'local',
                appVersion,
                codecs: supportedCodecs,
                preCreateIdentityCallback,
                preEnableIdentityCallback,
              })
            )
          }}
        />
      </View>
      {!!savedKeys.keyBundle && (
        <>
          <Divider key="divider-saved" />
          <Text
            style={{
              fontSize: 16,
              textAlign: 'right',
              textTransform: 'uppercase',
              color: '#333',
              paddingHorizontal: 16,
              marginHorizontal: 16,
            }}
          >
            Saved Wallet
          </Text>
          <View key="saved-dev" style={{ margin: 16 }}>
            <Button
              title="Use Saved Wallet (dev)"
              color="green"
              onPress={() => {
                configureWallet(
                  'dev',
                  XMTP.Client.createFromKeyBundle(savedKeys.keyBundle!, {
                    env: 'dev',
                    appVersion,
                    codecs: supportedCodecs,
                  })
                )
              }}
            />
          </View>
          <View key="saved-local" style={{ margin: 16 }}>
            <Button
              title="Use Saved Wallet (local)"
              color="purple"
              onPress={() => {
                configureWallet(
                  'local',
                  XMTP.Client.createFromKeyBundle(savedKeys.keyBundle!, {
                    env: 'local',
                    appVersion,
                    codecs: supportedCodecs,
                  })
                )
              }}
            />
          </View>
          <View key="saved-clear" style={{ margin: 16 }}>
            <Button
              title="Clear Saved Wallet"
              // color={"black"}
              onPress={() => savedKeys.clear()}
            />
          </View>
        </>
      )}
    </ScrollView>
  )
}

function Divider() {
  return (
    <View
      style={{
        borderBottomColor: 'black',
        margin: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
      }}
    />
  )
}
