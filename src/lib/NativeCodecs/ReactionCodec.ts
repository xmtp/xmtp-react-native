import {
  ContentTypeId,
  NativeContentCodec,
  NativeMessageContent,
  ReactionContent,
} from '../ContentCodec'

export class ReactionCodec implements NativeContentCodec<ReactionContent> {
  contentKey: 'reaction' = 'reaction'

  contentType: ContentTypeId = {
    authorityId: 'xmtp.org',
    typeId: 'reaction',
    versionMajor: 1,
    versionMinor: 0,
  }

  encode(content: ReactionContent): NativeMessageContent {
    return {
      reaction: content,
    }
  }

  decode(nativeContent: NativeMessageContent): ReactionContent {
    return nativeContent.reaction!
  }

  fallback(content: ReactionContent): string | undefined {
    switch (content.action) {
      case 'added':
        return `Reacted “${content.content}” to an earlier message`
      case 'removed':
        return `Removed “${content.content}” from an earlier message`
      default:
        return undefined
    }
  }
}
