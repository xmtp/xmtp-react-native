import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ConnectWallet, useSigner } from '@thirdweb-dev/react-native'
import React, { useCallback, useEffect, useState } from 'react'
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native'
import ModalSelector from 'react-native-modal-selector'
import * as XMTP from 'xmtp-react-native-sdk'
import { useXmtp } from 'xmtp-react-native-sdk'

import { NavigationParamList } from './Navigation'
import { TestCategory } from './TestScreen'
import { supportedCodecs } from './contentTypes/contentTypes'
import { useSavedKeys } from './hooks'

const appVersion = 'XMTP_RN_EX/0.0.1'

/// Prompt the user to run the tests, generate a wallet, or connect a wallet.
export default function LaunchScreen(
  this: any,
  { navigation }: NativeStackScreenProps<NavigationParamList, 'launch'>
) {
  const [selectedTest, setSelectedTest] = useState<TestCategory>(
    TestCategory.all
  )
  const [selectedNetwork, setSelectedNetwork] = useState<
    'dev' | 'local' | 'production'
  >('dev')
  const [enableGroups, setEnableGroups] = useState('true')
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

  const networkOptions = [
    { key: 0, label: 'dev' },
    { key: 1, label: 'local' },
    // { key: 2, label: 'production' },
  ]

  const groupOptions = [
    { key: 0, label: 'true' },
    { key: 1, label: 'false' },
  ]

  const testOptions = Object.entries(TestCategory).map(
    ([key, value], index) => ({
      key: index,
      label: value,
    })
  )

  useEffect(() => {
    ;(async () => {
      if (signer) {
        const address = await signer.getAddress()
        const addressDisplay = address.slice(0, 6) + '...' + address.slice(-4)
        setSignerAddressDisplay(addressDisplay)
      } else {
        setSignerAddressDisplay('loading...')
      }
    })().catch((e) => {
      console.error("Error displaying signers's address", e)
    })
  }, [signer])

  return (
    <ScrollView>
      <Text style={styles.title}>Automated Tests</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Select Test:</Text>
        <ModalSelector
          data={testOptions}
          selectStyle={styles.modalSelector}
          initValueTextStyle={styles.modalSelectText}
          selectTextStyle={styles.modalSelectText}
          backdropPressToClose
          initValue={selectedTest}
          onChange={(option) => setSelectedTest(option.label as TestCategory)}
        />
      </View>
      <View key="run-tests" style={{ margin: 16 }}>
        <Button
          title={`Run Selected Tests: ${selectedTest}`}
          onPress={() =>
            navigation.navigate('test', { testSelection: selectedTest })
          }
          accessibilityLabel="Unit-tests"
        />
      </View>
      <View style={styles.divider} />
      <Text style={styles.title}>Test Conversations</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Select Network:</Text>
        <ModalSelector
          data={networkOptions}
          selectStyle={styles.modalSelector}
          initValueTextStyle={styles.modalSelectText}
          selectTextStyle={styles.modalSelectText}
          backdropPressToClose
          initValue={selectedNetwork}
          onChange={(option) =>
            setSelectedNetwork(option.label as 'dev' | 'local' | 'production')
          }
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Enable Groups:</Text>
        <ModalSelector
          selectStyle={styles.modalSelector}
          initValueTextStyle={styles.modalSelectText}
          selectTextStyle={styles.modalSelectText}
          backdropPressToClose
          data={groupOptions}
          initValue={enableGroups}
          onChange={(option) => {
            setEnableGroups(option.label)
          }}
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>External Wallet:</Text>
        <ConnectWallet theme="dark" />
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
          <View key="connected-dev" style={{ margin: 16 }}>
            <Button
              title={`Use Connected Wallet (${signerAddressDisplay} + )`}
              color="orange"
              onPress={() => {
                console.log(
                  'Using network ' +
                    selectedNetwork +
                    ' and enableAlphaMLS ' +
                    enableGroups
                )
                configureWallet(
                  selectedNetwork,
                  XMTP.Client.create(signer, {
                    env: selectedNetwork,
                    appVersion,
                    preCreateIdentityCallback,
                    preEnableIdentityCallback,
                    enableAlphaMls: enableGroups === 'true',
                  })
                )
              }}
            />
          </View>
        </>
      )}
      <View key="generated-dev" style={{ margin: 16 }}>
        <Button
          title="Use Random Wallet"
          color="green"
          onPress={() => {
            console.log(
              'Using network ' +
                selectedNetwork +
                ' and enableAlphaMLS ' +
                enableGroups
            )
            configureWallet(
              selectedNetwork,
              XMTP.Client.createRandom({
                env: selectedNetwork,
                appVersion,
                codecs: supportedCodecs,
                preCreateIdentityCallback,
                preEnableIdentityCallback,
                enableAlphaMls: enableGroups === 'true',
              })
            )
          }}
        />
      </View>
      {!!savedKeys.keyBundle && (
        <>
          <View key="saved-dev" style={{ margin: 16 }}>
            <Button
              title="Use Saved Wallet"
              color="purple"
              onPress={() => {
                console.log(
                  'Using network ' +
                    selectedNetwork +
                    ' and enableAlphaMLS ' +
                    enableGroups
                )
                configureWallet(
                  selectedNetwork,
                  XMTP.Client.createFromKeyBundle(savedKeys.keyBundle!, {
                    env: selectedNetwork,
                    appVersion,
                    codecs: supportedCodecs,
                    enableAlphaMls: enableGroups === 'true',
                  })
                )
              }}
            />
          </View>
          <View key="saved-clear" style={{ margin: 16 }}>
            <Button
              title="Clear Saved Wallet"
              color="red"
              onPress={() => savedKeys.clear()}
            />
          </View>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  divider: {
    borderBottomColor: 'black',
    margin: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 18,
    textAlign: 'left',
    textTransform: 'uppercase',
    color: '#333',
    marginVertical: 16,
    paddingHorizontal: 16,
    marginHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginHorizontal: 16,
    backgroundColor: '#fff', // Or any color that fits your app's theme
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  modalSelector: {
    borderColor: 'black',
  },
  modalSelectText: {
    color: 'black',
    fontWeight: 'bold',
  },
  label: {
    fontSize: 16,
    flex: 1,
  },
})
