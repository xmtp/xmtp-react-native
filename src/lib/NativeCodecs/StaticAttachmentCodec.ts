import {
  ContentTypeId,
  NativeContentCodec,
  NativeMessageContent,
  StaticAttachmentContent,
} from '../ContentCodec'

export class StaticAttachmentCodec
  implements NativeContentCodec<StaticAttachmentContent>
{
  contentKey: 'attachment' = 'attachment'

  contentType: ContentTypeId = {
    authorityId: 'xmtp.org',
    typeId: 'attachment',
    versionMajor: 1,
    versionMinor: 0,
  }

  encode(content: StaticAttachmentContent): NativeMessageContent {
    return {
      attachment: content,
    }
  }

  decode(nativeContent: NativeMessageContent): StaticAttachmentContent {
    return nativeContent.attachment!
  }

  fallback(content: StaticAttachmentContent): string | undefined {
    return `Can’t display "${content.filename}". This app doesn’t support attachments.`
  }
}
