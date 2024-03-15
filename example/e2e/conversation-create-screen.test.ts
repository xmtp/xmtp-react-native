import { device } from 'detox'

import { createConversation } from './utils/createConversation'
import { generateDevWallet } from './utils/generateDevWallet'

describe('Conversation Create Screen Tests', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true })
    await generateDevWallet()
  })

  it('Create Conversation', async () => {
    await createConversation()
  })
})
