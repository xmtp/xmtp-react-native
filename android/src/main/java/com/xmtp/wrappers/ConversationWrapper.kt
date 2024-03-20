package com.xmtp.wrappers


import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.google.gson.GsonBuilder
import org.xmtp.android.library.Client
import org.xmtp.android.library.Conversation

class ConversationWrapper {

  companion object {
    fun encodeToObj(client: Client, conversation: Conversation): WritableMap {
      val context = when (conversation.version) {
        Conversation.Version.V2 -> {
          val metadata = conversation.conversationId?.let { conversation.toTopicData().invitation.context.metadataMap } ?: emptyMap() // Fetch metadata based on conversationId
          Arguments.createMap().apply {
            putString("conversationID", conversation.conversationId ?: "")
            putMap("metadata", Arguments.createMap().apply {
              metadata.entries.forEach {
                putString(it.key, it.value)
              }
            } )
          }
        }
        else -> Arguments.createMap() // Create an empty map for other versions
      }

      val result = Arguments.createMap().apply {
        putString("clientAddress", client.address)
        putDouble("createdAt", conversation.createdAt.time.toDouble())
        putMap("context", context)
        putString("topic", conversation.topic)
        putString("peerAddress", conversation.peerAddress)
        putString("version", conversation.version.toString())
        putString("conversationID", conversation.conversationId ?: "")
        putString("keyMaterial", conversation.keyMaterial?.let { Base64.encodeToString(it, Base64.NO_WRAP) } ?: "")
      }
      return result
    }

    fun encode(client: Client, conversation: Conversation): String {
      val gson = GsonBuilder().create()
      val obj = encodeToObj(client, conversation)
      return gson.toJson(obj)
    }
  }
}
