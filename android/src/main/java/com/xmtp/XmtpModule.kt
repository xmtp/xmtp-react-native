package com.xmtp

import com.facebook.react.bridge.ReactApplicationContext
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
import com.facebook.react.bridge.ReadableArray
import com.google.gson.JsonParser
import com.google.protobuf.kotlin.toByteString
import com.xmtp.wrappers.ConsentWrapper
import com.xmtp.wrappers.ConsentWrapper.Companion.consentStateToString
import com.xmtp.wrappers.ContentJson
import com.xmtp.wrappers.ConversationWrapper
import com.xmtp.wrappers.DecodedMessageWrapper
import com.xmtp.wrappers.DecryptedLocalAttachment
import com.xmtp.wrappers.EncryptedLocalAttachment
import com.xmtp.wrappers.PreparedLocalMessage
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
    module.sendEvent("sign", Arguments.createMap().apply {
      putString("id",request.id)
      putString("message", request.message)
    })
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
      promise.reject("Failed to create client", e)
      //throw XMTPException("Failed to create client: $e")
    }
  }

  @ReactMethod
  fun sign(clientAddress: String, digest: ReadableArray, keyType: String, preKeyIndex: Int, promise: Promise) {
    logV("sign")
    val client = clients[clientAddress] ?: throw XMTPException("No client")
    val digestList: List<Int> = (0 until digest.size()).map { digest.getInt(it) }
    val digestBytes =
      digestList.foldIndexed(ByteArray(digestList.size)) { i, a, v ->
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
    val result = signature.toByteArray().map { it.toInt() and 0xFF }
    promise.resolve(Arguments.fromList(result))
  }

  @ReactMethod
  fun exportPublicKeyBundle(clientAddress: String, promise: Promise) {
    logV("exportPublicKeyBundle")
    val client = clients[clientAddress] ?: throw XMTPException("No client")
    val result = client.keys.getPublicKeyBundle().toByteArray().map { it.toInt() and 0xFF }
    promise.resolve(Arguments.fromList(result))
  }

  @ReactMethod
  fun exportKeyBundle(clientAddress: String, promise: Promise) {
    logV("exportKeyBundle")
    val client = clients[clientAddress] ?: throw XMTPException("No client")
    promise.resolve(Base64.encodeToString(client.privateKeyBundle.toByteArray(), NO_WRAP))
  }

  // Export the conversation's serialized topic data.
  @ReactMethod
  fun exportConversationTopicData(clientAddress: String, topic: String, promise: Promise) {
    logV("exportConversationTopicData")
    val conversation = findConversation(clientAddress, topic)
      ?: throw XMTPException("no conversation found for $topic")
    promise.resolve(Base64.encodeToString(conversation.toTopicData().toByteArray(), NO_WRAP))
  }

  @ReactMethod
  fun getHmacKeys(clientAddress: String, promise: Promise) {
    logV("getHmacKeys")
    val client = clients[clientAddress] ?: throw XMTPException("No client")
    val hmacKeys = client.conversations.getHmacKeys()
    promise.resolve(hmacKeys.toByteArray().map { it.toInt() and 0xFF })
  }

  // Import a conversation from its serialized topic data.
  @ReactMethod
  fun importConversationTopicData(clientAddress: String, topicData: String, promise: Promise) {
    logV("importConversationTopicData")
    val client = clients[clientAddress] ?: throw XMTPException("No client")
    val data = TopicData.parseFrom(Base64.decode(topicData, NO_WRAP))
    val conversation = client.conversations.importTopicData(data)
    conversations[conversation.cacheKey(clientAddress)] = conversation
    if (conversation.keyMaterial == null) {
      logV("Null key material before encode conversation")
    }
    promise.resolve(ConversationWrapper.encode(client, conversation))
  }

  //
  // Client API
  @ReactMethod
 fun canMessage(clientAddress: String, peerAddress: String, promise: Promise) {
    logV("canMessage")
    val client = clients[clientAddress] ?: throw XMTPException("No client")

    promise.resolve(client.canMessage(peerAddress))
  }

  @ReactMethod
  fun staticCanMessage(peerAddress: String, environment: String, appVersion: String?, promise: Promise) {
    try {
      logV("staticCanMessage")
      val options = ClientOptions(api = apiEnvironments(environment, appVersion))
      promise.resolve(Client.canMessage(peerAddress = peerAddress, options = options))
    } catch (e: Exception) {
      throw XMTPException("Failed to create client: ${e.message}")
    }
  }

  @ReactMethod
  fun encryptAttachment(clientAddress: String, fileJson: String, promise: Promise) {
    logV("encryptAttachment")
    val client = clients[clientAddress] ?: throw XMTPException("No client")
    val file = DecryptedLocalAttachment.fromJson(fileJson)
    val uri = Uri.parse(file.fileUri)
    val data = reactApplicationContext.contentResolver
      ?.openInputStream(uri)
      ?.use { it.buffered().readBytes() }!!
    val attachment = Attachment(
      filename = uri.lastPathSegment ?: "",
      mimeType = file.mimeType,
      data.toByteString(),
    )
    val encrypted = RemoteAttachment.encodeEncrypted(
      attachment,
      AttachmentCodec()
    )
    val encryptedFile = File.createTempFile(UUID.randomUUID().toString(), null)
    encryptedFile.writeBytes(encrypted.payload.toByteArray())

    promise.resolve(EncryptedLocalAttachment.from(
      attachment,
      encrypted,
      encryptedFile.toUri()
    ).toJson())
  }

  @ReactMethod
  fun decryptAttachment(clientAddress: String, encryptedFileJson: String, promise: Promise) {
    logV("decryptAttachment")
    val client = clients[clientAddress] ?: throw XMTPException("No client")
    val encryptedFile = EncryptedLocalAttachment.fromJson(encryptedFileJson)
    val encryptedData = reactApplicationContext.contentResolver
      ?.openInputStream(Uri.parse(encryptedFile.encryptedLocalFileUri))
      ?.use { it.buffered().readBytes() }!!
    val encrypted = EncryptedEncodedContent(
      encryptedFile.metadata.contentDigest,
      encryptedFile.metadata.secret,
      encryptedFile.metadata.salt,
      encryptedFile.metadata.nonce,
      encryptedData.toByteString(),
      encryptedData.size,
      encryptedFile.metadata.filename,
    )
    val encoded: EncodedContent = RemoteAttachment.decryptEncoded(encrypted)
    val attachment = encoded.decoded<Attachment>()!!
    val file = File.createTempFile(UUID.randomUUID().toString(), null)
    file.writeBytes(attachment.data.toByteArray())
    promise.resolve(DecryptedLocalAttachment(
      fileUri = file.toURI().toString(),
      mimeType = attachment.mimeType,
      filename = attachment.filename
    ).toJson())
  }

  @ReactMethod
  fun sendEncodedContent(clientAddress: String, topic: String, encodedContentData: ReadableArray, promise: Promise) {
    val conversation =
      findConversation(
        clientAddress = clientAddress,
        topic = topic
      ) ?: throw XMTPException("no conversation found for $topic")
    val encodedContentDataList: List<Int> = (0 until encodedContentData.size()).map { encodedContentData.getInt(it) }
    val encodedContentDataBytes =
      encodedContentDataList.foldIndexed(ByteArray(encodedContentDataList.size)) { i, a, v ->
        a.apply {
          set(
            i,
            v.toByte()
          )
        }
      }
    val encodedContent = EncodedContent.parseFrom(encodedContentDataBytes)

    promise.resolve(conversation.send(encodedContent = encodedContent))
  }

  @ReactMethod
  fun listConversations(clientAddress: String, promise: Promise) {
    logV("listConversations")
    val client = clients[clientAddress] ?: throw XMTPException("No client")
    val conversationList = client.conversations.list()
    val result = conversationList.map { conversation ->
      conversations[conversation.cacheKey(clientAddress)] = conversation
      if (conversation.keyMaterial == null) {
        logV("Null key material before encode conversation")
      }
      ConversationWrapper.encodeToObj(client, conversation)
    }
    val array = Arguments.createArray()
    result.map {
      array.pushMap(it)
    }
    promise.resolve(array)
  }

  @ReactMethod
  fun loadMessages(clientAddress: String, topic: String, limit: Int?, before: String?, after: String?, direction: String?, promise: Promise) {
    logV("loadMessages")
    val conversation =
      findConversation(
        clientAddress = clientAddress,
        topic = topic,
      ) ?: throw XMTPException("no conversation found for $topic")
    val beforeDate = if (before != null) Date(before) else null
    val afterDate = if (after != null) Date(after) else null

    promise.resolve(conversation.decryptedMessages(
      limit = limit,
      before = beforeDate,
      after = afterDate,
      direction = MessageApiOuterClass.SortDirection.valueOf(
        direction ?: "SORT_DIRECTION_DESCENDING"
      )
    )
      .map { DecodedMessageWrapper.encode(it) })
  }

  @ReactMethod
  fun loadBatchMessages(clientAddress: String, topics: ReadableArray, promise: Promise) {
    logV("loadBatchMessages")
    val client = clients[clientAddress] ?: throw XMTPException("No client")
    val topicsList = mutableListOf<Pair<String, Pagination>>()
    val _topicsList: List<String> = (0 until topics.size()).map { topics.getString(it) }

    _topicsList.forEach {
      val jsonObj = JSONObject(it)
      val topic = jsonObj.get("topic").toString()
      var limit: Int? = null
      var before: Long? = null
      var after: Long? = null
      var direction: MessageApiOuterClass.SortDirection =
        MessageApiOuterClass.SortDirection.SORT_DIRECTION_DESCENDING

      try {
        limit = jsonObj.get("limit").toString().toInt()
        before = jsonObj.get("before").toString().toLong()
        after = jsonObj.get("after").toString().toLong()
        direction = MessageApiOuterClass.SortDirection.valueOf(
          if (jsonObj.get("direction").toString().isNullOrBlank()) {
            "SORT_DIRECTION_DESCENDING"
          } else {
            jsonObj.get("direction").toString()
          }
        )
      } catch (e: Exception) {
        Log.e(
          "XMTPModule",
          "Pagination given incorrect information ${e.message}"
        )
      }

      val page = Pagination(
        limit = if (limit != null && limit > 0) limit else null,
        before = if (before != null && before > 0) Date(before) else null,
        after = if (after != null && after > 0) Date(after) else null,
        direction = direction
      )

      topicsList.add(Pair(topic, page))
    }

    promise.resolve(client.conversations.listBatchDecryptedMessages(topicsList)
      .map { DecodedMessageWrapper.encode(it) })
  }

  @ReactMethod
  fun sendMessage(clientAddress: String, conversationTopic: String, contentJson: String, promise: Promise) {
    logV("sendMessage")
    val conversation =
      findConversation(
        clientAddress = clientAddress,
        topic = conversationTopic
      )
        ?: throw XMTPException("no conversation found for $conversationTopic")
    val sending = ContentJson.fromJson(contentJson)
    promise.resolve(conversation.send(
      content = sending.content,
      options = SendOptions(contentType = sending.type)
    ))
  }

  @ReactMethod
  fun prepareMessage(clientAddress: String, conversationTopic: String, contentJson: String, promise: Promise) {
    logV("prepareMessage")
    val conversation =
      findConversation(
        clientAddress = clientAddress,
        topic = conversationTopic
      )
        ?: throw XMTPException("no conversation found for $conversationTopic")
    val sending = ContentJson.fromJson(contentJson)
    val prepared = conversation.prepareMessage(
      content = sending.content,
      options = SendOptions(contentType = sending.type)
    )
    val preparedAtMillis = prepared.envelopes[0].timestampNs / 1_000_000
    val preparedFile = File.createTempFile(prepared.messageId, null)
    preparedFile.writeBytes(prepared.toSerializedData())
    val result = Arguments.createMap().apply {
      putString("messageId",prepared.messageId)
      putString("preparedFileUri", preparedFile.toURI().toString())
      putDouble("preparedAt", preparedAtMillis.toDouble())
    }
    promise.resolve(result)
  }

  @ReactMethod
  fun prepareEncodedMessage(clientAddress: String, conversationTopic: String, encodedContentData: ReadableArray, promise: Promise) {
    logV("prepareEncodedMessage")
    val conversation =
      findConversation(
        clientAddress = clientAddress,
        topic = conversationTopic
      )
        ?: throw XMTPException("no conversation found for $conversationTopic")
    val encodedContentDataList: List<Int> = (0 until encodedContentData.size()).map { encodedContentData.getInt(it) }
    val encodedContentDataBytes =
      encodedContentDataList.foldIndexed(ByteArray(encodedContentDataList.size)) { i, a, v ->
        a.apply {
          set(
            i,
            v.toByte()
          )
        }
      }
    val encodedContent = EncodedContent.parseFrom(encodedContentDataBytes)

    val prepared = conversation.prepareMessage(
      encodedContent = encodedContent,
    )
    val preparedAtMillis = prepared.envelopes[0].timestampNs / 1_000_000
    val preparedFile = File.createTempFile(prepared.messageId, null)
    preparedFile.writeBytes(prepared.toSerializedData())
    promise.resolve(PreparedLocalMessage(
      messageId = prepared.messageId,
      preparedFileUri = preparedFile.toURI().toString(),
      preparedAt = preparedAtMillis.toDouble(),
    ).toJson())
  }

  @ReactMethod
  fun sendPreparedMessage(clientAddress: String, preparedLocalMessageJson: String, promise: Promise) {
    logV("sendPreparedMessage")
    val client = clients[clientAddress] ?: throw XMTPException("No client")
    val local = PreparedLocalMessage.fromJson(preparedLocalMessageJson)
    val preparedFileUrl = Uri.parse(local.preparedFileUri)
    val contentResolver = reactApplicationContext.contentResolver!!
    val preparedData = contentResolver.openInputStream(preparedFileUrl)!!
      .use { it.buffered().readBytes() }
    val prepared = PreparedMessage.fromSerializedData(preparedData)
    client.publish(envelopes = prepared.envelopes)
    try {
      contentResolver.delete(preparedFileUrl, null, null)
    } catch (ignore: Exception) {
      /* ignore: the sending succeeds even if we fail to rm the tmp file afterward */
    }
    promise.resolve(prepared.messageId)
  }

  @ReactMethod
  fun createConversation(clientAddress: String, peerAddress: String, contextJson: String, promise: Promise) {
    logV("createConversation: $contextJson")
    val client = clients[clientAddress] ?: throw XMTPException("No client")
    val context = JsonParser.parseString(contextJson).asJsonObject
    val conversation = client.conversations.newConversation(
      peerAddress,
      context = InvitationV1ContextBuilder.buildFromConversation(
        conversationId = when {
          context.has("conversationID") -> context.get("conversationID").asString
          else -> ""
        },
        metadata = when {
          context.has("metadata") -> {
            val metadata = context.get("metadata").asJsonObject
            metadata.entrySet().associate { (key, value) -> key to value.asString }
          }

          else -> mapOf()
        },
      )
    )
    if (conversation.keyMaterial == null) {
      logV("Null key material before encode conversation")
    }
    promise.resolve(ConversationWrapper.encodeToObj(client, conversation))
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun subscribeToConversations(clientAddress: String) {
    logV("subscribeToConversations")
    subscribeToConversationsPrivate(clientAddress = clientAddress)
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun subscribeToAllMessages(clientAddress: String) {
    logV("subscribeToAllMessages")
    subscribeToAllMessagesPrivate(clientAddress = clientAddress)
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun subscribeToMessages(clientAddress: String, topic: String) {
    logV("subscribeToMessages")
    subscribeToMessagesPrivate(
      clientAddress = clientAddress,
      topic = topic
    )
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun unsubscribeFromConversations(clientAddress: String) {
    logV("unsubscribeFromConversations")
    subscriptions[getConversationsKey(clientAddress)]?.cancel()
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun unsubscribeFromAllMessages(clientAddress: String) {
    logV("unsubscribeFromAllMessages")
    subscriptions[getMessagesKey(clientAddress)]?.cancel()
  }

  @ReactMethod
  fun unsubscribeFromMessages(clientAddress: String, topic: String) {
    logV("unsubscribeFromMessages")
    unsubscribeFromMessagesPrivate(
      clientAddress = clientAddress,
      topic = topic
    )
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun registerPushToken(pushServer: String, token: String) {
    logV("registerPushToken")
    xmtpPush = XMTPPush(reactApplicationContext, pushServer)
    xmtpPush?.register(token)
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun subscribePushTopics(topics: ReadableArray) {
    logV("subscribePushTopics")
    val topicsList: List<String> = (0 until topics.size()).map { topics.getString(it) }
    if (topicsList.isNotEmpty()) {
      if (xmtpPush == null) {
        throw XMTPException("Push server not registered")
      }
      xmtpPush?.subscribe(topicsList)
    }
  }

  @ReactMethod
  fun decodeMessage(clientAddress: String, topic: String, encryptedMessage: String, promise: Promise) {
    logV("decodeMessage")
    val encryptedMessageData = Base64.decode(encryptedMessage, NO_WRAP)
    val envelope = EnvelopeBuilder.buildFromString(topic, Date(), encryptedMessageData)
    val conversation =
      findConversation(
        clientAddress = clientAddress,
        topic = topic
      )
        ?: throw XMTPException("no conversation found for $topic")
    val decodedMessage = conversation.decrypt(envelope)
    promise.resolve(DecodedMessageWrapper.encode(decodedMessage))
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun isAllowed(clientAddress: String, address: String) {
    logV("isAllowed")
    val client = clients[clientAddress] ?: throw XMTPException("No client")
    client.contacts.isAllowed(address)
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun isDenied(clientAddress: String, address: String) {
    logV("isDenied")
    val client = clients[clientAddress] ?: throw XMTPException("No client")
    client.contacts.isDenied(address)
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun denyContacts(clientAddress: String, addresses: ReadableArray) {
    logV("denyContacts")
    val addressesList: List<String> = (0 until addresses.size()).map { addresses.getString(it) }
    val client = clients[clientAddress] ?: throw XMTPException("No client")
    client.contacts.deny(addressesList)
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun allowContacts(clientAddress: String, addresses: ReadableArray) {
    val addressesList: List<String> = (0 until addresses.size()).map { addresses.getString(it) }
    val client = clients[clientAddress] ?: throw XMTPException("No client")
    client.contacts.allow(addressesList)
  }

  @ReactMethod
  fun refreshConsentList(clientAddress: String, promise: Promise) {
    val client = clients[clientAddress] ?: throw XMTPException("No client")
    val consentList = client.contacts.refreshConsentList()
    promise.resolve(consentList.entries.map { ConsentWrapper.encode(it.value) })
  }

  @ReactMethod
  fun conversationConsentState(clientAddress: String, conversationTopic: String, promise: Promise) {
    val conversation = findConversation(clientAddress, conversationTopic)
      ?: throw XMTPException("no conversation found for $conversationTopic")
    promise.resolve(consentStateToString(conversation.consentState()))
  }

  @ReactMethod
  fun consentList(clientAddress: String, promise: Promise) {
    val client = clients[clientAddress] ?: throw XMTPException("No client")
    promise.resolve(client.contacts.consentList.entries.map { ConsentWrapper.encode(it.value) })
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

  private fun subscribeToConversationsPrivate(clientAddress: String) {
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

  private fun subscribeToAllMessagesPrivate(clientAddress: String) {
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

  private fun subscribeToMessagesPrivate(clientAddress: String, topic: String) {
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

  private fun unsubscribeFromMessagesPrivate(
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
