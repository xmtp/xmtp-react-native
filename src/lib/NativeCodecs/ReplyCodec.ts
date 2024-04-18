import {
  ContentTypeId,
  NativeContentCodec,
  NativeMessageContent,
} from '../ContentCodec'

export type ReplyContent = {
  reference: string
  content: any
  contentType: string
}

export class ReplyCodec implements NativeContentCodec<ReplyContent> {
  contentKey: string = 'reply'

  contentType: ContentTypeId = {
    authorityId: 'xmtp.org',
    typeId: 'reply',
    versionMajor: 1,
    versionMinor: 0,
  }

  encode(content: ReplyContent): NativeMessageContent {
    return {
      reply: content,
    }
  }

  decode(nativeContent: NativeMessageContent): ReplyContent {
    return nativeContent.reply!
  }

  fallback(content: ReplyContent): string | undefined {
    if (typeof content.content === 'string') {
      return `Replied with “${content.content}” to an earlier message`
    }
    return 'Replied to an earlier message'
  }
}
