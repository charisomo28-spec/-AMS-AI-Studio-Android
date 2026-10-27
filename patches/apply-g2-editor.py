"""G2: repair preview null dereference and export original-resolution JPEG."""
from pathlib import Path
import re

path = Path("www/app.js")
source = path.read_text(encoding="utf-8")
old_preview = "$('preview').querySelector('canvas').style.display='none'"
assert source.count(old_preview) == 1, "Expected G2 preview bug not found"
source = source.replace(old_preview, "$('preview').style.display='none'")

start = source.index("async function exportJpg(){")
end = source.index("function bubble(", start)
replacement = r"""
// G2: export from the original image, never from the 2048px preview.
async function exportJpg(){
  if(!current)return alert('Select a photo first');
  const button=$('exportBtn');button.disabled=true;
  try{
    const im=await loadImage(current);
    const width=im.naturalWidth,height=im.naturalHeight;
    if(!width||!height)throw Error('Source image cannot be decoded');
    const canvas=document.createElement('canvas');
    canvas.width=width;canvas.height=height;
    if(canvas.width!==width||canvas.height!==height)throw Error('Full-resolution canvas unavailable');
    const ctx=canvas.getContext('2d');
    if(!ctx)throw Error('Canvas renderer unavailable');
    ctx.filter='brightness('+Number($('brightness').value)+'%) contrast('+Number($('contrast').value)+'%) saturate('+Number($('saturation').value)+'%)';
    ctx.drawImage(im,0,0,width,height);ctx.filter='none';
    const warmth=Number($('warmth').value);
    if(warmth!==0){
      ctx.fillStyle='rgba('+(warmth>0?'255,152,60':'75,145,255')+','+(Math.abs(warmth)/450)+')';
      ctx.fillRect(0,0,width,height);
    }
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(
      b=>b?resolve(b):reject(Error('JPEG encoder failed')),'image/jpeg',0.93));
    const decoded=await createImageBitmap(blob);
    const verified=decoded.width===width&&decoded.height===height;
    decoded.close();
    if(!verified)throw Error('Export dimensions differ from original');
    if(!window.Capacitor?.isNativePlatform?.())throw Error('Native Android save unavailable');
    const saver=window.Capacitor?.Plugins?.AmsPhotoSave;
    if(typeof saver?.saveJpeg!=='function')throw Error('Android AmsPhotoSave bridge unavailable');
    const base64=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onerror=()=>reject(Error('JPEG base64 conversion failed'));
      reader.onload=()=>resolve(String(reader.result).split(',')[1]);
      reader.readAsDataURL(blob);
    });
    const saved=await saver.saveJpeg({
      base64,
      fileName:'AMS_EDIT_'+current.name.replace(/\.[^.]+$/,'')+'_'+Date.now()+'.jpg'
    });
    if(!saved.uri||saved.bytes!==blob.size)throw Error('Android save confirmation failed');
    bubble('Saved '+width+' × '+height+' JPEG to '+saved.location+'/'+saved.fileName,'ai');
  }catch(e){
    bubble('Export failed: '+e.message,'ai');
    alert('Export failed: '+e.message);
  }finally{button.disabled=false}
}
$('exportBtn').onclick=exportJpg;
$('applyBtn').onclick=()=>exportJpg();
"""
source=source[:start]+replacement+source[end:]
assert "ctx.drawImage(im,0,0,width,height)" in source
assert "Export dimensions differ from original" in source
path.write_text(source,encoding="utf-8")
print("G2 source patch PASS: full-resolution export + preview bug")
