import { Signer, utils } from 'ethers'

import Contacts from './Contacts'
import type {
  DecryptedLocalAttachment,
  EncryptedLocalAttachment,
  PreparedLocalMessage,
} from './ContentCodec'
import Conversations from './Conversations'
import { DecodedMessage } from './DecodedMessage'
import { Query } from './Query'
import { hexToBytes } from './util'
import * as XMTPModule from '../index'

declare const Buffer
export class Client {
  address: string
  conversations: Conversations
  contacts: Contacts
  codecRegistry: { [key: string]: XMTPModule.ContentCodec<unknown> }

  static async create(
    signer: Signer,
    opts?: Partial<ClientOptions>
  ): Promise<Client> {
    const options = defaultOptions(opts)
    return new Promise<Client>((resolve, reject) => {
      ;(async () => {
        XMTPModule.emitter.addListener(
          'sign',
          async (message: { id: string; message: string }) => {
            const request: { id: string; message: string } = message
            const signatureString = await signer.signMessage(request.message)
            const eSig = utils.splitSignature(signatureString)
            const r = hexToBytes(eSig.r)
            const s = hexToBytes(eSig.s)
            const sigBytes = new Uint8Array(65)
            sigBytes.set(r)
            sigBytes.set(s, r.length)
            sigBytes[64] = eSig.recoveryParam

            const signature = Buffer.from(sigBytes).toString('base64')

            XMTPModule.receiveSignature(request.id, signature)
          }
        )

        XMTPModule.emitter.addListener('authed', async () => {
          const address = await signer.getAddress()
          resolve(new Client(address))
        })
        XMTPModule.auth(
          await signer.getAddress(),
          options.env,
          options.appVersion
        )
      })()
    })
  }

  static async createRandom(opts?: Partial<ClientOptions>): Promise<Client> {
    const options = defaultOptions(opts)
    const address = await XMTPModule.createRandom(
      options.env,
      options.appVersion
    )
    return new Client(address)
  }

  static async createFromKeyBundle(
    keyBundle: string,
    opts?: Partial<ClientOptions>
  ): Promise<Client> {
    const options = defaultOptions(opts)
    const address = await XMTPModule.createFromKeyBundle(
      keyBundle,
      options.env,
      options.appVersion
    )
    return new Client(address)
  }

  async canMessage(peerAddress: string): Promise<boolean> {
    return await XMTPModule.canMessage(this.address, peerAddress)
  }

  constructor(address: string) {
    this.address = address
    this.conversations = new Conversations(this)
    this.contacts = new Contacts(this)
    this.codecRegistry = {}
  }

  register<T, Codec extends XMTPModule.ContentCodec<T>>(contentCodec: Codec) {
    const id = `${contentCodec.contentType.authorityId}/${contentCodec.contentType.typeId}:${contentCodec.contentType.versionMajor}.${contentCodec.contentType.versionMinor}`
    this.codecRegistry[id] = contentCodec
  }

  async exportKeyBundle(): Promise<string> {
    return XMTPModule.exportKeyBundle(this.address)
  }

  // TODO: support persisting conversations for quick lookup
  // async importConversation(exported: string): Promise<Conversation> { ... }
  // async exportConversation(topic: string): Promise<string> { ... }

  async listBatchMessages(queries: Query[]): Promise<DecodedMessage[]> {
    try {
      return await XMTPModule.listBatchMessages(this, queries)
    } catch (e) {
      console.info('ERROR in listBatchMessages', e)
      return []
    }
  }

  async encryptAttachment(
    file: DecryptedLocalAttachment
  ): Promise<EncryptedLocalAttachment> {
    if (!file.fileUri?.startsWith('file://')) {
      throw new Error('the attachment must be a local file:// uri')
    }
    return await XMTPModule.encryptAttachment(this.address, file)
  }
  async decryptAttachment(
    encryptedFile: EncryptedLocalAttachment
  ): Promise<DecryptedLocalAttachment> {
    if (!encryptedFile.encryptedLocalFileUri?.startsWith('file://')) {
      throw new Error('the attachment must be a local file:// uri')
    }
    return await XMTPModule.decryptAttachment(this.address, encryptedFile)
  }

  async sendPreparedMessage(prepared: PreparedLocalMessage): Promise<string> {
    try {
      return await XMTPModule.sendPreparedMessage(this.address, prepared)
    } catch (e) {
      console.info('ERROR in sendPreparedMessage()', e)
      throw e
    }
  }
}

export type ClientOptions = NetworkOptions
export type NetworkOptions = {
  /**
   * Specify which XMTP environment to connect to. (default: `dev`)
   */
  env: 'local' | 'dev' | 'production'
  /**
   * identifier that's included with API requests.
   *
   * For example, you can use the following format:
   * `appVersion: APP_NAME + '/' + APP_VERSION`.
   * Setting this value provides telemetry that shows which apps are
   * using the XMTP client SDK. This information can help XMTP developers
   * provide app support, especially around communicating important
   * SDK updates, including deprecations and required upgrades.
   */
  appVersion?: string
}

/**
 * Provide a default client configuration. These settings can be used on their own, or as a starting point for custom configurations
 *
 * @param opts additional options to override the default settings
 */
export function defaultOptions(opts?: Partial<ClientOptions>): ClientOptions {
  const _defaultOptions: ClientOptions = {
    env: 'dev',
  }

  return { ..._defaultOptions, ...opts } as ClientOptions
}
