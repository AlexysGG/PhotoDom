import os
import subprocess
import tempfile
import io
import uuid
from PIL import Image, ImageOps
from django.core.files.base import ContentFile

def procesar_imagen_pil(archivo):
    """
    Recibe un archivo de imagen, lo procesa y devuelve un diccionario con 
    las dimensiones originales, el preview optimizado y el thumb, en memoria.
    """
    img = Image.open(archivo)
    
    # Corregir orientación EXIF (fotos tomadas con móviles)
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass

    ancho_original, alto_original = img.size
    output_format = 'WEBP'
    
    # 1. Crear Preview (máximo 1600px en el lado más largo, calidad web eficiente)
    img_preview = img.copy()
    img_preview.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
    buffer_preview = io.BytesIO()
    img_preview.save(buffer_preview, format=output_format, quality=75, optimize=True)
    
    # 2. Crear Thumb (máximo 400px para la cuadrícula)
    img_thumb = img.copy()
    img_thumb.thumbnail((400, 400), Image.Resampling.LANCZOS)
    buffer_thumb = io.BytesIO()
    img_thumb.save(buffer_thumb, format=output_format, quality=60, optimize=True)
    
    nombre_base = os.path.splitext(archivo.name)[0]
    
    return {
        'ancho': ancho_original,
        'alto': alto_original,
        'preview': ContentFile(buffer_preview.getvalue(), name=f"{nombre_base}_preview.webp"),
        'thumb': ContentFile(buffer_thumb.getvalue(), name=f"{nombre_base}_thumb.webp"),
    }

def transcodificar_video_ffmpeg(ruta_original):
    """
    Ejecuta FFmpeg para generar un thumbnail en WebP y una versión ligera MP4.
    Optimizado para entornos con CPU y memoria limitadas.
    """
    temp_dir = tempfile.gettempdir()
    base_name = str(uuid.uuid4())
    
    thumb_path = os.path.join(temp_dir, f"{base_name}_thumb.webp")
    preview_path = os.path.join(temp_dir, f"{base_name}_preview.mp4")
    
    try:
        # 1. Extraer miniatura (Fast Seek: -ss antes de -i para no gastar CPU)
        cmd_thumb = [
            'ffmpeg', '-y',
            '-ss', '00:00:00.500',
            '-i', ruta_original,
            '-vframes', '1',
            '-vf', "scale='min(400,iw)':-2",
            '-c:v', 'libwebp',
            '-quality', '65',
            thumb_path
        ]
        subprocess.run(cmd_thumb, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        
        # 2. Transcodificar a MP4 ligero
        # - scale: escala inteligente que reduce tanto videos verticales como horizontales
        # - faststart: permite que el video se reproduzca al instante en el navegador
        cmd_preview = [
            'ffmpeg', '-y',
            '-i', ruta_original,
            '-vf', "scale='if(gt(iw,ih),min(720,iw),-2)':'if(gt(iw,ih),-2,min(720,ih))'",
            '-c:v', 'libx264',
            '-crf', '28',
            '-preset', 'veryfast',
            '-c:a', 'aac',
            '-b:a', '96k',
            '-ac', '2',
            '-movflags', '+faststart',
            preview_path
        ]
        subprocess.run(cmd_preview, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        
    except FileNotFoundError:
        raise RuntimeError("FFmpeg no está instalado o no está en el PATH del sistema.")
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Error al ejecutar ffmpeg: {e}")
    
    return thumb_path, preview_path