package com.clevotech.nexora

import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    private var selectedUri: Uri? = null
    private var outputUri: Uri? = null
    private var decryptMode = false
    private var currentPassword: CharArray = charArrayOf()
    private var status by mutableStateOf("Ready")
    private var busy by mutableStateOf(false)

    private val openDocument = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        selectedUri = uri
        if (uri == null) {
            status = "File selection cancelled."
            clearPassword()
        }
    }

    private val createDocument = registerForActivityResult(ActivityResultContracts.CreateDocument("application/octet-stream")) { uri ->
        outputUri = uri
        if (uri == null) {
            status = "Destination selection cancelled."
            clearPassword()
            selectedUri = null
            return@registerForActivityResult
        }
        runVaultOperation()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { NexoraApp() }
    }

    @Composable
    private fun NexoraApp() {
        var password by remember { mutableStateOf("") }

        MaterialTheme {
            Surface(modifier = Modifier.fillMaxSize()) {
                Column(
                    modifier = Modifier.fillMaxSize().padding(28.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(14.dp, Alignment.CenterVertically)
                ) {
                    Text("NEXORA", style = MaterialTheme.typography.labelLarge)
                    Text("Secure Vault", style = MaterialTheme.typography.headlineLarge)
                    Text("NSV1 • AES-256-GCM • Argon2id")

                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text("Password") },
                        singleLine = true,
                        enabled = !busy
                    )

                    Button(
                        enabled = !busy && password.isNotEmpty(),
                        onClick = {
                            decryptMode = false
                            setPassword(password)
                            openDocument.launch(arrayOf("*/*"))
                        }
                    ) { Text("Encrypt file") }

                    Button(
                        enabled = !busy && password.isNotEmpty(),
                        onClick = {
                            decryptMode = true
                            setPassword(password)
                            openDocument.launch(arrayOf("application/octet-stream", "*/*"))
                        }
                    ) { Text("Decrypt .nsv file") }

                    if (busy) {
                        CircularProgressIndicator()
                    }

                    Text(status, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }

        LaunchedEffect(selectedUri) {
            if (selectedUri != null && !busy) {
                status = "File selected — choose destination…"
                val name = if (decryptMode) "decrypted-file" else "encrypted.nsv"
                createDocument.launch(name)
            }
        }
    }

    private fun setPassword(value: String) {
        clearPassword()
        currentPassword = value.toCharArray()
    }

    private fun clearPassword() {
        currentPassword.fill('\u0000')
        currentPassword = charArrayOf()
    }

    private fun runVaultOperation() {
        val input = selectedUri ?: return
        val output = outputUri ?: return
        if (currentPassword.isEmpty()) {
            status = "Password is required."
            return
        }

        busy = true
        status = if (decryptMode) "Decrypting and verifying…" else "Encrypting securely…"

        lifecycleScope.launch {
            try {
                withContext(Dispatchers.IO) {
                    if (decryptMode) {
                        NsvContainer.decrypt(contentResolver, input, output, currentPassword)
                    } else {
                        val name = contentResolver.query(
                            input,
                            arrayOf(android.provider.OpenableColumns.DISPLAY_NAME),
                            null,
                            null,
                            null
                        )?.use { if (it.moveToFirst()) it.getString(0) else "file" } ?: "file"

                        NsvContainer.encrypt(
                            contentResolver,
                            input,
                            output,
                            currentPassword,
                            name,
                            java.time.Instant.now().toString()
                        )
                    }
                }

                status = if (decryptMode) {
                    "Decrypted successfully — integrity verified."
                } else {
                    "Encrypted successfully."
                }
            } catch (e: Exception) {
                status = e.message ?: "Operation failed."
            } finally {
                clearPassword()
                selectedUri = null
                outputUri = null
                busy = false
            }
        }
    }

    override fun onDestroy() {
        clearPassword()
        super.onDestroy()
    }
}
