import { useContext } from 'react'

import { XmtpContext } from '../context/XmtpContext'

export const useXmtp = () => useContext(XmtpContext)
