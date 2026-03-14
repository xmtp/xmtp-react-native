/**
 * Test environment selection for createClients() when no env is passed.
 * Set from LaunchScreen; read from test-utils. Default is 'local'.
 * - local: XMTP local network
 * - dev: XMTP dev network
 * - d14n: dev network with custom gateway (uses GATEWAY_HOST from .env)
 */
export type TestEnvOption = 'local' | 'dev' | 'd14n'

let testEnv: TestEnvOption = 'local'

export function getTestEnv(): TestEnvOption {
  return testEnv
}

export function setTestEnv(value: TestEnvOption): void {
  testEnv = value
}
