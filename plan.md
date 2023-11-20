Step 1: Make sure native SDKs provide hooks for just decrypting bytes to hand off to client
Step 2: Introduce two new types to RN SDK:

```ts

// JSContentCodecs just get the decrypted bytes from the native layer and encode/decode
// into JS objects, similar to how codecs work in the other SDKs. This should be suitable
// for small objects like replies, reactions, etc.
interface JSContentCodec<T> {
  encode(object: T): EncodedContent
  decode(encodedContent: EncodedContent): T
  fallback(object: T): string | undefined
}

// NativeContentCodecs perform both encryption as well as encoding operations in the native
// layer. These require swift/kotlin implementations
interface NativeContentCodec<T> {
  encode(object: T): EncodedContent
  decode(encodedContent: EncodedContent): T
  fallback(object: T): string | undefined
}

// To send a basic Reaction message:
type Reaction = {
  messageID: string,
  reaction: string
}

class ReactionCodec: JSContentCodec<Reaction> {
  encode(object: Reaction): EncodedContent {

  }

  encode(encodedContent: EncodedContent): Reaction {

  }
}

conversation.send(reaction, { codec: ReactionCodec })

// To send a remote attachment:
class RemoteAttachmentCodec: NativeContentCodec {

}



```
