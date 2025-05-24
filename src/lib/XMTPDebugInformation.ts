import * as XMTPModule from '../index'
import { Client } from './Client'

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

  async uploadDebugInformation(serverUrl?: string): Promise<string> {
    return await XMTPModule.uploadDebugInformation(
      this.client.installationId,
      serverUrl
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
