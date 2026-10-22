import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import java.security.KeyStore
import java.security.MessageDigest
import java.security.PrivateKey
import java.security.Signature
import java.security.cert.X509Certificate
import groovy.json.JsonSlurper

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
}

val tauriProperties = Properties().apply {
    val propFile = file("tauri.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

val releaseSigningFile = file(System.getenv("SUPERGPT_ANDROID_SIGNING_PROPERTIES")
    ?: "${System.getProperty("user.home")}/.supergpt/signing/release.properties")
val releaseSigning = Properties().apply {
    if (releaseSigningFile.isFile) releaseSigningFile.reader(Charsets.UTF_8).use { load(it) }
}
fun signingValue(key: String): String = releaseSigning.getProperty(key)?.takeIf { it.isNotBlank() }
    ?: error("Release signing is incomplete. Restore the permanent keystore/properties, or run npm run android:signing:init for the first setup.")

val verifyReleaseSigningIdentity = tasks.register("verifyReleaseSigningIdentity") {
    // The action reads the private signing configuration at execution time.
    // Keep this verification mandatory without serializing script/secret state.
    notCompatibleWithConfigurationCache("Release certificate verification reads private signing configuration at execution time")
    doLast {
        check(releaseSigningFile.isFile) { "Permanent release signing credentials are missing. Never substitute the debug key." }
        val identityFile = file("../../../../config/android-release-signing.json")
        check(identityFile.isFile) { "Pinned public release certificate is missing." }
        val identity = JsonSlurper().parse(identityFile) as Map<*, *>
        check(identity["packageId"] == "id.sakelar.client") { "Unexpected release package identity." }
        val store = KeyStore.getInstance("PKCS12")
        file(signingValue("storeFile")).inputStream().use { store.load(it, signingValue("storePassword").toCharArray()) }
        val certificate = store.getCertificate(signingValue("keyAlias")) as? X509Certificate
            ?: error("Release signing certificate not found.")
        certificate.checkValidity()
        check(!certificate.subjectX500Principal.name.contains("Android Debug")) { "Debug signing is forbidden for releases." }
        val digest = MessageDigest.getInstance("SHA-256").digest(certificate.encoded).joinToString("") { "%02x".format(it) }
        check(digest == identity["sha256"]) { "Release certificate differs from the permanent pinned identity. Restore the original key." }
        val privateKey = store.getKey(signingValue("keyAlias"), signingValue("keyPassword").toCharArray()) as? PrivateKey
            ?: error("Permanent release private key is unavailable.")
        val challenge = "SuperGPT local release signing validation".toByteArray(Charsets.UTF_8)
        val proof = Signature.getInstance("SHA256withRSA")
        proof.initSign(privateKey); proof.update(challenge); val signature = proof.sign()
        proof.initVerify(certificate.publicKey); proof.update(challenge)
        check(proof.verify(signature)) { "Release private key does not match its certificate." }
        logger.lifecycle("Permanent SuperGPT release certificate verified: $digest")
    }
}
tasks.configureEach {
    if (name.matches(Regex("(assemble|bundle|package|validateSigning).*Release"))) dependsOn(verifyReleaseSigningIdentity)
}

android {
    compileSdk = 36
    namespace = "id.sakelar.client"
    defaultConfig {
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        applicationId = "id.sakelar.client"
        minSdk = 24
        targetSdk = 36
        versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
        versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")
    }
    signingConfigs {
        create("release") {
            storeType = "PKCS12"
            if (releaseSigningFile.isFile) {
                storeFile = file(signingValue("storeFile"))
                storePassword = signingValue("storePassword")
                keyAlias = signingValue("keyAlias")
                keyPassword = signingValue("keyPassword")
            }
        }
    }
    buildTypes {
        getByName("debug") {
            applicationIdSuffix = ".debug"
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            packaging {
                jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
                jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
                jniLibs.keepDebugSymbols.add("*/x86/*.so")
                jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
            }
        }
        getByName("release") {
            signingConfig = signingConfigs.getByName("release")
            isDebuggable = false
            isJniDebuggable = false
            isMinifyEnabled = true
            proguardFiles(
                // Required platform rules preserve enum reflection and other
                // runtime entry points used by Tauri/Jackson in release builds.
                getDefaultProguardFile("proguard-android-optimize.txt"),
                *fileTree(".") {
                  include("**/*.pro")
                  exclude("build/**")
                }.files.toTypedArray()
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    buildFeatures {
        buildConfig = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_1_8
    }
}

rust {
    rootDirRel = "../../../"
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.lifecycle:lifecycle-process:2.10.0")
    implementation("com.google.android.gms:play-services-auth:22.0.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = file("tauri.build.gradle.kts"))
