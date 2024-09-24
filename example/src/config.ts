import {
  createConnectorFromWallet,
  Wallets,
} from '@mobile-wallet-protocol/wagmi-connectors'
import * as Linking from 'expo-linking'
import { createConfig, http } from 'wagmi'
import { base } from 'wagmi/chains'

const PREFIX_URL = Linking.createURL('/')

const metadata = {
  appDeeplinkUrl: PREFIX_URL,
  appName: 'Smart ContractWalletDemo App',
}

export const config = createConfig({
  chains: [base],
  connectors: [
    createConnectorFromWallet({
      metadata,
      wallet: Wallets.CoinbaseSmartWallet,
    }),
  ],
  transports: {
    [base.id]: http(),
  },
})
