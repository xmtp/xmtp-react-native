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
import { PublicIdentity } from './PublicIdentity'
import { Signer, getSigner } from './Signer'
import XMTPDebugInformation from './XMTPDebugInformation'
import { DefaultContentTypes } from './types/DefaultContentType'
import { hexToBytes } from './util'
import * as XMTPModule from '../index'
import { LogLevel, LogRotation } from './types'

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
  inboxId: InboxId
  installationId: InstallationId
  dbPath: string
  publicIdentity: PublicIdentity
  conversations: Conversations<ContentTypes>
  preferences: PrivatePreferences
  debugInformation: XMTPDebugInformation
  environment: XMTPEnvironment
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
    const signedData = await signer.signMessage(request.message)

    if (signer.signerType?.() === 'SCW') {
      await XMTPModule.receiveSignature(request.id, signedData.signature)
    } else {
      const eSig = splitSignature(signedData.signature)
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
      Boolean(authInboxSubscription),
      options.dbDirectory,
      options.historySyncUrl,
      options.customLocalHost,
      options.deviceSyncEnabled,
      options.debugEventsEnabled
    )
    this.removeSubscription(authInboxSubscription)

    return new Client(
      client['inboxId'],
      client['installationId'],
      client['dbPath'],
      PublicIdentity.from(client['publicIdentity']),
      options.env,
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
    signer: Signer | WalletClient | null,
    options: ClientOptions & { codecs?: ContentCodecs }
  ): Promise<Client<ContentCodecs>> {
    if (options.dbEncryptionKey.length !== 32) {
      throw new Error('Must pass an encryption key that is exactly 32 bytes.')
    }
    const { authInboxSubscription } = this.setupSubscriptions(options)
    const signingKey = getSigner(signer)
    if (!signingKey) {
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
            installationId: string
            dbPath: string
            publicIdentity: string
          }) => {
            this.removeAllSubscriptions(authInboxSubscription)
            resolve(
              new Client(
                message.inboxId as InboxId,
                message.installationId as InstallationId,
                message.dbPath,
                PublicIdentity.from(message.publicIdentity),
                options.env,
                options.codecs || []
              )
            )
          }
        )

        await XMTPModule.create(
          await signingKey.getIdentifier(),
          options.env,
          options.dbEncryptionKey,
          Boolean(authInboxSubscription),
          options.dbDirectory,
          options.historySyncUrl,
          signingKey.signerType?.(),
          signingKey.getChainId?.(),
          signingKey.getBlockNumber?.(),
          options.customLocalHost,
          options.deviceSyncEnabled,
          options.debugEventsEnabled
        )
      })().catch((error) => {
        this.removeAllSubscriptions(authInboxSubscription)
        console.error('ERROR in create: ', error.message)
        reject(error)
      })
    })
  }

  /**
   * Builds a instance of the Client class using the provided identity and chainId if SCW.
   *
   * @param {PublicIdentity} identity - The identity of the account to build
   * @param {Partial<ClientOptions>} opts - Configuration options for the Client. Must include an encryption key.
   * @returns {Promise<Client>} A Promise that resolves to a new Client instance.
   *
   * See {@link https://xmtp.org/docs/build/authentication#create-a-client | XMTP Docs} for more information.
   */
  static async build<
    ContentCodecs extends DefaultContentTypes = DefaultContentTypes,
  >(
    identity: PublicIdentity,
    options: ClientOptions & { codecs?: ContentCodecs },
    inboxId?: InboxId | undefined
  ): Promise<Client<ContentCodecs>> {
    if (options.dbEncryptionKey.length !== 32) {
      throw new Error('Must pass an encryption key that is exactly 32 bytes.')
    }
    const client = await XMTPModule.build(
      identity,
      options.env,
      options.dbEncryptionKey,
      options.dbDirectory,
      options.historySyncUrl,
      inboxId,
      options.customLocalHost,
      options.deviceSyncEnabled,
      options.debugEventsEnabled
    )

    return new Client(
      client['inboxId'],
      client['installationId'],
      client['dbPath'],
      PublicIdentity.from(client['publicIdentity']),
      options.env,
      options.codecs || []
    )
  }

  /**
   * ⚠️ This function is delicate and should be used with caution.
   * Creating an FfiClient without signing or registering will create a broken experience use `create()` instead
   *
   * Creates a new instance of the Client class using the provided identity.
   *
   * @param {PublicIdentity} identity - The identity of the account to create
   * @param {Partial<ClientOptions>} opts - Configuration options for the Client. Must include an encryption key.
   * @returns {Promise<Client>} A Promise that resolves to a new Client instance.
   */
  static async ffiCreateClient<
    ContentCodecs extends DefaultContentTypes = DefaultContentTypes,
  >(
    identity: PublicIdentity,
    options: ClientOptions & { codecs?: ContentCodecs }
  ): Promise<Client<ContentCodecs>> {
    console.warn(
      '⚠️ This function is delicate and should be used with caution. ' +
        'Creating an FfiClient without signing or registering will create a broken experience use `create()` instead'
    )

    if (options.dbEncryptionKey.length !== 32) {
      throw new Error('Must pass an encryption key that is exactly 32 bytes.')
    }
    const client = await XMTPModule.ffiCreateClient(
      identity,
      options.env,
      options.dbEncryptionKey,
      options.dbDirectory,
      options.historySyncUrl,
      options.customLocalHost,
      options.deviceSyncEnabled,
      options.debugEventsEnabled
    )

    return new Client(
      client['inboxId'],
      client['installationId'],
      client['dbPath'],
      PublicIdentity.from(client['publicIdentity']),
      options.env,
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
   * Static method to determine the inboxId for the identity.
   *
   * @param {PublicIdentity} identity - The identity of the peer to check for messaging eligibility.
   * @param {XMTPEnvironment} env - Environment to get the inboxId from
   * @returns {Promise<InboxId>}
   */
  static async getOrCreateInboxId(
    identity: PublicIdentity,
    env: XMTPEnvironment
  ): Promise<InboxId> {
    return await XMTPModule.getOrCreateInboxId(identity, env)
  }

  /**
   * Determines whether the current user can send messages to the specified peers.
   *
   * This method checks if the specified peers are using clients that are on the network.
   *
   * @param {PublicIdentity[]} identities - The identities of the peers to check for messaging eligibility.
   * @param {XMTPEnvironment} env - Environment to see if the identity is on the network for
   * @returns {Promise<{ [key: string]: boolean }>} A Promise resolving to a hash of identifiers and booleans if they can message on the network.
   */
  static async canMessage(
    env: XMTPEnvironment,
    identities: PublicIdentity[]
  ): Promise<{ [key: string]: boolean }> {
    return await XMTPModule.staticCanMessage(env, identities)
  }

  /**
   * Determines whether the current user can send messages to the specified peers.
   *
   * This method checks if the specified peers are using clients that are on the network.
   *
   * @param {InboxId[]} inboxIds - The inboxIds to get the associated inbox states for.
   * @param {XMTPEnvironment} env - Environment to see if the identity is on the network for
   * @returns {Promise<InboxState[]>} A Promise resolving to a list of inbox states.
   */
  static async inboxStatesForInboxIds(
    env: XMTPEnvironment,
    inboxIds: InboxId[]
  ): Promise<InboxState[]> {
    return await XMTPModule.staticInboxStatesForInboxIds(env, inboxIds)
  }

  /**
   * Revoke a list of installations.
   * Revoking a installation will cause that installation to lose access to the inbox.
   * @param {XMTPEnvironment} env - Environment to revoke installation from.
   * @param {Signer} signer - The signer of the recovery account to sign the revocation.
   * @param {inboxId} InboxId - The inboxId of the account to revoke installations from.
   * @param {installationIds} InstallationId[] - The installationIds to revoke access to the inbox.
   */
  static async revokeInstallations(
    env: XMTPEnvironment,
    signer: Signer | WalletClient,
    inboxId: InboxId,
    installationIds: InstallationId[]
  ): Promise<void> {
    const signingKey = getSigner(signer)
    if (!signingKey) {
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

        await XMTPModule.staticRevokeInstallations(
          env,
          await signingKey.getIdentifier(),
          inboxId,
          installationIds,
          signingKey.signerType?.(),
          signingKey.getChainId?.(),
          signingKey.getBlockNumber?.()
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
   * ⚠️ This function is delicate and should be used with caution.
   * Should only be used if trying to manage the signature flow independently otherwise use `revokeInstallations()` instead
   *
   * Revoke a list of installations.
   * Revoking a installation will cause that installation to lose access to the inbox.
   * @param {XMTPEnvironment} env - Environment to revoke installation from.
   * @param {identity} Identity - The identity of the recovery account to sign the revocation.
   * @param {inboxId} InboxId - The inboxId of the account to revoke installations from.
   * @param {installationIds} InstallationId[] - The installationIds to revoke access to the inbox.
   */
  static async ffiRevokeInstallationsSignatureText(
    env: XMTPEnvironment,
    identity: PublicIdentity,
    inboxId: InboxId,
    installationIds: InstallationId[]
  ): Promise<string> {
    console.warn(
      '⚠️ This function is delicate and should be used with caution. ' +
        'Should only be used if trying to manage the signature flow independently otherwise use `revokeInstallations()` instead'
    )

    return await XMTPModule.ffiStaticRevokeInstallationsSignatureText(
      env,
      identity,
      inboxId,
      installationIds
    )
  }

  /**
   * ⚠️ This function is delicate and should be used with caution.
   * Should only be used if trying to manage the signature flow independently otherwise use `revokeInstallations()` instead
   *
   * Applies the signature.
   * @param {XMTPEnvironment} env - Environment to apply the signature request
   */
  static async ffiApplySignatureRequest(
    env: XMTPEnvironment,
    signatureType: SignatureType
  ): Promise<void> {
    console.warn(
      '⚠️ This function is delicate and should be used with caution. ' +
        'Should only be used if trying to manage the signature flow independently otherwise use `revokeInstallations()` instead'
    )

    await XMTPModule.ffiStaticApplySignature(env, signatureType)
  }

  /**
   * This function is delicate and should be used with caution. Should only be used if trying to manage the signature flow independently otherwise use `create()` instead.
   * Adds the Ecdsa signature to the identity to be registered
   */
  static async ffiAddEcdsaSignature(
    signatureType: SignatureType,
    signature: Uint8Array
  ): Promise<void> {
    console.warn(
      '⚠️ This function is delicate and should be used with caution. ' +
        'Should only be used if trying to manage the signature flow independently otherwise use `revokeInstallations()` instead'
    )
    return await XMTPModule.ffiStaticAddEcdsaSignature(signatureType, signature)
  }

  /**
   * This function is delicate and should be used with caution. Should only be used if trying to manage the signature flow independently otherwise use `create()` instead.
   * Adds the SCW signature to the identity to be registered
   */
  static async ffiAddScwSignature(
    signatureType: SignatureType,
    signature: Uint8Array,
    address: Address,
    chainId: number,
    blockNumber?: number | undefined
  ): Promise<void> {
    console.warn(
      '⚠️ This function is delicate and should be used with caution. ' +
        'Should only be used if trying to manage the signature flow independently otherwise use `revokeInstallations()` instead'
    )
    return await XMTPModule.ffiStaticAddScwSignature(
      signatureType,
      signature,
      address,
      chainId,
      blockNumber
    )
  }

  /**
   * Activates persistent logging for libXMTP with specified configuration.
   *
   * @param {LogLevel} logLevel - The minimum log level to record (e.g., debug, info, warn, error)
   * @param {LogRotation} logRotation - How often the log files will rotate into a new file
   * @param {number} logMaxFiles - Maximum number of log files to keep before rotation
   * @returns Promise that resolves when logging is activated
   */
  static activatePersistentLibXMTPLogWriter(
    logLevel: LogLevel,
    logRotation: LogRotation,
    logMaxFiles: number
  ) {
    return XMTPModule.staticActivatePersistentLibXMTPLogWriter(
      logLevel,
      logRotation,
      logMaxFiles
    )
  }

  /**
   * Deactivates the persistent log writer for libXMTP.
   * This stops recording logs to persistent storage.
   *
   * @returns Promise that resolves when logging is deactivated
   */
  static deactivatePersistentLibXMTPLogWriter() {
    return XMTPModule.staticDeactivatePersistentLibXMTPLogWriter()
  }

  /**
   * Checks if the persistent log writer is currently active.
   * Note that persistent logging may be killed by OS when app is backgrounded.
   * When app is foregrounded, logging will resume if isLogWriterActive is set to true.
   *
   * @returns {boolean} True if logging is active, false otherwise
   */
  static isLogWriterActive() {
    return XMTPModule.staticIsLogWriterActive()
  }

  /**
   * Gets the file paths of all XMTP log files.
   *
   * @returns {string[]} Array of file paths to log files
   */
  static getXMTPLogFilePaths(): string[] {
    return XMTPModule.staticGetXMTPLogFilePaths()
  }

  /**
   * Reads the contents of a specific XMTP log file.
   *
   * @param {string} filePath - Path to the log file to read
   * @returns {Promise<string>} Promise resolving to the contents of the log file
   */
  static readXMTPLogFile(filePath: string): Promise<string> {
    return XMTPModule.readXMTPLogFile(filePath)
  }

  /**
   * Clears all XMTP log files.
   *
   * @returns {number} Number of log files that were cleared
   */
  static clearXMTPLogs(): number {
    return XMTPModule.staticClearXMTPLogs()
  }

  constructor(
    inboxId: InboxId,
    installationId: InstallationId,
    dbPath: string,
    publicIdentity: PublicIdentity,
    environment: XMTPEnvironment,
    codecs: XMTPModule.ContentCodec<ContentTypes>[] = []
  ) {
    this.inboxId = inboxId
    this.installationId = installationId
    this.dbPath = dbPath
    this.publicIdentity = publicIdentity
    this.environment = environment
    this.conversations = new Conversations(this)
    this.preferences = new PrivatePreferences(this)
    this.debugInformation = new XMTPDebugInformation(this)
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
   * Adding a identity already associated with an inboxId will cause the identity to lose access to that inbox.
   * @param {Signer} newAccount - The signer of the new account to be added.
   * @param {boolean} allowReassignInboxId - A boolean specifying if the inboxId should be reassigned or not.
   */
  async addAccount(
    newAccount: Signer | WalletClient,
    allowReassignInboxId: boolean = false
  ) {
    console.warn(
      '⚠️ This function is delicate and should be used with caution. ' +
        'Adding a identity already associated with an inboxId will cause the identity to lose access to that inbox.'
    )
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
          await signer.getIdentifier(),
          signer.signerType?.(),
          signer.getChainId?.(),
          signer.getBlockNumber?.(),
          allowReassignInboxId
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
   * @param {Signer} signer - The signer object used for authenticate the removal.
   * @param {PublicIdentity} identityToRemove - The identity of the signer you'd like to remove from the account.
   */
  async removeAccount(
    signer: Signer | WalletClient,
    identityToRemove: PublicIdentity
  ) {
    const signingKey = getSigner(signer)
    if (!signingKey) {
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
          identityToRemove,
          await signingKey.getIdentifier(),
          signingKey.signerType?.(),
          signingKey.getChainId?.(),
          signingKey.getBlockNumber?.()
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
    signer: Signer | WalletClient | null,
    installationIds: InstallationId[]
  ) {
    const signingKey = getSigner(signer)
    if (!signingKey) {
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
          await signingKey.getIdentifier(),
          signingKey.signerType?.(),
          signingKey.getChainId?.(),
          signingKey.getBlockNumber?.()
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
  async revokeAllOtherInstallations(signer: Signer | WalletClient | null) {
    const signingKey = getSigner(signer)
    if (!signingKey) {
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
          await signingKey.getIdentifier(),
          signingKey.signerType?.(),
          signingKey.getChainId?.(),
          signingKey.getBlockNumber?.()
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
   * Find the InboxId associated with this identity
   *
   * @param {PublicIdentity} identity - The identity of the peer to check for inboxId.
   * @returns {Promise<InboxId>} A Promise resolving to the InboxId.
   */
  async findInboxIdFromIdentity(
    identity: PublicIdentity
  ): Promise<InboxId | undefined> {
    return await XMTPModule.findInboxIdFromIdentity(
      this.installationId,
      identity
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
    console.warn(
      '⚠️ This function is delicate and should be used with caution. ' +
        'App will error if database not properly reconnected. See: reconnectLocalDatabase()'
    )
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
   * @param {PublicIdentity[]} identities - The identities of the peers to check for messaging eligibility.
   * @returns {Promise<{ [key: string]: boolean }>} A Promise resolving to a hash of identifiers and booleans if they can message on the network.
   */
  async canMessage(
    identities: PublicIdentity[]
  ): Promise<{ [key: string]: boolean }> {
    return await XMTPModule.canMessage(this.installationId, identities)
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

  /**
   * This function is delicate and should be used with caution. Should only be used if trying to manage the signature flow independently otherwise use `create()` instead.
   * Gets the signature text to be signed
   */
  async ffiCreateSignatureText(): Promise<string> {
    console.warn(
      '⚠️ This function is delicate and should be used with caution. ' +
        'Should only be used if trying to manage the signature flow independently otherwise use `create()` instead'
    )
    return await XMTPModule.ffiCreateSignatureText(this.installationId)
  }

  /**
   * This function is delicate and should be used with caution. Should only be used if trying to manage the signature flow independently otherwise use `create()` instead.
   * Adds the Ecdsa signature to the identity to be registered
   */
  async ffiAddEcdsaSignature(signature: Uint8Array): Promise<void> {
    console.warn(
      '⚠️ This function is delicate and should be used with caution. ' +
        'Should only be used if trying to manage the signature flow independently otherwise use `create()` instead'
    )
    return await XMTPModule.ffiAddEcdsaSignature(this.installationId, signature)
  }

  /**
   * This function is delicate and should be used with caution. Should only be used if trying to manage the signature flow independently otherwise use `create()` instead.
   * Adds the SCW signature to the identity to be registered
   */
  async ffiAddScwSignature(
    signature: Uint8Array,
    address: Address,
    chainId: number,
    blockNumber?: number | undefined
  ): Promise<void> {
    console.warn(
      '⚠️ This function is delicate and should be used with caution. ' +
        'Should only be used if trying to manage the signature flow independently otherwise use `create()` instead'
    )
    return await XMTPModule.ffiAddScwSignature(
      this.installationId,
      signature,
      address,
      chainId,
      blockNumber
    )
  }

  /**
   * This function is delicate and should be used with caution. Should only be used if trying to manage the create and register flow independently otherwise use `create()` instead.
   * Registers the identity to the XMTP network
   */
  async ffiRegisterIdentity(): Promise<void> {
    console.warn(
      '⚠️ This function is delicate and should be used with caution. ' +
        'Should only be used if trying to manage the create and register flow independently otherwise use `create()` instead'
    )
    return await XMTPModule.ffiRegisterIdentity(this.installationId)
  }

  /**
   * This function is delicate and should be used with caution. Should only be used if trying to manage the signature flow independently otherwise use `revokeInstallations()` instead.
   * Gets the signature text for the revoke installations action
   */
  async ffiRevokeInstallationsSignatureText(
    installationIds: InstallationId[]
  ): Promise<string> {
    console.warn(
      '⚠️ This function is delicate and should be used with caution. ' +
        'Should only be used if trying to manage the signature flow independently otherwise use `revokeInstallations()` instead'
    )
    return await XMTPModule.ffiRevokeInstallationsSignatureText(
      this.installationId,
      installationIds
    )
  }

  /**
   * This function is delicate and should be used with caution. Should only be used if trying to manage the signature flow independently otherwise use `revokeAllOtherInstallations()` instead.
   * Gets the signature text for the revoke installations action
   */
  async ffiRevokeAllOtherInstallationsSignatureText(): Promise<string> {
    console.warn(
      '⚠️ This function is delicate and should be used with caution. ' +
        'Should only be used if trying to manage the signature flow independently otherwise use `revokeAllOtherInstallations()` instead'
    )
    return await XMTPModule.ffiRevokeAllOtherInstallationsSignatureText(
      this.installationId
    )
  }

  /**
   * This function is delicate and should be used with caution. Should only be used if trying to manage the signature flow independently otherwise use `removeWallet()` instead.
   * Gets the signature text for the removed identity action
   */
  async ffiRemoveIdentitySignatureText(
    identityToRemove: PublicIdentity
  ): Promise<string> {
    console.warn(
      '⚠️ This function is delicate and should be used with caution. ' +
        'Should only be used if trying to manage the signature flow independently otherwise use `removeAccount()` instead'
    )
    return await XMTPModule.ffiRevokeWalletSignatureText(
      this.installationId,
      identityToRemove
    )
  }

  /**
   * This function is delicate and should be used with caution. Should only be used if trying to manage the create and register flow independently otherwise use `addWallet()` instead.
   * Gets the signature text for the add identity action
   */
  async ffiAddIdentitySignatureText(
    identityToAdd: PublicIdentity,
    allowReassignInboxId: boolean = false
  ): Promise<string> {
    console.warn(
      '⚠️ This function is delicate and should be used with caution. ' +
        'Should only be used if trying to manage the create and register flow independently otherwise use `addAccount()` instead'
    )
    return await XMTPModule.ffiAddWalletSignatureText(
      this.installationId,
      identityToAdd,
      allowReassignInboxId
    )
  }

  /**
   * This function is delicate and should be used with caution. Should only be used if trying to manage the signature flow independently otherwise use `addAccount(), removeAccount(), or revoke()` instead.
   * Applys the signature after adding signature
   */
  async ffiApplySignature(): Promise<void> {
    console.warn(
      '⚠️ This function is delicate and should be used with caution. ' +
        'Should only be used if trying to manage the signature flow independently otherwise use `addAccount(), removeAccount(), or revoke()` instead'
    )
    return await XMTPModule.ffiApplySignatureRequest(this.installationId)
  }
}

export type XMTPEnvironment = 'local' | 'dev' | 'production'
export type SignatureType = 'revokeInstallations'

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
  /**
   * OPTIONAL specify a custom local host for testing on physical devices for example `localhost`
   */
  customLocalHost?: string
  /**
   * OPTIONAL specify if device sync should be enabled or disabled defaults to true
   */
  deviceSyncEnabled?: boolean
  /**
   * OPTIONAL specify if debug events should be tracked defaults to false
   */
  debugEventsEnabled?: boolean
}
