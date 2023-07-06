import { content } from "@xmtp/proto";

import { NumberCodec, TextCodec } from "./test_utils";
import * as XMTP from "../../src/index";
import { DecodedMessage } from "../../src/index";
import { CodecError } from "../../src/lib/CodecError";
import { CodecRegistry } from "../../src/lib/CodecRegistry";
import { randomBytes } from "crypto";

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

test("can send and receive a text codec", async () => {
  const textCodec = new TextCodec();
  const registry = new CodecRegistry();
  registry.register(textCodec);

  try {
    const id = textCodec.contentType.id();
    const codec = registry.find(id);

    const encodedContent = codec.encode("Hello world");

    const data = content.EncodedContent.encode(encodedContent).finish();

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

    await bobConversation.send(data);

    const messages: DecodedMessage[] = await aliceConversation.messages();

    if (messages.length !== 1) {
      throw Error("No message");
    }

    const firstMessage = messages?.[0];
    const decodedMessage = codec.decode(firstMessage.content);
    return decodedMessage === "Hello world";
  } catch (e) {
    return false;
  }
});

test("can pass a custom filter date and receive message objects with expected dates", async () => {
  const textCodec = new TextCodec();
  const registry = new CodecRegistry();
  registry.register(textCodec);

  try {
    const id = textCodec.contentType.id();
    const codec = registry.find(id);

    const encodedContent = codec.encode("Hello world");

    const data = content.EncodedContent.encode(encodedContent).finish();

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

    await bobConversation.send(data);

    // Show all messages before date in the past
    const messages1: DecodedMessage[] = await aliceConversation.messages(
      undefined,
      new Date("2023-01-01")
    );

    // Show all messages before date in the future
    const messages2: DecodedMessage[] = await aliceConversation.messages(
      undefined,
      new Date("2025-01-01")
    );

    const hasCorrectSentDate =
      messages2[0].sent.toDateString() === new Date().toDateString();

    return !messages1.length && messages2.length === 1 && hasCorrectSentDate;
  } catch (e) {
    return false;
  }
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
  const codec = registry.find(id);

  const encodedContent = codec.encode(3.14);
  const decodedContent = codec.decode(encodedContent);

  return decodedContent === 3.14;
});

test("throws an error if codec is not found in registry", async () => {
  const numberCodec = new NumberCodec();
  const registry = new CodecRegistry();
  registry.register(numberCodec);

  try {
    const id = "invalidId";
    registry.find(id);
  } catch (e) {
    return (e as CodecError).message === "codecNotFound";
  }
  return false;
});

test("throws an error if codec is invalid when decoding", async () => {
  const numberCodec = new NumberCodec();
  const registry = new CodecRegistry();
  registry.register(numberCodec);

  try {
    const id = numberCodec.contentType.id();
    const codec = registry.find(id);

    const encodedContent = codec.encode(3.14);
    const invalidContentToDecode = {
      ...encodedContent,
      // Not a UInt8Array
      content: 3.14,
    };
    // @ts-ignore
    codec.decode(invalidContentToDecode);
  } catch (e) {
    return (e as CodecError).message === "invalidContent";
  }
  return false;
});

test("can send and receive number codec", async () => {
  const numberCodec = new NumberCodec();
  const registry = new CodecRegistry();
  registry.register(numberCodec);

  try {
    const id = numberCodec.contentType.id();
    const codec = registry.find(id);

    const encodedContent = codec.encode(3.14);

    const data = content.EncodedContent.encode(encodedContent).finish();

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

    await bobConversation.send(data);
    const messages: DecodedMessage[] = await aliceConversation.messages();

    if (messages.length !== 1) {
      throw Error("No message");
    }

    const firstMessage = messages?.[0];
    const decodedMessage = codec.decode(firstMessage.content);
    return decodedMessage === 3.14;
  } catch (e) {
    return false;
  }
});

test("createFromKeyBundle throws error for non string value", async () => {
  try {
    const bytes = randomBytes(32);
    await XMTP.Client.createFromKeyBundle(JSON.stringify(bytes), "local");
  } catch (e) {
    return true;
  }
  return false;
});
