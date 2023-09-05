export class PreparedMessage {
  messageId: string;
  onSend: () => Promise<void>;

  constructor(messageId: string, onSend: () => Promise<void>) {
    this.messageId = messageId;
    this.onSend = onSend;
  }

  async send() {
    await this.onSend();
  }
}
