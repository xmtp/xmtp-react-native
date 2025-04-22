import { content } from '@xmtp/proto'
import { Wallet } from 'ethers'
import RNFS from 'react-native-fs'
import { PreferenceUpdates } from 'xmtp-react-native-sdk/lib/PrivatePreferences'

import {
  Test,
  assert,
  createClients,
} from './test-utils'
import {
  Client,
} from '../../../src/index'

import { ContentTypeWalletSendCalls, WalletSendCallsCodec, WalletSendCallsParams } from '@xmtp/content-type-wallet-send-calls'

export const conversationTests: Test[] = []
let counter = 1
function test(name: string, perform: () => Promise<boolean>) {
  conversationTests.push({
    name: String(counter++) + '. ' + name,
    run: perform,
  })
}

test('can you wallet send content type from js', async () => {
  const [alixClient, boClient] = await createClients(2)  

  Client.register(new WalletSendCallsCodec())

  const alixGroup = await alixClient.conversations.newGroup([boClient.inboxId])

  const walletSendCalls: WalletSendCallsParams = {
    version: "1.0",
    from: "0x123...abc",
    chainId: "0x2105",
    calls: [
      {
        to: "0x456...def",
        value: "0x5AF3107A4000",
        metadata: {
          description: "Send 0.0001 ETH on base to 0x456...def",
          transactionType: "transfer",
          currency: "ETH",
          amount: 100000000000000,
          decimals: 18,
          toAddress: "0x456...def",
        },
      },
      {
        to: "0x789...cba",
        data: "0xdead...beef",
        metadata: {
          description: "Lend 10 USDC on base with Morpho @ 8.5% APY",
          transactionType: "lend",
          currency: "USDC",
          amount: 10000000,
          decimals: 6,
          platform: "morpho",
          apy: "8.5",
        },
      },
    ],
  };

  await alixGroup.send(walletSendCalls, {
    contentType: ContentTypeWalletSendCalls,
  });

  await boClient.conversations.sync()
  const boGroup = await boClient.conversations.findConversation(alixGroup.id)
  await boGroup?.sync()
  const boMessages = await boGroup?.messages()
  assert(boMessages?.length === 1, 'did not get messages')

  const boMessage = boMessages?.[0]
  const boMessageContent: WalletSendCallsParams = boMessage?.content()

  assert(boMessageContent.version === "1.0", 'version should be 1.0')
  assert(boMessageContent.from === "0x123...abc", 'from should be 0x123...abc')
  assert(boMessageContent.chainId === "0x2105", 'chainId should be 0x2105')
  assert(boMessageContent.calls.length === 2, 'calls should have 2 calls')
  assert(boMessageContent.calls[0].to === "0x456...def", 'to should be 0x456...def')
  assert(boMessageContent.calls[0].value === "0x5AF3107A4000", 'value should be 0x5AF3107A4000')
  assert(boMessageContent.calls[0].metadata?.description === "Send 0.0001 ETH on base to 0x456...def", 'description should be Send 0.0001 ETH on base to 0x456...def')
  assert(boMessageContent.calls[0].metadata?.transactionType === "transfer", 'transactionType should be transfer')
  assert(boMessageContent.calls[0].metadata?.currency === "ETH", 'currency should be ETH')
  assert(boMessageContent.calls[0].metadata?.amount === 100000000000000, 'amount should be 100000000000000')
  assert(boMessageContent.calls[0].metadata?.decimals === 18, 'decimals should be 18')
  assert(boMessageContent.calls[0].metadata?.toAddress === "0x456...def", 'toAddress should be 0x456...def')
  assert(boMessageContent.calls[1].to === "0x789...cba", 'to should be 0x789...cba')
  assert(boMessageContent.calls[1].data === "0xdead...beef", 'data should be 0xdead...beef')

  return true
})