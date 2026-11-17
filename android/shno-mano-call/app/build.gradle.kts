import groovy.json.JsonSlurper
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

// google-services.json is public Android client configuration; private service keys stay server-side.
val firebaseConfigFile = file("google-services.json")
val firebaseRaw = System.getenv("SHNO_FIREBASE_ANDROID_CONFIG")?.takeIf { it.isNotBlank() }
    ?: firebaseConfigFile.takeIf { it.exists() }?.readText()
val firebaseConfig = firebaseRaw?.let { JsonSlurper().parseText(it) as Map<*, *> }
val firebaseClient = (firebaseConfig?.get("client") as? List<*>)?.mapNotNull { it as? Map<*, *> }?.firstOrNull {
    val info = it["client_info"] as? Map<*, *>
    (info?.get("android_client_info") as? Map<*, *>)?.get("package_name") == "com.shnomano.call"
}
if (firebaseRaw != null) require(firebaseClient != null) { "Firebase configuration must match com.shnomano.call" }

android {
    namespace = "com.shnomano.call"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.shnomano.call"
        minSdk = 26
        targetSdk = 35
        versionCode = 20
        versionName = "1.5.0"
        if (firebaseClient != null) {
            val project = firebaseConfig!!["project_info"] as Map<*, *>
            val info = firebaseClient["client_info"] as Map<*, *>
            val apiKeys = firebaseClient["api_key"] as List<*>
            resValue("string", "google_app_id", info["mobilesdk_app_id"].toString())
            resValue("string", "gcm_defaultSenderId", project["project_number"].toString())
            resValue("string", "project_id", project["project_id"].toString())
            resValue("string", "google_api_key", (apiKeys.first() as Map<*, *>)["current_key"].toString())
        }
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
    inputs.property("callUiVersion", "1.5.0-20")
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
            "{\"version\":\"1.5.0\",\"versionCode\":20,\"files\":{$entries}}"
        )
    }
}
android.sourceSets.getByName("main").assets.srcDir(callWebAssets)
tasks.named("preBuild") { dependsOn(bundleCallWeb) }

dependencies {
    implementation("com.google.firebase:firebase-messaging:24.1.0")
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
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
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