import {
  ContentTypeId,
  NativeContentCodec,
  NativeMessageContent,
} from '../ContentCodec'

export class TextCodec implements NativeContentCodec<string> {
  contentKey: 'text' = 'text'

  contentType: ContentTypeId = {
    authorityId: 'xmtp.org',
    typeId: 'text',
    versionMajor: 1,
    versionMinor: 0,
  }

  encode(content: string): NativeMessageContent {
    return {
      text: content,
    }
  }

  decode(nativeContent: NativeMessageContent): string {
    return nativeContent.text || ''
  }

  fallback(content: string): string | undefined {
    return content
  }
}
