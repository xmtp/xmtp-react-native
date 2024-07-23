import { useCallback, useRef, useState } from 'react'

import { useXmtp } from './useXmtp'
import { Client, ClientOptions } from '../lib/Client'
import { Signer } from '../lib/Signer'
import { DefaultContentTypes } from '../lib/types/DefaultContentType'

interface InitializeClientOptions {
  signer: Signer | null
  options: ClientOptions
}

export const useClient = <
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
>(
  onError?: (e: Error) => void
) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  // client is initializing
  const initializingRef = useRef(false)

  const { client, setClient } = useXmtp()
  /**
   * Initialize an XMTP client
   */
  const initialize = useCallback(
    async ({ options, signer }: InitializeClientOptions) => {
      // only initialize a client if one doesn't already exist
      if (!client && signer) {
        // if the client is already initializing, don't do anything
        if (initializingRef.current) {
          return undefined
        }

        // flag the client as initializing
        initializingRef.current = true

        // reset error state
        setError(null)
        // reset loading state
        setIsLoading(true)

        let xmtpClient: Client<any>

        try {
          // create a new XMTP client with the provided keys, or a wallet
          xmtpClient = await Client.create(signer ?? null, {
            ...options,
          })
          setClient(xmtpClient)
        } catch (e) {
          setClient(null)
          setError(e as Error)
          onError?.(e as Error)
          // re-throw error for upstream consumption
          throw e
        }

        setIsLoading(false)

        return xmtpClient
      }
      return client
    },
    [client, onError, setClient]
  )

  /**
   * Disconnect the XMTP client
   */
  const disconnect = useCallback(async () => {
    if (client) {
      setClient(null)
    }
  }, [client, setClient])

  return {
    client: client as Client<ContentTypes> | null,
    error,
    initialize,
    disconnect,
    isLoading,
  }
}
