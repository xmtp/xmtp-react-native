import { NavigationContext } from '@react-navigation/native'
import * as Clipboard from 'expo-clipboard'
import moment from 'moment'
import React, { useContext, useEffect, useState } from 'react'
import {
  Button,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native'
import {
  Conversation,
  Client,
  useXmtp,
  DecodedMessage,
} from 'xmtp-react-native-sdk'

import { useConversationList } from './hooks'

/// Show the user's list of conversations.

export default function HomeScreen() {
  const { client } = useXmtp()
  const {
    data: conversations,
    refetch,
    isFetching,
    isRefetching,
  } = useConversationList()

  const [forkStatusCounts, setForkStatusCounts] = useState({
    notForked: 0,
    forked: 0,
    unknown: 0,
  })

  // Stream all messages when screen loads
  useEffect(() => {
    if (!client) return

    console.log('🏠 Setting up streamAllMessages on HomeScreen')

    const setupStreamAllMessages = async () => {
      try {
        await client.conversations.streamAllMessages(
          async (message) => {
            console.log(
              '🏠 Received message in HomeScreen stream:',
              message.id,
              message.content()
            )
            // You can add additional logic here to handle incoming messages
            // For example, updating a global state, showing notifications, etc.
          },
          'all', // Stream from both groups and DMs
          undefined, // Use default consent states (allowed and unknown)
          () => {
            console.log('🏠 StreamAllMessages closed on HomeScreen')
          }
        )
        console.log('🏠 StreamAllMessages setup complete on HomeScreen')
      } catch (error) {
        console.error(
          '🏠 Error setting up streamAllMessages on HomeScreen:',
          error
        )
      }
    }

    setupStreamAllMessages().catch(console.error)

    return () => {
      console.log('🏠 Cleaning up streamAllMessages on HomeScreen')
      try {
        client.conversations.cancelStreamAllMessages()
      } catch (error) {
        console.error(
          '🏠 Error canceling streamAllMessages on HomeScreen:',
          error
        )
      }
    }
  }, [client])

  // Update fork status counts when conversations change
  useEffect(() => {
    if (!conversations) return

    const updateCounts = async () => {
      const counts = { notForked: 0, forked: 0, unknown: 0 }

      await Promise.all(
        conversations.map(async (conversation) => {
          try {
            const status = conversation.commitLogForkStatus

            switch (status) {
              case 'notForked':
                counts.notForked++
                break
              case 'forked':
                counts.forked++
                break
              default:
                counts.unknown++
                break
            }
          } catch (error) {
            console.error('Error getting debug info for conversation:', error)
            counts.unknown++
          }
        })
      )

      setForkStatusCounts(counts)
    }

    updateCounts().catch(console.error)
  }, [conversations])

  return (
    <>
      <View>
        <Text style={{ fontSize: 24, fontWeight: 'bold', textAlign: 'center' }}>
          Inbox
        </Text>

        {/* Fork Status Summary */}
        <View
          style={{
            backgroundColor: '#f0f0f0',
            padding: 12,
            marginHorizontal: 16,
            marginVertical: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#ddd',
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: 'bold',
              marginBottom: 8,
              textAlign: 'center',
            }}
          >
            Fork Status Summary
          </Text>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-around' }}
          >
            <View style={{ alignItems: 'center' }}>
              <Text
                style={{ fontSize: 18, fontWeight: 'bold', color: '#28a745' }}
              >
                {forkStatusCounts.notForked}
              </Text>
              <Text style={{ fontSize: 12, color: '#666' }}>Not Forked</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text
                style={{ fontSize: 18, fontWeight: 'bold', color: '#dc3545' }}
              >
                {forkStatusCounts.forked}
              </Text>
              <Text style={{ fontSize: 12, color: '#666' }}>Forked</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text
                style={{ fontSize: 18, fontWeight: 'bold', color: '#6c757d' }}
              >
                {forkStatusCounts.unknown}
              </Text>
              <Text style={{ fontSize: 12, color: '#666' }}>Unknown</Text>
            </View>
          </View>
        </View>
        <FlatList
          refreshing={isFetching || isRefetching}
          onRefresh={refetch}
          data={conversations || []}
          keyExtractor={(item) => item.topic}
          renderItem={({ item: conversation }) => (
            <ConversationItem conversation={conversation} client={client} />
          )}
          ListHeaderComponent={
            <View
              style={{
                paddingTop: 8,
                paddingBottom: 8,
                paddingLeft: 16,
                paddingRight: 16,
                backgroundColor: '#eee',
                borderBottomColor: 'gray',
                borderBottomWidth: StyleSheet.hairlineWidth,
              }}
            >
              <Text style={{ fontSize: 14 }}>Connected as</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', flex: 1 }}>
                  {client?.publicIdentity.identifier}
                </Text>
                <TouchableOpacity
                  onPress={async () => {
                    if (client?.publicIdentity.identifier) {
                      await Clipboard.setStringAsync(
                        client.publicIdentity.identifier
                      )
                    }
                  }}
                  style={{
                    padding: 8,
                    backgroundColor: '#ddd',
                    borderRadius: 4,
                    marginLeft: 8,
                  }}
                >
                  <Text>Copy</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
        />
      </View>
    </>
  )
}

function ConversationItem({
  conversation,
  client,
}: {
  conversation: Conversation<any>
  client: Client<any> | null
}) {
  const navigation = useContext(NavigationContext)
  const [messages, setMessages] = useState<DecodedMessage[]>([])
  const lastMessage = messages?.[0]
  const [consentState, setConsentState] = useState<string | undefined>()

  const denyGroup = async () => {
    await conversation.updateConsent('denied')
    const consent = await conversation.consentState()
    setConsentState(consent)
  }

  useEffect(() => {
    conversation
      ?.sync()
      .then(() => conversation.messages())
      .then(setMessages)
      .then(() => conversation.consentState())
      .then((result) => {
        setConsentState(result)
      })
      .catch((e) => {
        console.error('Error fetching conversation messages: ', e)
      })
  }, [conversation])

  return (
    <Pressable
      onPress={() => {
        console.log('conversation pressed')
        console.log(conversation.topic)
        navigation!.navigate('conversation', {
          topic: conversation.topic,
        })
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          padding: 8,
        }}
      >
        <View style={{ padding: 4 }}>
          <Text style={{ fontWeight: 'bold' }}>
            ({messages?.length} messages)
          </Text>
          <Button
            title="Deny"
            onPress={denyGroup}
            disabled={consentState === 'denied'}
          />
        </View>
        <View style={{ padding: 4 }}>
          <Text style={{ fontWeight: 'bold', color: 'red' }}>
            {consentState}
          </Text>
          <Text numberOfLines={1} ellipsizeMode="tail">
            {lastMessage?.fallback}
          </Text>
          <Text>{lastMessage?.senderInboxId}:</Text>
          <Text>{moment(lastMessage?.sentNs / 1000000).fromNow()}</Text>
        </View>
      </View>
    </Pressable>
  )
}
