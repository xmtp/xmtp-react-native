import { device, expect } from 'detox'

describe('Test Screen Tests', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true })
    await expect(element(by.id('run-tests'))).toBeVisible()
    await element(by.id('run-tests')).tap()
    await waitFor(element(by.id('test-screen')))
      .toBeVisible()
      .withTimeout(1500)
  })

  it('All Tests should pass', async () => {
    // Wait until no elements with testID "running" are visible
    await waitFor(element(by.id(/^.*running/)))
      .not.toBeVisible()
      .withTimeout(50000)
  })
})
