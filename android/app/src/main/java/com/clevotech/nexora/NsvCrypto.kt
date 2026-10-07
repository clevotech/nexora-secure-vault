package com.clevotech.nexora

import org.bouncycastle.crypto.generators.Argon2BytesGenerator
import org.bouncycastle.crypto.params.Argon2Parameters
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

object NsvCrypto {
    private const val SALT_SIZE = 16
    private const val NONCE_SIZE = 12
    private const val KEY_SIZE = 32
    private const val TAG_BITS = 128

    private val random = SecureRandom()

    fun newSalt(): ByteArray = ByteArray(SALT_SIZE).also(random::nextBytes)
    fun newNonce(): ByteArray = ByteArray(NONCE_SIZE).also(random::nextBytes)

    fun deriveKey(password: CharArray, salt: ByteArray): ByteArray {
        require(password.isNotEmpty()) { "Password is required" }
        val params = Argon2Parameters.Builder(Argon2Parameters.ARGON2_id)
            .withSalt(salt)
            .withIterations(3)
            .withMemoryAsKB(64 * 1024)
            .withParallelism(1)
            .withVersion(Argon2Parameters.ARGON2_VERSION_13)
            .build()
        val out = ByteArray(KEY_SIZE)
        val generator = Argon2BytesGenerator()
        generator.init(params)
        generator.generateBytes(String(password).toByteArray(Charsets.UTF_8), out)
        return out
    }

    fun encryptChunk(key: ByteArray, plain: ByteArray, nonce: ByteArray, aad: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_BITS, nonce))
        cipher.updateAAD(aad)
        return cipher.doFinal(plain)
    }

    fun decryptChunk(key: ByteArray, ciphertext: ByteArray, nonce: ByteArray, aad: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_BITS, nonce))
        cipher.updateAAD(aad)
        return cipher.doFinal(ciphertext)
    }
}
