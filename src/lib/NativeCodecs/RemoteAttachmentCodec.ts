import {
  ContentTypeId,
  NativeContentCodec,
  NativeMessageContent,
  RemoteAttachmentContent,
} from '../ContentCodec'

export class RemoteAttachmentCodec
  implements NativeContentCodec<RemoteAttachmentContent>
{
  contentKey: 'remoteAttachment' = 'remoteAttachment'

  contentType: ContentTypeId = {
    authorityId: 'xmtp.org',
    typeId: 'remoteStaticAttachment',
    versionMajor: 1,
    versionMinor: 0,
  }

  encode(content: RemoteAttachmentContent): NativeMessageContent {
    return {
      remoteAttachment: content,
    }
  }

  decode(nativeContent: NativeMessageContent): RemoteAttachmentContent {
    return nativeContent.remoteAttachment!
  }

  fallback(content: RemoteAttachmentContent): string | undefined {
    return `Can’t display "${content.filename}". This app doesn’t support attachments.`
  }
}
