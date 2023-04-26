# xmtp-react-native-sdk

![Lint](https://github.com/xmtp/xmtp-android/actions/workflows/lint.yml/badge.svg) ![Status](https://img.shields.io/badge/Project_Status-Pre--Preview-red)

<!--eng: Correctly stated below? Necessary to say which native XMTP SDKs, or no?-->

This repo provides wrappers that help you build a React Native app with XMTP. The wrappers serve as a bridge between your React Native app and native XMTP SDKs.

> **Important:**  
> This SDK is in **Pre-Preview** status and ready for you to start experimenting with.
>
> However, we do **not** recommend using Pre-Preview software in production apps. Software in this status will change as we iterate on features and feedback.

Specifically, this SDK is missing this functionality:

<!--eng: Fill in this list below, if applicable. Which features are missing that we might want to call out? in the second bullet, our pattern has been to call out the lack of parity between the SDK and xmtp-js. For this React Native SDK, is the comparison to xmtp-js still useful? Or does the comparison need to be with the xmtp-ios and xmtp-android SDKs? Or maybe parity with another SDK is not something we need to call out?-->

- The SDK connects to the `dev` environment only. Support for connecting to `production` and `local` environments is pending.

- The `apiUrl`, `keyStoreType`, `codecs`, `maxContentSize` and `appVersion` parameters present in the XMTP client SDK for JavaScript (xmtp-js) are not yet supported.

- Something else not supported

To keep up with the latest SDK developments, see the [Issues tab](https://github.com/xmtp/xmtp-react-native/issues) in this repo.

See an issue you'd like to work on? XMTP welcomes contributions! If you contribute a PR that gets merged into this repo, you'll be eligible to [claim this XMTP contributor POAP](https://www.gitpoap.io/gp/1042).

To learn more about XMTP and get answers to frequently asked questions, see [FAQ about XMTP](https://xmtp.org/docs/dev-concepts/faq).

![x-red-sm](https://user-images.githubusercontent.com/510695/163488403-1fb37e86-c673-4b48-954e-8460ae4d4b05.png)

## Example apps

This repo provides the following example apps:

- [Android example](example/android)

- [iOS example](example/ios)

<!--eng: is this command below correct? Do I just run it in the SDK's root dir?-->

To use an example app, run:

```bash
npm install --force
```

## API documentation

<!--eng: Relevant for this repo? Both links are 404s right now. Will these doc links eventually provide access to SDK docs generated from code annotations added to this repo?-->

- [Documentation for the main branch](https://github.com/expo/expo/blob/main/docs/pages/versions/unversioned/sdk/xmtp-react-native-sdk.md)

- [Documentation for the latest stable release](https://docs.expo.dev/versions/latest/sdk/xmtp-react-native-sdk/)

<!--eng: I basically created two paths for install - one for a managed Expo project and one for a bare RN project. The dev takes one route or the other depending on their setup, is that correct?-->

## Install in a managed Expo project

<!--eng: Is this correct? There is no API documentation for this right now - so is install for an expo project not possible yet? Or do we have a command we want to share here?-->

For a [managed](https://docs.expo.dev/versions/latest/introduction/managed-vs-bare/) Expo project, follow the installation instructions in the [API documentation](#api-documentation) for the latest stable release. If you follow the link and there is no documentation available, then this library is not yet usable within managed projects. It is likely to be included in an upcoming Expo SDK release.

## Install and configure in a bare React Native project

<!--eng: What does this mean - why do I need to install the Expo package if this is a bare RN project? Is there a command we want to share here?-->

For bare React Native projects, you must ensure that you have [installed and configured the `expo` package](https://docs.expo.dev/bare/installing-expo-modules/) before continuing.

### Add the package to your npm dependencies

```bash
npm install xmtp-react-native-sdk
```

### Configure for iOS

<!--eng: For this command and the one below - what are we configuring for iOS and for Android? When does this configuration happen? Do I run these commands in the root dir?-->

After installing the npm package, run:

```bash
npx pod-install
```

### Configure for Android

After installing the npm package, run:

<!--eng: Just guessing at this based on talking with ChatGPT LOL. Says that starting from React Native 0.60, this command may not be necessary.-->

```bash
react-native link xmtp-react-native-sdk
```

## Usage overview

The XMTP message API revolves around a message API client (client) that allows retrieving and sending messages to other XMTP network participants. A client must connect to a wallet app on startup. If this is the very first time the client is created, the client will generate a key bundle that is used to encrypt and authenticate messages. The key bundle persists encrypted in the network using an account signature. The public side of the key bundle is also regularly advertised on the network to allow parties to establish shared encryption keys. All of this happens transparently, without requiring any additional code.

<!--eng: provide code sample. showing swift for context of the kind of info you might want to provide. =)-->

```swift
import XMTP

// You'll want to replace this with a wallet from your application.
let account = try PrivateKey.generate()

// Create the client with your wallet. This will connect to the XMTP `dev` network by default.
// The account is anything that conforms to the `XMTP.SigningKey` protocol.
let client = try await Client.create(account: account)

// Start a conversation with XMTP
let conversation = try await client.conversations.newConversation(with: "0x3F11b27F323b62B159D2642964fa27C46C841897")

// Load all messages in the conversation
let messages = try await conversation.messages()
// Send a message
try await conversation.send(content: "gm")
// Listen for new messages in the conversation
for try await message in conversation.streamMessages() {
  print("\(message.senderAddress): \(message.body)")
}
```

## Create a client

<!--eng: provide code sample. showing swift for context of the kind of info you might want to provide. =)-->

A client is created with `Client.create(account: SigningKey) async throws -> Client` that requires passing in an object capable of creating signatures on your behalf. The client will request a signature in two cases:

1. To sign the newly generated key bundle. This happens only the very first time when a key bundle is not found in storage.
2. To sign a random salt used to encrypt the key bundle in storage. This happens every time the client is started, including the very first time.

> **Note**  
> At this time, the client can connect to the XMTP `dev` environment only.

<!--jha add this back once connection to other environments is supported. [Use `ClientOptions`](#configure-the-client) to change this and other parameters of the network connection.-->

```swift
import XMTP

// Create the client with a `SigningKey` from your app
let client = try await Client.create(account: account, options: .init(api: .init(env: .production)))
```

### Create a client from saved keys

<!--eng: provide code sample. showing swift for context of the kind of info you might want to provide. =)-->

You can save your keys from the client via the `privateKeyBundle` property:

```swift
// Create the client with a `SigningKey` from your app
let client = try await Client.create(account: account, options: .init(api: .init(env: .production)))

// Get the key bundle
let keys = client.privateKeyBundle

// Serialize the key bundle and store it somewhere safe
let keysData = try keys.serializedData()
```

Once you have those keys, you can create a new client with `Client.from`:

```swift
let keys = try PrivateKeyBundle(serializedData: keysData)
let client = try Client.from(bundle: keys, options: .init(api: .init(env: .production)))
```

### Configure the client

<!--eng: provide code sample. showing javascript for context of the kind of info you might want to provide. =)-->

The client's network connection and key storage method can be configured with these optional parameters of `Client.create`:

| Parameter                 | Default                                                                           | Description                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| appVersion                | `undefined`                                                                       | Add a client app version identifier that's included with API requests.<br/>For example, you can use the following format: `appVersion: APP_NAME + '/' + APP_VERSION`.<br/>Setting this value provides telemetry that shows which apps are using the XMTP client SDK. This information can help XMTP developers provide app support, especially around communicating important SDK updates, including deprecations and required upgrades. |
| apiUrl                    | `undefined`                                                                       | Manually specify an API URL to use. If specified, value of `env` will be ignored.                                                                                                                                                                                                                                                                                                                                                        |
| keystoreProviders         | `[StaticKeystoreProvider, NetworkKeystoreProvider, KeyGeneratorKeystoreProvider]` | Override the default behaviour of how the client creates a Keystore with a custom provider. This can be used to get the user's private keys from a different storage mechanism.                                                                                                                                                                                                                                                          |
| persistConversations      | `true`                                                                            | Maintain a cache of previously seen V2 conversations in the storage provider (defaults to `LocalStorage`).                                                                                                                                                                                                                                                                                                                               |
| skipContactPublishing     | `false`                                                                           | Do not publish the user's contact bundle to the network on client creation. Designed to be used in cases where the client session is short-lived (for example, decrypting a push notification), and where it is known that a client instance has been instantiated with this flag set to false at some point in the past.                                                                                                                |
| codecs                    | `[TextCodec]`                                                                     | Add codecs to support additional content types.                                                                                                                                                                                                                                                                                                                                                                                          |
| maxContentSize            | `100M`                                                                            | Maximum message content size in bytes.                                                                                                                                                                                                                                                                                                                                                                                                   |
| preCreateIdentityCallback | `undefined`                                                                       | `preCreateIdentityCallback` is a function that will be called immediately before a [Create Identity wallet signature](https://xmtp.org/docs/dev-concepts/account-signatures#sign-to-create-an-xmtp-identity) is requested from the user.                                                                                                                                                                                                 |
| preEnableIdentityCallback | `undefined`                                                                       | `preEnableIdentityCallback` is a function that will be called immediately before an [Enable Identity wallet signature](https://xmtp.org/docs/dev-concepts/account-signatures#sign-to-enable-an-xmtp-identity) is requested from the user.                                                                                                                                                                                                |

## Handle conversations

<!--eng: provide code sample. showing swift for context of the kind of info you might want to provide. =)-->

Most of the time, when interacting with the network, you'll want to do it through `conversations`. Conversations are between two accounts.

```swift
import XMTP
// Create the client with a wallet from your app
let client = try await Client.create(account: account)
let conversations = try await client.conversations.list()
```

### List existing conversations

<!--eng: provide code sample. showing swift for context of the kind of info you might want to provide. =)-->

You can get a list of all conversations that have one or more messages.

```swift
let allConversations = try await client.conversations.list()

for conversation in allConversations {
  print("Saying GM to \(conversation.peerAddress)")
  try await conversation.send(content: "gm")
}
```

### Listen for new conversations

<!--eng: provide code sample. showing swift for context of the kind of info you might want to provide. =)-->

You can also listen for new conversations being started in real-time. This will allow apps to display incoming messages from new contacts.

> **Warning**  
> This stream will continue infinitely. To end the stream, break from the loop.

```swift
for try await conversation in client.conversations.stream() {
  print("New conversation started with \(conversation.peerAddress)")

  // Say hello to your new friend
  try await conversation.send(content: "Hi there!")

  // Break from the loop to stop listening
  break
}
```

### Start a new conversation

<!--eng: provide code sample. showing swift for context of the kind of info you might want to provide. =)-->

You can create a new conversation with any Ethereum address on the XMTP network.

```swift
let newConversation = try await client.conversations.newConversation(with: "0x3F11b27F323b62B159D2642964fa27C46C841897")
```

### Send messages

<!--eng: provide code sample. showing swift for context of the kind of info you might want to provide. =)-->

To be able to send a message, the recipient must have already created a client at least once and consequently, advertised their key bundle on the network. Messages are addressed using account addresses. The message payload must be a plain string.

> **Note**  
> Other types of content are currently not supported.

```swift
let conversation = try await client.conversations.newConversation(with: "0x3F11b27F323b62B159D2642964fa27C46C841897")
try await conversation.send(content: "Hello world")
```

### List messages in a conversation

<!--eng: provide code sample. showing swift for context of the kind of info you might want to provide. =)-->

You can receive the complete message history in a conversation by calling `conversation.messages()`.

```swift
for conversation in client.conversations.list() {
  let messagesInConversation = try await conversation.messages()
}
```

### List messages in a conversation with pagination

<!--eng: provide code sample. showing swift for context of the kind of info you might want to provide. =)-->

It may be helpful to retrieve and process the messages in a conversation page by page. You can do this by calling `conversation.messages(limit: Int, before: Date)`, which will return the specified number of messages sent before that time.

```swift
let conversation = try await client.conversations.newConversation(with: "0x3F11b27F323b62B159D2642964fa27C46C841897")

let messages = try await conversation.messages(limit: 25)
let nextPage = try await conversation.messages(limit: 25, before: messages[0].sent)
```

### Listen for new messages in a conversation

<!--eng: provide code sample. showing swift for context of the kind of info you might want to provide. =)-->

You can listen for any new messages (incoming or outgoing) in a conversation by calling `conversation.streamMessages()`.

A successfully received message (that makes it through the decoding and decryption without throwing) can be trusted to be authentic. Authentic means that it was sent by the owner of the `message.senderAddress` account and that it wasn't modified in transit. The `message.sent` timestamp can be trusted to have been set by the sender.

The stream returned by the `stream` methods is an asynchronous iterator and as such is usable by a for-await-of loop. Note however that it is by its nature infinite, so any looping construct used with it will not terminate, unless the termination is explicitly initiated (by breaking the loop).

```swift
let conversation = try await client.conversations.newConversation(with: "0x3F11b27F323b62B159D2642964fa27C46C841897")

for try await message in conversation.streamMessages() {
  if message.senderAddress == client.address {
    // This message was sent from me
    continue
  }

  print("New message from \(message.senderAddress): \(message.body)")
}
```

<!--eng: Not sure about the comparison to xmtp-js. May not be relevant for this SDK?-->

> **Note**  
> This package does not currently include the `streamAllMessages()` functionality from the XMTP client SDK for JavaScript (xmtp-js).

### Listen for new messages in all conversations

<!--eng: provide code sample. showing javascript for context of the kind of info you might want to provide. =)-->

To listen for any new messages from _all_ conversations, use `conversations.streamAllMessages()`.

> **Note**  
> There is a chance this stream can miss messages if multiple new conversations are received in the time it takes to update the stream to include a new conversation.

```javascript
for await (const message of await xmtp.conversations.streamAllMessages()) {
  if (message.senderAddress === xmtp.address) {
    // This message was sent from me
    continue
  }
  console.log(`New message from ${message.senderAddress}: ${message.content}`)
}
```

### Check if an address is on the network

<!--eng: provide code sample. showing swift for context of the kind of info you might want to provide. =)-->

If you would like to check and see if a blockchain address is registered on the network before instantiating a client instance, you can use `Client.canMessage`.

```javascript
import { Client } from '@xmtp/xmtp-js'

const isOnDevNetwork = await Client.canMessage(
  '0x3F11b27F323b62B159D2642964fa27C46C841897'
)
const isOnProdNetwork = await Client.canMessage(
  '0x3F11b27F323b62B159D2642964fa27C46C841897',
  { env: 'production' }
)
```

### Handle multiple conversations with the same blockchain address

<!--eng: provide code sample. showing swift for context of the kind of info you might want to provide. =)-->

With XMTP, you can have multiple ongoing conversations with the same blockchain address. For example, you might want to have a conversation scoped to your particular app, or even a conversation scoped to a particular item in your app.

To accomplish this, you can pass a context with a `conversationId` when you are creating a conversation. We recommend conversation IDs start with a domain, to help avoid unwanted collisions between your app and other apps on the XMTP network.

```swift
// Start a scoped conversation with ID mydomain.xyz/foo
let conversation1 = try await client.conversations.newConversation(
  with: "0x3F11b27F323b62B159D2642964fa27C46C841897",
  context: .init(conversationID: "mydomain.xyz/foo")
)

// Start a scoped conversation with ID mydomain.xyz/bar. And add some metadata
let conversation2 = try await client.conversations.newConversation(
  with: "0x3F11b27F323b62B159D2642964fa27C46C841897",
  context: .init(conversationID: "mydomain.xyz/bar", metadata: ["title": "Bar conversation"])
)

// Get all the conversations
let conversations = try await client.conversations.list()

// Filter for the ones from your app
let myAppConversations = conversations.filter {
  guard let conversationID = $0.context?.conversationID else {
    return false
  }

  return conversationID.hasPrefix("mydomain.xyz/")
}
```

### Decode a single message

<!--eng: provide code sample. showing swift for context of the kind of info you might want to provide. =)-->

You can decode a single `Envelope` from XMTP using the `decode` method:

```swift
let conversation = try await client.conversations.newConversation(with: "0x3F11b27F323b62B159D2642964fa27C46C841897")

// Assume this function returns an Envelope that contains a message for the above conversation
let envelope = getEnvelopeFromXMTP()

let decodedMessage = try conversation.decode(envelope)
```

### Serialize/Deserialize conversations

<!--eng: provide code sample. showing swift for context of the kind of info you might want to provide. =)-->

You can save a conversation object locally using its `encodedContainer` property. This returns a `ConversationContainer` object which conforms to `Codable`.

```swift
// Get a conversation
let conversation = try await client.conversations.newConversation(with: "0x3F11b27F323b62B159D2642964fa27C46C841897")

// Get a container.
let container = conversation.encodedContainer

// Dump it to JSON
let encoder = JSONEncoder()
let data = try encoder.encode(container)

// Get it back from JSON
let decoder = JSONDecoder()
let containerAgain = try decoder.decode(ConversationContainer.self, from: data)

// Get an actual Conversation object like we had above
let decodedConversation = containerAgain.decode(with: client)
try await decodedConversation.send(text: "hi")
```

### Handle different types of content

<!--eng: provide code sample. showing javascript for context of the kind of info you might want to provide. =)-->

All send functions support `SendOptions` as an optional parameter. The `contentType` option allows specifying different types of content than the default simple string standard content type, which is identified with content type identifier `ContentTypeText`.

To learn more about content types, see [Content types with XMTP](https://xmtp.org/docs/dev-concepts/content-types).

Support for other types of content can be added by registering additional `ContentCodecs` with the `Client`. Every codec is associated with a content type identifier, `ContentTypeId`, which is used to signal to the client which codec should be used to process the content that is being sent or received.

For example, see the [Codecs](https://github.com/xmtp/xmtp-js/tree/main/src/codecs) available in `xmtp-js`.

If there is a concern that the recipient may not be able to handle a non-standard content type, the sender can use the `contentFallback` option to provide a string that describes the content being sent. If the recipient fails to decode the original content, the fallback will replace it and can be used to inform the recipient what the original content was.

```ts
// Assuming we've loaded a fictional NumberCodec that can be used to encode numbers,
// and is identified with ContentTypeNumber, we can use it as follows.

xmtp.registerCodec:(new NumberCodec())
conversation.send(3.14, {
  contentType: ContentTypeNumber,
  contentFallback: 'sending you a pie'
})
```

Additional codecs can be configured through the `ClientOptions` parameter of `Client.create`. The `codecs` option is a list of codec instances that should be added to the default set of codecs (currently only the `TextCodec`). If a codec is added for a content type that is already in the default set, it will replace the original codec.

```ts
// Adding support for `xmtp.org/composite` content type
import { CompositeCodec } from '@xmtp/xmtp-js'
const xmtp = Client.create(wallet, { codecs: [new CompositeCodec()] })
```

To learn more about how to build a custom content type, see [Build a custom content type](https://xmtp.org/docs/client-sdk/javascript/tutorials/use-content-types#build-a-custom-content-type).

Custom codecs and content types may be proposed as interoperable standards through XRCs. To learn about the custom content type proposal process, see [XIP-5](https://github.com/xmtp/XIPs/blob/main/XIPs/xip-5-message-content-types.md).

### Compression

<!--eng: provide code sample. showing swift for context of the kind of info you might want to provide. =)-->

Message content can be optionally compressed using the compression option. The value of the option is the name of the compression algorithm to use. Currently supported are gzip and deflate. Compression is applied to the bytes produced by the content codec.

Content will be decompressed transparently on the receiving end. Note that `Client` enforces maximum content size. The default limit can be overridden through the `ClientOptions`. Consequently a message that would expand beyond that limit on the receiving end will fail to decode.

```swift
try await conversation.send(text: '#'.repeat(1000), options: .init(compression: .gzip))
```

### Manually handle private key storage

<!--eng: provide code sample. showing javascript for context of the kind of info you might want to provide. =)-->

The SDK will handle key storage for the user by encrypting the private key bundle using a signature generated from the wallet, and storing the encrypted payload on the XMTP network. This can be awkward for some server-side applications, where you may only want to give the application access to the XMTP keys but not your wallet keys. Mobile applications may also want to store keys in a secure enclave rather than rely on decrypting the remote keys on the network each time the application starts up.

You can export the unencrypted key bundle using the static method `Client.getKeys`, save it somewhere secure, and then provide those keys at a later time to initialize a new client using the exported XMTP identity.

```javascript
import { Client } from '@xmtp/xmtp-js'
// Get the keys using a valid Signer. Save them somewhere secure.
const keys = await Client.getKeys(wallet)
// Create a client using keys returned from getKeys
const client = await Client.create(null, { privateKeyOverride: keys })
```

The keys returned by `getKeys` should be treated with the utmost care as compromise of these keys will allow an attacker to impersonate the user on the XMTP network. Ensure these keys are stored somewhere secure and encrypted.

### Cache conversations

<!--eng: provide code sample. showing javascript for context of the kind of info you might want to provide. =)-->

As a performance optimization, you may want to persist the list of conversations in your application outside of the SDK to speed up the first call to `client.conversations.list()`.

The exported conversation list contains encryption keys for any V2 conversations included in the list. As such, you should treat it with the same care that you treat private keys.

You can get a JSON serializable list of conversations by calling:

```javascript
const client = await Client.create(wallet)
const conversations = await client.conversations.export()
saveConversationsSomewhere(JSON.stringify(conversations))
To load the conversations in a new SDK instance you can run:

const client = await Client.create(wallet)
const conversations = JSON.parse(loadConversationsFromSomewhere())
await client.conversations.import(conversations)
```

## 🏗 **Breaking revisions**

Because `xmtp-react-native` is in active development, you should expect breaking revisions that might require you to adopt the latest SDK release to enable your app to continue working as expected.

XMTP communicates about breaking revisions in the [XMTP Discord community](https://discord.gg/xmtp), providing as much advance notice as possible. Additionally, breaking revisions in an `xmtp-react-native` release are described on the [Releases page](https://github.com/xmtp/xmtp-react-native/releases).

## Deprecation

Older versions of the SDK will eventually be deprecated, which means:

1. The network will not support and eventually actively reject connections from clients using deprecated versions.
2. Bugs will not be fixed in deprecated versions.

The following table provides the deprecation schedule.

| Announced  | Effective  | Minimum Version | Rationale                                                                                                         |
| ---------- | ---------- | --------------- | ----------------------------------------------------------------------------------------------------------------- |
| There are no deprecations scheduled for `xmtp-react-native` at this time. |  |          |  |

<!--jha add this section back in once prod and local are supported: XMTP `production` and `dev` network environments-->
