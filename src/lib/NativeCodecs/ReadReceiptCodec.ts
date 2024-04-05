import {
  ContentTypeId,
  NativeContentCodec,
  NativeMessageContent,
  ReadReceiptContent,
} from '../ContentCodec'

export class ReadReceiptCodec
  implements NativeContentCodec<ReadReceiptContent>
{
  contentKey: string = 'readReceipt'

  contentType: ContentTypeId = {
    authorityId: 'xmtp.org',
    typeId: 'readReceipt',
    versionMajor: 1,
    versionMinor: 0,
  }

  encode(content: ReadReceiptContent): NativeMessageContent {
    return {
      readReceipt: content,
    }
  }

  decode(nativeContent: NativeMessageContent): ReadReceiptContent {
    return nativeContent.reply!
  }

  fallback(content: object): string | undefined {
    return undefined
  }
}
