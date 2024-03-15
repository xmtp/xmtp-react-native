import { device } from 'detox'

import { createConversation } from './utils/createConversation'
import { generateDevWallet } from './utils/generateDevWallet'
import { sendMessage } from './utils/sendMessage'

describe('Conversation Screen Tests', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true })
    await generateDevWallet()
    await createConversation()
  })

  it('Send Message in Conversation', async () => {
    await sendMessage('Hello World!')
  })
})
