import {
  GroupUpdatedCodec,
  ReactionCodec,
  ReactionV2Codec,
  ReplyCodec,
  RemoteAttachmentCodec,
  StaticAttachmentCodec,
  MultiRemoteAttachmentCodec,
  LeaveRequestCodec,
  DeleteMessageCodec,
} from 'xmtp-react-native-sdk'

export const supportedCodecs = [
  new ReactionCodec(),
  new ReactionV2Codec(),
  new ReplyCodec(),
  new RemoteAttachmentCodec(),
  new MultiRemoteAttachmentCodec(),
  new StaticAttachmentCodec(),
  new GroupUpdatedCodec(),
  new LeaveRequestCodec(),
  new DeleteMessageCodec(),
]

export type SupportedContentTypes = typeof supportedCodecs
