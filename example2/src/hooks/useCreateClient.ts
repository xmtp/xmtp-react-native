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
const dbEncryptionKey = new Uint8Array([
  199, 210, 98, 150, 185, 165, 85, 228, 236, 99, 219, 252, 171, 94, 144, 152,
  138, 210, 67, 180, 13, 43, 67, 193, 111, 237, 165, 207, 216, 47, 248, 182,
])

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
  console.log('hi 4')

  return async () => {
    console.log('Client create or bhuld')
    try {
      const foo = await Client.createOrBuild(signer, {
        env: 'dev',
        appVersion,
        codecs: supportedCodecs,
        dbEncryptionKey,
      })
      console.log({ foo })
      return foo
    } catch (e) {
      console.log({ e })
    } finally {
      console.log('finally something')
    }
  }
}
