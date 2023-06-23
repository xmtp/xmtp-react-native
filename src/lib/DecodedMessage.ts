import { EncodedContent } from "../XMTP.types";

export type DecodedMessage = {
  id: string;
  // TODO:
  // topic: string;
  content: EncodedContent;
  senderAddress: string;
  sent: Date;
};
