import { device, expect } from 'detox'

import { generateDevWallet } from './utils/generateDevWallet'

describe('Launch Screen Tests', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true })
  })

  beforeEach(async () => {
    await device.reloadReactNative()
  })

  it('Tests Button', async () => {
    await expect(element(by.id('run-tests-button'))).toBeVisible()
    await element(by.id('run-tests-button')).tap()
    await waitFor(element(by.id('test-screen')))
      .toBeVisible()
      .withTimeout(15000)
  })

  it('Generate Dev Button', async () => {
    await generateDevWallet()
  })

  it('Use Saved Wallet Dev Button', async () => {
    await expect(element(by.id('saved-dev-button'))).toBeVisible()
    await element(by.id('saved-dev-button')).tap()
    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(15000)
  })

  it('Clear Saved Wallet Dev Button', async () => {
    await expect(element(by.id('saved-clear-button'))).toBeVisible()
    await element(by.id('saved-clear-button')).tap()
    await expect(element(by.id('saved-dev-button'))).not.toBeVisible()
  })
})
