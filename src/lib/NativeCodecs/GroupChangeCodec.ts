import {
  ContentTypeId,
  NativeContentCodec,
  NativeMessageContent,
} from '../ContentCodec'

export class GroupChangeCodec implements NativeContentCodec<string> {
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

  decode(nativeContent: NativeMessageContent): string {
    return nativeContent.text!
  }

  fallback(): string | undefined {
    return 'The members of this group have changed'
  }
}
