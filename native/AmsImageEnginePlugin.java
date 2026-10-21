package com.amsphotography.aistudio;

import android.app.Activity;
import androidx.activity.result.ActivityResult;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "AmsImageEngine")
public class AmsImageEnginePlugin extends Plugin {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicBoolean running = new AtomicBoolean(false);
    private volatile Process process;
    private volatile boolean inferenceSucceeded = false;

    private File models() {
        File dir = new File(getContext().getFilesDir(), "ams-models");
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Cannot create model directory");
        return dir;
    }
    private File outputs() {
        File dir = new File(getContext().getFilesDir(), "ams-results");
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Cannot create results directory");
        return dir;
    }
    private File engine() {
        return new File(getContext().getApplicationInfo().nativeLibraryDir, "libams_sd_cli.so");
    }
    private File currentModel() {
        String path = getContext().getSharedPreferences("ams_ai", 0).getString("model", "");
        return path.isEmpty() ? null : new File(path);
    }
    private void event(String stage, String description) {
        JSObject status = new JSObject();
        status.put("stage", stage);
        status.put("message", description);
        notifyListeners("status", status);
    }
    @PluginMethod
    public void status(PluginCall call) {
        JSObject out = new JSObject();
        File model = currentModel();
        out.put("binaryInstalled", engine().isFile() && engine().canExecute());
        out.put("modelSelected", model != null && model.isFile() && model.length() > 0);
        out.put("modelName", model == null ? "" : model.getName());
        out.put("running", running.get());
        out.put("verifiedInference", inferenceSucceeded);
        out.put("engine", "stable-diffusion.cpp (CPU, SD 1.5)");
        // A model being present does not mean it was successfully loaded.
        out.put("state", running.get() ? "PROCESSING" :
          !(engine().isFile() && engine().canExecute()) ? "BINARY_MISSING" :
          model == null || !model.isFile() ? "MODEL_MISSING" :
          inferenceSucceeded ? "INFERENCE_VERIFIED" : "CONFIGURED_UNVERIFIED");
        call.resolve(out);
    }
    private void chooseFile(PluginCall call, String mime, String callback) {
        if (running.get()) { call.reject("An inference is running"); return; }
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.setType(mime);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivityForResult(call, intent, callback);
    }
    @PluginMethod public void pickModel(PluginCall call) {
        chooseFile(call, "*/*", "onModelPicked");
    }
    @PluginMethod public void pickImage(PluginCall call) {
        chooseFile(call, "image/*", "onImagePicked");
    }
    @ActivityCallback
    private void onModelPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.reject("Model selection cancelled"); return;
        }
        Uri source = data.getData();
        String name = source.getLastPathSegment() == null ? "" : source.getLastPathSegment().toLowerCase(Locale.ROOT);
        String displayName = null;
        try (android.database.Cursor cursor = getContext().getContentResolver().query(
            source, new String[]{android.provider.OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) displayName = cursor.getString(0);
        } catch (Exception ignored) {}
        final String actual = displayName == null ? name : displayName;
        final String ext = actual.toLowerCase(Locale.ROOT);
        if (!(ext.endsWith(".safetensors") || ext.endsWith(".ckpt") || ext.endsWith(".gguf"))) {
            call.reject("Select an SD 1.5 model (.safetensors, .ckpt, or .gguf)"); return;
        }
        worker.execute(() -> {
            File pending = new File(models(), "model-import-" + System.nanoTime() + ".part");
            try {
                event("IMPORTING_MODEL", "Copying the selected model into private storage");
                try (InputStream in = getContext().getContentResolver().openInputStream(source);
                     OutputStream out = new BufferedOutputStream(new FileOutputStream(pending))) {
                    if (in == null) throw new IOException("Cannot open selected model");
                    byte[] buffer = new byte[1024 * 1024];
                    int count;
                    while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
                }
                if (pending.length() < 1024) throw new IOException("Model file is empty or invalid");
                File target = new File(models(), "active-model" + ext.substring(ext.lastIndexOf('.')));
                if (target.exists() && !target.delete()) throw new IOException("Cannot replace old model");
                if (!pending.renameTo(target)) throw new IOException("Cannot finish model import");
                getContext().getSharedPreferences("ams_ai", 0).edit()
                    .putString("model", target.getAbsolutePath()).apply();
                inferenceSucceeded = false;
                JSObject out = new JSObject();
                out.put("modelName", actual);
                out.put("sizeBytes", target.length());
                out.put("state", "CONFIGURED_UNVERIFIED");
                call.resolve(out);
                event("MODEL_IMPORTED", "Model stored. Inference not yet verified.");
            } catch (Exception e) {
                pending.delete();
                call.reject("Model import failed: " + e.getMessage());
                event("ERROR", e.getMessage());
            }
        });
    }
    @ActivityCallback
    private void onImagePicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.reject("Image selection cancelled"); return;
        }
        final Uri source = data.getData();
        worker.execute(() -> {
            try {
                File target = new File(outputs(), "input-" + UUID.randomUUID() + ".png");
                BitmapFactory.Options bounds = new BitmapFactory.Options();
                bounds.inJustDecodeBounds = true;
                try (InputStream in = getContext().getContentResolver().openInputStream(source)) {
                    BitmapFactory.decodeStream(in, null, bounds);
                }
                if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw new IOException("Cannot decode photo");
                BitmapFactory.Options options = new BitmapFactory.Options();
                options.inSampleSize = 1;
                while (Math.max(bounds.outWidth / options.inSampleSize, bounds.outHeight / options.inSampleSize) > 1024)
                    options.inSampleSize *= 2;
                Bitmap bitmap;
                try (InputStream in = getContext().getContentResolver().openInputStream(source)) {
                    bitmap = BitmapFactory.decodeStream(in, null, options);
                }
                if (bitmap == null) throw new IOException("Cannot read image");
                int width = Math.max(256, Math.round(512f * bitmap.getWidth() /
                    Math.max(bitmap.getWidth(), bitmap.getHeight()) / 64f) * 64);
                int height = Math.max(256, Math.round(512f * bitmap.getHeight() /
                    Math.max(bitmap.getWidth(), bitmap.getHeight()) / 64f) * 64);
                Bitmap resized = Bitmap.createScaledBitmap(bitmap, width, height, true);
                try (OutputStream out = new FileOutputStream(target)) {
                    if (!resized.compress(Bitmap.CompressFormat.PNG, 100, out))
                        throw new IOException("Cannot encode input PNG");
                }
                if (resized != bitmap) resized.recycle();
                bitmap.recycle();
                JSObject out = new JSObject();
                out.put("uri", Uri.fromFile(target).toString());
                out.put("width", width);
                out.put("height", height);
                call.resolve(out);
            } catch (Exception e) { call.reject("Image import failed: " + e.getMessage()); }
        });
    }
    @PluginMethod
    public void generate(PluginCall call) {
        String uri = call.getString("imageUri");
        String prompt = call.getString("prompt", "").trim();
        Integer steps = call.getInt("steps", 12);
        Double strength = call.getDouble("strength", 0.35);
        if (uri == null || prompt.isEmpty()) { call.reject("Choose image and enter a prompt"); return; }
        if (steps == null || steps < 1 || steps > 50 ||
            strength == null || strength < 0.05 || strength > 0.95) {
            call.reject("Invalid strength or step count"); return;
        }
        File model = currentModel();
        File binary = engine();
        if (!binary.isFile() || !binary.canExecute()) { call.reject("Native inference binary not installed"); return; }
        if (model == null || !model.isFile()) { call.reject("Import a model first"); return; }
        Uri source = Uri.parse(uri);
        File input = new File(source.getPath() == null ? "" : source.getPath());
        try {
            if (!input.getCanonicalPath().startsWith(outputs().getCanonicalPath() + File.separator)
                || !input.isFile() || !input.getName().startsWith("input-")) {
                call.reject("Use a photo selected through AMS"); return;
            }
        } catch (IOException e) { call.reject("Invalid photo path"); return; }
        if (!running.compareAndSet(false, true)) { call.reject("An inference is already running"); return; }
        final int nSteps = steps;
        final double denoise = strength;
        worker.execute(() -> {
            File output = new File(outputs(), "ams-edit-" + UUID.randomUUID() + ".png");
            try {
                event("STARTING", "Starting offline image-to-image inference");
                ArrayList<String> command = new ArrayList<>(Arrays.asList(
                    binary.getAbsolutePath(), "-m", model.getAbsolutePath(),
                    "-i", input.getAbsolutePath(), "-o", output.getAbsolutePath(),
                    "-p", prompt, "--strength", String.valueOf(denoise),
                    "--steps", String.valueOf(nSteps),
                    "-W", String.valueOf(getImageWidth(input)), "-H", String.valueOf(getImageHeight(input))
                ));
                ProcessBuilder pb = new ProcessBuilder(command);
                pb.redirectErrorStream(true);
                pb.environment().put("LD_LIBRARY_PATH", getContext().getApplicationInfo().nativeLibraryDir);
                process = pb.start();
                event("PROCESSING", "Local model is processing the image");
                StringBuilder tail = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        tail.append(line).append('\n');
                        if (tail.length() > 3000) tail.delete(0, tail.length() - 3000);
                    }
                }
                int code = process.waitFor();
                if (code != 0 || !output.isFile() || output.length() < 100) {
                    throw new IOException("Inference failed (exit " + code + "): " + tail);
                }
                inferenceSucceeded = true;
                JSObject out = new JSObject();
                out.put("uri", Uri.fromFile(output).toString());
                out.put("model", model.getName());
                out.put("verifiedInference", true);
                call.resolve(out);
                event("COMPLETE", "Offline image editing completed");
            } catch (Exception e) {
                output.delete();
                call.reject("AI edit failed: " + e.getMessage());
                event("ERROR", e.getMessage());
            } finally {
                process = null;
                running.set(false);
            }
        });
    }
    private int getImageWidth(File file) {
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(file.getAbsolutePath(), options);
        return options.outWidth;
    }
    private int getImageHeight(File file) {
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(file.getAbsolutePath(), options);
        return options.outHeight;
    }
    @PluginMethod
    public void cancel(PluginCall call) {
        Process p = process;
        if (p != null && p.isAlive()) {
            p.destroyForcibly();
            call.resolve();
        } else call.reject("No active native inference to cancel");
    }
    @PluginMethod
    public void export(PluginCall call) {
        String uri = call.getString("imageUri");
        if (uri == null) { call.reject("No image"); return; }
        File source = new File(Uri.parse(uri).getPath());
        try {
            if (!source.getCanonicalPath().startsWith(outputs().getCanonicalPath() + File.separator)
                || !source.isFile() || !source.getName().startsWith("ams-edit-")) {
                call.reject("Only AMS generated images can be exported"); return;
            }
        } catch (IOException e) { call.reject("Invalid image"); return; }
        worker.execute(() -> {
            try {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, "AMS-" + System.currentTimeMillis() + ".png");
                values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/AMS");
                values.put(MediaStore.Images.Media.IS_PENDING, 1);
                Uri destination = getContext().getContentResolver().insert(
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                if (destination == null) throw new IOException("Cannot save to gallery");
                try {
                    try (InputStream in = new FileInputStream(source);
                         OutputStream out = getContext().getContentResolver().openOutputStream(destination)) {
                        if (out == null) throw new IOException("Gallery output unavailable");
                        byte[] buffer = new byte[65536];
                        int count;
                        while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
                    }
                    values.clear();
                    values.put(MediaStore.Images.Media.IS_PENDING, 0);
                    getContext().getContentResolver().update(destination, values, null, null);
                    JSObject result = new JSObject();
                    result.put("uri", destination.toString());
                    call.resolve(result);
                } catch (Exception e) {
                    getContext().getContentResolver().delete(destination, null, null);
                    throw e;
                }
            } catch (Exception e) { call.reject("Export failed: " + e.getMessage()); }
        });
    }
    @Override protected void handleOnDestroy() {
        Process p = process;
        if (p != null) p.destroyForcibly();
        worker.shutdownNow();
        super.handleOnDestroy();
    }
}
