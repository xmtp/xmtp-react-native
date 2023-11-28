import { NavigationContext } from '@react-navigation/native'
import moment from 'moment'
import React, { useContext, useState } from 'react'
import {
  Button,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Conversation, Client } from 'xmtp-react-native-sdk'

import { useXmtp } from './XmtpContext'
import { useConversationList, useMessages } from './hooks'

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
          <Text style={{ fontSize: 14, fontWeight: 'bold' }}>
            {client?.address}
          </Text>
        </View>
      }
    />
  )
}

function ConversationItem({
  conversation,
  client,
}: {
  conversation: Conversation
  client: Client | null
}) {
  const navigation = useContext(NavigationContext)
  const { data: messages } = useMessages({ topic: conversation.topic })
  const lastMessage = messages?.[0]
  const [getConsentState, setConsentState] = useState<string | undefined>()

  conversation.consentState().then((result) => {
    setConsentState(result)
  })
  const denyContact = () => client?.contacts.deny([conversation.peerAddress])

  return (
    <Pressable
      onPress={() =>
        navigation!.navigate('conversation', {
          topic: conversation.topic,
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
            onPress={denyContact}
            disabled={getConsentState === 'denied'}
          />
        </View>
        <View style={{ padding: 4 }}>
          <Text numberOfLines={1} ellipsizeMode="tail">
            {lastMessage?.content().text}
          </Text>
          <Text>{lastMessage?.senderAddress}:</Text>
          <Text>{moment(lastMessage?.sent).fromNow()}</Text>
          <Text style={{ fontWeight: 'bold', color: 'red' }}>
            {getConsentState}
          </Text>
        </View>
      </View>
    </Pressable>
  )
}
