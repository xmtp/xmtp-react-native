import {
  ContentTypeId,
  DeleteMessageContent,
  NativeContentCodec,
  NativeMessageContent,
} from '../ContentCodec'

export class DeleteMessageCodec
  implements NativeContentCodec<DeleteMessageContent>
{
  contentKey: 'deleteMessage' = 'deleteMessage'

  contentType: ContentTypeId = {
    authorityId: 'xmtp.org',
    typeId: 'deletedMessage',
    versionMajor: 1,
    versionMinor: 0,
  }

  encode(content: DeleteMessageContent): NativeMessageContent {
    return {
      deleteMessage: content,
    }
  }

  decode(nativeContent: NativeMessageContent): DeleteMessageContent {
    return nativeContent.deleteMessage!
  }

  fallback(content: DeleteMessageContent): string | undefined {
    return content.messageId ?? 'Message ID is required'
  }

  shouldPush(content: DeleteMessageContent): boolean {
    return false
  }
}
