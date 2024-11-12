import {
  Client,
  ContentTypeId,
  ConversationVersion,
  Dm,
  EncodedContent,
  JSContentCodec,
  ReactionCodec,
  ReplyCodec,
  sendMessage,
  TextCodec,
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
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  const textClient = await Client.createRandom<[TextCodec]>({
    env: 'local',
    dbEncryptionKey: keyBytes,
  })
  const textConvo = (await textClient.conversations.list())[0]
  await textConvo.send({ text: 'hello' })
  await textConvo.send('hello')
  // @ts-expect-error
  await textConvo.send(12312312)
  // @ts-expect-error
  await textConvo.send({ wrong: 'hello' })

  const textConvo2 = new Dm(textClient, {
    createdAt: 123,
    // @ts-expect-error
    topic: 'sdf',
    peerAddress: 'sdf',
    version: 'sdf',
  })
  await textConvo2.send({ text: 'hello' })
  await textConvo2.send('hello')
  // @ts-expect-error
  await textConvo2.send(12312312)
  // @ts-expect-error
  await textConvo2.send({ wrong: 'hello' })
  // @ts-expect-error
  await sendMessage<[TextCodec]>('0x1234', 'topic', 12314)

  const supportedCodecs = [new ReactionCodec()]
  const reactionClient = await Client.createRandom<typeof supportedCodecs>({
    codecs: supportedCodecs,
    env: 'local',
    dbEncryptionKey: keyBytes,
  })
  const reactionConvo = (await reactionClient.conversations.list())[0]
  await reactionConvo.send({
    reaction: {
      action: 'added',
      content: '💖',
      reference: '123',
      schema: 'unicode',
    },
  })
  await reactionConvo.send({
    // @ts-expect-error
    schmeaction: {
      action: 'added',
      content: '💖',
      reference: '123',
      schema: 'unicode',
    },
  })

  await reactionConvo.send({
    reaction: {
      // @ts-expect-error
      text: 'added',
    },
  })
  await reactionConvo.send({
    text: 'text',
  })
  const keyBundleReactionClient = await Client.build<typeof supportedCodecs>(
    reactionClient.address,
    {
      codecs: supportedCodecs,
      env: 'local',
      dbEncryptionKey: keyBytes,
    }
  )
  const reactionKeyBundleConvo = (
    await keyBundleReactionClient.conversations.list()
  )[0]
  await reactionKeyBundleConvo.send({
    // @ts-expect-error
    sdfsdf: 'sdfsdf',
  })
  await reactionConvo.send({
    reaction: {
      action: 'added',
      content: '💖',
      reference: '123',
      schema: 'unicode',
    },
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
    dbEncryptionKey: keyBytes,
  })
  const customContentConvo = (await customContentClient.conversations.list())[0]

  await customContentConvo.send(
    {
      topNumber: {
        bottomNumber: 12,
      },
    },
    { contentType: ContentTypeNumber }
  )

  const customContentGroup = (await customContentClient.conversations.list())[0]

  await customContentGroup.send(
    {
      topNumber: {
        bottomNumber: 12,
      },
    },
    { contentType: ContentTypeNumber }
  )
  const customContentMessages = await customContentConvo.messages()
  customContentMessages[0].content()

  await customContentGroup.send({
    // @ts-expect-error
    test: 'test',
  })
  const supportedReplyCodecs = [...supportedCodecs, new ReplyCodec()]
  const replyClient = await Client.createRandom<typeof supportedReplyCodecs>({
    codecs: supportedReplyCodecs,
    env: 'local',
    dbEncryptionKey: keyBytes,
  })

  const replyConvo = (await replyClient.conversations.list())[0]
  await replyConvo.send({
    reaction: {
      action: 'added',
      content: '💖',
      reference: '123',
      schema: 'unicode',
    },
  })
  await replyConvo.send({
    reply: {
      reference: '123',
      content: {
        reaction: {
          action: 'added',
          content: '💖',
          reference: '123',
          schema: 'unicode',
        },
      },
    },
  })
  await replyConvo.send({
    reply: {
      reference: '123',
      content: {
        // @ts-expect-error
        reaction: {
          action: 'added',
          content: '💖',
          reference: '123',
          // schema: 'unicode',
        },
      },
    },
  })
  const replyMessages = await replyConvo.messages()
  const replyContent = replyMessages[0].content()
  if (typeof replyContent === 'string') {
    //
  } else {
    const reply = replyContent
    // Typecheck for reaction
    if (typeof reply.content === 'string') {
    } else {
      // is a reply of some type
      if (reply.content.text !== 'added') {
        //
      }
    }
  }

  const convoClient = await Client.createRandom({
    env: 'local',
    codecs: [new NumberCodec()],
    dbEncryptionKey: keyBytes,
  })
  const convos = await convoClient.conversations.list()
  const firstConvo = convos[0]
  if (firstConvo.version === ConversationVersion.GROUP) {
    const groupName = firstConvo.name
    // @ts-expect-error
    const peerAddress = await firstConvo.peerInboxId()
  } else if (firstConvo.version === ConversationVersion.DM) {
    const peerAddress = await firstConvo.peerInboxId()
    // @ts-expect-error
    const groupName = firstConvo.name
  } else {
    // @ts-expect-error
    const peerAddress2 = firstConvo.peerInboxId()
  }
}
