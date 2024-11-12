import { NavigationContext } from '@react-navigation/native'
import moment from 'moment'
import React, { useContext, useEffect, useState } from 'react'
import {
  Button,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import {
  Conversation,
  Client,
  useXmtp,
  DecodedMessage,
} from 'xmtp-react-native-sdk'

import { SupportedContentTypes } from './contentTypes/contentTypes'
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
  return (
    <>
      <View>
        <Text style={{ fontSize: 24, fontWeight: 'bold', textAlign: 'center' }}>
          Inbox
        </Text>
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
              <Text selectable style={{ fontSize: 14, fontWeight: 'bold' }}>
                {client?.address}
              </Text>
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
  const [messages, setMessages] = useState<
    DecodedMessage<SupportedContentTypes>[]
  >([])
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
      onPress={() =>
        navigation!.navigate('conversation', {
          id: conversation.id,
        })
      }
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
          <Text>{lastMessage?.senderAddress}:</Text>
          <Text>{moment(lastMessage?.sentNs / 1000000).fromNow()}</Text>
        </View>
      </View>
    </Pressable>
  )
}
