import { Wallet } from "ethers";
import { Client } from "xmtp-react-native-sdk";
import * as XMTP from "../../src/index";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type Test = {
  name: string;
  run: () => Promise<boolean>;
};

export const tests: Test[] = [];

function test(name: string, perform: () => Promise<boolean>) {
  tests.push({ name, run: perform });
}

test("can make a client", async () => {
  const client = await XMTP.Client.createRandom("local");
  return client.address.length > 0;
});

test("can message a client", async () => {
  const bob = await XMTP.Client.createRandom("local");
  const alice = await XMTP.Client.createRandom("local");
  console.log("BOB ADDRESS: ", bob.address);
  console.log("ALICE ADDRESS: ", alice.address);

  if (bob.address === alice.address) {
    throw new Error("bob and alice should be different");
  }

  const bobConversation = await bob.conversations.newConversation(
    alice.address
  );

  await sleep(1000);

  const aliceConversation = (await alice.conversations.list())[0];
  if (!aliceConversation) {
    throw new Error("aliceConversation should exist");
  }

  await bobConversation.send("hello world");

  const messages = await aliceConversation.messages();

  if (messages.length !== 1) {
    throw "No message";
  }

  const message = messages[0];

  return message.content === "hello world";
});
