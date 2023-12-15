import * as React from 'react'

import { Client } from '../lib/Client'

export interface XmtpContextValue {
  /**
   * The XMTP client instance
   */
  client: Client<any> | null
  /**
   * Set the XMTP client instance
   */
  setClient: React.Dispatch<React.SetStateAction<Client<any> | null>>
}

export const XmtpContext = React.createContext<XmtpContextValue>({
  client: null,
  setClient: () => {},
})
interface Props {
  children: React.ReactNode
  client?: Client<any>
}
export const XmtpProvider: React.FC<Props> = ({
  children,
  client: initialClient,
}) => {
  const [client, setClient] = React.useState<Client<any> | null>(
    initialClient ?? null
  )
  const context = React.useMemo(
    () => ({ client, setClient }),
    [client, setClient]
  )
  return <XmtpContext.Provider value={context}>{children}</XmtpContext.Provider>
}
