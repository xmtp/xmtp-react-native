import { element, waitFor } from 'detox'

export const createConversation = async () => {
  await waitFor(element(by.id('home-screen')))
    .toBeVisible()
    .withTimeout(15000)
  await element(by.id('new-conversation-button')).tap()
  await element(by.id('to-address-input')).typeText(
    '0xc93C111dcb2Df6Bb25a3F9035D5cd47bDc0381d0'
  )
  await element(by.id('start-conversation-button')).tap()
  await waitFor(element(by.id('conversation-screen')))
    .toBeVisible()
    .withTimeout(15000)
}
