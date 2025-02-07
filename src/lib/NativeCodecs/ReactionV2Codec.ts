import {
  ContentTypeId,
  NativeContentCodec,
  NativeMessageContent,
  ReactionContent,
} from '../ContentCodec'

export class ReactionV2Codec implements NativeContentCodec<ReactionContent> {
  contentKey: 'reactionV2' = 'reactionV2'

  contentType: ContentTypeId = {
    authorityId: 'xmtp.org',
    typeId: 'reaction',
    versionMajor: 2,
    versionMinor: 0,
  }

  encode(content: ReactionContent): NativeMessageContent {
    return {
      reactionV2: content,
    }
  }

  decode(nativeContent: NativeMessageContent): ReactionContent {
    return nativeContent.reactionV2!
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
