package com.clevotech.nexora

import java.nio.ByteBuffer
import java.nio.ByteOrder

object NsvProtocol {
    const val MAGIC = "NSV1"
    const val VERSION = 1
    const val CHUNK_SIZE = 1024 * 1024

    fun readUInt32LE(bytes: ByteArray, offset: Int): Long =
        ByteBuffer.wrap(bytes, offset, 4).order(ByteOrder.LITTLE_ENDIAN).int.toLong() and 0xffffffffL

    fun writeUInt32LE(value: Int): ByteArray =
        ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN).putInt(value).array()

    fun validateHeader(magic: String, version: Int, algorithm: String, kdf: String) {
        require(magic == MAGIC) { "Invalid Nexora container" }
        require(version == VERSION) { "Unsupported Nexora version" }
        require(algorithm == "AES-256-GCM") { "Unsupported encryption algorithm" }
        require(kdf == "Argon2id") { "Unsupported key derivation function" }
    }
}
