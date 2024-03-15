import { expect } from 'detox'

export const generateDevWallet = async () => {
  await expect(element(by.id('generated-dev-button'))).toBeVisible()
  await element(by.id('generated-dev-button')).tap()
  await waitFor(element(by.id('home-screen')))
    .toBeVisible()
    .withTimeout(1500)
}
