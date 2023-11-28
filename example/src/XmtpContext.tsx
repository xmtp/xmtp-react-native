import {
  createContext,
  FC,
  ReactNode,
  useContext,
  useMemo,
  useState,
} from 'react'
import * as XMTP from 'xmtp-react-native-sdk'

const XmtpContext = createContext<{
  client: XMTP.Client | null
  setClient: (client: XMTP.Client | null) => void
}>({
  client: null,
  setClient: () => {},
})
export const useXmtp = () => useContext(XmtpContext)
type Props = {
  children: ReactNode
}
export const XmtpContextProvider: FC<Props> = ({ children }) => {
  const [client, setClient] = useState<XMTP.Client | null>(null)
  const context = useMemo(() => ({ client, setClient }), [client, setClient])
  return <XmtpContext.Provider value={context}>{children}</XmtpContext.Provider>
}
