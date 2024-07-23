import {
  ContentTypeId,
  GroupUpdatedContent,
  NativeContentCodec,
  NativeMessageContent,
} from '../ContentCodec'

export class GroupUpdatedCodec
  implements NativeContentCodec<GroupUpdatedContent>
{
  contentKey: 'groupUpdated' = 'groupUpdated'
  contentType: ContentTypeId = {
    authorityId: 'xmtp.org',
    typeId: 'group_updated',
    versionMajor: 1,
    versionMinor: 0,
  }
  // Should never have to encode since only sent from Rust backend
  encode(): NativeMessageContent {
    return {}
  }

  decode(nativeContent: NativeMessageContent): GroupUpdatedContent {
    return nativeContent.groupUpdated!
  }

  fallback(): string | undefined {
    return undefined
  }
}
