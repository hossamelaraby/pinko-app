import os
import sys
import shutil
import zipfile
import subprocess
from PIL import Image

BASE_DIR = r"D:\araby-tech projects\PINKO APP"
BUILD_DIR = os.path.join(BASE_DIR, "android_build")
RELEASE_DIR = os.path.join(BASE_DIR, "release")
MOBILE_DIST = os.path.join(BASE_DIR, "mobile", "dist")

JAVA_HOME = r"C:\Users\HOSS\AppData\Local\JDK17\PFiles64\Eclipse Adoptium\jdk-17.0.20.101-hotspot"
JAVA_BIN = os.path.join(JAVA_HOME, "bin")
JAVAC = os.path.join(JAVA_BIN, "javac.exe")
KEYTOOL = os.path.join(JAVA_BIN, "keytool.exe")

ANDROID_SDK = r"C:\Users\HOSS\AppData\Local\Android\Sdk"
BUILD_TOOLS = os.path.join(ANDROID_SDK, "build-tools", "34.0.0")
AAPT2 = os.path.join(BUILD_TOOLS, "aapt2.exe")
ZIPALIGN = os.path.join(BUILD_TOOLS, "zipalign.exe")
D8 = os.path.join(BUILD_TOOLS, "d8.bat")
APKSIGNER = os.path.join(BUILD_TOOLS, "apksigner.bat")
ANDROID_JAR = os.path.join(ANDROID_SDK, "platforms", "android-34", "android.jar")

ICON_SRC = os.path.join(RELEASE_DIR, "PinkoApp-Icon.png")

def log(msg):
    print(f"[Android Build] {msg}", flush=True)

def run(cmd, cwd=None, env=None):
    log(f"Running: {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    run_env = os.environ.copy()
    run_env["JAVA_HOME"] = JAVA_HOME
    run_env["PATH"] = JAVA_BIN + os.pathsep + BUILD_TOOLS + os.pathsep + run_env.get("PATH", "")
    if env:
        run_env.update(env)
    res = subprocess.run(cmd, cwd=cwd, env=run_env, capture_output=True, text=True, shell=(isinstance(cmd, str) or cmd[0].endswith(".bat")))
    if res.returncode != 0:
        log(f"FAILED (code {res.returncode}):\nStdout: {res.stdout}\nStderr: {res.stderr}")
        sys.exit(1)
    if res.stdout.strip():
        print(res.stdout, flush=True)
    return res.stdout

def setup_directories():
    if os.path.exists(BUILD_DIR):
        shutil.rmtree(BUILD_DIR)
    os.makedirs(BUILD_DIR, exist_ok=True)
    os.makedirs(os.path.join(BUILD_DIR, "res", "values"), exist_ok=True)
    os.makedirs(os.path.join(BUILD_DIR, "src", "com", "pinko", "app"), exist_ok=True)
    os.makedirs(os.path.join(BUILD_DIR, "classes"), exist_ok=True)
    os.makedirs(os.path.join(BUILD_DIR, "dex"), exist_ok=True)
    os.makedirs(os.path.join(BUILD_DIR, "assets", "www"), exist_ok=True)
    os.makedirs(RELEASE_DIR, exist_ok=True)

def generate_icons():
    log("Generating Android Mipmap Icons from PinkoApp-Icon.png...")
    img = Image.open(ICON_SRC).convert("RGBA")
    sizes = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }
    for folder, size in sizes.items():
        folder_path = os.path.join(BUILD_DIR, "res", folder)
        os.makedirs(folder_path, exist_ok=True)
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(os.path.join(folder_path, "ic_launcher.png"), format="PNG")
        resized.save(os.path.join(folder_path, "ic_launcher_round.png"), format="PNG")

def write_manifest_and_res():
    log("Writing AndroidManifest.xml & resource files...")
    manifest = """<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.pinko.app"
    android:versionCode="1"
    android:versionName="1.0.0">

    <uses-sdk
        android:minSdkVersion="21"
        android:targetSdkVersion="34" />

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="true"
        android:hardwareAccelerated="true">
        
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|screenLayout|keyboardHidden"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
"""
    with open(os.path.join(BUILD_DIR, "AndroidManifest.xml"), "w", encoding="utf-8") as f:
        f.write(manifest)

    strings_xml = """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Pinko App</string>
</resources>
"""
    with open(os.path.join(BUILD_DIR, "res", "values", "strings.xml"), "w", encoding="utf-8") as f:
        f.write(strings_xml)

    styles_xml = """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="@android:style/Theme.Material.NoActionBar">
        <item name="android:windowBackground">@android:color/black</item>
        <item name="android:statusBarColor">#1e1b4b</item>
        <item name="android:navigationBarColor">#0f172a</item>
    </style>
</resources>
"""
    with open(os.path.join(BUILD_DIR, "res", "values", "styles.xml"), "w", encoding="utf-8") as f:
        f.write(styles_xml)

def write_java_source():
    log("Writing MainActivity.java...")
    java_code = """package com.pinko.app;

import android.app.Activity;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

public class MainActivity extends Activity {
    private WebView mWebView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Hardware acceleration & status bar styling
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(0xFF1E1B4B);
        window.setNavigationBarColor(0xFF0F172A);

        FrameLayout rootLayout = new FrameLayout(this);
        rootLayout.setBackgroundColor(0xFF0F172A);

        mWebView = new WebView(this);
        rootLayout.addView(mWebView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        setContentView(rootLayout);

        WebSettings settings = mWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        mWebView.setWebChromeClient(new WebChromeClient());
        mWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }
        });

        // Load bundled single-page app
        mWebView.loadUrl("file:///android_asset/www/index.html");
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && mWebView != null && mWebView.canGoBack()) {
            mWebView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
}
"""
    with open(os.path.join(BUILD_DIR, "src", "com", "pinko", "app", "MainActivity.java"), "w", encoding="utf-8") as f:
        f.write(java_code)

def copy_assets():
    log("Copying mobile dist assets into assets/www...")
    dst = os.path.join(BUILD_DIR, "assets", "www")
    for item in os.listdir(MOBILE_DIST):
        s = os.path.join(MOBILE_DIST, item)
        d = os.path.join(dst, item)
        if os.path.isdir(s):
            shutil.copytree(s, d)
        else:
            shutil.copy2(s, d)

def compile_and_assemble():
    log("Step 1: Compiling resources with aapt2...")
    res_zip = os.path.join(BUILD_DIR, "compiled_res.zip")
    run([AAPT2, "compile", "--dir", os.path.join(BUILD_DIR, "res"), "-o", res_zip])

    log("Step 2: Linking resources with aapt2...")
    unaligned_apk = os.path.join(BUILD_DIR, "unaligned_res.apk")
    run([
        AAPT2, "link",
        "-I", ANDROID_JAR,
        "--manifest", os.path.join(BUILD_DIR, "AndroidManifest.xml"),
        "-o", unaligned_apk,
        "--auto-add-overlay",
        res_zip
    ])

    log("Step 3: Compiling Java source with javac...")
    java_src = os.path.join(BUILD_DIR, "src", "com", "pinko", "app", "MainActivity.java")
    classes_dir = os.path.join(BUILD_DIR, "classes")
    run([
        JAVAC,
        "-source", "1.8",
        "-target", "1.8",
        "-cp", ANDROID_JAR,
        "-d", classes_dir,
        java_src
    ])

    log("Step 4: Converting classes to DEX with d8...")
    dex_dir = os.path.join(BUILD_DIR, "dex")
    class_files = []
    for root, _, files in os.walk(classes_dir):
        for file in files:
            if file.endswith(".class"):
                class_files.append(os.path.join(root, file))

    run([
        D8,
        "--min-api", "21",
        "--lib", ANDROID_JAR,
        "--output", dex_dir
    ] + class_files)

    log("Step 5: Adding DEX and assets into APK...")
    assembled_apk = os.path.join(BUILD_DIR, "assembled.apk")
    shutil.copyfile(unaligned_apk, assembled_apk)

    with zipfile.ZipFile(assembled_apk, "a", compression=zipfile.ZIP_DEFLATED) as zf:
        # Add classes.dex
        dex_path = os.path.join(dex_dir, "classes.dex")
        zf.write(dex_path, "classes.dex")

        # Add assets/
        assets_base = os.path.join(BUILD_DIR, "assets")
        for root, _, files in os.walk(assets_base):
            for file in files:
                abs_f = os.path.join(root, file)
                rel_f = os.path.relpath(abs_f, BUILD_DIR)
                # Ensure forward slashes in zip
                zf.write(abs_f, rel_f.replace("\\", "/"))

    log("Step 6: Zipalign APK...")
    aligned_apk = os.path.join(BUILD_DIR, "aligned.apk")
    if os.path.exists(aligned_apk):
        os.remove(aligned_apk)
    run([ZIPALIGN, "-f", "-p", "4", assembled_apk, aligned_apk])

    log("Step 7: Signing APK with apksigner...")
    keystore = os.path.join(BASE_DIR, "pinko-release.keystore")
    if not os.path.exists(keystore):
        log("Creating signing keystore...")
        run([
            KEYTOOL,
            "-genkeypair",
            "-v",
            "-keystore", keystore,
            "-alias", "pinko",
            "-keyalg", "RSA",
            "-keysize", "2048",
            "-validity", "10000",
            "-storepass", "pinko123",
            "-keypass", "pinko123",
            "-dname", "CN=Pinko App, OU=Engineering, O=Pinko, L=Cairo, ST=Cairo, C=EG"
        ])

    final_apk = os.path.join(RELEASE_DIR, "PinkoApp.apk")
    if os.path.exists(final_apk):
        os.remove(final_apk)

    run([
        APKSIGNER, "sign",
        "--ks", keystore,
        "--ks-pass", "pass:pinko123",
        "--key-pass", "pass:pinko123",
        "--ks-key-alias", "pinko",
        "--out", final_apk,
        aligned_apk
    ])

    log("Step 8: Verifying final APK signature...")
    run([APKSIGNER, "verify", "-v", final_apk])

    apk_size_mb = os.path.getsize(final_apk) / (1024 * 1024)
    log(f"SUCCESS! Built and signed PinkoApp.apk: {final_apk} ({apk_size_mb:.2f} MB)")

if __name__ == "__main__":
    setup_directories()
    generate_icons()
    write_manifest_and_res()
    write_java_source()
    copy_assets()
    compile_and_assemble()
