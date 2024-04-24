import { MessageDeliveryStatus } from '../DecodedMessage'

export type MessagesOptions = {
  limit?: number | undefined
  before?: number | Date | undefined
  after?: number | Date | undefined
  direction?:
    | 'SORT_DIRECTION_ASCENDING'
    | 'SORT_DIRECTION_DESCENDING'
    | undefined
  deliveryStatus?: MessageDeliveryStatus | undefined
}
