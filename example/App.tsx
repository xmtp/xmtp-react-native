import { NavigationContainer } from '@react-navigation/native'
// import { Ethereum } from '@thirdweb-dev/chains'
import 'react-native-get-random-values';
import '@ethersproject/shims';
import { Buffer as BufferPolyfill } from 'buffer'
// Make Buffer globally available
global.Buffer = global.Buffer || BufferPolyfill
// import {
//   ThirdwebProvider,
//   metamaskWallet,
//   rainbowWallet,
// } from '@thirdweb-dev/react-native'
import { Button, Platform, ActionSheetIOS, Modal, View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native'
import Config from 'react-native-config'
// Used to polyfill webCrypto in react-native
import { QueryClient, QueryClientProvider } from 'react-query'
import { XmtpProvider, Client } from 'xmtp-react-native-sdk'
import { useState, useEffect } from 'react'
import React from 'react'

import ConversationCreateScreen from './src/ConversationCreateScreen'
import ConversationScreen from './src/ConversationScreen'
import GroupScreen from './src/GroupScreen'
import HomeScreen from './src/HomeScreen'
import LaunchScreen from './src/LaunchScreen'
import { Navigator } from './src/Navigation'
import StreamScreen from './src/StreamScreen'
import TestScreen from './src/TestScreen'
import { LogLevel, LogRotation } from 'xmtp-react-native-sdk/lib/types/LogTypes';

const queryClient = new QueryClient()

interface LogFilesModalProps {
  visible: boolean
  onClose: () => void
  client?: Client
}

interface DropdownOption {
  title: string
  onPress: () => void
}

interface AndroidDropdownProps {
  visible: boolean
  onClose: () => void
  options: DropdownOption[]
}

// Component for the log files modal
const LogFilesModal: React.FC<LogFilesModalProps> = ({ visible, onClose }) => {
  const [logFiles, setLogFiles] = useState<string[]>([])
  const [fileSizes, setFileSizes] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [logStatus, setLogStatus] = useState<string>('')
  
  // Fetch log files when modal becomes visible
  useEffect(() => {
    if (visible) {
      const fetchLogFiles = async (): Promise<void> => {
        try {
          setIsLoading(true)
          setFileSizes({}) // Reset file sizes when reopening
          setLogStatus('Checking log status...')
          
          // Check if logging is active
          const isActive = await Client.isLogWriterActive()
          setLogStatus(`Logging ${isActive ? 'is active' : 'is NOT active'}`)
          
          const files = await Client.getXMTPLogFilePaths()
          console.log('Found log files:', files)
          setLogFiles(files)
          
          if (files.length === 0) {
            setLogStatus(prev => `${prev}\nNo log files found. Try activating logs first.`)
          } else {
            setLogStatus(prev => `${prev}\nFound ${files.length} log file(s)`)
          }
          
          // Load file sizes in parallel
          const sizePromises = files.map(async (path) => {
            try {
              const content = await Client.readXMTPLogFile(path)
              console.log(`Log file ${path} size: ${content.length} bytes`)
              return { 
                path, 
                size: `${(content.length / 1024).toFixed(2)} KB`,
                isEmpty: content.length === 0
              }
            } catch (error) {
              console.error(`Error loading size for ${path}:`, error)
              return { path, size: 'Error loading size', isEmpty: true }
            }
          })
          
          const results = await Promise.all(sizePromises)
          
          // Update all sizes at once
          const newSizes: Record<string, string> = {}
          let emptyCount = 0
          
          results.forEach(({ path, size, isEmpty }) => {
            newSizes[path] = isEmpty ? `${size} (empty)` : size
            if (isEmpty) emptyCount++
          })
          
          setFileSizes(newSizes)
          
          if (emptyCount > 0) {
            setLogStatus(prev => `${prev}\n${emptyCount} empty log file(s) found. Make sure logging is properly activated.`)
          }
          
        } catch (error) {
          console.error('Error fetching log files:', error)
          setLogStatus(`Error: ${error instanceof Error ? error.message : String(error)}`)
        } finally {
          setIsLoading(false)
        }
      }
      
      fetchLogFiles()
    }
  }, [visible])

  // Function to share a log file
  const shareLogFile = async (filePath: string): Promise<void> => {
    try {
      // Read the log file content
      const content = await Client.readXMTPLogFile(filePath)
      
      if (content.length === 0) {
        alert('This log file is empty. Try generating some logs first.')
        return
      }
      
      // Use the Share API to open the native share dialog
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        const Share = require('react-native').Share
        await Share.share({
          title: 'XMTP Log File',
          message: content,
          // On iOS, you can also specify a subject
          ...(Platform.OS === 'ios' && { subject: `XMTP Log: ${filePath.split('/').pop()}` })
        })
      }
    } catch (error) {
      console.error('Error sharing log file:', error)
      alert('Failed to share log file')
    }
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Log Files</Text>
          
          {/* Display log status information */}
          {logStatus ? (
            <View style={styles.statusContainer}>
              <Text style={styles.statusText}>{logStatus}</Text>
            </View>
          ) : null}
          
          {isLoading ? (
            <Text style={styles.noLogsText}>Loading log files...</Text>
          ) : logFiles.length === 0 ? (
            <Text style={styles.noLogsText}>No log files found</Text>
          ) : (
            <FlatList
              data={logFiles}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.logFileItem}
                  onPress={() => shareLogFile(item)}
                >
                  <Text style={styles.logFilePath} numberOfLines={1} ellipsizeMode="middle">
                    {item}
                  </Text>
                  <Text style={styles.logFileSize}>
                    {fileSizes[item] || 'Loading...'}
                  </Text>
                  <Text style={styles.tapToShareText}>Tap to share</Text>
                </TouchableOpacity>
              )}
            />
          )}
          
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

// Styles for the modal
const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  logFileItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  logFilePath: {
    fontSize: 14,
  },
  logFileSize: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  tapToShareText: {
    fontSize: 11,
    color: 'rgb(49 0 110)',
    marginTop: 4,
    fontStyle: 'italic',
  },
  noLogsText: {
    textAlign: 'center',
    marginVertical: 20,
    color: '#666',
  },
  closeButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: 'rgb(49 0 110)',
    borderRadius: 5,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  statusContainer: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  statusText: {
    fontSize: 12,
    color: '#333',
  },
})

// Custom dropdown for Android
const AndroidDropdown: React.FC<AndroidDropdownProps> = ({ visible, onClose, options }) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        }}
        onPress={onClose}
      >
        <View 
          style={{
            position: 'absolute',
            top: 60,
            right: 10,
            backgroundColor: 'white',
            borderRadius: 5,
            elevation: 5,
            width: 200,
          }}
        >
          {options.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={{
                padding: 15,
                borderBottomWidth: index < options.length - 1 ? 1 : 0,
                borderBottomColor: '#eee',
              }}
              onPress={() => {
                onClose()
                option.onPress()
              }}
            >
              <Text>{option.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  )
}

export default function App() {
  // Uncomment below to ensure correct id loaded from .env
  // console.log("Thirdweb client id: " + Config.THIRD_WEB_CLIENT_ID)
  
  const [showAndroidDropdown, setShowAndroidDropdown] = useState<boolean>(false)
  const [showLogFilesModal, setShowLogFilesModal] = useState<boolean>(false)
  
  // Function to clear all log files
  const clearLogFiles = async (): Promise<void> => {
    try {
      const files = await Client.getXMTPLogFilePaths()
      if (files.length === 0) {
        alert('No log files to clear')
        return
      }
      
      let successCount = await Client.clearXMTPLogs()
      
      if (successCount === files.length) {
        alert('All log files cleared successfully')
      } else if (successCount > 0) {
        alert(`Cleared ${successCount} of ${files.length} log files`)
      } else {
        alert('Failed to clear log files')
      }
    } catch (error) {
      console.error('Error clearing log files:', error)
      alert('Failed to clear log files')
    }
  }
  
  return (
    // <ThirdwebProvider
    //   activeChain={Ethereum}
    //   supportedChains={[Ethereum]}
    //   clientId={Config.THIRD_WEB_CLIENT_ID}
    //   dAppMeta={{
    //     name: 'XMTP Example',
    //     description: 'Example app from xmtp-react-native repo',
    //     logoUrl:
    //       'https://pbs.twimg.com/profile_images/1668323456935510016/2c_Ue8dF_400x400.jpg',
    //     url: 'https://xmtp.org',
    //   }}
    //   supportedWallets={[metamaskWallet(), rainbowWallet()]}
    // >
      
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
                options={({ navigation }) => {
                  // Define dropdown options
                  const dropdownOptions: DropdownOption[] = [
                    {
                      title: 'New Conversation',
                      onPress: () => navigation.navigate('conversationCreate')
                    },
                    {
                      title: 'Activate Logs',
                      onPress: async () => {
                        await Client.activatePersistentLibXMTPLogWriter(LogLevel.DEBUG, LogRotation.MINUTELY, 5) // Using default values
                        alert('Logs activated')
                      }
                    },
                    {
                      title: 'Deactivate Logs',
                      onPress: () => {
                        Client.deactivatePersistentLibXMTPLogWriter()
                        alert('Logs deactivated')
                      }
                    },
                    {
                      title: 'View Log Files',
                      onPress: () => setShowLogFilesModal(true)
                    },
                    {
                      title: 'Clear Log Files',
                      onPress: () => {
                        // Show confirmation dialog before clearing logs
                        if (Platform.OS === 'ios') {
                          ActionSheetIOS.showActionSheetWithOptions(
                            {
                              options: ['Clear All Log Files', 'Cancel'],
                              destructiveButtonIndex: 0,
                              cancelButtonIndex: 1,
                              title: 'Are you sure you want to delete all log files?',
                              message: 'This action cannot be undone.'
                            },
                            (buttonIndex) => {
                              if (buttonIndex === 0) {
                                clearLogFiles()
                              }
                            }
                          )
                        } else {
                          // For Android, use Alert.alert
                          const Alert = require('react-native').Alert
                          Alert.alert(
                            'Clear Log Files',
                            'Are you sure you want to delete all log files? This action cannot be undone.',
                            [
                              {
                                text: 'Cancel',
                                style: 'cancel'
                              },
                              {
                                text: 'Clear',
                                onPress: clearLogFiles,
                                style: 'destructive'
                              }
                            ]
                          )
                        }
                      }
                    }
                  ]
                  
                  // Platform-specific dropdown handling
                  const showDropdown = (): void => {
                    if (Platform.OS === 'ios') {
                      ActionSheetIOS.showActionSheetWithOptions(
                        {
                          options: [...dropdownOptions.map(option => option.title), 'Cancel'],
                          cancelButtonIndex: dropdownOptions.length,
                        },
                        (buttonIndex) => {
                          if (buttonIndex < dropdownOptions.length) {
                            dropdownOptions[buttonIndex].onPress()
                          }
                        }
                      )
                    } else {
                      setShowAndroidDropdown(true)
                    }
                  }
                  
                  return {
                    title: 'My Conversations',
                    headerStyle: {
                      backgroundColor: 'rgb(49 0 110)',
                    },
                    headerTintColor: '#fff',
                    headerTitleStyle: {
                      fontWeight: 'bold',
                    },
                    headerRight: () => (
                      <>
                        <Button
                          onPress={showDropdown}
                          title="Options"
                          color={Platform.OS === 'ios' ? '#fff' : 'rgb(49 0 110)'}
                        />
                        
                        {/* Android dropdown */}
                        <AndroidDropdown 
                          visible={showAndroidDropdown}
                          onClose={() => setShowAndroidDropdown(false)}
                          options={dropdownOptions}
                        />
                        
                        {/* Log files modal */}
                        <LogFilesModal
                          visible={showLogFilesModal}
                          onClose={() => setShowLogFilesModal(false)}
                        />
                      </>
                    ),
                  }
                }}
              />
              <Navigator.Screen
                name="conversation"
                component={ConversationScreen}
                options={{ title: 'Conversation' }}
                initialParams={{ topic: '' }}
              />
              <Navigator.Screen
                name="group"
                component={GroupScreen}
                options={{ title: 'Group' }}
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
    // </ThirdwebProvider>
  )
}
