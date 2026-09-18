from requests import request
import os
import io
import base64
import qrcode
import zipfile
import requests
import uuid
import re
from datetime import datetime, timezone as dt_timezone, timedelta
from django.shortcuts import render, get_object_or_404, redirect
from django.http import JsonResponse, HttpResponse, Http404
from django.urls import reverse
from django.views.decorators.http import require_POST
from django_ratelimit.decorators import ratelimit
from django.utils import timezone
from django.conf import settings
from .models import Evento, FotoInvitado, Marco, SolicitudEvento
from django_q.tasks import async_task
import json
from .utils_media import procesar_imagen_pil
from .utils_marcos import obtener_catalogo_marcos_preview, obtener_paletas_preview
from .forms import SolicitudEventoForm


def generar_nombre_seguro(nombre_original, extension=None):
    """
    Genera un nombre de archivo corto y seguro basado en el nombre original.
    - Remueve caracteres especiales
    - Usa un UUID corto para evitar colisiones
    - Mantiene la extensión original
    """
    # Extraer extensión si no se proporciona
    if extension is None:
        _, extension = os.path.splitext(nombre_original)
        extension = extension.lower()
    else:
        if not extension.startswith('.'):
            extension = '.' + extension

    # Generar UUID corto (primeros 8 caracteres)
    uuid_corto = str(uuid.uuid4())[:8]

    # Nombre base corto
    nombre_seguro = f"foto_{uuid_corto}{extension}"

    return nombre_seguro

def galeria_invitado(request, evento_id):
    """Muestra la galería interactiva al invitado"""
    evento = get_object_or_404(Evento, id=evento_id)

    # Establecer acceso en sesión para descargas posteriores
    session_key = f'acceso_evento_{evento.id}'
    request.session[session_key] = True
    request.session.modified = True

    # Verificar si el evento está expirado por vigencia del plan
    if evento.esta_expirado() or not evento.activo:
        return render(request, 'galerias/expirado.html', {'evento': evento})

    # Verificar control de ventana de tiempo
    if evento.fecha_hora_inicio:
        from datetime import timedelta
        from django.utils import timezone

        ahora = timezone.now()
        margen_inicio = evento.fecha_hora_inicio - timedelta(minutes=15)

        # Si el evento aún no ha comenzado (con margen de 15 min)
        if ahora < margen_inicio:
            tiempo_restante = evento.fecha_hora_inicio - ahora
            return render(request, 'galerias/espera.html', {
                'evento': evento,
                'tiempo_restante': tiempo_restante,
                'fecha_inicio': evento.fecha_hora_inicio
            })

        # Si el evento ya terminó según la duración contratada
        if evento.fecha_fin_evento and ahora > evento.fecha_fin_evento:
            return render(request, 'galerias/expirado.html', {'evento': evento})

    archivos = evento.fotos.all().order_by('-fecha_subida')

    mis_fotos_ids = request.session.get('mis_fotos_ids', [])

    fotos_destacadas = []
    if evento.permite_interaccion:
        # Agregamos extensiones de video a la expresión regular
        extensiones_media = r'\.(jpg|jpeg|png|webp|gif|heic|mp4|mov|avi|webm)$'
        
        fotos_destacadas = (
            archivos.filter(
                original_archivo__iregex=extensiones_media,  # 👈 Se cambió 'archivo' por 'original_archivo'
                likes__gt=0
            )
            .order_by('-likes', '-fecha_subida')[:3]
        )

    likes_sesion = request.session.get('likes_fotos', [])
    # Calcular el almacenamiento usado actualmente en MB
    bytes_ocupados = sum(foto.peso_bytes for foto in archivos)
    espacio_usado_mb = bytes_ocupados / (1024 * 1024)
    likes_sesion = request.session.get('likes_fotos', [])
    
    return render(request, 'galerias/galeria_invitado.html', {
        'evento': evento,
        'archivos': archivos,
        'mis_fotos_ids': mis_fotos_ids,
        'espacio_usado_mb': round(espacio_usado_mb, 2),
        'url_marco': evento.url_marco_activo,
        'likes_sesion': likes_sesion,
        'fotos_destacadas': fotos_destacadas 
    })


@require_POST  # 👈 Rechaza peticiones GET enviando un error claro
@ratelimit(key='ip', rate='30/m', block=False)
def subir_foto_ajax(request, evento_id):
    """Procesa la subida de fotos y videos vía AJAX con validación de espacio"""
    was_limited = getattr(request, 'limited', False)
    if was_limited:
        return JsonResponse({
            'success': False, 
            'error': 'Has alcanzado el límite máximo de subidas por minuto.'
        }, status=429)

    evento = get_object_or_404(Evento, id=evento_id)
    archivo = request.FILES.get('foto')

    if not archivo:
        return JsonResponse({'success': False, 'error': 'No se recibió ningún archivo.'}, status=400)

    # --- VALIDACIONES DE ALMACENAMIENTO Y TAMAÑO ---
    peso_archivo_mb = archivo.size / (1024 * 1024)

    # 1. Límite máximo por archivo (1 GB)
    if peso_archivo_mb > 1024:
        return JsonResponse({
            'success': False, 
            'error': 'El archivo supera el límite máximo permitido por archivo (1 GB).'
        }, status=400)

    # 2. Calcular almacenamiento ocupado de forma segura sin romper la vista
    archivos_existentes = evento.fotos.all()
    bytes_ocupados = sum(f.peso_bytes for f in archivos_existentes)

    mb_ocupados = bytes_ocupados / (1024 * 1024)
    limite_plan_mb = evento.plan_almacenamiento
    espacio_libre_mb = limite_plan_mb - mb_ocupados

    # 3. Validar si cabe el archivo
    if peso_archivo_mb > espacio_libre_mb:
        espacio_mostrar = max(0, espacio_libre_mb)
        return JsonResponse({
            'success': False, 
            'error': f'Almacenamiento no disponible. Quedan {espacio_mostrar:.1f} MB libres en el plan.'
        }, status=400)

    # Guardar en base de datos y Google Cloud Storage (mensaje solo si el plan lo permite)
    mensaje_texto = request.POST.get('mensaje', '').strip() if evento.permite_interaccion else ''

    try:
        es_video = archivo.content_type.startswith('video/')
        tipo_media = 'VIDEO' if es_video else 'IMAGEN'

        # Generar nombre seguro para el archivo
        nombre_original = archivo.name
        extension = os.path.splitext(nombre_original)[1].lower()
        nombre_seguro = generar_nombre_seguro(nombre_original, extension)

        foto = FotoInvitado(
            evento=evento,
            mensaje=mensaje_texto or None,
            tipo=tipo_media,
            peso_bytes=archivo.size,
            estado_procesamiento='PROCESANDO' if es_video else 'COMPLETADO'
        )

        # Guardar con nombre seguro
        foto.original_archivo.save(nombre_seguro, archivo, save=False)
        
        if not es_video:
            # Procesar imagen sincrónicamente (es rápido)
            resultados = procesar_imagen_pil(archivo)

            # Generar nombres seguros para preview y thumb
            nombre_preview = generar_nombre_seguro(nombre_original, '.jpg')
            nombre_thumb = generar_nombre_seguro(nombre_original, '.jpg')

            foto.ancho = resultados['ancho']
            foto.alto = resultados['alto']
            foto.preview_archivo.save(nombre_preview, resultados['preview'], save=False)
            foto.thumb_archivo.save(nombre_thumb, resultados['thumb'], save=False)
            
        foto.save()
        
        if es_video:
            # Enviar a background worker
            async_task('galerias.tasks.procesar_video_async', foto.id)
            
    except Exception as e:
        return JsonResponse({
            'success': False, 
            'error': f'Error al procesar y guardar: {str(e)}'
        }, status=500)

    mis_fotos = request.session.get('mis_fotos_ids', [])
    if not isinstance(mis_fotos, list):
        mis_fotos = []
    
    mis_fotos.append(foto.id)
    request.session['mis_fotos_ids'] = mis_fotos
    request.session.modified = True

    return JsonResponse({
        'success': True,
        'id': foto.id,
        'archivo_url': str(foto.original_archivo.url) if foto.original_archivo else '',
        'thumb_url': str(foto.thumb_archivo.url) if foto.thumb_archivo else '',
        'preview_url': str(foto.preview_archivo.url) if foto.preview_archivo else '',
        'es_video': foto.es_video(),
        'mensaje': foto.mensaje or '',
        'estado': foto.estado_procesamiento
    })


@require_POST
def eliminar_foto_ajax(request, foto_id):
    """Elimina el archivo (foto o video)"""

    try:
        foto = FotoInvitado.objects.get(id=foto_id)
    except FotoInvitado.DoesNotExist:
        return JsonResponse({'error': 'El archivo no existe'}, status=404)

    # Verificar si es dueño a través del PIN enviado en JSON
    es_dueno = False
    if request.content_type == 'application/json':
        import json
        try:
            data = json.loads(request.body)
            if data.get('pin') == foto.evento.pin_dueno:
                es_dueno = True
        except:
            pass

    mis_fotos_ids = request.session.get('mis_fotos_ids', [])

    if foto_id not in mis_fotos_ids and not es_dueno:
        return JsonResponse({'error': 'No tienes permiso para eliminar esta foto'}, status=403)

    if foto.original_archivo:
        foto.original_archivo.delete(save=False)
    if foto.preview_archivo:
        foto.preview_archivo.delete(save=False)
    if foto.thumb_archivo:
        foto.thumb_archivo.delete(save=False)
        
    foto.delete()
    
    if foto_id in mis_fotos_ids:
        mis_fotos_ids.remove(foto_id)
        request.session['mis_fotos_ids'] = mis_fotos_ids
        request.session.modified = True

    return JsonResponse({'success': True})


def dar_like_ajax(request, foto_id):
    """Permite 1 like por invitado por foto usando la sesión del navegador."""
    foto = get_object_or_404(FotoInvitado, id=foto_id)
    if not foto.evento.permite_interaccion:
        return JsonResponse({'error': 'Interacción no disponible en este plan.'}, status=403)

    # 1. Recuperar la lista de IDs de fotos con me gusta de la sesión del visitante
    likes_sesion = request.session.get('likes_fotos', [])

    # 2. Alternar me gusta (Toggle)
    if foto_id in likes_sesion:
        # Si ya le dio me gusta, se lo quitamos
        likes_sesion.remove(foto_id)
        foto.likes = max(0, foto.likes - 1)
        dio_like = False
    else:
        # Si no le ha dado me gusta, se lo sumamos
        likes_sesion.append(foto_id)
        foto.likes += 1
        dio_like = True

    # 3. Guardar cambios en el modelo y actualizar la sesión
    foto.save(update_fields=['likes'])
    request.session['likes_fotos'] = likes_sesion
    request.session.modified = True

    return JsonResponse({
        'success': True,
        'likes': foto.likes,
        'dio_like': dio_like
    })


def galeria_dueno(request, evento_id):
    """Panel para el cliente/dueño del evento (modo lectura con métricas y destacados)"""
    evento = get_object_or_404(Evento, id=evento_id)
    archivos = evento.fotos.all().order_by('-fecha_subida')

    total_archivos = archivos.count()
    
    # Evaluación de videos y fotos
    total_videos = sum(
        1 for a in archivos 
        if (a.es_video() if callable(getattr(a, 'es_video', None)) else getattr(a, 'es_video', False))
    )
    total_fotos = total_archivos - total_videos

    # --- FOTOS DESTACADAS (Top 3 con más likes) ---
    fotos_destacadas = []
    if evento.permite_interaccion:
        fotos_destacadas = archivos.filter(likes__gt=0).order_by('-likes', '-fecha_subida')[:3]

    # --- GENERAR CÓDIGO QR ---
    url_invitados = request.build_absolute_uri(f"/evento/{evento.id}/")
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=2,
    )
    qr.add_data(url_invitados)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color=(37, 99, 235), back_color=(224, 229, 236))
    
    buffer = io.BytesIO()
    img.save(buffer, "PNG")
    buffer.seek(0)
    qr_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

    context = {
        'evento': evento,
        'archivos': archivos,
        'fotos_destacadas': fotos_destacadas,
        'total_archivos': total_archivos,
        'total_fotos': total_fotos,
        'total_videos': total_videos,
        'qr_base64': qr_base64,
        'url_marco': getattr(evento, 'url_marco_activo', None),
    }
    return render(request, 'galerias/galeria_dueno.html', context)


def descargar_todas_las_fotos_zip(request, evento_id):
    """Descarga masiva de todos los archivos en ZIP con límite de intentos"""
    evento = get_object_or_404(Evento, id=evento_id)

    # Verificar límite de descargas
    if evento.descargas_zip_restantes <= 0:
        return JsonResponse({
            'success': False,
            'error': 'Has alcanzado el límite máximo de descargas completas permitidas.'
        }, status=403)

    archivos = evento.fotos.all()

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for idx, item in enumerate(archivos, start=1):
            if not item.original_archivo:
                continue

            try:
                # FIX SSRF: Abrir el archivo directamente usando el Storage de Django
                # en lugar de hacer una petición HTTP con requests.get()
                with item.original_archivo.open('rb') as f:
                    nombre_original = os.path.basename(item.original_archivo.name)
                    nombre_en_zip = f"{idx}_{nombre_original}"
                    
                    # f.read() carga el contenido, equivalente a response.content
                    zip_file.writestr(nombre_en_zip, f.read())
            except Exception as e:
                print(f"Error al descargar {item.original_archivo.name}: {e}")

    # Restar una descarga y guardar
    evento.descargas_zip_restantes -= 1
    evento.save()

    buffer.seek(0)
    response = HttpResponse(buffer, content_type='application/zip')
    nombre_zip = f"galeria_{evento.nombre_evento.replace(' ', '_')}_id{evento.id}.zip"
    response['Content-Disposition'] = f'attachment; filename="{nombre_zip}"'
    return response


@ratelimit(key='ip', rate='30/m', block=True)
def descargar_archivo_proxy(request, archivo_id):
    """
    Vista segura para descargar archivos individuales con:
    - Validación por sesión o PIN
    - Rate limiting por IP
    - URL firmada de GCP (60 segundos)
    - Redirección optimizada
    """
    item = get_object_or_404(FotoInvitado, pk=archivo_id)
    evento = item.evento

    # 1. Validación de acceso - solo sesión o PIN
    tiene_acceso = False

    # Verificar acceso por sesión
    session_key = f'acceso_evento_{evento.id}'
    if request.session.get(session_key):
        tiene_acceso = True

    # Verificar si es dueño a través del PIN (en GET parameters)
    pin_param = request.GET.get('pin')
    if pin_param and pin_param == evento.pin_dueno:
        tiene_acceso = True
        request.session[session_key] = True

    if not tiene_acceso:
        return JsonResponse({
            'success': False,
            'error': 'No tienes acceso autorizado a este evento.'
        }, status=403)

    # 2. Verificar que el archivo existe
    if not item.original_archivo:
        raise Http404("El archivo no existe en el almacenamiento.")

    try:
        # 3. Generar URL firmada de Google Cloud Storage usando credenciales existentes
        from google.cloud import storage
        from django.conf import settings

        # Usar las credenciales ya configuradas en settings.py
        credentials = getattr(settings, 'GS_CREDENTIALS', None)
        client = storage.Client(credentials=credentials)
        bucket = client.bucket('photosdomviewer')

        # Obtener el nombre del blob desde la URL del archivo
        blob_name = item.original_archivo.name
        blob = bucket.blob(blob_name)

        # Generar URL firmada v4 con expiración de 60 segundos
        expiration = timedelta(seconds=60)

        # Nombre seguro para descarga
        nombre_seguro = f"photo_dom_{item.id}.jpg"
        if item.es_video():
            nombre_seguro = f"photo_dom_{item.id}.mp4"

        url_firmada = blob.generate_signed_url(
            version='v4',
            expiration=expiration,
            method='GET',
            response_disposition=f'attachment; filename="{nombre_seguro}"'
        )

        # 4. Redirección optimizada a la URL firmada
        return redirect(url_firmada)

    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Error al generar URL de descarga: {str(e)}'
        }, status=500)


def obtener_contexto_index(form, mostrar_formulario=False):
    """Genera el contexto para la landing page index con marcos y temas mapeados"""
    marcos_lista, marcos_dict = obtener_catalogo_marcos_preview()
    temas_dict = obtener_paletas_preview()

    return {
        'form': form,
        'mostrar_formulario': mostrar_formulario,
        'marcos_lista': marcos_lista,
        'marcos_preview_json': json.dumps(marcos_dict),
        'temas_lista': list(temas_dict.values()),
        'temas_preview_json': json.dumps(temas_dict),
    }


def home(request):
    """Página de inicio / Landing Page principal del sitio"""
    form = SolicitudEventoForm()
    return render(request, 'galerias/index.html', obtener_contexto_index(form))


def crear_solicitud_evento(request):
    """Vista para crear una solicitud de evento desde el formulario público"""
    if request.method == 'POST':
        form = SolicitudEventoForm(request.POST, request.FILES)
        if form.is_valid():
            # Procesar la fecha del formulario que viene en formato local
            from django.utils import timezone
            from datetime import datetime, timedelta

            fecha_hora_inicio = form.cleaned_data.get('fecha_hora_inicio')
            if fecha_hora_inicio:
                # El datetime-local del navegador no tiene timezone info,
                # asumimos que está en la zona horaria de Mexico City (UTC-6)
                # y convertimos a UTC para almacenamiento consistente
                from zoneinfo import ZoneInfo
                mexico_tz = ZoneInfo('America/Mexico_City')

                if fecha_hora_inicio.tzinfo is None:
                    # Si no tiene timezone, asumimos Mexico City
                    fecha_hora_inicio = fecha_hora_inicio.replace(tzinfo=mexico_tz)

                # Convertir a UTC para almacenamiento
                fecha_hora_inicio_utc = fecha_hora_inicio.astimezone(dt_timezone.utc)
                form.instance.fecha_hora_inicio = fecha_hora_inicio_utc

            # Eliminar campos extra del formulario (checkboxes legales no guardados en BD)
            if 'aceptar_terminos' in form.cleaned_data:
                del form.cleaned_data['aceptar_terminos']
            if 'aceptar_privacidad' in form.cleaned_data:
                del form.cleaned_data['aceptar_privacidad']
            if 'aceptar_cookies' in form.cleaned_data:
                del form.cleaned_data['aceptar_cookies']

            solicitud = form.save()
            return render(request, 'galerias/solicitud_confirmada.html', {
                'solicitud': solicitud
            })
    else:
        form = SolicitudEventoForm()

    return render(request, 'galerias/index.html', obtener_contexto_index(form, mostrar_formulario=True))


def custom_404(request, exception):
    """Página 404 personalizada"""
    return render(request, 'galerias/404.html', status=404)


def terminos_condiciones(request):
    """Página de Términos y Condiciones"""
    return render(request, 'galerias/terminos_condiciones.html')


def aviso_privacidad(request):
    """Página de Aviso de Privacidad"""
    return render(request, 'galerias/aviso_privacidad.html')


def politica_cookies(request):
    """Página de Política de Cookies"""
    return render(request, 'galerias/politica_cookies.html')


def modo_proyector(request, evento_id):
    """Vista del modo proyector solo para planes Premium"""
    evento = get_object_or_404(Evento, id=evento_id, activo=True)
    if not evento.es_plan_premium:
        return redirect('galeria_invitado', evento_id=evento.id)

    archivos = evento.fotos.all().order_by('-fecha_subida')

    # Generar código QR que apunta a la URL de invitados
    url_invitados = request.build_absolute_uri(f"/evento/{evento.id}/")
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=2,
    )
    qr.add_data(url_invitados)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color=(255, 255, 255), back_color=(0, 0, 0))
    
    buffer = io.BytesIO()
    img.save(buffer, "PNG")
    buffer.seek(0)
    qr_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

    return render(request, 'galerias/proyector.html', {
        'evento': evento,
        'archivos': archivos,
        'qr_base64': qr_base64,
        'url_marco': evento.url_marco_activo,
        'usar_proxy': True,  # Indicador para usar URLs del proxy
    })


def api_archivos_proyector(request, evento_id):
    """API ligera para polling de archivos nuevos en modo proyector"""
    evento = get_object_or_404(Evento, id=evento_id, activo=True)
    
    # Obtener el último ID procesado del parámetro de consulta
    ultimo_id = request.GET.get('ultimoid', 0)
    
    try:
        ultimo_id = int(ultimo_id)
    except (ValueError, TypeError):
        ultimo_id = 0
    
    # Para lidiar con videos asincronos que pueden completarse tarde, 
    # buscamos archivos completados con ID > ultimo_id - 50 (margen de seguridad)
    margen_id = max(0, ultimo_id - 50)
    
    archivos_nuevos = evento.fotos.filter(
        id__gt=margen_id, 
        estado_procesamiento='COMPLETADO'
    ).order_by('-fecha_subida')
    
    # Construir respuesta JSON con URLs de previews y thumbs (blindaje de transferencia)
    archivos_data = []
    for archivo in archivos_nuevos:
        archivos_data.append({
            'id': archivo.id,
            'preview_url': request.build_absolute_uri(archivo.preview_archivo.url) if archivo.preview_archivo else '',
            'thumb_url': request.build_absolute_uri(archivo.thumb_archivo.url) if archivo.thumb_archivo else '',
            'es_video': archivo.es_video(),
            'mensaje': archivo.mensaje or '',
            'likes': archivo.likes,
            'estado': archivo.estado_procesamiento
        })
    
    return JsonResponse({
        'archivos': archivos_data
    })


def api_estado_archivos(request, evento_id):
    """Devuelve el estado actual de los archivos solicitados por ID (útil para actualizar spinners de carga en frontend)"""
    ids_param = request.GET.get('ids', '')
    if not ids_param:
        return JsonResponse({'archivos': []})
    
    try:
        ids_list = [int(i) for i in ids_param.split(',') if i.strip().isdigit()]
    except Exception:
        ids_list = []
        
    archivos = FotoInvitado.objects.filter(evento_id=evento_id, id__in=ids_list)
    
    data = []
    for archivo in archivos:
        data.append({
            'id': archivo.id,
            'estado': archivo.estado_procesamiento,
            'thumb_url': request.build_absolute_uri(archivo.thumb_archivo.url) if archivo.thumb_archivo else '',
            'preview_url': request.build_absolute_uri(archivo.preview_archivo.url) if archivo.preview_archivo else '',
            'es_video': archivo.es_video()
        })

    return JsonResponse({'archivos': data})


def api_estado_descargas(request, evento_id):
    """API asíncrona para verificar el estado de descargas ZIP restantes"""
    evento = get_object_or_404(Evento, id=evento_id)
    return JsonResponse({
        'descargas_restantes': evento.descargas_zip_restantes,
        'limite_alcanzado': evento.descargas_zip_restantes <= 0
    })