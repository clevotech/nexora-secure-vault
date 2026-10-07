package com.clevotech.nexora

import org.junit.Test
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class NsvCryptoTest {
    @Test fun roundTripChunk() {
        val key = NsvCrypto.deriveKey("correct horse battery staple".toCharArray(), ByteArray(16) { it.toByte() })
        val nonce = ByteArray(12) { (it + 1).toByte() }
        val aad = "NSV1-test".toByteArray()
        val plain = "Nexora interoperability".toByteArray()
        val cipher = NsvCrypto.encryptChunk(key, plain, nonce, aad)
        assertTrue(plain.contentEquals(NsvCrypto.decryptChunk(key, cipher, nonce, aad)))
    }

    @Test fun wrongAadFails() {
        val key = NsvCrypto.deriveKey("secret".toCharArray(), ByteArray(16))
        val nonce = ByteArray(12)
        val cipher = NsvCrypto.encryptChunk(key, byteArrayOf(1,2,3), nonce, "aad".toByteArray())
        assertFailsWith<Exception> { NsvCrypto.decryptChunk(key, cipher, nonce, "tampered".toByteArray()) }
    }
}
