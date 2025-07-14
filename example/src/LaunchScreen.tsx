import { NativeStackScreenProps } from '@react-navigation/native-stack'
// import { ConnectWallet, useSigner } from '@thirdweb-dev/react-native'
import React, { useCallback, useState } from 'react'
import {
  Button,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  FlatList,
} from 'react-native'
import * as XMTP from 'xmtp-react-native-sdk'
import { PublicIdentity, useXmtp } from 'xmtp-react-native-sdk'

import { NavigationParamList } from './Navigation'
import { TestCategory } from './TestScreen'
import { supportedCodecs } from './contentTypes/contentTypes'
import { getDbEncryptionKey } from './hooks'

// Custom Modal Picker Component
const CustomPicker = ({
  value,
  onValueChange,
  options,
  placeholder = 'Select an option',
}: {
  value: string
  onValueChange: (value: string) => void
  options: { id: string; label: string }[]
  placeholder?: string
}) => {
  const [modalVisible, setModalVisible] = useState(false)

  const selectedOption = options.find((option) => option.label === value)

  return (
    <>
      <TouchableOpacity
        style={styles.pickerButton}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.pickerButtonText}>
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <Text style={styles.pickerButtonArrow}>▼</Text>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Option</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalOption,
                    item.label === value && styles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    onValueChange(item.label)
                    setModalVisible(false)
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      item.label === value && styles.modalOptionTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  )
}

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
  // const signer = useSigner()
  // const [signerAddressDisplay, setSignerAddressDisplay] = useState<string>()
  const { setClient } = useXmtp()

  // Create a simple implementation of savedKeys functionality
  const [savedAddress, setSavedAddress] = useState<string | null>(null)
  const [savedInboxId, setSavedInboxId] = useState<string | null>(null)

  // Simple implementation of the savedKeys object
  const savedKeys = {
    address: savedAddress,
    inboxId: savedInboxId,
    save: async (address: string, inboxId: string) => {
      console.log('Saving address', address)
      setSavedAddress(address)
      setSavedInboxId(inboxId)
      // Here you would typically save to AsyncStorage or similar
      return true
    },
    clear: () => {
      console.log('Clearing saved address')
      setSavedAddress(null)
      setSavedInboxId(null)
      // Here you would typically clear from AsyncStorage or similar
    },
  }

  const configureWallet = useCallback(
    (label: string, configuring: Promise<XMTP.Client<any>>) => {
      console.log('Connecting XMTP client', label)
      configuring
        .then(async (client) => {
          console.log('Connected XMTP client', label, {
            address: client.publicIdentity.identifier,
          })
          setClient(client)
          navigation.navigate('home')
          // Save the configured client keys for use in later sessions.
          await savedKeys.save(client.publicIdentity.identifier, client.inboxId)
        })
        .catch((err) =>
          console.log('Unable to connect XMTP client', label, err)
        )
    },
    [navigation, setClient]
  )

  const preAuthenticateToInboxCallback = async () => {
    console.log('Pre Authenticate To Inbox Callback')
  }

  const networkOptions = [
    { id: 'dev', label: 'dev' },
    { id: 'local', label: 'local' },
    { id: 'production', label: 'production' },
  ]

  const testOptions = Object.entries(TestCategory).map(([enumKey, label]) => ({
    id: enumKey,
    label,
  }))

  return (
    <ScrollView>
      <Text style={styles.title}>Automated Tests</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Select Test:</Text>
        <CustomPicker
          value={selectedTest}
          onValueChange={(value) => setSelectedTest(value as TestCategory)}
          options={testOptions}
          placeholder="Select Test"
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
      <View key="stream-tests" style={{ margin: 16, marginTop: 16 }}>
        <Button
          color="green"
          title="Create Stream Tests"
          onPress={() => navigation.navigate('streamTest')}
          accessibilityLabel="Unit-tests"
        />
      </View>
      <View style={styles.divider} />
      <Text style={styles.title}>Test Conversations</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Select Network:</Text>
        <CustomPicker
          value={selectedNetwork}
          onValueChange={(value) =>
            setSelectedNetwork(value as 'dev' | 'local' | 'production')
          }
          options={networkOptions}
          placeholder="Select Network"
        />
      </View>
      {/* <View style={styles.row}>
        <Text style={styles.label}>External Wallet:</Text>
        <ConnectWallet theme="dark" />
      </View> */}
      {/* {signer && (
        <>
          <View key="connected-dev" style={{ margin: 16 }}>
            <Button
              title={`Use Connected Wallet (${signerAddressDisplay} + )`}
              color="orange"
              onPress={() => {
                ;(async () => {
                  console.log('Using network ' + selectedNetwork)

                  const dbEncryptionKey = await getDbEncryptionKey(
                    selectedNetwork,
                    true
                  )

                  configureWallet(
                    selectedNetwork,
                    XMTP.Client.create(signer, {
                      env: selectedNetwork,
                      codecs: supportedCodecs,
                      preAuthenticateToInboxCallback,
                      dbEncryptionKey,
                    })
                  )
                })().catch(console.error) // Don't forget error handling
              }}
            />
          </View>
        </>
      )} */}
      <View key="generated-dev" style={{ margin: 16 }}>
        <Button
          title="Use Random Wallet"
          color="green"
          onPress={() => {
            ;(async () => {
              console.log('Using network ' + selectedNetwork)
              const dbEncryptionKey = await getDbEncryptionKey(
                selectedNetwork,
                true
              )
              configureWallet(
                selectedNetwork,
                XMTP.Client.createRandom({
                  env: selectedNetwork,
                  codecs: supportedCodecs,
                  preAuthenticateToInboxCallback,
                  dbEncryptionKey,
                })
              )
            })().catch(console.error) // Don't forget error handling
          }}
        />
      </View>
      {!!savedKeys.address && (
        <>
          <View key="saved-dev" style={{ margin: 16 }}>
            <Button
              title="Use Saved Wallet"
              color="purple"
              onPress={() => {
                ;(async () => {
                  console.log('Using network ' + selectedNetwork)
                  const dbEncryptionKey =
                    await getDbEncryptionKey(selectedNetwork)
                  configureWallet(
                    selectedNetwork,
                    XMTP.Client.build(
                      new PublicIdentity(savedKeys.address!, 'ETHEREUM'),
                      {
                        env: selectedNetwork,
                        codecs: supportedCodecs,
                        dbEncryptionKey,
                      },
                      savedKeys.inboxId!
                    )
                  )
                })().catch(console.error) // Don't forget error handling
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
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  label: {
    fontSize: 16,
    flex: 1,
  },
  // Custom Picker Styles
  pickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dee2e6',
    marginLeft: 8,
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#333',
  },
  pickerButtonArrow: {
    fontSize: 12,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalClose: {
    fontSize: 24,
    color: '#666',
    padding: 4,
  },
  modalOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalOptionSelected: {
    backgroundColor: '#e3f2fd',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#333',
  },
  modalOptionTextSelected: {
    color: '#1976d2',
    fontWeight: 'bold',
  },
})
