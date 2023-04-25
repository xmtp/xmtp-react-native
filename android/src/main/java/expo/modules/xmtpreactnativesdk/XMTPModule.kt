package expo.modules.xmtpreactnativesdk

import android.util.Base64
import com.google.protobuf.kotlin.toByteString
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.xmtp.android.library.SigningKey
import org.xmtp.android.library.XMTPException
import org.xmtp.android.library.messages.Signature
import org.xmtp.proto.message.contents.SignatureOuterClass
import kotlin.coroutines.Continuation
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine
import org.xmtp.android.library.Client
import org.xmtp.android.library.Conversation
import org.xmtp.android.library.messages.InvitationV1ContextBuilder
import org.xmtp.android.library.messages.PrivateKeyBuilder
import java.util.UUID

class ReactNativeSigner(var module: XMTPModule, override var address: String) : SigningKey {
  var continuations: Map<String, Continuation<SignatureOuterClass.Signature>> = mapOf()

  fun handle(id: String, signature: String) {
    val continuation = continuations[id] ?: return
    val signatureData = Base64.decode(signature.toByteArray(), Base64.NO_WRAP)
    if (signatureData == null || signatureData.size != 65) {
      continuation.resumeWithException(XMTPException("Invalid Signature"))
      continuations.remove(id)
      return
    }
    val sig = SignatureOuterClass.Signature.newBuilder().also {
      it.ecdsaCompact = it.ecdsaCompact.toBuilder().also { builder ->
        builder.bytes = signatureData.take(64).toByteArray().toByteString()
        builder.recovery = signatureData[64].toInt()
      }.build()
    }.build()
    continuation.resume(sig)
    continuations.remove(id)
  }
  override suspend fun sign(data: ByteArray): Signature {
    val request = SignatureRequest(message = String(data, Charsets.UTF_8))
    module.sendEvent("sign", mapOf<"id" , request.id, "message" , request.message>)
    return suspendCancellableCoroutine { continuation ->
      continuations[request.id] = continuation
    }
  }
  override suspend fun sign(message: String): Signature =
    sign(message.toByteArray())
}
data class SignatureRequest(
  var id: String = UUID.randomUUID().toString(),
  var message: String,
)
val Conversation.cacheKey: String
  get() {
    if (conversationId != "") {
      return "${topic}:${conversationId}"
    } else {
      return topic
    }
  }

class XMTPModule : Module() {
  var client: Client? = null
  var signer: ReactNativeSigner? = null
  var conversations: Map<String, Conversation> = mapOf()
  var subscriptions: Map<String, Task<Void, Never>> = mapOf()
  override fun definition() = ModuleDefinition {
    Name("XMTP")
    Events("sign", "authed", "conversation", "message")

    Function("address") {   ->
      if (client) {
        return client.address
      } else {
        return "No Client."
      }
    }
    //
    // Auth fucntions
    //
    Function("auth") { address  ->
      val signer = ReactNativeSigner(module = this, address = address)
      this.signer = signer
      this.client = Client().create(account = signer)
      this.signer = null
      sendEvent("authed")
    }
    Function("receiveSignature") { requestID, signature  ->
      signer?.handle(id = requestID, signature = signature)
    }
    // Generate a random wallet and set the client to that
    Function("createRandom") {   ->
      val privateKey = PrivateKeyBuilder()
      val client = Client().create(account = privateKey)
      this.client = client
      client.address
    }
    //
    // Client API
    Function("listConversations") {   ->
      if (!client) {
        throw Error.noClient
      }
      val conversations = client.conversations.list()
      conversations.map { conversation  ->
        this.conversations[conversation.cacheKey] = conversation
        ConversationWrapper.encode(conversation)
      }
    }
    // TODO: Support pagination and conversation ID here, don't do a full lookup each time
    Function("loadMessages") { conversationTopic, conversationId  ->
      if (!client) {
        throw Error.noClient
      }
      val conversation = findConversation(topic = conversationTopic, conversationId = conversationId) ?: throw Error.conversationNotFound("no conversation found for ${conversationTopic}")
      conversation.messages(after = Date.init(timeIntervalSince1970 = 0)).map { DecodedMessageWrapper.encode(it) }
    }
    // TODO: Support content types (?????)
    Function("sendMessage") { conversationTopic, conversationId, content  ->
      if (!client) {
        throw XMTPException("No Client")
      }
      val conversation = findConversation(topic = conversationTopic, conversationId = conversationId) ?: throw Error.conversationNotFound("no conversation found for ${conversationTopic}")
      val preparedMessage = conversation.prepareMessage(content = content)
      val decodedMessage = preparedMessage.decodedMessage()
      preparedMessage.send()
      DecodedMessageWrapper.encode(decodedMessage)
    }
    // TODO: Support conversationID
    Function("createConversation") { peerAddress, conversationId  ->
      if (client == null) {
        throw XMTPException("No Client")
      } else {
        val conversation = client!!.conversations.newConversation(peerAddress,
          context = InvitationV1ContextBuilder.buildFromConversation(conversationId = conversationId ?: "", metadata = mapOf()))
        ConversationWrapper.encode(conversation)
      }
    }
    Function("subscribeToConversations") { subscribeToConversations() }
    Function("subscribeToMessages") { topic, conversationID  ->
      subscribeToMessages(topic = topic, conversationId = conversationID)
    }
    Function("unsubscribeFromMessages") { topic, conversationID  ->
      unsubscribeFromMessages(topic = topic, conversationId = conversationID)
    }
    // Defines a JavaScript function that always returns a Promise and whose native code
    // is by default dispatched on the different thread than the JavaScript runtime runs on.
    AsyncFunction("setValueAsync") { value: String ->
      // Send an event to JavaScript.
      sendEvent("onChange", mapOf(
        "value" to value
      ))
    }
  }

  //
  // Helpers
  //
  fun findConversation(topic: String, conversationId: String?) : Conversation? {
    if (client == null) {
      throw XMTPException("No Client")
    }
    val cacheKey: String
    if (conversationId != "") {
      cacheKey = "${topic}:${conversationId}"
    } else {
      cacheKey = topic
    }
    val conversation = conversations[cacheKey]
    if (conversation != null) {
      return conversation
    } else val conversation = client.conversations.list().firstOrNull()(where = { it.topic == topic && it.conversationId == conversationId })
    if (conversation != null) {
      conversations[conversation.cacheKey] = conversation
      return conversation
    }
    return null
  }

  fun subscribeToConversations() {
    if (client == null) {
      return
    }
    subscriptions["conversations"] = Task { do {
      for (conversation in client.conversations.stream()) {
        sendEvent("conversation", mapOf<"topic" , conversation.topic, "peerAddress" , conversation.peerAddress, "version" , if (conversation.version == .v1) "v1" else "v2", "conversationID" , conversation.conversationID>)
      }
    } catch {
      print("Error in conversations subscription: ${error}")
      subscriptions["conversations"]?.cancel()
    } }
  }

  fun subscribeToMessages(topic: String, conversationId: String?) {
    val conversation = findConversation(topic = topic, conversationId = conversationId) ?: return
    subscriptions[conversation.cacheKey] = Task { do {
      for (message in conversation.streamMessages()) {
        print("GOT A MESSAGE IN SWIFT ${message}")
        sendEvent("message", mapOf<"topic" , conversation.topic, "conversationID" , conversation.conversationId, "messageJSON" , DecodedMessageWrapper.encode(message)>)
      }
    } catch {
      print("Error in messages subscription: ${error}")
      subscriptions[conversation.cacheKey]?.cancel()
    } }
  }

  fun unsubscribeFromMessages(topic: String, conversationId: String?) {
    val conversation = findConversation(topic = topic, conversationId = conversationId) ?: return
    subscriptions[conversation.cacheKey]?.cancel()
  }
}

