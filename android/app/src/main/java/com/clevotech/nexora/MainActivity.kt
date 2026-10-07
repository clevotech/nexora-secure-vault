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

    private val openDocument = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        selectedUri = uri
    }
    private val createDocument = registerForActivityResult(ActivityResultContracts.CreateDocument("application/octet-stream")) { uri ->
        outputUri = uri
        runVaultOperation()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { NexoraApp() }
    }

    @Composable
    private fun NexoraApp() {
        var password by remember { mutableStateOf("") }
        var status by remember { mutableStateOf("Ready") }
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
                    OutlinedTextField(value=password,onValueChange={password=it},label={Text("Password")},singleLine=true)
                    Button(onClick={
                        decryptMode=false
                        currentPassword=password
                        openDocument.launch(arrayOf("*/*"))
                    }) { Text("Encrypt file") }
                    Button(onClick={
                        decryptMode=true
                        currentPassword=password
                        openDocument.launch(arrayOf("application/octet-stream","*/*"))
                    }) { Text("Decrypt .nsv file") }
                    Text(status, style=MaterialTheme.typography.bodyMedium)
                }
            }
        }
        LaunchedEffect(selectedUri) {
            if (selectedUri != null) {
                status = "File selected — choose destination…"
                val name = if (decryptMode) "decrypted-file" else "encrypted.nsv"
                createDocument.launch(name)
            }
        }
    }

    private fun runVaultOperation() {
        val input = selectedUri ?: return
        val output = outputUri ?: return
        lifecycleScope.launch {
            try {
                withContext(Dispatchers.IO) {
                    if (decryptMode) {
                        NsvContainer.decrypt(contentResolver, input, output, currentPassword.toCharArray())
                    } else {
                        val name = contentResolver.query(input, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME), null, null, null)
                            ?.use { if (it.moveToFirst()) it.getString(0) else "file" } ?: "file"
                        NsvContainer.encrypt(contentResolver, input, output, currentPassword.toCharArray(), name, java.time.Instant.now().toString())
                    }
                }
                selectedUri = null
                outputUri = null
            } catch (_: Exception) {
                selectedUri = null
                outputUri = null
            }
        }
    }

    private var currentPassword: String = ""
}
