import * as XMTP from "../../src/index";
import { CodecRegistry } from "../../src/lib/Client";
import { NumberCodec } from "./test_utils";

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

// test("can fail", async () => {
//   return false;
// });

test("can make a client", async () => {
  const client = await XMTP.Client.createRandom("local");
  return client.address.length > 0;
});

test("can message a client", async () => {
  const bob = await XMTP.Client.createRandom("local");
  const alice = await XMTP.Client.createRandom("local");

  if (bob.address === alice.address) {
    throw new Error("bob and alice should be different");
  }

  const bobConversation = await bob.conversations.newConversation(
    alice.address
  );

  const aliceConversation = (await alice.conversations.list())[0];
  if (!aliceConversation) {
    throw new Error("aliceConversation should exist");
  }

  await bobConversation.send("hello world");

  const messages = await aliceConversation.messages();

  if (messages.length !== 1) {
    throw Error("No message");
  }

  const message = messages[0];

  return message.content === "hello world";
});

test("canMessage", async () => {
  const bob = await XMTP.Client.createRandom("local");
  const alice = await XMTP.Client.createRandom("local");

  const canMessage = await bob.canMessage(alice.address);
  return canMessage;
});

test("can register, encode, and decode a number codec", async () => {
  const numberCodec = new NumberCodec();

  const registry = new CodecRegistry();
  registry.register(numberCodec);

  const id = numberCodec.contentType.id();
  const codec = registry.codecs[id];
  const encodedContent = codec.encode(3.14);

  const decodedContent = encodedContent.decoded(registry);
  return decodedContent === 3.14;
});
