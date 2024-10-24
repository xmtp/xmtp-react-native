import { Client } from '@xmtp/react-native-sdk'

import { SupportedContentTypes } from './useCreateClient'

export const useCreateGroup = (
  client: Client<SupportedContentTypes> | undefined
) => {
  if (!client) {
    return () => undefined
  }

  return () => {
    return client.conversations.newGroup([], {
      name: 'Smart Contract Wallet Group',
    })
  }
}
