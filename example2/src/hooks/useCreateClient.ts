import {
  Client,
  GroupUpdatedCodec,
  ReactionCodec,
  ReplyCodec,
  RemoteAttachmentCodec,
  StaticAttachmentCodec,
  Signer,
} from '@xmtp/react-native-sdk'
import { WalletClient } from 'viem'

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
    getChainId: () => walletClient.chain?.id ?? 0,
    getBlockNumber: () => undefined,
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
