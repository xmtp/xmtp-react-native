import { Group } from '@xmtp/react-native-sdk'

import { SupportedContentTypes } from './useCreateClient'

export const useListMessages = (
  group: Group<SupportedContentTypes> | undefined
) => {
  if (!group) {
    return () => undefined
  }

  return () => {
    return group.messages()
  }
}
