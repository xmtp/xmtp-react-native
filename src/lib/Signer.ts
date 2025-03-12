import type { WalletClient } from 'viem'

import { PublicIdentity } from './PublicIdentity'

export type SignerType = 'EOA' | 'SCW'

export interface SignedData {
  signature: string
  publicKey?: string // Used for Passkeys
  authenticatorData?: string // WebAuthn metadata
  clientDataJson?: string // WebAuthn metadata
}

export interface Signer {
  getIdentifier: () => Promise<PublicIdentity>
  getChainId: () => number | undefined
  getBlockNumber: () => number | undefined
  signerType: () => SignerType | undefined
  signMessage: (message: string) => Promise<SignedData>
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
    signMessage: async (message: string) => {
      const signature = await walletClient.signMessage({
        message: typeof message === 'string' ? message : { raw: message },
        account,
      })

      return {
        signature,
        publicKey: undefined, // Populate if passkey-related
        authenticatorData: undefined, // Populate if WebAuthn is used
        clientDataJson: undefined, // Populate if WebAuthn is used
      }
    },
    getChainId: () => undefined,
    getBlockNumber: () => undefined,
    signerType: () => undefined,
  }
}
