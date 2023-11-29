import {
  ContentTypeId,
  NativeContentCodec,
  NativeMessageContent,
} from '../ContentCodec'

export type ReplyContent = {
  reference: string
  content: any
  contentType: ContentTypeId
}

export class ReplyCodec implements NativeContentCodec<ReplyContent> {
  contentKey: string = 'reply'

  contentType: ContentTypeId = {
    authorityId: 'xmtp.org',
    typeId: 'text',
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
    return 'replied'
  }
}
