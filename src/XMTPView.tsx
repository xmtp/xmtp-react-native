import { requireNativeViewManager } from 'expo-modules-core';
import * as React from 'react';

import { XMTPViewProps } from './XMTP.types';

const NativeView: React.ComponentType<XMTPViewProps> =
  requireNativeViewManager('XMTP');

export default function XMTPView(props: XMTPViewProps) {
  return <NativeView {...props} />;
}
