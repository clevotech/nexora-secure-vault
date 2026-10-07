plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android { namespace = "com.clevotech.nexora"; compileSdk = 36
    defaultConfig { applicationId = "com.clevotech.nexora"; minSdk = 26; targetSdk = 36; versionCode = 1; versionName = "0.2.0" }
}
dependencies {
    implementation(platform("androidx.compose:compose-bom:2025.09.00"))
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.compose.material3:material3")
}
