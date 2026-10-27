package com.amsphotography.aistudio;
import android.os.Build;
import android.os.StatFs;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
@CapacitorPlugin(name = "AmsEngineManager")
public class AmsEngineManagerPlugin extends Plugin {
  @PluginMethod
  public void scan(PluginCall call) {
    JSObject result = new JSObject();
    result.put("androidApi", Build.VERSION.SDK_INT);
    result.put("abis", new com.getcapacitor.JSArray(java.util.Arrays.asList(Build.SUPPORTED_ABIS)));
    result.put("freeBytes", new StatFs(getContext().getFilesDir().getAbsolutePath()).getAvailableBytes());
    result.put("nativeBridge", true);
    result.put("modelInstallerReady", false);
    result.put("reason", "No pinned trusted model catalog and verified native inference adapter installed");
    call.resolve(result);
  }
  @PluginMethod
  public void catalog(PluginCall call) {
    JSObject result = new JSObject();
    result.put("models", new com.getcapacitor.JSArray());
    result.put("reason", "Trusted compatible catalog not configured");
    call.resolve(result);
  }
  @PluginMethod
  public void install(PluginCall call) {
    call.reject("Install unavailable: trusted model manifest and verified inference runtime required");
  }
}
