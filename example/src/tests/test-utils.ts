import { Platform } from "expo-modules-core";
import { Client } from "xmtp-react-native-sdk";

export type Test = {
    name: string
    run: () => Promise<boolean>
}

export function isIos() {
    return Platform.OS === 'ios'
}

export async function delayToPropogate(milliseconds = 100): Promise<void> {
    // delay avoid clobbering
    return new Promise((r) => setTimeout(r, milliseconds))
}

export function assert(condition: boolean, msg: string) {
    if (!condition) {
        throw new Error(msg)
    }
}

export async function createClients(numClients: number): Promise<Client<any>[]> {
    const clients = [];
    for (let i = 0; i < numClients; i++) {
        clients.push(await Client.createRandom({
            env: 'local',
            enableAlphaMls: true,
        }));
    }
    return clients;
}