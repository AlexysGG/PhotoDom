import os
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

    # 1. Obtener la ruta o descargar temporalmente el original si está en GCS
    # Al usar django-storages, foto.original_archivo.url nos da la URL firmada.
    # Necesitamos descargarlo localmente para que ffmpeg lo procese.
    import tempfile
    import requests
    
    temp_dir = tempfile.gettempdir()
    original_path = os.path.join(temp_dir, f"original_{foto.id}.mp4")
    
    try:
        # Descargar el video de GCS para procesarlo
        response = requests.get(foto.original_archivo.url, stream=True)
        response.raise_for_status()
        with open(original_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                
        # 2. Procesar con ffmpeg
        thumb_path, preview_path = transcodificar_video_ffmpeg(original_path)
        
        # 3. Subir los archivos generados
        with open(thumb_path, 'rb') as f_thumb:
            foto.thumb_archivo.save(f"thumb_{foto.id}.webp", File(f_thumb), save=False)
            
        with open(preview_path, 'rb') as f_preview:
            foto.preview_archivo.save(f"preview_{foto.id}.mp4", File(f_preview), save=False)
            
        # 4. Actualizar estado
        foto.estado_procesamiento = 'COMPLETADO'
        foto.save()
        
    except Exception as e:
        foto.estado_procesamiento = 'ERROR'
        foto.save()
        print(f"Error procesando video {foto_id}: {e}")
        
    finally:
        # Limpiar archivos temporales
        for path in [original_path]:
            if os.path.exists(path):
                try:
                    os.remove(path)
                except:
                    pass
