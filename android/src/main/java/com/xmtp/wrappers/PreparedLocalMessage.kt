package com.xmtp.wrappers

import com.google.gson.GsonBuilder
import com.google.gson.JsonParser

class PreparedLocalMessage(
    val messageId: String,
    val preparedFileUri: String,
    val preparedAt: Double,
) {
    companion object {
        fun fromJson(json: String): PreparedLocalMessage {
            val obj = JsonParser.parseString(json).asJsonObject
            return PreparedLocalMessage(
                obj.get("messageId").asString,
                obj.get("preparedFileUri").asString,
                obj.get("preparedAt").asNumber.toDouble(),
            )
        }
    }

    fun toJson(): String = GsonBuilder().create().toJson(mapOf(
        "messageId" to messageId,
        "preparedFileUri" to preparedFileUri,
        "preparedAt" to preparedAt,
    ))
}
