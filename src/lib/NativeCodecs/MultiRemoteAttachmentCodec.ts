import {
  ContentTypeId,
  MultiRemoteAttachmentContent,
  MultiRemoteAttachmentMetadata,
  NativeContentCodec,
  NativeMessageContent,
  RemoteAttachmentInfo,
  RemoteAttachmentMetadata,
} from '../ContentCodec'

export class MultiRemoteAttachmentCodec
  implements NativeContentCodec<MultiRemoteAttachmentContent>
{
  static buildMultiRemoteAttachmentInfo(
    url: string,
    metadata: RemoteAttachmentMetadata
  ): RemoteAttachmentInfo {
    const multiMetadata: MultiRemoteAttachmentMetadata = {
      secret: metadata.secret,
      salt: metadata.salt,
      nonce: metadata.nonce,
      contentDigest: metadata.contentDigest,
      contentLength: metadata.contentLength ?? '0',
      filename: metadata.filename,
    }
    return {
      ...multiMetadata,
      scheme: 'https://',
      url,
    }
  }

  contentKey: 'multiRemoteAttachment' = 'multiRemoteAttachment'

  contentType: ContentTypeId = {
    authorityId: 'xmtp.org',
    typeId: 'multiRemoteStaticAttachment',
    versionMajor: 1,
    versionMinor: 0,
  }

  encode(content: MultiRemoteAttachmentContent): NativeMessageContent {
    return {
      multiRemoteAttachment: content,
    }
  }

  decode(nativeContent: NativeMessageContent): MultiRemoteAttachmentContent {
    return nativeContent.multiRemoteAttachment!
  }

  fallback(content: MultiRemoteAttachmentContent): string | undefined {
    return 'Multi attachments not supported.'
  }

  shouldPush(content: MultiRemoteAttachmentContent): boolean {
    return true
  }
}
