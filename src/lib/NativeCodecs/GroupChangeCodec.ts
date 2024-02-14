import {
  ContentTypeId,
  GroupChangeContent,
  NativeContentCodec,
  NativeMessageContent,
} from '../ContentCodec'

export class GroupChangeCodec
  implements NativeContentCodec<GroupChangeContent>
{
  contentKey: 'groupChange' = 'groupChange'
  contentType: ContentTypeId = {
    authorityId: 'xmtp.org',
    typeId: 'group_membership_change',
    versionMajor: 1,
    versionMinor: 0,
  }

  encode(): NativeMessageContent {
    return {}
  }

  decode(nativeContent: NativeMessageContent): GroupChangeContent {
    return nativeContent.groupChange!
  }

  fallback(): string | undefined {
    return 'The members of this group have changed'
  }
}
