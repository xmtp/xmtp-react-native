package com.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import com.google.gson.JsonParser

class PreparedLocalMessage(
    val messageId: String,
    val preparedFileUri: String,
    val preparedAt: Long,
) {
    companion object {
        fun fromJson(json: String): PreparedLocalMessage {
            val obj = JsonParser.parseString(json).asJsonObject
            return PreparedLocalMessage(
                obj.get("messageId").asString,
                obj.get("preparedFileUri").asString,
                obj.get("preparedAt").asNumber.toLong(),
            )
        }
    }

    fun toJson(): String = GsonBuilder().create().toJson(mapOf(
        "messageId" to messageId,
        "preparedFileUri" to preparedFileUri,
        "preparedAt" to preparedAt,
    ))
}
