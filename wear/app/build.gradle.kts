import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    // app/google-services.json이 필요하다(커밋하지 않는다 — wear/README.md).
    alias(libs.plugins.google.services)
}

android {
    namespace = "app.web.note_my_coffee.wear"
    compileSdk = 35

    defaultConfig {
        // 폰 앱(TWA)과 같은 패키지명 — Play에서 한 등록정보에 Wear OS 폼 팩터로 올린다.
        applicationId = "app.web.note_my_coffee"
        minSdk = 30 // Wear OS 3 (Galaxy Watch4 이후)
        targetSdk = 35
        // 폰 TWA의 versionCode와 겹치면 업로드가 거부된다 — 워치는 2,000,000번대를 쓴다.
        versionCode = 2_000_001
        versionName = "0.1.0-wear"
    }

    signingConfigs {
        // 릴리스 서명: wear/keystore.properties(커밋 금지)가 있을 때만 쓴다.
        val propsFile = rootProject.file("keystore.properties")
        if (propsFile.exists()) {
            val props = Properties().apply { propsFile.inputStream().use { load(it) } }
            create("release") {
                storeFile = rootProject.file(props.getProperty("storeFile"))
                storePassword = props.getProperty("storePassword")
                keyAlias = props.getProperty("keyAlias")
                keyPassword = props.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.wear.compose.material)
    implementation(libs.wear.compose.foundation)
    implementation(libs.wear.compose.navigation)
    implementation(libs.wear.input)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.datastore.preferences)

    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.auth)
    implementation(libs.firebase.firestore)
    implementation(libs.kotlinx.coroutines.play.services)

    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.wear.compose.ui.tooling)
}
