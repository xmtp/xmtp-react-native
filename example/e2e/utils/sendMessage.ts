import { element } from 'detox'

export const sendMessage = async (message: string) => {
  await waitFor(element(by.id('conversation-screen')))
    .toBeVisible()
    .withTimeout(15000)
  await element(by.id('message-input')).typeText(message)
  await element(by.id('send-message-button')).tap()

  await waitFor(element(by.id(/^conversation-message-.*/)))
    .toBeVisible()
    .withTimeout(15000)
}
