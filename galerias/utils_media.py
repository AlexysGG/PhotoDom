import os
import subprocess
import tempfile
import io
from PIL import Image
from django.core.files.base import ContentFile
import uuid

def procesar_imagen_pil(archivo):
    """
    Recibe un archivo de imagen, lo procesa y devuelve un diccionario con 
    el archivo original, el preview (1920px) y el thumb (400px), todos en memoria.
    """
    img = Image.open(archivo)
    
    # Corregir orientación EXIF si es necesario
    try:
        from PIL import ImageOps
        img = ImageOps.exif_transpose(img)
    except:
        pass

    ancho_original, alto_original = img.size
    
    # Configurar formato de salida (siempre WebP para optimizar)
    output_format = 'WEBP'
    
    # 1. Crear Preview (máximo 1920px de ancho/alto)
    img_preview = img.copy()
    img_preview.thumbnail((1920, 1920), Image.Resampling.LANCZOS)
    
    buffer_preview = io.BytesIO()
    img_preview.save(buffer_preview, format=output_format, quality=85)
    
    # 2. Crear Thumb (máximo 400px)
    img_thumb = img.copy()
    img_thumb.thumbnail((400, 400), Image.Resampling.LANCZOS)
    
    buffer_thumb = io.BytesIO()
    img_thumb.save(buffer_thumb, format=output_format, quality=60)
    
    nombre_base = os.path.splitext(archivo.name)[0]
    
    return {
        'ancho': ancho_original,
        'alto': alto_original,
        'preview': ContentFile(buffer_preview.getvalue(), name=f"{nombre_base}_preview.webp"),
        'thumb': ContentFile(buffer_thumb.getvalue(), name=f"{nombre_base}_thumb.webp"),
    }

def transcodificar_video_ffmpeg(ruta_original):
    """
    Ejecuta ffmpeg para generar un frame en WebP y una versión ligera del video en H.264.
    Requiere ffmpeg instalado en el sistema.
    """
    import tempfile
    temp_dir = tempfile.gettempdir()
    
    # Rutas temporales de salida
    base_name = str(uuid.uuid4())
    thumb_path = os.path.join(temp_dir, f"{base_name}_thumb.webp")
    preview_path = os.path.join(temp_dir, f"{base_name}_preview.mp4")
    
    try:
        # Extraer miniatura (thumbnail) al segundo 0 (o 1)
        cmd_thumb = [
            'ffmpeg', '-y', '-i', ruta_original, 
            '-ss', '00:00:00.100', '-vframes', '1', 
            '-q:v', '50', thumb_path
        ]
        subprocess.run(cmd_thumb, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        
        # Transcodificar a mp4 ligero (720p máx, h264, aac)
        cmd_preview = [
            'ffmpeg', '-y', '-i', ruta_original,
            '-vf', "scale='min(1280,iw)':-2",
            '-vcodec', 'libx264', '-crf', '28', '-preset', 'fast',
            '-acodec', 'aac', '-b:a', '128k',
            preview_path
        ]
        subprocess.run(cmd_preview, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    except FileNotFoundError:
        raise RuntimeError("FFmpeg no está instalado o no está en el PATH del sistema. (WinError 2)")
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Error al ejecutar ffmpeg: {e}")
    
    return thumb_path, preview_path
