import {
  ContentTypeId,
  NativeContentCodec,
  NativeMessageContent,
} from '../ContentCodec'

export type ReplyContent = {
  reference: string
  // Right now this will assume any NativeMessageContent is valid, but really should only be the supported content types
  content: NativeMessageContent
}

export class ReplyCodec implements NativeContentCodec<ReplyContent> {
  contentKey: 'reply' = 'reply'

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
