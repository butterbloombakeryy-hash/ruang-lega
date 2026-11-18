package id.ruanglega.app;

import android.app.Activity;
import android.app.AppOpsManager;
import android.app.usage.StorageStats;
import android.app.usage.StorageStatsManager;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Process;
import android.os.StatFs;
import android.os.storage.StorageManager;
import android.provider.Settings;
import android.util.Base64;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * RUANG LEGA Android shell.
 * Reads per-app storage totals via StorageStatsManager after explicit Usage Access.
 * The system-wide cache clear is delegated to Android's own confirmation screen.
 */
public class MainActivity extends Activity {
    private static final int REQUEST_PICK_FILES = 7101;
    private static final int REQUEST_SAVE_CSV = 7102;
    private static final int REQUEST_CLEAR_APP_CACHE = 7103;
    private static final String START_URL =
            "https://appassets.androidplatform.net/assets/index.html";

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private byte[] pendingCsvBytes;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(16, 63, 62));
        getWindow().setNavigationBarColor(Color.rgb(16, 63, 62));

        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(true);
        webView.getSettings().setSupportZoom(false);
        webView.addJavascriptInterface(new NativeBridge(), "AndroidBridge");

        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public android.webkit.WebResourceResponse shouldInterceptRequest(
                    WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !"appassets.androidplatform.net".equals(request.getUrl().getHost());
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                try {
                    Intent intent = params.createIntent();
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("*/*");
                    if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                    }
                    startActivityForResult(intent, REQUEST_PICK_FILES);
                    return true;
                } catch (Exception e) {
                    filePathCallback = null;
                    Toast.makeText(MainActivity.this,
                            "Pemilih file tidak dapat dibuka.", Toast.LENGTH_LONG).show();
                    return false;
                }
            }
        });

        setContentView(webView);
        webView.loadUrl(START_URL);
    }

    @Override
    protected void onResume() {
        super.onResume();
        notifyWebPermissionsChanged();
    }

    private void notifyWebPermissionsChanged() {
        if (webView == null) return;
        webView.postDelayed(() -> {
            if (webView != null) {
                webView.evaluateJavascript(
                        "window.RuangLegaNativeRefreshPermissions && window.RuangLegaNativeRefreshPermissions();",
                        null);
            }
        }, 350);
    }

    private boolean hasUsageAccess() {
        try {
            AppOpsManager ops = (AppOpsManager) getSystemService(APP_OPS_SERVICE);
            if (ops == null) return false;
            int mode = ops.checkOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), getPackageName());
            return mode == AppOpsManager.MODE_ALLOWED;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean hasAllFilesAccess() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                && Environment.isExternalStorageManager();
    }

    private JSONObject getDeviceStorageSnapshot() {
        JSONObject out = new JSONObject();
        try {
            StatFs stat = new StatFs(Environment.getDataDirectory().getAbsolutePath());
            long total = stat.getTotalBytes();
            long free = stat.getAvailableBytes();
            out.put("ok", true);
            out.put("totalBytes", total);
            out.put("freeBytes", free);
            out.put("usedBytes", Math.max(0L, total - free));
            out.put("usagePercent", total > 0 ? (double) (total - free) * 100.0 / total : 0.0);
            out.put("androidVersion", Build.VERSION.RELEASE);
            out.put("apiLevel", Build.VERSION.SDK_INT);
        } catch (Exception e) {
            try {
                out.put("ok", false);
                out.put("error", "storage_unavailable");
            } catch (Exception ignored) { }
        }
        return out;
    }

    private JSONArray getInstalledAppStats() throws Exception {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            throw new IllegalStateException("Per-app storage statistics need Android 8.0 or newer.");
        }
        if (!hasUsageAccess()) {
            throw new SecurityException("usage_access_required");
        }

        StorageStatsManager statsManager =
                (StorageStatsManager) getSystemService(STORAGE_STATS_SERVICE);
        if (statsManager == null) throw new IllegalStateException("StorageStatsManager unavailable");

        PackageManager pm = getPackageManager();
        Intent launcherIntent = new Intent(Intent.ACTION_MAIN);
        launcherIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> launchables = pm.queryIntentActivities(launcherIntent, 0);
        List<JSONObject> rows = new ArrayList<>();

        for (ResolveInfo resolved : launchables) {
            if (resolved.activityInfo == null || resolved.activityInfo.applicationInfo == null) continue;
            ApplicationInfo appInfo = resolved.activityInfo.applicationInfo;
            String packageName = appInfo.packageName;
            if (packageName == null || packageName.equals(getPackageName())) continue;

            try {
                UUID storageUuid = appInfo.storageUuid != null
                        ? appInfo.storageUuid : StorageManager.UUID_DEFAULT;
                StorageStats stats = statsManager.queryStatsForPackage(
                        storageUuid, packageName, Process.myUserHandle());

                long appBytes = stats.getAppBytes();
                long dataWithCacheBytes = stats.getDataBytes();
                long cacheBytes = stats.getCacheBytes();
                long dataBytes = Math.max(0L, dataWithCacheBytes - cacheBytes);

                JSONObject row = new JSONObject();
                row.put("packageName", packageName);
                row.put("appName", String.valueOf(pm.getApplicationLabel(appInfo)));
                row.put("appBytes", appBytes);
                row.put("dataBytes", dataBytes);
                row.put("cacheBytes", cacheBytes);
                row.put("totalBytes", appBytes + dataWithCacheBytes);
                rows.add(row);
            } catch (PackageManager.NameNotFoundException | IOException | SecurityException ignored) {
                // Some system, managed-profile, or restricted packages cannot be queried.
            }
        }

        Collections.sort(rows, (a, b) ->
                Long.compare(b.optLong("cacheBytes"), a.optLong("cacheBytes")));

        JSONArray result = new JSONArray();
        for (JSONObject row : rows) result.put(row);
        return result;
    }

    private long deleteContents(File dir) {
        if (dir == null || !dir.exists() || !dir.isDirectory()) return 0L;
        long reclaimed = 0L;
        File[] files = dir.listFiles();
        if (files == null) return 0L;
        for (File file : files) {
            if (file.isDirectory()) {
                reclaimed += deleteContents(file);
                if (file.delete()) { /* directory removed */ }
            } else {
                long size = file.length();
                if (file.delete()) reclaimed += size;
            }
        }
        return reclaimed;
    }

    private final class NativeBridge {
        @JavascriptInterface
        public String getDeviceStorageSnapshot() {
            return MainActivity.this.getDeviceStorageSnapshot().toString();
        }

        @JavascriptInterface
        public boolean hasUsageAccess() {
            return MainActivity.this.hasUsageAccess();
        }

        @JavascriptInterface
        public boolean hasAllFilesAccess() {
            return MainActivity.this.hasAllFilesAccess();
        }

        @JavascriptInterface
        public void requestUsageAccess() {
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS));
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this,
                            "Pengaturan akses statistik tidak tersedia.",
                            Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void requestAllFilesAccess() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
                    Toast.makeText(MainActivity.this,
                            "Fitur ini memerlukan Android 11 atau lebih baru.",
                            Toast.LENGTH_LONG).show();
                    return;
                }
                try {
                    Intent intent = new Intent(
                            Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                            Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                } catch (Exception e) {
                    try {
                        startActivity(new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION));
                    } catch (Exception ignored) {
                        Toast.makeText(MainActivity.this,
                                "Aktifkan Akses semua file dari Pengaturan Android.",
                                Toast.LENGTH_LONG).show();
                    }
                }
            });
        }

        @JavascriptInterface
        public String scanInstalledApps() {
            JSONObject response = new JSONObject();
            try {
                JSONArray apps = getInstalledAppStats();
                response.put("ok", true);
                response.put("apps", apps);
                response.put("count", apps.length());
            } catch (SecurityException e) {
                try {
                    response.put("ok", false);
                    response.put("error", "usage_access_required");
                } catch (Exception ignored) { }
            } catch (Exception e) {
                try {
                    response.put("ok", false);
                    response.put("error", e.getMessage() == null
                            ? "scan_failed" : e.getMessage());
                } catch (Exception ignored) { }
            }
            return response.toString();
        }

        @JavascriptInterface
        public void openAppSettings(String packageName) {
            runOnUiThread(() -> {
                try {
                    if (packageName == null || packageName.trim().isEmpty()) return;
                    Intent intent = new Intent(
                            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                            Uri.parse("package:" + packageName));
                    startActivity(intent);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this,
                            "Pengaturan aplikasi tidak dapat dibuka.",
                            Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public String requestClearExternalCaches() {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return "unsupported";
            if (!hasAllFilesAccess()) return "all_files_access_required";

            runOnUiThread(() -> {
                try {
                    // Android displays its own user confirmation. This app cannot clear
                    // other apps' private data or silently erase other apps' caches.
                    Intent intent = new Intent(StorageManager.ACTION_CLEAR_APP_CACHE);
                    startActivityForResult(intent, REQUEST_CLEAR_APP_CACHE);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this,
                            "Pembersihan cache sistem tidak tersedia pada perangkat ini.",
                            Toast.LENGTH_LONG).show();
                }
            });
            return "system_confirmation_requested";
        }

        @JavascriptInterface
        public void clearOwnCache() {
            new Thread(() -> {
                long freed = deleteContents(getCacheDir());
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                    freed += deleteContents(getExternalCacheDir());
                }
                final long size = freed;
                runOnUiThread(() -> {
                    Toast.makeText(MainActivity.this,
                            "Cache RUANG LEGA dibersihkan: " + android.text.format.Formatter.formatShortFileSize(MainActivity.this, size),
                            Toast.LENGTH_LONG).show();
                    if (webView != null) webView.evaluateJavascript(
                            "window.RuangLegaNativeRefreshPermissions && window.RuangLegaNativeRefreshPermissions();",
                            null);
                });
            }).start();
        }

        @JavascriptInterface
        public void saveCsv(String fileName, String base64Data) {
            try {
                pendingCsvBytes = Base64.decode(base64Data, Base64.DEFAULT);
                runOnUiThread(() -> {
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("text/csv");
                    intent.putExtra(Intent.EXTRA_TITLE, fileName);
                    startActivityForResult(intent, REQUEST_SAVE_CSV);
                });
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this,
                        "Laporan gagal disiapkan.", Toast.LENGTH_LONG).show());
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == REQUEST_PICK_FILES) {
            if (filePathCallback != null) {
                Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
            return;
        }

        if (requestCode == REQUEST_SAVE_CSV) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null
                    && pendingCsvBytes != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                    if (out != null) {
                        out.write(pendingCsvBytes);
                        out.flush();
                        Toast.makeText(this, "Laporan berhasil disimpan.", Toast.LENGTH_LONG).show();
                    }
                } catch (Exception e) {
                    Toast.makeText(this, "Gagal menyimpan laporan.", Toast.LENGTH_LONG).show();
                }
            }
            pendingCsvBytes = null;
            return;
        }

        if (requestCode == REQUEST_CLEAR_APP_CACHE) {
            final int result = resultCode;
            if (webView != null) {
                webView.post(() -> webView.evaluateJavascript(
                        "window.RuangLegaNativeCacheResult && window.RuangLegaNativeCacheResult("
                                + result + ");", null));
            }
            if (resultCode == RESULT_OK) {
                Toast.makeText(this, "Android melaporkan cache aplikasi berhasil dibersihkan.",
                        Toast.LENGTH_LONG).show();
            } else {
                Toast.makeText(this, "Pembersihan cache dibatalkan atau tidak selesai.",
                        Toast.LENGTH_LONG).show();
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidBridge");
            webView.destroy();
        }
        super.onDestroy();
    }
}
