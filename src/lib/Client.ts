import { splitSignature } from '@ethersproject/bytes'
import { Subscription } from 'expo-modules-core'
import type { WalletClient } from 'viem'

import type {
  DecryptedLocalAttachment,
  EncryptedLocalAttachment,
} from './ContentCodec'
import Conversations from './Conversations'
import { InboxState } from './InboxState'
import { TextCodec } from './NativeCodecs/TextCodec'
import PrivatePreferences from './PrivatePreferences'
import { Signer, getSigner } from './Signer'
import { DefaultContentTypes } from './types/DefaultContentType'
import { hexToBytes } from './util'
import * as XMTPModule from '../index'

declare const Buffer

export type GetMessageContentTypeFromClient<C> =
  C extends Client<infer T> ? T : never

export type ExtractDecodedType<C> =
  C extends XMTPModule.ContentCodec<infer T> ? T : never

export type InstallationId = string & { readonly brand: unique symbol }
export type InboxId = string
export type Address = string

export class Client<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
> {
  address: Address
  inboxId: InboxId
  installationId: InstallationId
  dbPath: string
  conversations: Conversations<ContentTypes>
  preferences: PrivatePreferences
  static codecRegistry: { [key: string]: XMTPModule.ContentCodec<unknown> }
  private static signSubscription: Subscription | null = null
  private static authSubscription: Subscription | null = null

  static async exportNativeLogs() {
    return XMTPModule.exportNativeLogs()
  }

  private static removeAllSubscriptions(
    authInboxSubscription?: Subscription
  ): void {
    ;[
      authInboxSubscription,
      this.signSubscription,
      this.authSubscription,
    ].forEach((subscription) => subscription?.remove())

    this.signSubscription = null
    this.authSubscription = null
  }

  private static async handleSignatureRequest(
    signer: any,
    request: { id: string; message: string }
  ): Promise<void> {
    const signatureString = await signer.signMessage(request.message)

    if (signer.walletType?.() === 'SCW') {
      await XMTPModule.receiveSCWSignature(request.id, signatureString)
    } else {
      const eSig = splitSignature(signatureString)
      const r = hexToBytes(eSig.r)
      const s = hexToBytes(eSig.s)
      const sigBytes = new Uint8Array(65)
      sigBytes.set(r)
      sigBytes.set(s, r.length)
      sigBytes[64] = eSig.recoveryParam

      const signature = Buffer.from(sigBytes).toString('base64')
      await XMTPModule.receiveSignature(request.id, signature)
    }
  }

  /**
   * Creates a new instance of the XMTP Client with a randomly generated address.
   *
   * @param {Partial<ClientOptions>} opts - Configuration options for the Client. Must include encryption key.
   * @returns {Promise<Client>} A Promise that resolves to a new Client instance with a random address.
   */
  static async createRandom<ContentTypes extends DefaultContentTypes>(
    options: ClientOptions & { codecs?: ContentTypes }
  ): Promise<Client<ContentTypes>> {
    if (options.dbEncryptionKey.length !== 32) {
      throw new Error('Must pass an encryption key that is exactly 32 bytes.')
    }
    const { authInboxSubscription } = this.setupSubscriptions(options)
    const client = await XMTPModule.createRandom(
      options.env,
      options.dbEncryptionKey,
      options.appVersion,
      Boolean(authInboxSubscription),
      options.dbDirectory,
      options.historySyncUrl
    )
    this.removeSubscription(authInboxSubscription)

    return new Client(
      client['address'],
      client['inboxId'],
      client['installationId'],
      client['dbPath'],
      options?.codecs || []
    )
  }

  /**
   * Creates a new instance of the Client class using the provided signer.
   *
   * @param {Signer} signer - The signer object used for authentication and message signing.
   * @param {Partial<ClientOptions>} opts - Configuration options for the Client. Must include an encryption key.
   * @returns {Promise<Client>} A Promise that resolves to a new Client instance.
   *
   * See {@link https://xmtp.org/docs/build/authentication#create-a-client | XMTP Docs} for more information.
   */
  static async create<
    ContentCodecs extends DefaultContentTypes = DefaultContentTypes,
  >(
    wallet: Signer | WalletClient | null,
    options: ClientOptions & { codecs?: ContentCodecs }
  ): Promise<Client<ContentCodecs>> {
    if (options.dbEncryptionKey.length !== 32) {
      throw new Error('Must pass an encryption key that is exactly 32 bytes.')
    }
    const { authInboxSubscription } = this.setupSubscriptions(options)
    const signer = getSigner(wallet)
    if (!signer) {
      throw new Error('Signer is not configured')
    }

    return new Promise<Client<ContentCodecs>>((resolve, reject) => {
      ;(async () => {
        this.signSubscription = XMTPModule.emitter.addListener(
          'sign',
          async (message: { id: string; message: string }) => {
            try {
              await Client.handleSignatureRequest(signer, message)
            } catch (e) {
              const errorMessage = 'ERROR in create. User rejected signature'
              console.info(errorMessage, e)
              this.removeAllSubscriptions(authInboxSubscription)
              reject(errorMessage)
            }
          }
        )

        this.authSubscription = XMTPModule.emitter.addListener(
          'authed',
          async (message: {
            inboxId: string
            address: string
            installationId: string
            dbPath: string
          }) => {
            this.removeAllSubscriptions(authInboxSubscription)
            resolve(
              new Client(
                message.address,
                message.inboxId as InboxId,
                message.installationId as InstallationId,
                message.dbPath,
                options.codecs || []
              )
            )
          }
        )

        await XMTPModule.create(
          await signer.getAddress(),
          options.env,
          options.dbEncryptionKey,
          options.appVersion,
          Boolean(authInboxSubscription),
          options.dbDirectory,
          options.historySyncUrl,
          signer.walletType?.(),
          signer.getChainId?.(),
          signer.getBlockNumber?.()
        )
      })().catch((error) => {
        this.removeAllSubscriptions(authInboxSubscription)
        console.error('ERROR in create: ', error.message)
      })
    })
  }

  /**
   * Builds a instance of the Client class using the provided address and chainId if SCW.
   *
   * @param {string} address - The address of the account to build
   * @param {Partial<ClientOptions>} opts - Configuration options for the Client. Must include an encryption key.
   * @returns {Promise<Client>} A Promise that resolves to a new Client instance.
   *
   * See {@link https://xmtp.org/docs/build/authentication#create-a-client | XMTP Docs} for more information.
   */
  static async build<
    ContentCodecs extends DefaultContentTypes = DefaultContentTypes,
  >(
    address: Address,
    options: ClientOptions & { codecs?: ContentCodecs },
    inboxId?: InboxId | undefined
  ): Promise<Client<ContentCodecs>> {
    if (options.dbEncryptionKey.length !== 32) {
      throw new Error('Must pass an encryption key that is exactly 32 bytes.')
    }
    const client = await XMTPModule.build(
      address,
      options.env,
      options.dbEncryptionKey,
      options.appVersion,
      options.dbDirectory,
      options.historySyncUrl,
      inboxId
    )

    return new Client(
      client['address'],
      client['inboxId'],
      client['installationId'],
      client['dbPath'],
      options.codecs || []
    )
  }

  /**
   * Drop the client from memory. Use when you want to remove the client from memory and are done with it.
   */
  static async dropClient(installationId: InstallationId) {
    return await XMTPModule.dropClient(installationId)
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

  private static removeSubscription(subscription?: Subscription) {
    if (subscription) {
      subscription.remove()
    }
  }

  private static setupSubscriptions(opts: ClientOptions): {
    authInboxSubscription?: Subscription
  } {
    const authInboxSubscription = this.addSubscription(
      'preAuthenticateToInboxCallback',
      opts,
      async () => {
        await this.executeCallback(opts?.preAuthenticateToInboxCallback)
        XMTPModule.preAuthenticateToInboxCallbackCompleted()
      }
    )

    return { authInboxSubscription }
  }

  /**
   * Static method to determine the inboxId for the address.
   *
   * @param {Address} peerAddress - The address of the peer to check for messaging eligibility.
   * @param {XMTPEnvironment} env - Environment to get the inboxId from
   * @returns {Promise<InboxId>}
   */
  static async getOrCreateInboxId(
    address: Address,
    env: XMTPEnvironment
  ): Promise<InboxId> {
    return await XMTPModule.getOrCreateInboxId(address, env)
  }

  /**
   * Determines whether the current user can send messages to the specified peers.
   *
   * This method checks if the specified peers are using clients that are on the network.
   *
   * @param {Address[]} addresses - The addresses of the peers to check for messaging eligibility.
   * @param {XMTPEnvironment} env - Environment to see if the address is on the network for
   * @returns {Promise<{ [key: Address]: boolean }>} A Promise resolving to a hash of addresses and booleans if they can message on the network.
   */
  static async canMessage(
    env: XMTPEnvironment,
    addresses: Address[]
  ): Promise<{ [key: Address]: boolean }> {
    return await XMTPModule.staticCanMessage(env, addresses)
  }

  /**
   * Determines whether the current user can send messages to the specified peers.
   *
   * This method checks if the specified peers are using clients that are on the network.
   *
   * @param {InboxId[]} inboxIds - The inboxIds to get the associated inbox states for.
   * @param {XMTPEnvironment} env - Environment to see if the address is on the network for
   * @returns {Promise<InboxState[]>} A Promise resolving to a list of inbox states.
   */
  static async inboxStatesForInboxIds(
    env: XMTPEnvironment,
    inboxIds: InboxId[]
  ): Promise<InboxState[]> {
    return await XMTPModule.staticInboxStatesForInboxIds(env, inboxIds)
  }

  constructor(
    address: Address,
    inboxId: InboxId,
    installationId: InstallationId,
    dbPath: string,
    codecs: XMTPModule.ContentCodec<ContentTypes>[] = []
  ) {
    this.address = address
    this.inboxId = inboxId
    this.installationId = installationId
    this.dbPath = dbPath
    this.conversations = new Conversations(this)
    this.preferences = new PrivatePreferences(this)
    Client.codecRegistry = {}

    Client.register(new TextCodec())

    for (const codec of codecs) {
      Client.register(codec)
    }
  }

  static register<T, Codec extends XMTPModule.ContentCodec<T>>(
    contentCodec: Codec
  ) {
    const id = `${contentCodec.contentType.authorityId}/${contentCodec.contentType.typeId}:${contentCodec.contentType.versionMajor}.${contentCodec.contentType.versionMinor}`
    this.codecRegistry[id] = contentCodec
  }

  /**
   * Add this account to the current inboxId.
   * @param {Signer} newAccount - The signer of the new account to be added.
   */
  async addAccount(newAccount: Signer | WalletClient) {
    const signer = getSigner(newAccount)
    if (!signer) {
      throw new Error('Signer is not configured')
    }

    return new Promise<void>((resolve, reject) => {
      ;(async () => {
        Client.signSubscription = XMTPModule.emitter.addListener(
          'sign',
          async (message: { id: string; message: string }) => {
            try {
              await Client.handleSignatureRequest(signer, message)
            } catch (e) {
              const errorMessage =
                'ERROR in addAccount. User rejected signature'
              console.info(errorMessage, e)
              Client.signSubscription?.remove()
              reject(errorMessage)
            }
          }
        )

        await XMTPModule.addAccount(
          this.installationId,
          await signer.getAddress(),
          signer.walletType?.(),
          signer.getChainId?.(),
          signer.getBlockNumber?.()
        )
        Client.signSubscription?.remove()
        resolve()
      })().catch((error) => {
        Client.signSubscription?.remove()
        reject(error)
      })
    })
  }

  /**
   * Remove this account from the current inboxId.
   * @param {Signer} wallet - The signer object used for authenticate the removal.
   * @param {Address} addressToRemove - The address of the wallet you'd like to remove from the account.
   */
  async removeAccount(wallet: Signer | WalletClient, addressToRemove: Address) {
    const signer = getSigner(wallet)
    if (!signer) {
      throw new Error('Signer is not configured')
    }

    return new Promise<void>((resolve, reject) => {
      ;(async () => {
        Client.signSubscription = XMTPModule.emitter.addListener(
          'sign',
          async (message: { id: string; message: string }) => {
            try {
              await Client.handleSignatureRequest(signer, message)
            } catch (e) {
              const errorMessage =
                'ERROR in removeAccount. User rejected signature'
              console.info(errorMessage, e)
              Client.signSubscription?.remove()
              reject(errorMessage)
            }
          }
        )

        await XMTPModule.removeAccount(
          this.installationId,
          addressToRemove,
          signer.walletType?.(),
          signer.getChainId?.(),
          signer.getBlockNumber?.()
        )
        Client.signSubscription?.remove()
        resolve()
      })().catch((error) => {
        Client.signSubscription?.remove()
        reject(error)
      })
    })
  }

  /**
   * Revoke a list of installations.
   * @param {Signer} signer - The signer object used for authenticate the revoke.
   * @param {InstallationId[]} installationIds - A list of installationIds to revoke access to the inboxId.
   */
  async revokeInstallations(
    wallet: Signer | WalletClient | null,
    installationIds: InstallationId[]
  ) {
    const signer = getSigner(wallet)
    if (!signer) {
      throw new Error('Signer is not configured')
    }

    return new Promise<void>((resolve, reject) => {
      ;(async () => {
        Client.signSubscription = XMTPModule.emitter.addListener(
          'sign',
          async (message: { id: string; message: string }) => {
            try {
              await Client.handleSignatureRequest(signer, message)
            } catch (e) {
              const errorMessage =
                'ERROR in revokeInstallations. User rejected signature'
              console.info(errorMessage, e)
              Client.signSubscription?.remove()
              reject(errorMessage)
            }
          }
        )

        await XMTPModule.revokeInstallations(
          this.installationId,
          installationIds,
          signer.walletType?.(),
          signer.getChainId?.(),
          signer.getBlockNumber?.()
        )
        Client.signSubscription?.remove()
        resolve()
      })().catch((error) => {
        Client.signSubscription?.remove()
        reject(error)
      })
    })
  }

  /**
   * Revoke all other installations but the current one.
   * @param {Signer} signer - The signer object used for authenticate the revoke.
   */
  async revokeAllOtherInstallations(wallet: Signer | WalletClient | null) {
    const signer = getSigner(wallet)
    if (!signer) {
      throw new Error('Signer is not configured')
    }

    return new Promise<void>((resolve, reject) => {
      ;(async () => {
        Client.signSubscription = XMTPModule.emitter.addListener(
          'sign',
          async (message: { id: string; message: string }) => {
            try {
              await Client.handleSignatureRequest(signer, message)
            } catch (e) {
              const errorMessage =
                'ERROR in revokeAllOtherInstallations. User rejected signature'
              console.info(errorMessage, e)
              Client.signSubscription?.remove()
              reject(errorMessage)
            }
          }
        )

        await XMTPModule.revokeAllOtherInstallations(
          this.installationId,
          signer.walletType?.(),
          signer.getChainId?.(),
          signer.getBlockNumber?.()
        )
        Client.signSubscription?.remove()
        resolve()
      })().catch((error) => {
        Client.signSubscription?.remove()
        reject(error)
      })
    })
  }

  /**
   * Sign this message with the current installation key.
   * @param {string} message - The message to sign.
   * @returns {Promise<Uint8Array>} A Promise resolving to the signature bytes.
   */
  async signWithInstallationKey(message: string): Promise<Uint8Array> {
    return await XMTPModule.signWithInstallationKey(
      this.installationId,
      message
    )
  }

  /**
   * Verify the signature was signed with this clients installation key.
   * @param {string} message - The message that was signed.
   * @param {Uint8Array} signature - The signature.
   * @returns {Promise<boolean>} A Promise resolving to a boolean if the signature verified or not.
   */
  async verifySignature(
    message: string,
    signature: Uint8Array
  ): Promise<boolean> {
    return await XMTPModule.verifySignature(
      this.installationId,
      message,
      signature
    )
  }

  /**
   * Find the Address associated with this address
   *
   * @param {string} peerAddress - The address of the peer to check for inboxId.
   * @returns {Promise<InboxId>} A Promise resolving to the InboxId.
   */
  async findInboxIdFromAddress(
    peerAddress: Address
  ): Promise<InboxId | undefined> {
    return await XMTPModule.findInboxIdFromAddress(
      this.installationId,
      peerAddress
    )
  }

  /**
   * Deletes the local database. This cannot be undone and these stored messages will not be refetched from the network.
   */
  async deleteLocalDatabase() {
    return await XMTPModule.deleteLocalDatabase(this.installationId)
  }

  /**
   * Drop the local database connection. This function is delicate and should be used with caution. App will error if database not properly reconnected. See: reconnectLocalDatabase()
   */
  async dropLocalDatabaseConnection() {
    return await XMTPModule.dropLocalDatabaseConnection(this.installationId)
  }

  /**
   * Reconnects the local database after being dropped.
   */
  async reconnectLocalDatabase() {
    return await XMTPModule.reconnectLocalDatabase(this.installationId)
  }

  /**
   * Make a request for your inbox state.
   *
   * @param {boolean} refreshFromNetwork - If you want to refresh the current state of in the inbox from the network or not.
   * @returns {Promise<InboxState>} A Promise resolving to a InboxState.
   */
  async inboxState(refreshFromNetwork: boolean): Promise<InboxState> {
    return await XMTPModule.getInboxState(
      this.installationId,
      refreshFromNetwork
    )
  }

  /**
   * Make a request for a list of inbox states.
   *
   * @param {InboxId[]} inboxIds - The inboxIds to get the associate inbox states for.
   * @param {boolean} refreshFromNetwork - If you want to refresh the current state the inbox from the network or not.
   * @returns {Promise<InboxState[]>} A Promise resolving to a list of InboxState.
   */
  async inboxStates(
    refreshFromNetwork: boolean,
    inboxIds: InboxId[]
  ): Promise<InboxState[]> {
    return await XMTPModule.getInboxStates(
      this.installationId,
      refreshFromNetwork,
      inboxIds
    )
  }

  /**
   * Determines whether the current user can send messages to the specified peers.
   *
   * This method checks if the specified peers are using clients that are on the network.
   *
   * @param {Address[]} addresses - The addresses of the peers to check for messaging eligibility.
   * @returns {Promise<{ [key: Address]: boolean }>} A Promise resolving to a hash of addresses and booleans if they can message on the network.
   */
  async canMessage(addresses: Address[]): Promise<{ [key: Address]: boolean }> {
    return await XMTPModule.canMessage(this.installationId, addresses)
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
    return await XMTPModule.encryptAttachment(this.installationId, file)
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
    return await XMTPModule.decryptAttachment(
      this.installationId,
      encryptedFile
    )
  }
}

export type XMTPEnvironment = 'local' | 'dev' | 'production'

export type ClientOptions = {
  /**
   * Specify which XMTP environment to connect to. (default: `dev`)
   */
  env: XMTPEnvironment
  /**
   * REQUIRED specify the encryption key for the database. The encryption key must be exactly 32 bytes.
   */
  dbEncryptionKey: Uint8Array
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
  preAuthenticateToInboxCallback?: () => Promise<void> | void
  /**
   * OPTIONAL specify the XMTP managed database directory
   */
  dbDirectory?: string
  /**
   * OPTIONAL specify a url to sync message history from
   */
  historySyncUrl?: string
}

export type KeyType = {
  kind: 'identity' | 'prekey'
  prekeyIndex?: number
}
