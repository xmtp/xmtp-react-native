import ReactNativeBlobUtil from "react-native-blob-util";
import * as XMTP from "../../src/index";

const { fs } = ReactNativeBlobUtil;

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

test("canPrepareMessage", async () => {
  const bob = await XMTP.Client.createRandom({ env: "local" });
  const alice = await XMTP.Client.createRandom({ env: "local" });
  await delayToPropogate();

  const bobConversation = await bob.conversations.newConversation(
    alice.address,
  );
  await delayToPropogate();

  const preparedMessage = await bobConversation.prepareMessage(content: "hi")
  const messageId = preparedMessage.messageId
  await preparedMessage.send()
  const messages = await bobConversation.messages()
  const message = messages[0]

  return message.id === messageId;
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

test("can paginate batch messages", async () => {
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

  for (let i = 0; i < 5; i++) {
    await bobConversation.send({ text: `Message ${i}` });
    await delayToPropogate();
  }
  const messages: DecodedMessage[] = await alice.listBatchMessages([
    {
      contentTopic: bobConversation.topic,
      pageSize: 2,
    } as Query,
  ]);

  if (messages.length !== 2) {
    throw Error("Unexpected message count " + messages.length);
  }
  if (messages[0].content.text !== "Message 4") {
    throw Error("Unexpected message content " + messages[0].content.text);
  }
  if (messages[1].content.text !== "Message 3") {
    throw Error("Unexpected message content " + messages[1].content.text);
  }
  return true;
});

test("can stream messages", async () => {
  const bob = await XMTP.Client.createRandom({ env: "local" });
  await delayToPropogate();
  const alice = await XMTP.Client.createRandom({ env: "local" });
  await delayToPropogate();

  // Record new conversation stream
  const allConversations: Conversation[] = [];
  await alice.conversations.stream(async (conversation) => {
    allConversations.push(conversation);
  });

  // Record message stream across all conversations
  const allMessages: DecodedMessage[] = [];
  await alice.conversations.streamAllMessages(async (message) => {
    allMessages.push(message);
  });

  // Start Bob starts a new conversation.
  const bobConvo = await bob.conversations.newConversation(alice.address, {
    conversationID: "https://example.com/alice-and-bob",
    metadata: {
      title: "Alice and Bob",
    },
  });
  await delayToPropogate();

  if (bobConvo.clientAddress !== bob.address) {
    throw Error("Unexpected client address " + bobConvo.clientAddress);
  }
  if (!bobConvo.topic) {
    throw Error("Missing topic " + bobConvo.topic);
  }
  if (
    bobConvo.context?.conversationID !== "https://example.com/alice-and-bob"
  ) {
    throw Error(
      "Unexpected conversationID " + bobConvo.context?.conversationID,
    );
  }
  if (bobConvo.context?.metadata?.title !== "Alice and Bob") {
    throw Error(
      "Unexpected metadata title " + bobConvo.context?.metadata?.title,
    );
  }
  if (!bobConvo.createdAt) {
    console.log("bobConvo", bobConvo);
    throw Error("Missing createdAt " + bobConvo.createdAt);
  }

  if (allConversations.length !== 1) {
    throw Error(
      "Unexpected all conversations count " + allConversations.length,
    );
  }
  if (allConversations[0].topic !== bobConvo.topic) {
    throw Error(
      "Unexpected all conversations topic " + allConversations[0].topic,
    );
  }

  const aliceConvo = (await alice.conversations.list())[0];
  if (!aliceConvo) {
    throw new Error("missing conversation");
  }

  // Record message stream for this conversation
  const convoMessages: DecodedMessage[] = [];
  await aliceConvo.streamMessages(async (message) => {
    convoMessages.push(message);
  });

  for (let i = 0; i < 5; i++) {
    await bobConvo.send({ text: `Message ${i}` });
    await delayToPropogate();
  }
  if (allMessages.length !== 5) {
    throw Error("Unexpected all messages count " + allMessages.length);
  }
  if (convoMessages.length !== 5) {
    throw Error("Unexpected convo messages count " + convoMessages.length);
  }
  for (let i = 0; i < 5; i++) {
    if (allMessages[i].content.text !== `Message ${i}`) {
      throw Error(
        "Unexpected all message content " + allMessages[i].content.text,
      );
    }
    if (allMessages[i].topic !== bobConvo.topic) {
        throw Error("Unexpected all message topic " + allMessages[i].topic);
    }
    if (convoMessages[i].content.text !== `Message ${i}`) {
      throw Error(
        "Unexpected convo message content " + convoMessages[i].content.text,
      );
    }
    if (convoMessages[i].topic !== bobConvo.topic) {
        throw Error("Unexpected convo message topic " + convoMessages[i].topic);
    }
  }
  return true;
});

test("remote attachments should work", async () => {
  const alice = await XMTP.Client.createRandom({ env: "local" });
  const bob = await XMTP.Client.createRandom({ env: "local" });
  const convo = await alice.conversations.newConversation(bob.address);

  // Alice is sending Bob a file from her phone.
  const filename = `${Date.now()}.txt`;
  const file = `${fs.dirs.CacheDir}/${filename}`;
  await fs.writeFile(file, "hello world", "utf8");
  const { encryptedLocalFileUri, metadata } = await alice.encryptAttachment({
    fileUri: `file://${file}`,
    mimeType: "text/plain",
  });

  let encryptedFile = encryptedLocalFileUri.slice("file://".length);
  let originalContent = await fs.readFile(file, "base64");
  let encryptedContent = await fs.readFile(encryptedFile, "base64");
  if (encryptedContent === originalContent) {
    throw new Error("encrypted file should not match original");
  }

  // This is where the app will upload the encrypted file to a remote server and generate a URL.
  //   let url = await uploadFile(encryptedLocalFileUri);
  let url = "https://example.com/123";

  // Together with the metadata, we send the URL as a remoteAttachment message to the conversation.
  await convo.send({
    remoteAttachment: {
      ...metadata,
      scheme: "https://",
      url,
    },
  });
  await delayToPropogate();

  // Now we should see the remote attachment message.
  const messages = await convo.messages();
  if (messages.length !== 1) {
    throw new Error("Expected 1 message");
  }
  const message = messages[0];

  if (message.contentTypeId !== "xmtp.org/remoteStaticAttachment:1.0") {
    throw new Error("Expected correctly formatted typeId");
  }
  if (!message.content.remoteAttachment) {
    throw new Error("Expected remoteAttachment");
  }
  if (message.content.remoteAttachment.url !== "https://example.com/123") {
    throw new Error("Expected url to match");
  }

  // This is where the app prompts the user to download the encrypted file from `url`.
  // TODO: let downloadedFile = await downloadFile(url);
  // But to simplify this test, we're just going to copy
  // the previously encrypted file and pretend that we just downloaded it.
  let downloadedFileUri = `file://${fs.dirs.CacheDir}/${Date.now()}.bin`;
  await fs.cp(
    new URL(encryptedLocalFileUri).pathname,
    new URL(downloadedFileUri).pathname,
  );

  // Now we can decrypt the downloaded file using the message metadata.
  const attached = await alice.decryptAttachment({
    encryptedLocalFileUri: downloadedFileUri,
    metadata: message.content.remoteAttachment,
  });
  if (attached.mimeType !== "text/plain") {
    throw new Error("Expected mimeType to match");
  }
  const text = await fs.readFile(new URL(attached.fileUri).pathname, "utf8");
  if (text !== "hello world") {
    throw new Error("Expected text to match");
  }
  return true;
});
