plugins { id("com.android.application") }

android {
    namespace = "id.ruanglega.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "id.ruanglega.app"
        minSdk = 23
        targetSdk = 35
        versionCode = 9
        versionName = "1.11.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    signingConfigs {
        create("stableDebug") {
            storeFile = file("${System.getProperty("user.home")}/.android/ruang-lega-debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("stableDebug")
        }
        release { isMinifyEnabled = false }
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.work:work-runtime:2.11.2")
}
