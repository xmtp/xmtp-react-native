import { content } from "@xmtp/proto";
import { randomBytes } from "crypto";

import * as XMTP from "../../src/index";
import { DecodedMessage, Query } from "../../src/index";

export type Test = {
  name: string;
  run: () => Promise<boolean>;
};

export const tests: Test[] = [];

function delayToPropogate(): Promise<void> {
  // delay 1s to avoid clobbering
  return new Promise((r) => setTimeout(r, 100));
}

function test(name: string, perform: () => Promise<boolean>) {
  tests.push({ name, run: perform });
}

// test("can fail", async () => {
//   return false;
// });

test("can make a client", async () => {
  const client = await XMTP.Client.createRandom({
    env: "local",
    appVersion: "Testing/0.0.0",
  });
  return client.address.length > 0;
});

test("can pass a custom filter date and receive message objects with expected dates", async () => {
  try {
    const bob = await XMTP.Client.createRandom({ env: "local" });
    const alice = await XMTP.Client.createRandom({ env: "local" });

    if (bob.address === alice.address) {
      throw new Error("bob and alice should be different");
    }

    const bobConversation = await bob.conversations.newConversation(
      alice.address,
    );

    const aliceConversation = (await alice.conversations.list())[0];
    if (!aliceConversation) {
      throw new Error("aliceConversation should exist");
    }

    let sentAt = Date.now();
    await bobConversation.send({ text: "hello" });

    // Show all messages before date in the past
    const messages1: DecodedMessage[] = await aliceConversation.messages(
      undefined,
      new Date("2023-01-01"),
    );

    // Show all messages before date in the future
    const messages2: DecodedMessage[] = await aliceConversation.messages(
      undefined,
      new Date("2025-01-01"),
    );

    const isAboutRightSendTime = Math.abs(messages2[0].sent - sentAt) < 1000;

    return !messages1.length && messages2.length === 1 && isAboutRightSendTime;
  } catch (e) {
    return false;
  }
});

test("canMessage", async () => {
  const bob = await XMTP.Client.createRandom({ env: "local" });
  const alice = await XMTP.Client.createRandom({ env: "local" });

  const canMessage = await bob.canMessage(alice.address);
  return canMessage;
});

test("createFromKeyBundle throws error for non string value", async () => {
  try {
    const bytes = randomBytes(32);
    await XMTP.Client.createFromKeyBundle(JSON.stringify(bytes), {
      env: "local",
    });
  } catch (e) {
    return true;
  }
  return false;
});

test("can list batch messages", async () => {
  try {
    const bob = await XMTP.Client.createRandom({ env: "local" });
    await delayToPropogate();
    const alice = await XMTP.Client.createRandom({ env: "local" });
    await delayToPropogate();
    if (bob.address === alice.address) {
      throw new Error("bob and alice should be different");
    }

    const bobConversation = await bob.conversations.newConversation(
      alice.address,
    );
    await delayToPropogate();

    const aliceConversation = (await alice.conversations.list())[0];
    if (!aliceConversation) {
      throw new Error("aliceConversation should exist");
    }

    await bobConversation.send({ text: "Hello world" });
    await delayToPropogate();
    const messages: DecodedMessage[] = await alice.listBatchMessages([
      {
        contentTopic: bobConversation.topic,
      } as Query,
      {
        contentTopic: aliceConversation.topic,
      } as Query,
    ]);

    if (messages.length < 1) {
      throw Error("No message");
    }

    const firstMessage = messages?.[0];

    return firstMessage.content.text === "Hello world";
  } catch (e) {
    return false;
  }
});
