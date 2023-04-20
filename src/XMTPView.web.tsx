import * as React from 'react';

import { XMTPViewProps } from './XMTP.types';

export default function XMTPView(props: XMTPViewProps) {
  return (
    <div>
      <span>{props.name}</span>
    </div>
  );
}
