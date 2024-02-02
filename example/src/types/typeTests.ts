import {
  Client,
  ContentTypeId,
  Conversation,
  EncodedContent,
  JSContentCodec,
  ReactionCodec,
  TextCodec,
  sendMessage,
} from 'xmtp-react-native-sdk'

const ContentTypeNumber: ContentTypeId = {
  authorityId: 'org',
  typeId: 'number',
  versionMajor: 1,
  versionMinor: 0,
}

export type NumberRef = {
  topNumber: {
    bottomNumber: number
  }
}

class NumberCodec implements JSContentCodec<NumberRef> {
  contentType = ContentTypeNumber

  // a completely absurd way of encoding number values
  encode(content: NumberRef): EncodedContent {
    return {
      type: ContentTypeNumber,
      parameters: {
        test: 'test',
      },
      content: new TextEncoder().encode(JSON.stringify(content)),
    }
  }

  decode(encodedContent: EncodedContent): NumberRef {
    if (encodedContent.parameters.test !== 'test') {
      throw new Error(`parameters should parse ${encodedContent.parameters}`)
    }
    const contentReceived = JSON.parse(
      new TextDecoder().decode(encodedContent.content)
    ) as NumberRef
    return contentReceived
  }

  fallback(content: NumberRef): string | undefined {
    return 'a billion'
  }
}

export const typeTests = async () => {
  const textClient = await Client.createRandom<[TextCodec]>({ env: 'local' })
  const textConvo = (await textClient.conversations.list())[0]
  textConvo.send({ text: 'hello' })
  textConvo.send('hello')
  // @ts-expect-error
  textConvo.send(12312312)
  // @ts-expect-error
  textConvo.send({ wrong: 'hello' })

  const textConvo2 = new Conversation(textClient, {
    createdAt: 123,
    topic: 'sdf',
    peerAddress: 'sdf',
    version: 'sdf',
  })
  textConvo2.send({ text: 'hello' })
  textConvo2.send('hello')
  // @ts-expect-error
  textConvo2.send(12312312)
  // @ts-expect-error
  textConvo2.send({ wrong: 'hello' })
  sendMessage<[TextCodec]>('0x1234', 'topic', { text: 'hello' })
  sendMessage<[TextCodec]>('0x1234', 'topic', 'hello')
  // @ts-expect-error
  sendMessage<[TextCodec]>('0x1234', 'topic', 12314)

  const supportedCodecs = [new ReactionCodec()]
  const reactionClient = await Client.createRandom<typeof supportedCodecs>({
    codecs: supportedCodecs,
  })
  const reactionConvo = (await reactionClient.conversations.list())[0]
  reactionConvo.send({
    reaction: {
      action: 'added',
      content: '💖',
      reference: '123',
      schema: 'unicode',
    },
  })
  reactionConvo.send({
    // @ts-expect-error
    schmeaction: {
      action: 'added',
      content: '💖',
      reference: '123',
      schema: 'unicode',
    },
  })

  reactionConvo.send({
    reaction: {
      // @ts-expect-error
      text: 'added',
    },
  })
  reactionConvo.send({
    text: 'text',
  })

  const messages = await reactionConvo.messages()
  const content = messages[0].content()
  if (typeof content === 'string') {
    //
  } else {
    const reaction = content
    const action = reaction.action
    // @ts-expect-error
    if (action === 12) {
      //
    }
  }

  const customContentClient = await Client.createRandom({
    env: 'local',
    codecs: [new NumberCodec()],
  })
  const customContentConvo = (await customContentClient.conversations.list())[0]

  customContentConvo.send(
    {
      topNumber: {
        bottomNumber: 12,
      },
    },
    { contentType: ContentTypeNumber }
  )
  const customContentMessages = await customContentConvo.messages()
  customContentMessages[0].content()
}
