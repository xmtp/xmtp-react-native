import {
  GroupUpdatedCodec,
  ReactionCodec,
  ReactionV2Codec,
  ReplyCodec,
  RemoteAttachmentCodec,
  StaticAttachmentCodec,
  MultiRemoteAttachmentCodec,
} from 'xmtp-react-native-sdk'

export const supportedCodecs = [
  new ReactionCodec(),
  new ReactionV2Codec(),
  new ReplyCodec(),
  new RemoteAttachmentCodec(),
  new MultiRemoteAttachmentCodec(),
  new StaticAttachmentCodec(),
  new GroupUpdatedCodec(),
]

export type SupportedContentTypes = typeof supportedCodecs
