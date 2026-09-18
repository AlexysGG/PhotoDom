import os
import json
from django.conf import settings
from django.templatetags.static import static
from .models import Marco, PALETAS_COLOR, CONFIGURACION_TEMAS

def obtener_archivos_marcos_locales():
    """
    Retorna un conjunto con los nombres de archivo exactos disponibles
    en la carpeta estática local de marcos (galerias/static/galerias/marcos/).
    """
    ruta_marcos = os.path.join(settings.BASE_DIR, 'galerias', 'static', 'galerias', 'marcos')
    if not os.path.exists(ruta_marcos):
        return set()
    
    archivos = set()
    for f in os.listdir(ruta_marcos):
        if os.path.isfile(os.path.join(ruta_marcos, f)):
            archivos.add(f)
    return archivos


def obtener_catalogo_marcos_preview():
    """
    Obtiene el listado de marcos activos desde la base de datos (Google Cloud)
    y busca coincidencias ÚNICAMENTE POR NOMBRE EXACTO en la carpeta local de la app.
    
    Retorna:
    - marcos_lista: lista de diccionarios con info de cada marco y su URL de preview local.
    - marcos_dict: mapa { marco_id: datos } listo para consultar desde JavaScript.
    """
    marcos_activos = Marco.objects.filter(activo=True).order_by('nombre')
    archivos_locales = obtener_archivos_marcos_locales()
    
    # Crear un mapa case-insensitive de archivos locales para mayor tolerancia en sistemas de archivos
    archivos_locales_map = {f.lower(): f for f in archivos_locales}
    
    marcos_lista = []
    marcos_dict = {}

    for marco in marcos_activos:
        nombre_archivo_gc = os.path.basename(marco.imagen.name) if marco.imagen else ''
        nombre_lower = nombre_archivo_gc.lower()
        
        # Coincidencia ÚNICAMENTE por nombre exacto del archivo en Google Cloud
        archivo_local_encontrado = None
        if nombre_archivo_gc in archivos_locales:
            archivo_local_encontrado = nombre_archivo_gc
        elif nombre_lower in archivos_locales_map:
            archivo_local_encontrado = archivos_locales_map[nombre_lower]
        
        preview_url = None
        if archivo_local_encontrado:
            preview_url = static(f'galerias/marcos/{archivo_local_encontrado}')
        
        info = {
            'id': marco.id,
            'nombre': marco.nombre,
            'archivo_gc': nombre_archivo_gc,
            'preview_url': preview_url,
            'tiene_preview': bool(preview_url),
            'solo_premium': marco.solo_premium,
        }
        marcos_lista.append(info)
        marcos_dict[str(marco.id)] = info

    return marcos_lista, marcos_dict


def obtener_paletas_preview():
    """
    Construye la información estructurada de las paletas de color disponibles
    para su renderizado y preview interactivo con 'cuadritos' en el frontend.
    """
    temas = {}
    for codigo, nombre_visible in PALETAS_COLOR:
        config = CONFIGURACION_TEMAS.get(codigo, {})
        temas[codigo] = {
            'codigo': codigo,
            'nombre': nombre_visible,
            'bg': config.get('bg', '#ffffff'),
            'primary': config.get('primary', '#4f46e5'),
            'text': config.get('text', '#1e293b'),
            'shadow_dark': config.get('shadow_dark', '#cbd5e1'),
            'shadow_light': config.get('shadow_light', '#ffffff'),
        }
    return temas
