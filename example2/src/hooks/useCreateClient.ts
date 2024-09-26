import {
  Client,
  GroupUpdatedCodec,
  ReactionCodec,
  ReplyCodec,
  RemoteAttachmentCodec,
  StaticAttachmentCodec,
} from '@xmtp/react-native-sdk'
import { WalletClient } from 'viem'

interface Signer {
  getAddress: () => Promise<string>
  getChainId: () => bigint
  getBlockNumber: () => bigint
  isSmartContractWallet: () => boolean
  signMessage: (message: string) => Promise<string>
}

const supportedCodecs = [
  new ReactionCodec(),
  new ReplyCodec(),
  new RemoteAttachmentCodec(),
  new StaticAttachmentCodec(),
  new GroupUpdatedCodec(),
]

export type SupportedContentTypes = typeof supportedCodecs

const appVersion = 'XMTP_RN_SC_EX/0.0.1'

export const useCreateClient = (walletClient: WalletClient | undefined) => {
  if (!walletClient) {
    return () => undefined
  }

  const { account } = walletClient
  if (!account || !account.address) {
    throw new Error('WalletClient is not configured')
  }

  const signer: Signer = {
    getAddress: () => Promise.resolve(walletClient.account?.address ?? ''),
    getChainId: () => BigInt(walletClient.chain?.id ?? 0),
    getBlockNumber: () => 0n,
    isSmartContractWallet: () => true,
    signMessage: (message: string) =>
      walletClient.signMessage({ message, account }),
  }

  return () => {
    const dbEncryptionKey = crypto.getRandomValues(new Uint8Array(32))
    return Client.createOrBuild(signer, {
      env: 'dev',
      appVersion,
      codecs: supportedCodecs,
      dbEncryptionKey,
    })
  }
}
