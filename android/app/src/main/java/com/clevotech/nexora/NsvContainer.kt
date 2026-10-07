package com.clevotech.nexora

import android.content.ContentResolver
import android.net.Uri
import org.json.JSONObject
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.UUID

object NsvContainer {
    private const val HEADER_LIMIT = 64 * 1024
    private const val MAX_CHUNK = NsvProtocol.CHUNK_SIZE + 16

    private fun u32(v: Int) = ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN).putInt(v).array()
    private fun readU32(input: java.io.BufferedInputStream): Int {
        val b = ByteArray(4)
        if (input.read(b) != 4) error("Malformed container")
        return ByteBuffer.wrap(b).order(ByteOrder.LITTLE_ENDIAN).int
    }
    private fun readExact(input: java.io.BufferedInputStream, out: ByteArray) {
        var p = 0
        while (p < out.size) {
            val n = input.read(out, p, out.size - p)
            if (n < 0) error("Unexpected end of container")
            p += n
        }
    }
    private fun headerBytes(salt: ByteArray, name: String, size: Long, created: String, operationId: String): ByteArray {
        val h = JSONObject()
        h.put("magic", "NSV1"); h.put("version", 1); h.put("algorithm", "AES-256-GCM"); h.put("kdf", "Argon2id")
        h.put("salt", salt.joinToString("") { "%02x".format(it) }); h.put("chunkSize", NsvProtocol.CHUNK_SIZE)
        h.put("originalName", name.replace('\\', '_').replace('/', '_')); h.put("originalSize", size.toString())
        h.put("createdAt", created); h.put("operationId", operationId)
        return h.toString().toByteArray(Charsets.UTF_8)
    }

    fun encrypt(resolver: ContentResolver, input: Uri, output: Uri, password: CharArray, fileName: String, createdAt: String): Long {
        val size = resolver.openAssetFileDescriptor(input, "r")?.use { it.length } ?: -1L
        require(size >= 0) { "Unable to determine input size" }
        val salt = NsvCrypto.newSalt()
        val key = NsvCrypto.deriveKey(password, salt)
        val hb = headerBytes(salt, fileName, size, createdAt, UUID.randomUUID().toString().replace("-", ""))
        require(hb.size <= HEADER_LIMIT) { "Header too large" }
        var total = 0L
        resolver.openInputStream(input)!!.buffered().use { src ->
            resolver.openOutputStream(output, "w")!!.buffered().use { dst ->
                dst.write(u32(hb.size)); dst.write(hb)
                val buf = ByteArray(NsvProtocol.CHUNK_SIZE); var seq = 0
                while (true) {
                    val n = src.read(buf); if (n < 0) break; if (n == 0) continue
                    val nonce = NsvCrypto.newNonce()
                    val ct = NsvCrypto.encryptChunk(key, buf.copyOf(n), nonce, hb + u32(seq))
                    dst.write(u32(seq)); dst.write(byteArrayOf(12)); dst.write(nonce); dst.write(u32(ct.size)); dst.write(ct)
                    total += n; seq++
                }
                dst.flush()
            }
        }
        key.fill(0); password.fill('\u0000')
        return total
    }

    fun decrypt(resolver: ContentResolver, input: Uri, output: Uri, password: CharArray): Long {
        var total = 0L
        resolver.openInputStream(input)!!.buffered().use { src ->
            val headerLen = readU32(src)
            require(headerLen in 1..HEADER_LIMIT) { "Invalid header length" }
            val hb = ByteArray(headerLen); readExact(src, hb)
            val h = JSONObject(String(hb, Charsets.UTF_8))
            require(h.optString("magic") == "NSV1" && h.optInt("version") == 1) { "Unsupported container" }
            require(h.optString("algorithm") == "AES-256-GCM" && h.optString("kdf") == "Argon2id") { "Unsupported container" }
            require(h.optInt("chunkSize") == NsvProtocol.CHUNK_SIZE) { "Invalid chunk size" }
            val salt = ByteArray(16)
            val saltHex = h.optString("salt")
            require(saltHex.length == 32) { "Invalid salt" }
            for (i in salt.indices) salt[i] = saltHex.substring(i * 2, i * 2 + 2).toInt(16).toByte()
            val expectedSize = h.optString("originalSize").toLongOrNull() ?: error("Invalid original size")
            val key = NsvCrypto.deriveKey(password, salt)
            try {
                resolver.openOutputStream(output, "w")!!.buffered().use { dst ->
                    val buf4 = ByteArray(4); var expectedSeq = 0
                    while (true) {
                        val first = src.read()
                        if (first < 0) break
                        buf4[0] = first.toByte(); readExact(src, buf4, 1)
                        val seq = ByteBuffer.wrap(buf4).order(ByteOrder.LITTLE_ENDIAN).int
                        require(seq == expectedSeq) { "Invalid chunk sequence" }
                        val nonceLen = src.read(); require(nonceLen == 12) { "Invalid nonce" }
                        val nonce = ByteArray(12); readExact(src, nonce)
                        readExact(src, buf4)
                        val clen = ByteBuffer.wrap(buf4).order(ByteOrder.LITTLE_ENDIAN).int
                        require(clen in 16..MAX_CHUNK) { "Invalid ciphertext length" }
                        val ct = ByteArray(clen); readExact(src, ct)
                        val plain = try { NsvCrypto.decryptChunk(key, ct, nonce, hb + u32(seq)) }
                        catch (_: Exception) { error("Authentication failed") }
                        total += plain.size
                        require(total <= expectedSize) { "Integrity/size verification failed" }
                        dst.write(plain); expectedSeq++
                    }
                    require(total == expectedSize) { "Integrity/size verification failed" }
                    dst.flush()
                }
            } finally { key.fill(0) }
        }
        password.fill('\u0000')
        return total
    }
}
