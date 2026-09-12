import os
import tempfile
import requests
from django.core.files import File
from .models import FotoInvitado
from .utils_media import transcodificar_video_ffmpeg

def procesar_video_async(foto_id):
    """
    Tarea asíncrona (ejecutada por django-q) que toma el video original,
    le extrae el thumbnail webp y crea una versión ligera MP4.
    """
    try:
        foto = FotoInvitado.objects.get(id=foto_id)
    except FotoInvitado.DoesNotExist:
        return
        
    if foto.tipo != 'VIDEO' or not foto.original_archivo:
        return

    temp_dir = tempfile.gettempdir()
    original_path = os.path.join(temp_dir, f"original_{foto.id}.mp4")
    thumb_path = None
    preview_path = None
    
    try:
        # 1. Descargar el video de GCS en chunks de 64 KB (más eficiente que 8 KB)
        response = requests.get(foto.original_archivo.url, stream=True, timeout=60)
        response.raise_for_status()
        
        with open(original_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=65536):
                if chunk:
                    f.write(chunk)
                
        # 2. Procesar con ffmpeg
        thumb_path, preview_path = transcodificar_video_ffmpeg(original_path)
        
        # 3. Subir los archivos generados a Google Cloud Storage
        with open(thumb_path, 'rb') as f_thumb:
            foto.thumb_archivo.save(f"thumb_{foto.id}.webp", File(f_thumb), save=False)
            
        with open(preview_path, 'rb') as f_preview:
            foto.preview_archivo.save(f"preview_{foto.id}.mp4", File(f_preview), save=False)
            
        # 4. Actualizar estado persistiendo solo los campos modificados
        foto.estado_procesamiento = 'COMPLETADO'
        foto.save(update_fields=['thumb_archivo', 'preview_archivo', 'estado_procesamiento'])
        
    except Exception as e:
        foto.estado_procesamiento = 'ERROR'
        foto.save(update_fields=['estado_procesamiento'])
        print(f"Error procesando video {foto_id}: {e}")
        
    finally:
        # 5. Limpieza TOTAL de temporales (Original + Thumbnail + Preview)
        for path in [original_path, thumb_path, preview_path]:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass