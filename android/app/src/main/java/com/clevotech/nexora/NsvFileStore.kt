package com.clevotech.nexora

import android.content.ContentResolver
import android.net.Uri
import java.io.InputStream
import java.io.OutputStream

class NsvFileStore(private val resolver: ContentResolver) {
    fun openInput(uri: Uri): InputStream =
        resolver.openInputStream(uri) ?: error("Unable to open selected file")

    fun openOutput(uri: Uri): OutputStream =
        resolver.openOutputStream(uri, "w") ?: error("Unable to open destination file")

    fun copyStreaming(input: Uri, output: Uri, bufferSize: Int = NsvProtocol.CHUNK_SIZE): Long {
        var total = 0L
        openInput(input).use { source ->
            openOutput(output).use { destination ->
                val buffer = ByteArray(bufferSize)
                var total = 0L
                while (true) {
                    val count = source.read(buffer)
                    if (count < 0) break
                    if (count == 0) continue
                    destination.write(buffer, 0, count)
                    total += count
                }
                destination.flush()
                return total
            }
        }
    }
}
