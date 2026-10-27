package com.amsphotography.aistudio;

import android.os.Build;
import android.os.StatFs;
import com.getcapacitor.JSObject;
import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "AmsEngineManager")
public class AmsEngineManagerPlugin extends Plugin {
  private final ExecutorService worker = Executors.newSingleThreadExecutor();
  private final AtomicBoolean downloading = new AtomicBoolean(false);
  private JSONObject manifest() throws Exception {
    try (InputStream in = getContext().getAssets().open("ams-model-catalog.json");
         ByteArrayOutputStream out = new ByteArrayOutputStream()) {
      byte[] buf = new byte[8192]; int n;
      while ((n=in.read(buf))!=-1) out.write(buf,0,n);
      return new JSONObject(out.toString("UTF-8"));
    }
  }
  private boolean hasEngine() {
    File f = new File(getContext().getApplicationInfo().nativeLibraryDir, "libams_sd_cli.so");
    return f.isFile() && f.canExecute();
  }
  private void event(String stage,String message,long done,long total) {
    JSObject out=new JSObject();
    out.put("stage",stage);out.put("message",message);out.put("bytes",done);out.put("totalBytes",total);
    notifyListeners("updateProgress",out);
  }
  @PluginMethod public void scan(PluginCall call) {
    JSObject result=new JSObject();
    result.put("androidApi",Build.VERSION.SDK_INT);
    result.put("abis",new JSArray(java.util.Arrays.asList(Build.SUPPORTED_ABIS)));
    result.put("freeBytes",new StatFs(getContext().getFilesDir().getAbsolutePath()).getAvailableBytes());
    result.put("nativeImageEngine",hasEngine());
    result.put("modelInstallerReady",true);
    result.put("inProgress",downloading.get());
    call.resolve(result);
  }
  @PluginMethod public void catalog(PluginCall call) {
    try {
      JSONArray entries=manifest().getJSONArray("models");
      JSArray models=new JSArray();
      for(int i=0;i<entries.length();i++){
        JSONObject entry=entries.getJSONObject(i);
        JSObject item=new JSObject();
        String runtime=entry.optString("runtime");
        boolean runtimeReady=runtime.equals("stable-diffusion.cpp") && hasEngine();
        boolean abiOk=java.util.Arrays.asList(Build.SUPPORTED_ABIS).contains(entry.optString("abi","arm64-v8a"));
        boolean eligible=entry.optBoolean("installable",false) && runtimeReady && abiOk &&
          Build.VERSION.SDK_INT>=entry.optInt("minAndroidApi",28);
        item.put("id",entry.getString("id"));
        item.put("name",entry.getString("name"));
        item.put("kind",entry.getString("kind"));
        item.put("sizeBytes",entry.optLong("sizeBytes",0));
        item.put("eligible",eligible);
        item.put("reason",eligible?"Candidate available; inference not yet verified":entry.optString("status","Runtime unavailable"));
        models.put(item);
      }
      JSObject out=new JSObject();out.put("models",models);
      out.put("catalogVersion",manifest().getInt("schemaVersion"));call.resolve(out);
    } catch(Exception e){call.reject("Catalog error: "+e.getMessage());}
  }
  @PluginMethod public void install(PluginCall call) {
    final String id=call.getString("id","");
    if(!downloading.compareAndSet(false,true)){call.reject("Download already running");return;}
    worker.execute(()->{
      File partial=null;
      try{
        JSONObject model=null;JSONArray entries=manifest().getJSONArray("models");
        for(int i=0;i<entries.length();i++)if(entries.getJSONObject(i).getString("id").equals(id))model=entries.getJSONObject(i);
        if(model==null || !model.optBoolean("installable",false) || !model.getString("runtime").equals("stable-diffusion.cpp") || !hasEngine())
          throw new IOException("Model not allowed or native runtime missing");
        if(Build.VERSION.SDK_INT<model.getInt("minAndroidApi") || !java.util.Arrays.asList(Build.SUPPORTED_ABIS).contains(model.getString("abi")))
          throw new IOException("Device incompatible");
        String expected=model.getString("sha256").toLowerCase(Locale.ROOT);
        if(!expected.matches("[a-f0-9]{64}"))throw new IOException("Missing pinned SHA-256");
        long total=model.getLong("sizeBytes");
        File folder=new File(getContext().getFilesDir(),"ams-models");
        if(!folder.exists()&&!folder.mkdirs())throw new IOException("Cannot create model directory");
        if(new StatFs(folder.getAbsolutePath()).getAvailableBytes()<model.getLong("requiredFreeBytes"))
          throw new IOException("Insufficient free storage");
        partial=new File(folder,id+".part");
        // Restart from zero on every attempt: safe behavior if server lacks range support.
        URL url=new URL(model.getString("url"));
        if(!url.getProtocol().equals("https") || !url.getHost().equals("huggingface.co"))throw new IOException("Untrusted URL");
        HttpURLConnection conn=(HttpURLConnection)url.openConnection();
        conn.setConnectTimeout(20000);conn.setReadTimeout(60000);
        conn.setInstanceFollowRedirects(true);
        conn.connect();
        if(conn.getResponseCode()!=200)throw new IOException("HTTP "+conn.getResponseCode());
        if(!conn.getURL().getProtocol().equals("https"))throw new IOException("Insecure redirect");
        MessageDigest digest=MessageDigest.getInstance("SHA-256");
        long read=0,last=0;
        try(InputStream in=new BufferedInputStream(conn.getInputStream());
            OutputStream out=new BufferedOutputStream(new FileOutputStream(partial,false))){
          byte[] buffer=new byte[262144];int n;
          while((n=in.read(buffer))!=-1){
            read+=n;if(read>total)throw new IOException("Unexpected model size");
            digest.update(buffer,0,n);out.write(buffer,0,n);
            if(read-last>=8388608){event("DOWNLOADING",model.getString("name"),read,total);last=read;}
          }
        } finally {conn.disconnect();}
        if(read!=total)throw new IOException("Incomplete download "+read+"/"+total);
        StringBuilder actual=new StringBuilder();
        for(byte b:digest.digest())actual.append(String.format(Locale.ROOT,"%02x",b&255));
        if(!expected.equals(actual.toString()))throw new IOException("SHA-256 mismatch; file discarded");
        File target=new File(folder,"active-model.safetensors");
        if(target.exists()&&!target.delete())throw new IOException("Cannot replace existing model");
        if(!partial.renameTo(target))throw new IOException("Cannot activate verified model");
        getContext().getSharedPreferences("ams_ai",0).edit().putString("model",target.getAbsolutePath()).apply();
        event("INSTALLED_UNVERIFIED","Model downloaded and hash verified; inference test required",total,total);
        JSObject result=new JSObject();result.put("state","INSTALLED_UNVERIFIED");result.put("bytes",total);call.resolve(result);
      }catch(Exception e){
        if(partial!=null)partial.delete();
        event("ERROR",e.getMessage(),0,0);call.reject("Model installation failed: "+e.getMessage());
      }finally{downloading.set(false);}
    });
  }
}
