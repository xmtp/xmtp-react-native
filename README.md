# xmtp-react-native

![Lint](https://github.com/xmtp/xmtp-android/actions/workflows/lint.yml/badge.svg) ![Status](https://img.shields.io/badge/Project_Status-Beta-yellow)

This repo provides a package you can use to build with XMTP in a React Native or Expo app.

> **Important**  
> This SDK is in **beta** status and ready for you to start experimenting with.
>
> However, we do **not** recommend using beta software in production apps. Software in this status will change as we add features and iterate based on feedback.

We're still working on adding several features to bring this SDK to parity with the [XMTP client SDK for JavaScript](https://github.com/xmtp/xmtp-js) (`xmtp-js`). Here's a [list of features and issues](https://github.com/xmtp/xmtp-react-native/issues/14) we're working on.

Is there a feature you need that's not on the list? Please [open an issue](https://github.com/xmtp/xmtp-react-native/issues).

Or better yet, open a PR and we'll get it reviewed and merged as soon as possible. If you contribute a PR that gets merged into this repo, you'll be eligible to [claim this XMTP contributor POAP](https://www.gitpoap.io/gp/1042)!

To learn more about XMTP and get answers to frequently asked questions, see [XMTP documentation](https://xmtp.org/docs).

![x-red-sm](https://user-images.githubusercontent.com/510695/163488403-1fb37e86-c673-4b48-954e-8460ae4d4b05.png)

## Reference docs

You can use the `xmtp-js` client SDK [reference documentation](https://xmtp-js.pages.dev/modules) as reference documentation for this SDK.

## Quickstart app

<!--Per our offsite discussion, I think this is a quickstart app, not an example app? If we make this change, I think we need to change the directory name.-->

Use the [XMTP React Native quickstart app](example) as a tool to start building an app with XMTP. This basic messaging app has an intentionally unopinionated UI to help make it easier for you to build with.

Follow the [React Native guide](https://reactnative.dev/docs/environment-setup) to set up a CLI environment.

To use the quickstart app, run:

```bash
cd example
npm install --force
npm run [ios or android]
```

## Install in a managed Expo project

```bash
npx expo prebuild
```

## Install in bare React Native project

For bare React Native projects, [install and configure the `expo` package](https://docs.expo.dev/bare/installing-expo-modules/) before continuing.

### Add the package to your npm dependencies

```bash
npm i @xmtp/react-native-sdk
```

### Configure for iOS

```bash
npx pod-install
```

<!--any thoughts on providing more details here?-->

We're working on testing the end-to-end installation and will provide more platform-specific configuration details.

### Configure for Android

Your app must use Android `minSdkVersion = 22` to work with the `xmtp-react-native` SDK.

<!--any thoughts on providing more details here?-->

We're working on testing the end-to-end installation and will provide more platform-specific configuration details.

## Usage

The [XMTP message API](https://xmtp.org/docs/concepts/architectural-overview#network-layer) revolves around a network client that allows retrieving and sending messages to other network participants. A client must be connected to a wallet on startup. If this is the very first time the client is created, the client will generate a [key bundle](https://xmtp.org/docs/concepts/key-generation-and-usage) that is used to [encrypt and authenticate messages](https://xmtp.org/docs/concepts/invitation-and-message-encryption). The key bundle persists encrypted in the network using a [wallet signature](https://xmtp.org/docs/concepts/account-signatures). The public side of the key bundle is also regularly advertised on the network to allow parties to establish shared encryption keys. All this happens transparently, without requiring any additional code.

<!--as discussed, use the README from xmtp-js as the basis for this README. In the code samples, I changed @xmtp/xmtp-js in the imports to @xmtp/xmtp-react-native - correct?-->

<!--I also changed the language in the code fences from tsx to js - correct?-->

```js
import { Client } from '@xmtp/xmtp-react-native'
import { Wallet } from 'ethers'

// You'll want to replace this with a wallet from your application
const wallet = Wallet.createRandom()
// Create the client with your wallet. This will connect to the XMTP development network by default
const xmtp = await Client.create(wallet)
// Start a conversation with XMTP
const conversation = await xmtp.conversations.newConversation(
  '0x3F11b27F323b62B159D2642964fa27C46C841897'
)
// Load all messages in the conversation
const messages = await conversation.messages()
// Send a message
await conversation.send('gm')
// Listen for new messages in the conversation
for await (const message of await conversation.streamMessages()) {
  console.log(`[${message.senderAddress}]: ${message.content}`)
}
```

Currently, network nodes are configured to rate limit high-volume publishing from clients. A rate-limited client can expect to receive a 429 status code response from a node. Rate limits can change at any time in the interest of maintaining network health.

## Create a client

<!--Signer.ts doesn't exist in this repo. How might we update this text below?-->

A client is created with `Client.create(wallet: Signer): Promise<Client>` that requires passing in a connected wallet that implements the [Signer](src/types/Signer.ts) interface. The client will request a wallet signature in two cases:

1. To sign the newly generated key bundle. This happens only the very first time when key bundle is not found in storage.
2. To sign a random salt used to encrypt the key bundle in storage. This happens every time the client is started (including the very first time).

> **Important**
> The client connects to the XMTP `dev` environment by default. [Use `ClientOptions`](#configure-the-client) to change this and other parameters of the network connection.

```js
import { Client } from '@xmtp/xmtp-react-native'
// Create the client with a `Signer` from your application
const xmtp = await Client.create(wallet)
```

### Configure the client

The client's network connection and key storage method can be configured with these optional parameters of `Client.create`:

| Parameter                 | Default                                                                           | Description                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| appVersion                | `undefined`                                                                       | Add a client app version identifier that's included with API requests.<br/>For example, you can use the following format: `appVersion: APP_NAME + '/' + APP_VERSION`.<br/>Setting this value provides telemetry that shows which apps are using the XMTP client SDK. This information can help XMTP developers provide app support, especially around communicating important SDK updates, including deprecations and required upgrades. |
| env                       | `dev`                                                                             | Connect to the specified XMTP network environment. Valid values include `dev`, `production`, or `local`. For important details about working with these environments, see [XMTP `production` and `dev` network environments](#xmtp-production-and-dev-network-environments).                                                                                                                                                             |
| apiUrl                    | `undefined`                                                                       | Manually specify an API URL to use. If specified, value of `env` will be ignored.                                                                                                                                                                                                                                                                                                                                                        |
| keystoreProviders         | `[StaticKeystoreProvider, NetworkKeystoreProvider, KeyGeneratorKeystoreProvider]` | Override the default behaviour of how the client creates a Keystore with a custom provider. This can be used to get the user's private keys from a different storage mechanism.                                                                                                                                                                                                                                                          |
| persistConversations      | `true`                                                                            | Maintain a cache of previously seen V2 conversations in the storage provider (defaults to `LocalStorage`).                                                                                                                                                                                                                                                                                                                               |
| skipContactPublishing     | `false`                                                                           | Do not publish the user's contact bundle to the network on client creation. Designed to be used in cases where the client session is short-lived (for example, decrypting a push notification), and where it is known that a client instance has been instantiated with this flag set to false at some point in the past.                                                                                                                |
| codecs                    | `[TextCodec]`                                                                     | Add codecs to support additional content types.                                                                                                                                                                                                                                                                                                                                                                                          |
| maxContentSize            | `100M`                                                                            | Maximum message content size in bytes.                                                                                                                                                                                                                                                                                                                                                                                                   |
| preCreateIdentityCallback | `undefined`                                                                       | `preCreateIdentityCallback` is a function that will be called immediately before a [Create Identity wallet signature](https://xmtp.org/docs/concepts/account-signatures#sign-to-create-an-xmtp-identity) is requested from the user.                                                                                                                                                                                                 |
| preEnableIdentityCallback | `undefined`                                                                       | `preEnableIdentityCallback` is a function that will be called immediately before an [Enable Identity wallet signature](https://xmtp.org/docs/concepts/account-signatures#sign-to-enable-an-xmtp-identity) is requested from the user.                                                                                                                                                                                                |

## Handle conversations

Most of the time, when interacting with the network, you'll want to do it through `conversations`. Conversations are between two wallets.

```js
import { Client } from '@xmtp/xmtp-react-native'
// Create the client with a `Signer` from your application
const xmtp = await Client.create(wallet)
const conversations = xmtp.conversations
```

### List existing conversations

You can get a list of all conversations that have one or more messages.

```js
const allConversations = await xmtp.conversations.list()
// Say gm to everyone you've been chatting with
for (const conversation of allConversations) {
  console.log(`Saying GM to ${conversation.peerAddress}`)
  await conversation.send('gm')
}
```

These conversations include all conversations for a user **regardless of which app created the conversation.** This functionality provides the concept of an [interoperable inbox](https://xmtp.org/docs/concepts/interoperable-inbox), which enables a user to access all of their conversations in any app built with XMTP.

### Listen for new conversations

You can also listen for new conversations being started in real-time. This will allow applications to display incoming messages from new contacts.

**Warning**: This stream will continue infinitely. To end the stream you can either break from the loop, or call `await stream.return()`.

```js
const stream = await xmtp.conversations.stream()
for await (const conversation of stream) {
  console.log(`New conversation started with ${conversation.peerAddress}`)
  // Say hello to your new friend
  await conversation.send('Hi there!')
  // Break from the loop to stop listening
  break
}
```

### Start a new conversation

You can create a new conversation with any Ethereum address on the XMTP network.

```js
const newConversation = await xmtp.conversations.newConversation(
  '0x3F11b27F323b62B159D2642964fa27C46C841897'
)
```

### Cache conversations

When running in a browser, conversations are cached in `LocalStorage` by default. Running `client.conversations.list()` will update that cache and persist the results to the browsers `LocalStorage`. The data stored in `LocalStorage` is encrypted and signed using the Keystore's identity key so that attackers cannot read the sensitive contents or tamper with them.

To disable this behavior, set the `persistConversations` client option to `false`.

```js
const clientWithNoCache = await Client.create(wallet, {
  persistConversations: false,
})
```

## Handle messages

To be able to send a message, the recipient must have already started their client at least once and consequently advertised their key bundle on the network. Messages are addressed using wallet addresses. The message payload can be a plain string, but other types of content can be supported through the use of `SendOptions` (see [Different types of content](#different-types-of-content) for more details)

```js
const conversation = await xmtp.conversations.newConversation(
  '0x3F11b27F323b62B159D2642964fa27C46C841897'
)
await conversation.send('Hello world')
```

### List messages in a conversation

You can receive the complete message history in a conversation by calling `conversation.messages()`

```js
for (const conversation of await xmtp.conversations.list()) {
  // All parameters are optional and can be omitted
  const opts = {
    // Only show messages from last 24 hours
    startTime: new Date(new Date().setDate(new Date().getDate() - 1)),
    endTime: new Date(),
  }
  const messagesInConversation = await conversation.messages(opts)
}
```

### List messages in a conversation with pagination

It may be helpful to retrieve and process the messages in a conversation page by page. You can do this by calling `conversation.messagesPaginated()` which will return an [AsyncGenerator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator) yielding one page of results at a time. `conversation.messages()` uses this under the hood internally to gather all messages.

```js
const conversation = await xmtp.conversations.newConversation(
  '0x3F11b27F323b62B159D2642964fa27C46C841897'
)

for await (const page of conversation.messagesPaginated({ pageSize: 25 })) {
  for (const msg of page) {
    // Breaking from the outer loop will stop the client from requesting any further pages
    if (msg.content === 'gm') {
      return
    }
    console.log(msg.content)
  }
}
```

### Listen for new messages in a conversation

You can listen for any new messages (incoming or outgoing) in a conversation by calling `conversation.streamMessages()`.

A successfully received message (that makes it through the decoding and decryption without throwing) can be trusted to be authentic, i.e. that it was sent by the owner of the `message.senderAddress` wallet and that it wasn't modified in transit. The `message.sent` timestamp can be trusted to have been set by the sender.

The Stream returned by the `stream` methods is an asynchronous iterator and as such usable by a for-await-of loop. Note however that it is by its nature infinite, so any looping construct used with it will not terminate, unless the termination is explicitly initiated (by breaking the loop or by an external call to `Stream.return()`)

```js
const conversation = await xmtp.conversations.newConversation(
  '0x3F11b27F323b62B159D2642964fa27C46C841897'
)
for await (const message of await conversation.streamMessages()) {
  if (message.senderAddress === xmtp.address) {
    // This message was sent from me
    continue
  }
  console.log(`New message from ${message.senderAddress}: ${message.content}`)
}
```

### Listen for new messages in all conversations

To listen for any new messages from _all_ conversations, use `conversations.streamAllMessages()`.

> **Note**
> There is a chance this stream can miss messages if multiple new conversations are received in the time it takes to update the stream to include a new conversation.

```js
for await (const message of await xmtp.conversations.streamAllMessages()) {
  if (message.senderAddress === xmtp.address) {
    // This message was sent from me
    continue
  }
  console.log(`New message from ${message.senderAddress}: ${message.content}`)
}
```

## Check if an address is on the network

If you would like to check and see if a blockchain address is registered on the network before instantiating a client instance, you can use `Client.canMessage`.

```js
import { Client } from '@xmtp/xmtp-react-native'

const isOnDevNetwork = await Client.canMessage(
  '0x3F11b27F323b62B159D2642964fa27C46C841897'
)
const isOnProdNetwork = await Client.canMessage(
  '0x3F11b27F323b62B159D2642964fa27C46C841897',
  { env: 'production' }
)
```

## Send a broadcast message

You can send a broadcast message (1:many message or announcement) with XMTP. The recipient sees the message as a DM from the sending wallet address.

> **Note**  
> If your app stores a signature to read and send XMTP messages on behalf of a user, be sure to let users know. As a best practice, your app should also provide a way for a user to delete their signature. For example disclosure text and UI patterns, see [Disclose signature storage](https://xmtp.org/docs/tutorials/broadcast#disclose-signature-storage).

1. Use the bulk query `canMessage` method to identify the wallet addresses that are activated on the XMTP network.
2. Send the message to all of the activated wallet addresses.

For example:

```js
const ethers = require('ethers')
const { Client } = require('@xmtp/xmtp-react-native')

async function main() {
  //Create a random wallet for example purposes. On the frontend you should replace it with the user's wallet (metamask, rainbow, etc)
  const wallet = ethers.Wallet.createRandom()
  //Initialize the xmtp client
  const xmtp = await Client.create(wallet)

  //In this example we are going to broadcast to the GM_BOT wallet (already activated) and a random wallet (not activated)
  const GM_BOT = '0x937C0d4a6294cdfa575de17382c7076b579DC176'
  const test = ethers.Wallet.createRandom()
  const broadcasts_array = [GM_BOT, test.address]

  //Querying the activation status of the wallets
  const broadcasts_canMessage = await Client.canMessage(broadcasts_array)
  for (let i = 0; i < broadcasts_array.length; i++) {
    //Checking the activation status of each wallet
    const wallet = broadcasts_array[i]
    const canMessage = broadcasts_canMessage[i]
    if (broadcasts_canMessage[i]) {
      //If activated, start
      const conversation = await xmtp.conversations.newConversation(wallet)
      // Send a message
      const sent = await conversation.send('gm')
    }
  }
}
main()
```

## Handle different types of content

All send functions support `SendOptions` as an optional parameter. The `contentType` option allows specifying different types of content than the default simple string standard content type, which is identified with content type identifier `ContentTypeText`.

To learn more about content types, see [Content types with XMTP](https://xmtp.org/docs/concepts/content-types).

Support for other types of content can be added by registering additional `ContentCodecs` with the `Client`. Every codec is associated with a content type identifier, `ContentTypeId`, which is used to signal to the client which codec should be used to process the content that is being sent or received.

<!--not sure about the Codecs link - WDYT?-->

For example, see the [Codecs](https://github.com/xmtp/xmtp-react-native/blob/main/src/lib/CodecRegistry.ts) available in `xmtp-react-native`.

If there is a concern that the recipient may not be able to handle a non-standard content type, the sender can use the `contentFallback` option to provide a string that describes the content being sent. If the recipient fails to decode the original content, the fallback will replace it and can be used to inform the recipient what the original content was.

```js
// Assuming we've loaded a fictional NumberCodec that can be used to encode numbers,
// and is identified with ContentTypeNumber, we can use it as follows.

xmtp.registerCodec:(new NumberCodec())
conversation.send(3.14, {
  contentType: ContentTypeNumber,
  contentFallback: 'sending you a pie'
})
```

Additional codecs can be configured through the `ClientOptions` parameter of `Client.create`. The `codecs` option is a list of codec instances that should be added to the default set of codecs (currently only the `TextCodec`). If a codec is added for a content type that is already in the default set, it will replace the original codec.

```js
// Adding support for `xmtp.org/composite` content type
import { CompositeCodec } from '@xmtp/xmtp-react-native'
const xmtp = Client.create(wallet, { codecs: [new CompositeCodec()] })
```

To learn more about how to build a custom content type, see [Build a custom content type](https://xmtp.org/docs/concepts/content-types#build-a-custom-content-type).

Custom codecs and content types may be proposed as interoperable standards through XRCs. To learn about the custom content type proposal process, see [XIP-5](https://github.com/xmtp/XIPs/blob/main/XIPs/xip-5-message-content-types.md).

## Compression

Message content can be optionally compressed using the `compression` option. The value of the option is the name of the compression algorithm to use. Currently supported are `gzip` and `deflate`. Compression is applied to the bytes produced by the content codec.

Content will be decompressed transparently on the receiving end. Note that `Client` enforces maximum content size. The default limit can be overridden through the `ClientOptions`. Consequently a message that would expand beyond that limit on the receiving end will fail to decode.

```js
import { Compression } from '@xmtp/xmtp-react-native'

conversation.send('#'.repeat(1000), {
  compression: Compression.COMPRESSION_DEFLATE,
})
```

## Manually handle private key storage

The SDK will handle key storage for the user by encrypting the private key bundle using a signature generated from the wallet, and storing the encrypted payload on the XMTP network. This can be awkward for some server-side applications, where you may only want to give the application access to the XMTP keys but not your wallet keys. Mobile applications may also want to store keys in a secure enclave rather than rely on decrypting the remote keys on the network each time the application starts up.

You can export the unencrypted key bundle using the static method `Client.getKeys`, save it somewhere secure, and then provide those keys at a later time to initialize a new client using the exported XMTP identity.

```js
import { Client } from '@xmtp/xmtp-react-native'
// Get the keys using a valid Signer. Save them somewhere secure.
const keys = await Client.getKeys(wallet)
// Create a client using keys returned from getKeys
const client = await Client.create(null, { privateKeyOverride: keys })
```

The keys returned by `getKeys` should be treated with the utmost care as compromise of these keys will allow an attacker to impersonate the user on the XMTP network. Ensure these keys are stored somewhere secure and encrypted.

## Enable the quickstart app to send push notifications

You can use a Firebase Cloud Messaging server and an example push notification server to enable the `xmtp-react-native` quickstart app to send push notifications.

Perform this setup to understand how you might want to enable push notifications for your own app built with the `xmtp-react-native` SDK.

### Set up a Firebase Cloud Messaging server

For this tutorial, we'll use [Firebase Cloud Messaging](https://console.firebase.google.com/) (FCM) as a convenient way to set up a messaging server.

1. Create an FCM project.

2. Add the quickstart app to the FCM project. This generates a `google-services.json` file that you need in subsequent steps.

3. Add the `google-services.json` file to the quickstart app's project as described in the FCM project creation process.

4. Generate FCM credentials, which you need to run the example notification server. To do this, from the FCM dashboard, click the gear icon next to **Project Overview** and select **Project settings**. Select **Service accounts**. Select **Go** and click **Generate new private key**. 

### Run an example notification server

Now that you have an FCM server set up, take a look at the [export-kotlin-proto-code](https://github.com/xmtp/example-notification-server-go/tree/np/export-kotlin-proto-code) branch in the `example-notifications-server-go` repo. 

This example branch can serve as the basis for what you might want to provide for your own notification server. The branch also demonstrates how to generate the proto code if you decide to perform these tasks for your own app. This proto code from the example notification server has already been generated in the `xmtp-android` quickstart app.

**To run a notification server based on the example branch:**

1. Clone the [example-notification-server-go](https://github.com/xmtp/example-notification-server-go) repo.

2. Complete the steps in [Local Setup](https://github.com/xmtp/example-notification-server-go/blob/np/export-kotlin-proto-code/README.md#local-setup).

3. Get the FCM project ID and FCM credentials you created earlier and run:

    ```bash
      YOURFCMJSON=`cat YOURFIREBASEADMINFROMSTEP4.json` 
    ```

    ```bash
    dev/run \                                                                     
    --xmtp-listener-tls \
    --xmtp-listener \
    --api \
    -x "production.xmtp.network:5556" \
    -d "postgres://postgres:xmtp@localhost:25432/postgres?sslmode=disable" \
    --fcm-enabled \
    --fcm-credentials-json=$YOURFCMJSON \
    --fcm-project-id="YOURFCMPROJECTID"
    ```

4. You should now be able to see push notifications coming across the local network.

### Update the Android quickstart app to send push notifications

1. Checkout the `push-notifications-example` branch

2. Add your `google-services.json` file to the `example/android/app` folder if you haven't already done it as a part of the FCM project creation process.

3. Uncomment `apply plugin: 'com.google.gms.google-services'` in the quickstart app's `build.gradle` file.

4. Uncomment `classpath('com.google.gms:google-services:4.3.15')` in the top level of the quickstart app's `build.gradle` file.

5. Sync the gradle project.

6. Replace `YOUR_SERVER_ADDRESS` in the `PullController.ts` file. If you're using the example notification server, it should be something like `YOURIPADDRESS:8080` since the Android emulator takes over localhost.

7. Change the quickstart app's environment to `production` in both places in `AuthView.tsx`.

8. Replace `YOUR_FIREBASE_SENDER_ID` in the `PullController.ts` with your sender ID from Firebase.

### Update the iOS quickstart app to send push notifications

<!--any thoughts on providing more details here?-->

Coming soon.

## 🏗 Breaking revisions

Because `xmtp-react-native` is in active development, you should expect breaking revisions that might require you to adopt the latest SDK release to enable your app to continue working as expected.

XMTP communicates about breaking revisions in the [XMTP Discord community](https://discord.gg/xmtp), providing as much advance notice as possible. Additionally, breaking revisions in an `xmtp-react-native` release are described on the [Releases page](https://github.com/xmtp/xmtp-react-native/releases).

### Deprecation

Older versions of the SDK will eventually be deprecated, which means:

1. The network will not support and eventually actively reject connections from clients using deprecated versions.
2. Bugs will not be fixed in deprecated versions.

Following table shows the deprecation schedule.

| Announced  | Effective  | Minimum Version | Rationale                                                                                                         |
| ---------- | ---------- | --------------- | ----------------------------------------------------------------------------------------------------------------- |
| 2022-08-18 | 2022-11-08 | v6.0.0          | XMTP network will stop supporting the Waku/libp2p based client interface in favor of the new GRPC based interface |

Issues and PRs are welcome in accordance with our [contribution guidelines](https://github.com/xmtp/.github/blob/main/CONTRIBUTING.md).

## XMTP `production` and `dev` network environments

XMTP provides both `production` and `dev` network environments to support the development phases of your project.

The `production` and `dev` networks are completely separate and not interchangeable.
For example, for a given blockchain account address, its XMTP identity on `dev` network is completely distinct from its XMTP identity on the `production` network, as are the messages associated with these identities. In addition, XMTP identities and messages created on the `dev` network can't be accessed from or moved to the `production` network, and vice versa.

> **Important**
> When you [create a client](#create-a-client), it connects to the XMTP `dev` environment by default. To learn how to use the `env` parameter to set your client's network environment, see [Configure the client](#configure-the-client).

The `env` parameter accepts one of three valid values: `dev`, `production`, or `local`. Here are some best practices for when to use each environment:

- `dev`: Use to have a client communicate with the `dev` network. As a best practice, set `env` to `dev` while developing and testing your app. Follow this best practice to isolate test messages to `dev` inboxes.

- `production`: Use to have a client communicate with the `production` network. As a best practice, set `env` to `production` when your app is serving real users. Follow this best practice to isolate messages between real-world users to `production` inboxes.

- `local`: Use to have a client communicate with an XMTP node you are running locally. For example, an XMTP node developer can set `env` to `local` to generate client traffic to test a node running locally.

The `production` network is configured to store messages indefinitely. XMTP may occasionally delete messages and keys from the `dev` network, and will provide advance notice in the [XMTP Discord community](https://discord.gg/xmtp).
