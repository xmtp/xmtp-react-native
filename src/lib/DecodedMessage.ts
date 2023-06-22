export class DecodedMessage {
  id: string;
  // TODO:
  // topic: string;
  content: any;
  senderAddress: string;
  sent: Date;

  constructor(params: {
    id: string;
    content: any;
    senderAddress: string;
    sent: Date;
  }) {
    this.id = params.id;
    this.content = params.content;
    this.senderAddress = params.senderAddress;
    this.sent = params.sent;
  }
};
