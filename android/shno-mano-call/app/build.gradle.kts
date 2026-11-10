import java.util.Properties
import java.security.MessageDigest

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.devtools.ksp")
}

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("keystore.properties")
if (keystorePropertiesFile.exists()) {
    keystorePropertiesFile.inputStream().use(keystoreProperties::load)
}

fun signingValue(property: String, env: String): String? =
    keystoreProperties.getProperty(property)?.takeIf { it.isNotBlank() }
        ?: System.getenv(env)?.takeIf { it.isNotBlank() }

android {
    namespace = "com.shnomano.call"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.shnomano.call"
        minSdk = 26
        targetSdk = 35
        versionCode = 19
        versionName = "1.4.0"
    }

    signingConfigs {
        create("release") {
            val storePath = signingValue("storeFile", "SHNO_MANO_KEYSTORE_FILE")
            if (storePath != null) storeFile = file(storePath)
            storePassword = signingValue("storePassword", "SHNO_MANO_KEYSTORE_PASSWORD")
            keyAlias = signingValue("keyAlias", "SHNO_MANO_KEY_ALIAS")
            keyPassword = signingValue("keyPassword", "SHNO_MANO_KEY_PASSWORD")
        }
    }

    buildTypes {
        getByName("debug") {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        getByName("release") {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
        }
    }

    buildFeatures { compose = true }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

// Package the exact shared call frontend with the APK. APIs remain authenticated
// HTTPS requests; this contains no sessions, user content, or database snapshots.
val callWebFiles = listOf(
    "messages.html", "private-messages.js", "call-signaling.js", "screen-share.js", "call-surface.js", "call-session-state.js", "call-ice.js",
    "call-screen.css", "social-api.js", "call-groups.html", "call-groups.js",
    "social.css", "mall.css", "messages-call-fix.css", "shinomino-shared-visual.css",
    "call-audio.js", "incoming-call-global.js", "auth-guard.js", "mall.js",
    "call-permission-guard.js"
)
val callWebRoot = rootProject.projectDir.resolve("../..").canonicalFile
val callWebAssets = layout.buildDirectory.dir("generated/callWebAssets")
val bundleCallWeb by tasks.registering(Sync::class) {
    from(callWebRoot) { include(callWebFiles) }
    into(callWebAssets.map { it.dir("call-web") })
    inputs.property("callUiVersion", "1.4.0-19")
    doFirst {
        callWebFiles.forEach { check(callWebRoot.resolve(it).isFile) { "Missing bundled call asset: $it" } }
    }
    doLast {
        val digest = MessageDigest.getInstance("SHA-256")
        val entries = callWebFiles.joinToString(",") { name ->
            val hash = digest.digest(callWebRoot.resolve(name).readBytes()).joinToString("") { "%02x".format(it) }
            "\"$name\":\"$hash\""
        }
        callWebAssets.get().file("call-web/call-build.json").asFile.writeText(
            "{\"version\":\"1.4.0\",\"versionCode\":19,\"files\":{$entries}}"
        )
    }
}
android.sourceSets.getByName("main").assets.srcDir(callWebAssets)
tasks.named("preBuild") { dependsOn(bundleCallWeb) }

dependencies {
    testImplementation("junit:junit:4.13.2")
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.10.0")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")

    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.navigation:navigation-compose:2.8.5")

    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
}