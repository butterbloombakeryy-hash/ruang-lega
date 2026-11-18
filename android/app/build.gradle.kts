plugins { id("com.android.application") }

android {
    namespace = "id.ruanglega.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "id.ruanglega.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "1.3.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release { isMinifyEnabled = false }
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
}
