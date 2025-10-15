describe('Example', () => {
  beforeAll(async () => {
    await device.launchApp()
  })

  beforeEach(async () => {
    await device.reloadReactNative()
  })

  it('shows the automated tests screen', async () => {
    await expect(element(by.text('Automated Tests'))).toBeVisible()
  })
})
