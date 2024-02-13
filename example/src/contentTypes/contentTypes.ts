import {
  ReactionCodec,
  ReplyCodec,
  RemoteAttachmentCodec,
  StaticAttachmentCodec,
} from 'xmtp-react-native-sdk'

export const supportedCodecs = [
  new ReactionCodec(),
  new ReplyCodec(),
  new RemoteAttachmentCodec(),
  new StaticAttachmentCodec(),
]

export type SupportedContentTypes = typeof supportedCodecs
