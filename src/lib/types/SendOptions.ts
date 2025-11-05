import { ContentTypeId } from './ContentCodec'

export type SendOptions = {
  contentType?: ContentTypeId
  /** Whether to send a push notification. Defaults to the codec's shouldPush behavior if not specified. */
  shouldPush?: boolean
}
