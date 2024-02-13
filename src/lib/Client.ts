import { splitSignature } from '@ethersproject/bytes'
import { Subscription } from 'expo-modules-core'
import type { WalletClient } from 'viem'

import Contacts from './Contacts'
import type {
  DecryptedLocalAttachment,
  EncryptedLocalAttachment,
  PreparedLocalMessage,
} from './ContentCodec'
import Conversations from './Conversations'
import { TextCodec } from './NativeCodecs/TextCodec'
import { Query } from './Query'
import { Signer, getSigner } from './Signer'
import { DefaultContentTypes } from './types/DefaultContentType'
import { hexToBytes } from './util'
import * as XMTPModule from '../index'
import { DecodedMessage } from '../index'

declare const Buffer

export type GetMessageContentTypeFromClient<C> = C extends Client<infer T>
  ? T
  : never

export type ExtractDecodedType<C> = C extends XMTPModule.ContentCodec<infer T>
  ? T
  : never

export class Client<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
> {
  address: string
  conversations: Conversations<ContentTypes>
  contacts: Contacts
  codecRegistry: { [key: string]: XMTPModule.ContentCodec<unknown> }
  private static signSubscription: Subscription | null = null
  private static authSubscription: Subscription | null = null

  /**
   * Creates a new instance of the Client class using the provided signer.
   *
   * @param {Signer} signer - The signer object used for authentication and message signing.
   * @param {Partial<ClientOptions>} opts - Optional configuration options for the Client.
   * @returns {Promise<Client>} A Promise that resolves to a new Client instance.
   *
   * See {@link https://xmtp.org/docs/build/authentication#create-a-client | XMTP Docs} for more information.
   */
  static async create<
    ContentCodecs extends DefaultContentTypes = DefaultContentTypes,
  >(
    wallet: Signer | WalletClient | null,
    opts?: Partial<ClientOptions> & { codecs?: ContentCodecs }
  ): Promise<Client<DefaultContentTypes>> {
    const options = defaultOptions(opts)
    const { enableSubscription, createSubscription } =
      this.setupSubscriptions(options)
    const signer = getSigner(wallet)
    if (!signer) {
      throw new Error('Signer is not configured')
    }
    return new Promise<Client<DefaultContentTypes>>((resolve, reject) => {
      ;(async () => {
        this.signSubscription = XMTPModule.emitter.addListener(
          'sign',
          async (message: { id: string; message: string }) => {
            const request: { id: string; message: string } = message
            try {
              const signatureString = await signer.signMessage(request.message)
              const eSig = splitSignature(signatureString)
              const r = hexToBytes(eSig.r)
              const s = hexToBytes(eSig.s)
              const sigBytes = new Uint8Array(65)
              sigBytes.set(r)
              sigBytes.set(s, r.length)
              sigBytes[64] = eSig.recoveryParam

              const signature = Buffer.from(sigBytes).toString('base64')

              XMTPModule.receiveSignature(request.id, signature)
            } catch (e) {
              const errorMessage = 'ERROR in create. User rejected signature'
              console.info(errorMessage, e)
              this.removeSubscription(enableSubscription)
              this.removeSubscription(createSubscription)
              this.removeSignSubscription()
              this.removeAuthSubscription()
              reject(errorMessage)
            }
          }
        )

        this.authSubscription = XMTPModule.emitter.addListener(
          'authed',
          async () => {
            this.removeSubscription(enableSubscription)
            this.removeSubscription(createSubscription)
            this.removeSignSubscription()
            this.removeAuthSubscription()
            const address = await signer.getAddress()
            resolve(new Client(address, opts?.codecs || []))
          }
        )
        XMTPModule.auth(
          await signer.getAddress(),
          options.env,
          options.appVersion,
          Boolean(createSubscription),
          Boolean(enableSubscription),
          Boolean(options.enableAlphaMls)
        )
      })()
    })
  }

  private static removeSignSubscription(): void {
    if (this.signSubscription) {
      this.signSubscription.remove()
      this.signSubscription = null
    }
  }

  private static removeAuthSubscription(): void {
    if (this.authSubscription) {
      this.authSubscription.remove()
      this.authSubscription = null
    }
  }

  /**
   * Creates a new instance of the XMTP Client with a randomly generated address.
   *
   * @param {Partial<ClientOptions>} opts - Optional configuration options for the Client.
   * @returns {Promise<Client>} A Promise that resolves to a new Client instance with a random address.
   */
  static async createRandom<ContentTypes extends DefaultContentTypes>(
    opts?: Partial<ClientOptions> & { codecs?: ContentTypes }
  ): Promise<Client<ContentTypes>> {
    const options = defaultOptions(opts)
    const { enableSubscription, createSubscription } =
      this.setupSubscriptions(options)
    const address = await XMTPModule.createRandom(
      options.env,
      options.appVersion,
      Boolean(createSubscription),
      Boolean(enableSubscription),
      Boolean(options.enableAlphaMls)
    )
    this.removeSubscription(enableSubscription)
    this.removeSubscription(createSubscription)

    return new Client(address, opts?.codecs || [])
  }

  /**
   * Creates a new instance of the Client class from a provided key bundle.
   *
   * This method is useful for scenarios where you want to manually handle private key storage,
   * allowing the application to have access to XMTP keys without exposing wallet keys.
   *
   * @param {string} keyBundle - The key bundle used for address generation.
   * @param {Partial<ClientOptions>} opts - Optional configuration options for the Client.
   * @returns {Promise<Client>} A Promise that resolves to a new Client instance based on the provided key bundle.
   */
  static async createFromKeyBundle<
    ContentCodecs extends DefaultContentTypes = [],
  >(
    keyBundle: string,
    opts?: Partial<ClientOptions> & { codecs?: ContentCodecs }
  ): Promise<Client<DefaultContentTypes>> {
    const options = defaultOptions(opts)
    const address = await XMTPModule.createFromKeyBundle(
      keyBundle,
      options.env,
      options.appVersion,
      Boolean(options.enableAlphaMls)
    )
    return new Client(address, opts?.codecs || [])
  }

  /**
   * Determines whether the current user can send messages to a specified peer.
   *
   * This method checks if the specified peer has signed up for XMTP
   * and ensures that the message is not addressed to the sender (no self-messaging).
   *
   * @param {string} peerAddress - The address of the peer to check for messaging eligibility.
   * @returns {Promise<boolean>} A Promise resolving to true if messaging is allowed, and false otherwise.
   */
  async canMessage(peerAddress: string): Promise<boolean> {
    return await XMTPModule.canMessage(this.address, peerAddress)
  }

  /**
   * Static method to determine if the address is currently in our network.
   *
   * This method checks if the specified peer has signed up for XMTP.
   *
   * @param {string} peerAddress - The address of the peer to check for messaging eligibility.
   * @param {Partial<ClientOptions>} opts - Optional configuration options for the Client.
   * @returns {Promise<boolean>}
   */
  static async canMessage(
    peerAddress: string,
    opts?: Partial<ClientOptions>
  ): Promise<boolean> {
    const options = defaultOptions(opts)
    return await XMTPModule.staticCanMessage(
      peerAddress,
      options.env,
      options.appVersion
    )
  }

  private static addSubscription(
    event: string,
    opts: ClientOptions,
    callback: () => Promise<void> | void
  ): Subscription | undefined {
    if (this.hasEventCallback(event, opts)) {
      return XMTPModule.emitter.addListener(event, callback)
    }
    return undefined
  }

  private static async executeCallback(
    callback?: () => Promise<void> | void
  ): Promise<void> {
    await callback?.()
  }

  private static hasEventCallback(event: string, opts: ClientOptions): boolean {
    return opts?.[event] !== undefined
  }

  private static async removeSubscription(
    subscription?: Subscription
  ): Promise<void> {
    if (subscription) {
      subscription.remove()
    }
  }

  private static setupSubscriptions(opts: ClientOptions): {
    enableSubscription?: Subscription
    createSubscription?: Subscription
  } {
    const enableSubscription = this.addSubscription(
      'preEnableIdentityCallback',
      opts,
      async () => {
        await this.executeCallback(opts?.preEnableIdentityCallback)
        XMTPModule.preEnableIdentityCallbackCompleted()
      }
    )

    const createSubscription = this.addSubscription(
      'preCreateIdentityCallback',
      opts,
      async () => {
        await this.executeCallback(opts?.preCreateIdentityCallback)
        XMTPModule.preCreateIdentityCallbackCompleted()
      }
    )

    return { enableSubscription, createSubscription }
  }

  constructor(
    address: string,
    codecs: XMTPModule.ContentCodec<ContentTypes>[] = []
  ) {
    this.address = address
    this.conversations = new Conversations(this)
    this.contacts = new Contacts(this)
    this.codecRegistry = {}

    this.register(new TextCodec())

    for (const codec of codecs) {
      this.register(codec)
    }
  }

  register<T, Codec extends XMTPModule.ContentCodec<T>>(contentCodec: Codec) {
    const id = `${contentCodec.contentType.authorityId}/${contentCodec.contentType.typeId}:${contentCodec.contentType.versionMajor}.${contentCodec.contentType.versionMinor}`
    this.codecRegistry[id] = contentCodec
  }

  /**
   * Exports the key bundle associated with the current XMTP address.
   *
   * This method allows you to obtain the unencrypted key bundle for the current XMTP address.
   * Ensure the exported keys are stored securely and encrypted.
   *
   * @returns {Promise<string>} A Promise that resolves to the unencrypted key bundle for the current XMTP address.
   */
  async exportKeyBundle(): Promise<string> {
    return XMTPModule.exportKeyBundle(this.address)
  }

  // TODO: support persisting conversations for quick lookup
  // async importConversation(exported: string): Promise<Conversation> { ... }
  // async exportConversation(topic: string): Promise<string> { ... }

  /**
   * Retrieves a list of batch messages based on the provided queries.
   *
   * This method pulls messages associated from multiple conversation with the current address
   * and specified queries.
   *
   * @param {Query[]} queries - An array of queries to filter the batch messages.
   * @returns {Promise<DecodedMessage[]>} A Promise that resolves to a list of batch messages.
   * @throws {Error} The error is logged, and the method gracefully returns an empty array.
   */
  async listBatchMessages(
    queries: Query[]
  ): Promise<DecodedMessage<ContentTypes>[]> {
    try {
      return await XMTPModule.listBatchMessages<ContentTypes>(this, queries)
    } catch (e) {
      console.info('ERROR in listBatchMessages', e)
      return []
    }
  }

  /**
   * Encrypts a local attachment for secure transmission.
   *
   * This asynchronous method takes a file, checks if it's a local file URI,
   * and encrypts the attachment for secure transmission.
   * @param {DecryptedLocalAttachment} file - The local attachment to be encrypted.
   * @returns {Promise<EncryptedLocalAttachment>} A Promise that resolves to the encrypted local attachment.
   * @throws {Error} Throws an error if the attachment is not a local file URI (must start with "file://").
   */
  async encryptAttachment(
    file: DecryptedLocalAttachment
  ): Promise<EncryptedLocalAttachment> {
    if (!file.fileUri?.startsWith('file://')) {
      throw new Error('the attachment must be a local file:// uri')
    }
    return await XMTPModule.encryptAttachment(this.address, file)
  }

  /**
   * Decrypts an encrypted local attachment.
   *
   * This asynchronous method takes an encrypted local attachment and decrypts it.
   * @param {EncryptedLocalAttachment} encryptedFile - The encrypted local attachment to be decrypted.
   * @returns {Promise<DecryptedLocalAttachment>} A Promise that resolves to the decrypted local attachment.
   * @throws {Error} Throws an error if the attachment is not a local file URI (must start with "file://").
   */
  async decryptAttachment(
    encryptedFile: EncryptedLocalAttachment
  ): Promise<DecryptedLocalAttachment> {
    if (!encryptedFile.encryptedLocalFileUri?.startsWith('file://')) {
      throw new Error('the attachment must be a local file:// uri')
    }
    return await XMTPModule.decryptAttachment(this.address, encryptedFile)
  }

  /**
   * Sends a prepared message.
   *
   * @param {PreparedLocalMessage} prepared - The prepared local message to be sent.
   * @returns {Promise<string>} A Promise that resolves to a string identifier for the sent message.
   * @throws {Error} Throws an error if there is an issue with sending the prepared message.
   */
  async sendPreparedMessage(prepared: PreparedLocalMessage): Promise<string> {
    try {
      return await XMTPModule.sendPreparedMessage(this.address, prepared)
    } catch (e) {
      console.info('ERROR in sendPreparedMessage()', e)
      throw e
    }
  }
}

export type ClientOptions = {
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

  /**
   * Set optional callbacks for handling identity setup
   */
  preCreateIdentityCallback?: () => Promise<void> | void
  preEnableIdentityCallback?: () => Promise<void> | void
  /**
   * Specify whether to enable Alpha version of MLS (Group Chat)
   */
  enableAlphaMls?: boolean
}

/**
 * Provide a default client configuration. These settings can be used on their own, or as a starting point for custom configurations
 *
 * @param opts additional options to override the default settings
 */
export function defaultOptions(opts?: Partial<ClientOptions>): ClientOptions {
  const _defaultOptions: ClientOptions = {
    env: 'dev',
    enableAlphaMls: false,
  }

  return { ..._defaultOptions, ...opts } as ClientOptions
}
