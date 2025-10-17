/* eslint-disable @typescript-eslint/no-floating-promises */
import React, { useCallback, useEffect, useState } from 'react'
import { Button, FlatList, Text, View, Switch, Pressable } from 'react-native'

import { getDbEncryptionKey } from './hooks'
import { Client, Conversation, DecodedMessage } from '../../src'

let events: StreamEvent[] = []

const useClient = () => {
  const [client, setClient] = useState<Client<any> | null>(null)
  useEffect(() => {
    getDbEncryptionKey('dev')
      .then((dbEncryptionKey) =>
        Client.createRandom({
          env: 'dev',
          dbEncryptionKey,
        })
      )
      .then((client) => {
        setClient(client)
      })
  }, [])

  return client
}

const useConversation = (client: Client<any>, recieve: boolean) => {
  const [conversation, setConversation] = useState<Conversation<any> | null>(
    null
  )
  const [otherClientConvo, setOtherClientConvo] =
    useState<Conversation<any> | null>(null)
  const conversationClient = useClient()

  useEffect(() => {
    if (!conversationClient) {
      return
    }
    if (!client) {
      return
    }

    const setupConversations = async () => {
      const conversation = await client.conversations.newConversation(
        conversationClient.inboxId
      )
      events.push({ type: 'start_conv', timestamp: Date.now() })
      setConversation(conversation)
      const conversations = await conversationClient.conversations.list()
      const otherConvo = conversations.find(
        (convo) => convo.topic === conversation.topic
      )
      if (otherConvo) {
        setOtherClientConvo(otherConvo)
      }
    }

    const setupReceiveConvo = async () => {
      const conversation =
        await conversationClient.conversations.newConversation(
          conversationClient.inboxId
        )
      events.push({ type: 'receive_convo', timestamp: Date.now() })
      setOtherClientConvo(conversation)
      const conversations = await client.conversations.list()
      const otherConvo = conversations.find(
        (convo) => convo.topic === conversation.topic
      )
      if (otherConvo) {
        setConversation(otherConvo)
      }
    }
    if (recieve) {
      setupReceiveConvo()
    } else {
      setupConversations()
    }
  }, [conversationClient, client])

  return { conversation, otherClientConvo }
}

interface ConversationItemProps {
  client: Client<any>
  received: boolean
  onSendMessage: () => void
  onReceiveMessage: () => void
}

const ConversationItem = ({
  client,
  received,
  onSendMessage,
  onReceiveMessage,
}: ConversationItemProps) => {
  const { conversation, otherClientConvo } = useConversation(client, received)
  const [messages, setMessages] = useState<DecodedMessage[]>([])
  const [shouldStream, setShouldStream] = useState<boolean>(true)
  const [show, setShow] = useState<boolean>(true)

  useEffect(() => {
    let sub: (() => void) | undefined = undefined

    const setSub = async () => {
      sub = await conversation?.streamMessages(async (message) => {
        setMessages((prev) => [...prev, message])
      })
    }
    if (shouldStream) {
      setSub()
    }
    return () => {
      sub?.()
    }
  }, [conversation, shouldStream])

  const toggleStream = useCallback(() => {
    setShouldStream((prev) => !prev)
  }, [setShouldStream])

  const toggleShow = useCallback(() => {
    setShow((prev) => !prev)
  }, [setShow])

  const sendMessage = useCallback(() => {
    conversation?.send('Hello!')
    onSendMessage()
  }, [conversation, onSendMessage])

  const receiveMessage = useCallback(() => {
    otherClientConvo?.send('Hi!')
    onReceiveMessage()
  }, [otherClientConvo, client.publicIdentity.identifier, onReceiveMessage])

  return (
    <View>
      <Pressable onPress={toggleShow}>
        <Text style={{ color: show ? 'black' : 'grey' }}>
          {conversation?.topic} {messages.length}
        </Text>
      </Pressable>
      {show && (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Button
              title="Send new message"
              color="green"
              onPress={sendMessage}
            />
            <Button
              title="Receive message"
              color="blue"
              onPress={receiveMessage}
            />
            <View style={{ flexDirection: 'row' }}>
              <Text>Stream</Text>
              <Switch value={shouldStream} onValueChange={toggleStream} />
            </View>
          </View>
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <Text>{item.sentNs}</Text>}
          />
        </>
      )}
    </View>
  )
}

interface StreamEvent {
  type:
    | 'start_conv'
    | 'receive_convo'
    | 'receive_message'
    | 'send_message'
    | 'conv_stream_start'
    | 'conv_stream_cancel'
    | 'all_messages_start'
    | 'all_messages_cancel'
    | 'all_messages_receive'
    | 'all_start'
    | 'all_cancel'
    | 'all_receive'
  timestamp: number
}

export default function StreamScreen() {
  const client = useClient()
  const [showEvents, setShowEvents] = useState<boolean>(false)
  const [conversations, setConversations] = useState<boolean[]>([])
  const [stream, setStream] = useState<boolean>(true)
  const [streamCount, setStreamCount] = useState<number>(0)
  const [streamMessages, setStreamMessages] = useState<boolean>(true)
  const [streamMessagesCount, setStreamMessagesCount] = useState<number>(0)

  useEffect(() => {
    events = []
  }, [])

  const toggleStreamMessages = useCallback(() => {
    setStreamMessages((prev) => !prev)
  }, [setStreamMessages])
  const toggleStreamAll = useCallback(() => {
    setStream((prev) => !prev)
  }, [setStream])
  const toggleShowEvents = useCallback(() => {
    setShowEvents((prev) => !prev)
  }, [setShowEvents])

  const addConversation = useCallback(() => {
    setConversations((prev) => [...prev, false])
  }, [setConversations])

  const removeConversation = useCallback(() => {
    setConversations((prev) => prev.slice(0, prev.length - 1))
  }, [setConversations])

  const onSendMessage = useCallback(() => {
    events.push({ type: 'send_message', timestamp: Date.now() })
  }, [])

  const onReceiveMessage = useCallback(() => {
    events.push({ type: 'receive_message', timestamp: Date.now() })
  }, [])

  const onStreamAllMessages = useCallback(() => {
    events.push({ type: 'all_messages_start', timestamp: Date.now() })
  }, [])

  const onCancelStreamAllMessages = useCallback(() => {
    events.push({ type: 'all_messages_cancel', timestamp: Date.now() })
  }, [])

  const onStreamAll = useCallback(() => {
    events.push({ type: 'all_start', timestamp: Date.now() })
  }, [])

  const onCancelStreamAll = useCallback(() => {
    events.push({ type: 'all_cancel', timestamp: Date.now() })
  }, [])

  useEffect(() => {
    if (!client) {
      return
    }
    const setupSub = async () => {
      onStreamAllMessages()
      client.conversations.streamAllMessages(async () => {
        setStreamMessagesCount((prev) => prev + 1)
      })
    }
    if (streamMessages) {
      setupSub()
    }

    return () => {
      onCancelStreamAllMessages()
      client.conversations.cancelStreamAllMessages()
    }
  }, [client, stream, onStreamAllMessages, onCancelStreamAllMessages])

  useEffect(() => {
    if (!client) {
      return
    }
    const setupSub = async () => {
      onStreamAll()
      client.conversations.stream(async () => {
        setStreamCount((prev) => prev + 1)
      })
    }
    if (streamMessages) {
      setupSub()
    }

    return () => {
      onCancelStreamAll()
      client.conversations.cancelStream()
    }
  }, [client, stream, onStreamAllMessages, onCancelStreamAllMessages])

  if (!client) {
    return (
      <View>
        <Text>Loading</Text>
      </View>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      {showEvents && <Text selectable>{JSON.stringify(events)}</Text>}
      <Button title="Show events" onPress={toggleShowEvents} color="blue" />
      <View>
        <Button
          title="Add new conversation"
          color="green"
          onPress={addConversation}
        />
        <Button
          title="Remove latest conversation"
          color="red"
          onPress={removeConversation}
        />
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flexDirection: 'row' }}>
            <Text>Stream All: {streamCount}</Text>
            <Switch value={stream} onValueChange={toggleStreamAll} />
          </View>
          <View style={{ flexDirection: 'row' }}>
            <Text>Stream All Messages: {streamMessagesCount}</Text>
            <Switch
              value={streamMessages}
              onValueChange={toggleStreamMessages}
            />
          </View>
        </View>
      </View>
      <FlatList
        // style={{ flexGrow: 1 }}
        data={conversations}
        keyExtractor={(item, idx) => idx.toString()}
        renderItem={({ item }) => (
          <ConversationItem
            client={client}
            received={item}
            onSendMessage={onSendMessage}
            onReceiveMessage={onReceiveMessage}
          />
        )}
      />
    </View>
  )
}
