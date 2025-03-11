import type { WalletClient } from 'viem'

import { PublicIdentity } from './PublicIdentity'

export type SignerType = 'EOA' | 'SCW'

export interface Signer {
  getIdentifier: () => Promise<PublicIdentity>
  getChainId: () => number | undefined
  getBlockNumber: () => number | undefined
  signerType: () => SignerType | undefined
  signMessage: (message: string) => Promise<string>
}

export function getSigner(wallet: Signer | WalletClient | null): Signer | null {
  if (!wallet) {
    return null
  }
  if (isWalletClient(wallet)) {
    return convertWalletClientToSigner(wallet)
  }
  if (typeof wallet.getIdentifier !== 'function') {
    throw new Error('Unknown wallet type')
  }
  return wallet
}

function isWalletClient(wallet: Signer | WalletClient): wallet is WalletClient {
  return 'type' in wallet && wallet.type === 'walletClient'
}

export function convertWalletClientToSigner(
  walletClient: WalletClient
): Signer {
  const { account } = walletClient
  if (!account || !account.address) {
    throw new Error('WalletClient is not configured')
  }

  return {
    getIdentifier: async () => {
      return new PublicIdentity(account.address, 'ETHEREUM')
    },
    signMessage: async (message: string | Uint8Array) =>
      walletClient.signMessage({
        message: typeof message === 'string' ? message : { raw: message },
        account,
      }),
    getChainId: () => undefined,
    getBlockNumber: () => undefined,
    signerType: () => undefined,
  }
}
