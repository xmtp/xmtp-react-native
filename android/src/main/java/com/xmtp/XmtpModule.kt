package com.xmtp

import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

import android.net.Uri
import android.util.Base64
import android.util.Base64.NO_WRAP
import android.util.Log
import androidx.core.net.toUri
import com.facebook.react.bridge.Promise
import com.google.gson.JsonParser
import com.google.protobuf.kotlin.toByteString
import com.xmtp.wrappers.ContentJson
import com.xmtp.wrappers.ConversationWrapper
import com.xmtp.wrappers.DecodedMessageWrapper
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.suspendCancellableCoroutine
import org.json.JSONObject
import org.xmtp.android.library.Client
import org.xmtp.android.library.ClientOptions
import org.xmtp.android.library.Conversation
import org.xmtp.android.library.PreEventCallback
import org.xmtp.android.library.PreparedMessage
import org.xmtp.android.library.SendOptions
import org.xmtp.android.library.SigningKey
import org.xmtp.android.library.XMTPEnvironment
import org.xmtp.android.library.XMTPException
import org.xmtp.android.library.codecs.Attachment
import org.xmtp.android.library.codecs.AttachmentCodec
import org.xmtp.android.library.codecs.EncodedContent
import org.xmtp.android.library.codecs.EncryptedEncodedContent
import org.xmtp.android.library.codecs.RemoteAttachment
import org.xmtp.android.library.codecs.decoded
import org.xmtp.android.library.messages.EnvelopeBuilder
import org.xmtp.android.library.messages.InvitationV1ContextBuilder
import org.xmtp.android.library.messages.Pagination
import org.xmtp.android.library.messages.PrivateKeyBuilder
import org.xmtp.android.library.messages.Signature
import org.xmtp.android.library.messages.getPublicKeyBundle
import org.xmtp.android.library.push.XMTPPush
import org.xmtp.proto.keystore.api.v1.Keystore.TopicMap.TopicData
import org.xmtp.proto.message.api.v1.MessageApiOuterClass
import org.xmtp.proto.message.contents.PrivateKeyOuterClass
import java.io.File
import java.util.Date
import java.util.UUID
import kotlin.coroutines.Continuation
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class ReactNativeSigner(var module: XMTPModule, override var address: String) : SigningKey {
  private val continuations: MutableMap<String, Continuation<Signature>> = mutableMapOf()

  fun handle(id: String, signature: String) {
    val continuation = continuations[id] ?: return
    val signatureData = Base64.decode(signature.toByteArray(), NO_WRAP)
    if (signatureData == null || signatureData.size != 65) {
      continuation.resumeWithException(XMTPException("Invalid Signature"))
      continuations.remove(id)
      return
    }
    val sig = Signature.newBuilder().also {
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
    module.sendEvent("sign", Arguments.createMap().apply { putString("id",request.id); putString("message", request.message) })
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

fun Conversation.cacheKey(clientAddress: String): String {
  return "${clientAddress}:${topic}"
}

class XMTPModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private fun apiEnvironments(env: String, appVersion: String?): ClientOptions.Api {
    return when (env) {
      "local" -> ClientOptions.Api(
        env = XMTPEnvironment.LOCAL,
        isSecure = false,
        appVersion = appVersion
      )

      "production" -> ClientOptions.Api(
        env = XMTPEnvironment.PRODUCTION,
        isSecure = true,
        appVersion = appVersion
      )

      else -> ClientOptions.Api(
        env = XMTPEnvironment.DEV,
        isSecure = true,
        appVersion = appVersion
      )
    }
  }

  private var clients: MutableMap<String, Client> = mutableMapOf()
  private var xmtpPush: XMTPPush? = null
  private var signer: ReactNativeSigner? = null
  private val isDebugEnabled = BuildConfig.DEBUG // TODO: consider making this configurable
  private val conversations: MutableMap<String, Conversation> = mutableMapOf()
  private val subscriptions: MutableMap<String, Job> = mutableMapOf()
  private var preEnableIdentityCallbackDeferred: CompletableDeferred<Unit>? = null
  private var preCreateIdentityCallbackDeferred: CompletableDeferred<Unit>? = null

  override fun getName(): String {
    return NAME
  }

  companion object {
    const val NAME = "XMTPModule"
  }

  @ReactMethod
  fun addListener(eventName: String?) {
    // Required for rn built in EventEmitter Calls.
  }

  @ReactMethod
  fun removeListeners(count: Int?) {
    // Required for rn built in EventEmitter Calls.
  }

  @ReactMethod
  fun address(clientAddress: String) {
    logV("address")
    val client = clients[clientAddress]
    client?.address ?: "No Client."
  }

  //
  // Auth functions
  //
  @ReactMethod
  fun auth(address: String, environment: String, appVersion: String?, hasCreateIdentityCallback: Boolean?, hasEnableIdentityCallback: Boolean?) {
    logV("auth")
    val reactSigner = ReactNativeSigner(module = this@XMTPModule, address = address)
    signer = reactSigner

    if (hasCreateIdentityCallback == true)
      preCreateIdentityCallbackDeferred = CompletableDeferred()
    if (hasEnableIdentityCallback == true)
      preEnableIdentityCallbackDeferred = CompletableDeferred()
    val preCreateIdentityCallback: PreEventCallback? =
      preCreateIdentityCallback.takeIf { hasCreateIdentityCallback == true }
    val preEnableIdentityCallback: PreEventCallback? =
      preEnableIdentityCallback.takeIf { hasEnableIdentityCallback == true }
    val options = ClientOptions(
      api = apiEnvironments(environment, appVersion),
      preCreateIdentityCallback = preCreateIdentityCallback,
      preEnableIdentityCallback = preEnableIdentityCallback
    )
    clients[address] = Client().create(account = reactSigner, options = options)
    ContentJson.Companion
    signer = null
    sendEvent("authed")
  }

  @ReactMethod
  fun receiveSignature(requestID: String, signature: String) {
    logV("receiveSignature")
    signer?.handle(id = requestID, signature = signature)
  }

  @ReactMethod
  fun createRandom(environment: String, appVersion: String?, hasCreateIdentityCallback: Boolean?, hasEnableIdentityCallback: Boolean?, promise: Promise) {
    logV("createRandom")
    val privateKey = PrivateKeyBuilder()

    if (hasCreateIdentityCallback == true)
      preCreateIdentityCallbackDeferred = CompletableDeferred()
    if (hasEnableIdentityCallback == true)
      preEnableIdentityCallbackDeferred = CompletableDeferred()
    val preCreateIdentityCallback: PreEventCallback? =
      preCreateIdentityCallback.takeIf { hasCreateIdentityCallback == true }
    val preEnableIdentityCallback: PreEventCallback? =
      preEnableIdentityCallback.takeIf { hasEnableIdentityCallback == true }

    val options = ClientOptions(
      api = apiEnvironments(environment, appVersion),
      preCreateIdentityCallback = preCreateIdentityCallback,
      preEnableIdentityCallback = preEnableIdentityCallback
    )
    val randomClient = Client().create(account = privateKey, options = options)
    ContentJson.Companion
    clients[randomClient.address] = randomClient
    promise.resolve(randomClient.address)
  }

  @ReactMethod
  fun createFromKeyBundle(keyBundle: String, environment: String, appVersion: String?, promise: Promise) {
    try {
      logV("createFromKeyBundle")
      val options = ClientOptions(api = apiEnvironments(environment, appVersion))
      val bundle =
        PrivateKeyOuterClass.PrivateKeyBundle.parseFrom(
          Base64.decode(
            keyBundle,
            NO_WRAP
          )
        )
      val client = Client().buildFromBundle(bundle = bundle, options = options)
      ContentJson.Companion
      clients[client.address] = client
      promise.resolve(client.address)
    } catch (e: Exception) {
      throw XMTPException("Failed to create client: $e")
    }
  }

  @ReactMethod
  fun sign(clientAddress: String, digest: List<Int>, keyType: String, preKeyIndex: Int, promise: Promise) {
    logV("sign")
    val client = clients[clientAddress] ?: throw XMTPException("No client")
    val digestBytes =
      digest.foldIndexed(ByteArray(digest.size)) { i, a, v ->
        a.apply {
          set(
            i,
            v.toByte()
          )
        }
      }
    val privateKeyBundle = client.keys
    val signedPrivateKey = if (keyType == "prekey") {
      privateKeyBundle.preKeysList[preKeyIndex]
    } else {
      privateKeyBundle.identityKey
    }
    val signature = runBlocking {
      val privateKey = PrivateKeyBuilder.buildFromSignedPrivateKey(signedPrivateKey)
      PrivateKeyBuilder(privateKey).sign(digestBytes)
    }
    promise.resolve(signature.toByteArray().map { it.toInt() and 0xFF })
  }

  @ReactMethod
  fun exportPublicKeyBundle(clientAddress: String, promise: Promise) {
    logV("exportPublicKeyBundle")
    val client = clients[clientAddress] ?: throw XMTPException("No client")
    promise.resolve(client.keys.getPublicKeyBundle().toByteArray().map { it.toInt() and 0xFF })
  }

  @ReactMethod
  fun exportKeyBundle(clientAddress: String, promise: Promise) {
    logV("exportKeyBundle")
    val client = clients[clientAddress] ?: throw XMTPException("No client")
    promise.resolve(Base64.encodeToString(client.privateKeyBundle.toByteArray(), NO_WRAP))
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun preCreateIdentityCallbackCompleted() {
    logV("preCreateIdentityCallbackCompleted")
    preCreateIdentityCallbackDeferred?.complete(Unit)
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun preEnableIdentityCallbackCompleted() {
    logV("preEnableIdentityCallbackCompleted")
    preEnableIdentityCallbackDeferred?.complete(Unit)
  }


  fun sendEvent(eventName: String, params: WritableMap? = null) {
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, params)
  }

  //
  // Helpers
  //

  private fun findConversation(
    clientAddress: String,
    topic: String,
  ): Conversation? {
    val client = clients[clientAddress] ?: throw XMTPException("No client")

    val cacheKey = "${clientAddress}:${topic}"
    val cacheConversation = conversations[cacheKey]
    if (cacheConversation != null) {
      return cacheConversation
    } else {
      val conversation = client.conversations.list()
        .firstOrNull { it.topic == topic }
      if (conversation != null) {
        conversations[conversation.cacheKey(clientAddress)] = conversation
        return conversation
      }
    }
    return null
  }

  private fun subscribeToConversations(clientAddress: String) {
    val client = clients[clientAddress] ?: throw XMTPException("No client")

    subscriptions[getConversationsKey(clientAddress)]?.cancel()
    subscriptions[getConversationsKey(clientAddress)] = CoroutineScope(Dispatchers.IO).launch {
      try {
        client.conversations.stream().collect { conversation ->
          run {
            if (conversation.keyMaterial == null) {
              logV("Null key material before encode conversation")
            }
            sendEvent(
              "conversation",
              Arguments.createMap().apply {
                putString("clientAddress", clientAddress)
                putMap("conversation", ConversationWrapper.encodeToObj(
                  client,
                  conversation
                ))
              }
            )
          }
        }
      } catch (e: Exception) {
        Log.e("XMTPModule", "Error in conversations subscription: $e")
        subscriptions[getConversationsKey(clientAddress)]?.cancel()
      }
    }
  }

  private fun subscribeToAllMessages(clientAddress: String) {
    val client = clients[clientAddress] ?: throw XMTPException("No client")

    subscriptions[getMessagesKey(clientAddress)]?.cancel()
    subscriptions[getMessagesKey(clientAddress)] = CoroutineScope(Dispatchers.IO).launch {
      try {
        client.conversations.streamAllDecryptedMessages().collect { message ->
          sendEvent(
            "message",
            //mapOf(
              //"clientAddress" to clientAddress,
              //"message" to DecodedMessageWrapper.encodeMap(message),
            //)
          )
        }
      } catch (e: Exception) {
        Log.e("XMTPModule", "Error in all messages subscription: $e")
        subscriptions[getMessagesKey(clientAddress)]?.cancel()
      }
    }
  }

  private fun subscribeToMessages(clientAddress: String, topic: String) {
    val conversation =
      findConversation(
        clientAddress = clientAddress,
        topic = topic
      ) ?: return
    subscriptions[conversation.cacheKey(clientAddress)]?.cancel()
    subscriptions[conversation.cacheKey(clientAddress)] =
      CoroutineScope(Dispatchers.IO).launch {
        try {
          conversation.streamDecryptedMessages().collect { message ->
            sendEvent(
              "message",
              //mapOf(
              //  "clientAddress" to clientAddress,
              //  "message" to DecodedMessageWrapper.encodeMap(message),
              //)
            )
          }
        } catch (e: Exception) {
          Log.e("XMTPModule", "Error in messages subscription: $e")
          subscriptions[conversation.cacheKey(clientAddress)]?.cancel()
        }
      }
  }

  private fun getMessagesKey(clientAddress: String): String {
    return "messages:$clientAddress"
  }

  private fun getConversationsKey(clientAddress: String): String {
    return "conversations:$clientAddress"
  }

  private fun unsubscribeFromMessages(
    clientAddress: String,
    topic: String,
  ) {
    val conversation =
      findConversation(
        clientAddress = clientAddress,
        topic = topic
      ) ?: return
    subscriptions[conversation.cacheKey(clientAddress)]?.cancel()
  }

  private fun logV(msg: String) {
    if (isDebugEnabled) {
      Log.v("XMTPModule", msg)
    }
  }

  private val preEnableIdentityCallback: suspend () -> Unit = {
    sendEvent("preEnableIdentityCallback")
    preEnableIdentityCallbackDeferred?.await()
    preCreateIdentityCallbackDeferred == null
  }

  private val preCreateIdentityCallback: suspend () -> Unit = {
    sendEvent("preCreateIdentityCallback")
    preCreateIdentityCallbackDeferred?.await()
    preCreateIdentityCallbackDeferred = null
  }
}
