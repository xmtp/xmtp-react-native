import {
  ContentTypeId,
  LeaveRequestContent,
  NativeContentCodec,
  NativeMessageContent,
  ReadReceiptContent,
} from '../ContentCodec'

export class LeaveRequestCodec
  implements NativeContentCodec<LeaveRequestContent>
{
  contentKey: 'leaveRequest' = 'leaveRequest'

  contentType: ContentTypeId = {
    authorityId: 'xmtp.org',
    typeId: 'leave_request',
    versionMajor: 1,
    versionMinor: 0,
  }

  encode(content: LeaveRequestContent): NativeMessageContent {
    return {
      leaveRequest: content,
    }
  }

  decode(nativeContent: NativeMessageContent): LeaveRequestContent {
    return nativeContent.leaveRequest!
  }

  fallback(content: LeaveRequestContent): string | undefined {
    return content.authenticatedNote ?? 'User requested to leave the group'
  }

  shouldPush(content: LeaveRequestContent): boolean {
    return false
  }
}
