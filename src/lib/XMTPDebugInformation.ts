import * as XMTPModule from '../index'
import { Client, InstallationId } from './Client'

export default class XMTPDebugInformation {
  client: Client<any>

  constructor(client: Client<any>) {
    this.client = client
  }

  async getNetworkDebugInformation(): Promise<NetworkDebugInfo> {
    return await XMTPModule.getNetworkDebugInformation(
      this.client.installationId
    )
  }

  async clearAllStatistics(): Promise<void> {
    return await XMTPModule.clearAllNetworkStatistics(
      this.client.installationId
    )
  }

  async uploadDebugInformation(serverUrl?: string): Promise<string> {
    return await XMTPModule.uploadDebugInformation(
      this.client.installationId,
      serverUrl
    )
  }

  async getKeyPackageStatuses(
    installationIds: InstallationId[]
  ): Promise<KeyPackageStatuses> {
    return await XMTPModule.staticKeyPackageStatuses(
      this.client.environment,
      installationIds
    )
  }
}

export interface ApiStatistics {
  uploadKeyPackage: number
  fetchKeyPackage: number
  sendGroupMessages: number
  sendWelcomeMessages: number
  queryGroupMessages: number
  queryWelcomeMessages: number
  subscribeMessages: number
  subscribeWelcomes: number
}

export interface IdentityStatistics {
  publishIdentityUpdate: number
  getIdentityUpdatesV2: number
  getInboxIds: number
  verifySmartContractWalletSignature: number
}

export class NetworkDebugInfo {
  apiStatistics: ApiStatistics
  identityStatistics: IdentityStatistics
  aggregateStatistics: string

  constructor(
    apiStatistics: ApiStatistics,
    identityStatistics: IdentityStatistics,
    aggregateStatistics: string
  ) {
    this.apiStatistics = apiStatistics
    this.identityStatistics = identityStatistics
    this.aggregateStatistics = aggregateStatistics
  }

  static from(json: string): NetworkDebugInfo {
    const entry = JSON.parse(json)

    if (
      !entry.apiStatistics ||
      !entry.identityStatistics ||
      entry.aggregateStatistics == null
    ) {
      throw new Error('Invalid JSON structure for NetworkDebugInfo')
    }

    const parsedApiStats = JSON.parse(entry.apiStatistics)
    const parsedIdentityStats = JSON.parse(entry.identityStatistics)

    return new NetworkDebugInfo(
      parsedApiStats,
      parsedIdentityStats,
      entry.aggregateStatistics
    )
  }
}

export class KeyPackageStatuses {
  statuses: Map<InstallationId, KeyPackageStatus>

  constructor(statuses: Map<InstallationId, KeyPackageStatus>) {
    this.statuses = statuses
  }

  static from(json: Record<string, string>): KeyPackageStatuses {
    const statuses = new Map<InstallationId, KeyPackageStatus>()

    for (const [installationId, statusJson] of Object.entries(json)) {
      const status = KeyPackageStatus.from(statusJson)
      statuses.set(installationId as InstallationId, status)
    }

    return new KeyPackageStatuses(statuses)
  }
}

export class KeyPackageStatus {
  lifetime: KeyPackageLifetime
  validationError: string

  constructor(lifetime: KeyPackageLifetime, validationError: string) {
    this.lifetime = lifetime
    this.validationError = validationError
  }

  static from(json: string): KeyPackageStatus {
    const entry = JSON.parse(json)

    const parsedLifetime = JSON.parse(entry.lifetime)

    return new KeyPackageStatus(parsedLifetime, entry.validationError)
  }
}

export interface KeyPackageLifetime {
  notBefore: number
  notAfter: number
}
