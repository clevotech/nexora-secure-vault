package com.clevotech.nexora

import android.content.ContentResolver
import android.net.Uri
import org.json.JSONObject
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.UUID

object NsvContainer {
    private const val HEADER_LIMIT = 64 * 1024

    private fun u32(v: Int) = ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN).putInt(v).array()
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
                    val aad = hb + u32(seq)
                    val ct = NsvCrypto.encryptChunk(key, buf.copyOf(n), nonce, aad)
                    dst.write(u32(seq)); dst.write(byteArrayOf(12)); dst.write(nonce); dst.write(u32(ct.size)); dst.write(ct)
                    total += n; seq++
                }
                dst.flush()
            }
        }
        key.fill(0); password.fill('\u0000')
        return total
    }
}
