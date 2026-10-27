package com.amsphotography.aistudio;

import android.content.ContentValues;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;

@CapacitorPlugin(name = "AmsPhotoSave")
public class AmsPhotoSavePlugin extends Plugin {
    @PluginMethod
    public void saveJpeg(PluginCall call) {
        String encoded = call.getString("base64");
        String requestedName = call.getString("fileName", "AMS_EDIT.jpg");
        if (encoded == null || encoded.isEmpty()) { call.reject("JPEG data missing"); return; }
        String safeName = requestedName.replaceAll("[^A-Za-z0-9._-]", "_");
        if (!safeName.toLowerCase(java.util.Locale.ROOT).endsWith(".jpg")) safeName += ".jpg";
        Uri uri = null;
        try {
            byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
            if (bytes.length < 4 || (bytes[0] & 255) != 255 || (bytes[1] & 255) != 216)
                throw new IllegalArgumentException("Invalid JPEG data");
            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, safeName);
            values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
            values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/AMS AI Studio");
            values.put(MediaStore.Images.Media.IS_PENDING, 1);
            uri = getContext().getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IllegalStateException("MediaStore insertion failed");
            try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri)) {
                if (stream == null) throw new IllegalStateException("Cannot open image destination");
                stream.write(bytes);
                stream.flush();
            }
            values.clear();
            values.put(MediaStore.Images.Media.IS_PENDING, 0);
            if (getContext().getContentResolver().update(uri, values, null, null) < 1)
                throw new IllegalStateException("Could not publish saved image");
            try (android.os.ParcelFileDescriptor descriptor = getContext().getContentResolver().openFileDescriptor(uri, "r")) {
                if (descriptor == null || descriptor.getStatSize() != bytes.length)
                    throw new IllegalStateException("Saved image verification failed");
            }
            JSObject result = new JSObject();
            result.put("uri", uri.toString());
            result.put("fileName", safeName);
            result.put("bytes", bytes.length);
            result.put("location", "Pictures/AMS AI Studio");
            call.resolve(result);
        } catch (Exception error) {
            if (uri != null) getContext().getContentResolver().delete(uri, null, null);
            call.reject("Android photo save failed: " + error.getMessage());
        }
    }
}
