package id.ruanglega.app;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/** Runs the 24-hour background cache maintenance task. */
public class CacheCleanupWorker extends Worker {
    public static final String KEY_TRIGGER = "cleanup_trigger";
    public static final String KEY_FORCE = "cleanup_force";

    public CacheCleanupWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        String trigger = getInputData().getString(KEY_TRIGGER);
        if (trigger == null || trigger.trim().isEmpty()) trigger = "Jadwal 24 jam";
        boolean force = getInputData().getBoolean(KEY_FORCE, false);
        long result = AutoCacheCleanupManager.performCleanup(getApplicationContext(), trigger, force);
        return result < 0L ? Result.retry() : Result.success();
    }
}
