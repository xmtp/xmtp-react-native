import { createContext, useContext, useMemo, useState } from "react";
import * as XMTP from "xmtp-react-native-sdk";

const XmtpContext = createContext<{
  client: XMTP.Client | null;
  setClient: (client: XMTP.Client | null) => void;
}>({
  client: null,
  setClient: () => {},
});
export const useXmtp = () => useContext(XmtpContext);
export function XmtpContextProvider({ children }) {
  let [client, setClient] = useState<XMTP.Client | null>(null);
  let context = useMemo(() => ({ client, setClient }), [client, setClient]);
  return (
    <XmtpContext.Provider value={context}>{children}</XmtpContext.Provider>
  );
}
