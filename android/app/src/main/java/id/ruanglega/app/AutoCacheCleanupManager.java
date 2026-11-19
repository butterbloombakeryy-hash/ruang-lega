package id.ruanglega.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;

import androidx.work.Data;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.TimeUnit;

/**
 * Automatic cleanup for RUANG LEGA's own disposable cache directories only.
 *
 * Intentionally does NOT touch filesDir, databases, preferences, user downloads,
 * photos, documents, WebView cookies, WebView DOM storage, or another app's data.
 */
public final class AutoCacheCleanupManager {
    public static final long INTERVAL_HOURS = 24L;
    private static final long INTERVAL_MS = TimeUnit.HOURS.toMillis(INTERVAL_HOURS);
    private static final long DUPLICATE_GUARD_MS = TimeUnit.MINUTES.toMillis(20);
    private static final String PREFS = "ruang_lega_auto_cleanup";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_LAST_RUN = "last_run_millis";
    private static final String KEY_LAST_VERSION = "last_version_code";
    private static final String KEY_LAST_FREED = "last_freed_bytes";
    private static final String KEY_LAST_TRIGGER = "last_trigger";
    private static final String KEY_LOGS = "logs_json";
    private static final String PERIODIC_WORK = "ruang_lega_cache_cleanup_24h";
    private static final String STARTUP_WORK = "ruang_lega_cache_cleanup_startup";
    private static final Object LOCK = new Object();

    private AutoCacheCleanupManager() { }

    private static Context app(Context context) {
        return context.getApplicationContext();
    }

    private static SharedPreferences prefs(Context context) {
        return app(context).getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static boolean isEnabled(Context context) {
        return prefs(context).getBoolean(KEY_ENABLED, true);
    }

    public static void initialize(Context context) {
        Context application = app(context);
        if (!isEnabled(application)) return;

        PeriodicWorkRequest periodic = new PeriodicWorkRequest.Builder(
                CacheCleanupWorker.class, INTERVAL_HOURS, TimeUnit.HOURS).build();
        WorkManager.getInstance(application).enqueueUniquePeriodicWork(
                PERIODIC_WORK, ExistingPeriodicWorkPolicy.KEEP, periodic);

        SharedPreferences p = prefs(application);
        long now = System.currentTimeMillis();
        long lastRun = p.getLong(KEY_LAST_RUN, 0L);
        int currentVersion = getVersionCode(application);
        int previousVersion = p.getInt(KEY_LAST_VERSION, -1);

        boolean firstLaunch = lastRun == 0L;
        boolean versionChanged = previousVersion != currentVersion;
        boolean intervalDue = lastRun > 0L && (now - lastRun) >= INTERVAL_MS;

        if (firstLaunch || versionChanged || intervalDue) {
            String trigger = versionChanged && !firstLaunch
                    ? "Pembaruan versi"
                    : firstLaunch ? "Pertama kali dibuka" : "Dibuka setelah 24 jam";
            enqueueOneTime(application, trigger, true);
        }
    }

    public static void setEnabled(Context context, boolean enabled) {
        Context application = app(context);
        prefs(application).edit().putBoolean(KEY_ENABLED, enabled).apply();

        WorkManager workManager = WorkManager.getInstance(application);
        if (enabled) {
            initialize(application);
        } else {
            workManager.cancelUniqueWork(STARTUP_WORK);
            workManager.cancelUniquePeriodicWork(PERIODIC_WORK);
            appendLog(application, "Otomatis dinonaktifkan", "nonaktif", 0L,
                    "Tidak ada cache yang dihapus.");
        }
    }

    public static void requestManualCleanup(Context context) {
        enqueueOneTime(app(context), "Pembersihan manual", true);
    }

    private static void enqueueOneTime(Context context, String trigger, boolean force) {
        Data input = new Data.Builder()
                .putString(CacheCleanupWorker.KEY_TRIGGER, trigger)
                .putBoolean(CacheCleanupWorker.KEY_FORCE, force)
                .build();
        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(CacheCleanupWorker.class)
                .setInputData(input)
                .build();
        WorkManager.getInstance(context).enqueueUniqueWork(
                STARTUP_WORK, ExistingWorkPolicy.KEEP, request);
    }

    /**
     * @return bytes removed; -1 indicates a failure. The 20-minute guard prevents
     * two startup/periodic requests from deleting/reporting the same cache twice.
     */
    public static long performCleanup(Context context, String trigger, boolean force) {
        Context application = app(context);
        synchronized (LOCK) {
            SharedPreferences p = prefs(application);
            if (!isEnabled(application) && !"Pembersihan manual".equals(trigger)) {
                appendLog(application, trigger, "dilewati", 0L,
                        "Pembersihan otomatis sedang nonaktif.");
                return 0L;
            }

            long now = System.currentTimeMillis();
            long lastRun = p.getLong(KEY_LAST_RUN, 0L);
            int currentVersion = getVersionCode(application);
            int previousVersion = p.getInt(KEY_LAST_VERSION, -1);
            boolean versionChanged = previousVersion != currentVersion;

            if (!force && !versionChanged && lastRun > 0L
                    && (now - lastRun) < DUPLICATE_GUARD_MS) {
                appendLog(application, trigger, "dilewati", 0L,
                        "Pembersihan baru saja berjalan; permintaan ganda dilewati.");
                return 0L;
            }

            appendLog(application, trigger, "dimulai", 0L,
                    "Memeriksa folder cache milik RUANG LEGA.");
            try {
                long freed = clearOwnCacheDirectories(application);
                long completedAt = System.currentTimeMillis();
                p.edit()
                        .putLong(KEY_LAST_RUN, completedAt)
                        .putInt(KEY_LAST_VERSION, currentVersion)
                        .putLong(KEY_LAST_FREED, freed)
                        .putString(KEY_LAST_TRIGGER, trigger)
                        .apply();
                appendLog(application, trigger, "selesai", freed,
                        "Hanya folder cache milik RUANG LEGA yang dibersihkan. Data pengguna dipertahankan.");
                return freed;
            } catch (Exception e) {
                appendLog(application, trigger, "gagal", 0L,
                        e.getClass().getSimpleName() + ": " + String.valueOf(e.getMessage()));
                return -1L;
            }
        }
    }

    private static long clearOwnCacheDirectories(Context context) {
        Set<String> visited = new HashSet<>();
        long total = 0L;

        total += clearCacheDirectory(context.getCacheDir(), visited);

        File[] externalCaches = context.getExternalCacheDirs();
        if (externalCaches != null) {
            for (File directory : externalCaches) {
                total += clearCacheDirectory(directory, visited);
            }
        }
        return total;
    }

    private static long clearCacheDirectory(File directory, Set<String> visited) {
        if (directory == null || !directory.exists() || !directory.isDirectory()) return 0L;

        try {
            String canonical = directory.getCanonicalPath();
            if (!visited.add(canonical)) return 0L;
        } catch (Exception ignored) {
            return 0L;
        }

        File[] children = directory.listFiles();
        if (children == null) return 0L;

        long freed = 0L;
        for (File child : children) {
            try {
                // Do not follow symbolic links out of the app's cache directory.
                if (java.nio.file.Files.isSymbolicLink(child.toPath())) {
                    if (child.delete()) {
                        // The symlink itself is disposable cache content; its target is untouched.
                    }
                } else if (child.isDirectory()) {
                    freed += clearCacheDirectory(child, visited);
                    child.delete();
                } else if (child.isFile()) {
                    long size = child.length();
                    if (child.delete()) freed += size;
                }
            } catch (Exception ignored) {
                // One locked/unavailable cache item must not stop the remaining cleanup.
            }
        }
        return freed;
    }

    private static int getVersionCode(Context context) {
        try {
            PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            if (android.os.Build.VERSION.SDK_INT >= 28) {
                return (int) info.getLongVersionCode();
            }
            //noinspection deprecation
            return info.versionCode;
        } catch (PackageManager.NameNotFoundException e) {
            return 0;
        }
    }

    private static void appendLog(Context context, String trigger, String status,
                                  long freedBytes, String details) {
        SharedPreferences p = prefs(context);
        JSONArray oldLogs;
        try {
            oldLogs = new JSONArray(p.getString(KEY_LOGS, "[]"));
        } catch (JSONException e) {
            oldLogs = new JSONArray();
        }

        JSONObject entry = new JSONObject();
        try {
            entry.put("time", System.currentTimeMillis());
            entry.put("trigger", trigger);
            entry.put("status", status);
            entry.put("freedBytes", freedBytes);
            entry.put("details", details);
            oldLogs.put(entry);
        } catch (JSONException ignored) { }

        JSONArray trimmed = new JSONArray();
        int start = Math.max(0, oldLogs.length() - 30);
        for (int i = start; i < oldLogs.length(); i++) {
            JSONObject item = oldLogs.optJSONObject(i);
            if (item != null) trimmed.put(item);
        }
        p.edit().putString(KEY_LOGS, trimmed.toString()).apply();
    }

    public static JSONObject getStatus(Context context) {
        SharedPreferences p = prefs(context);
        JSONObject out = new JSONObject();
        long lastRun = p.getLong(KEY_LAST_RUN, 0L);
        try {
            out.put("enabled", isEnabled(context));
            out.put("intervalHours", INTERVAL_HOURS);
            out.put("lastRunMillis", lastRun);
            out.put("nextDueMillis", lastRun == 0L ? 0L : lastRun + INTERVAL_MS);
            out.put("lastFreedBytes", p.getLong(KEY_LAST_FREED, 0L));
            out.put("lastTrigger", p.getString(KEY_LAST_TRIGGER, ""));
            out.put("currentVersionCode", getVersionCode(context));
            out.put("logs", new JSONArray(p.getString(KEY_LOGS, "[]")));
        } catch (JSONException ignored) { }
        return out;
    }
}
