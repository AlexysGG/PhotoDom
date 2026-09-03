import os
import io
import base64
import qrcode
import zipfile
import requests
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse, HttpResponse, Http404
from django.urls import reverse
from django.views.decorators.http import require_POST
from django_ratelimit.decorators import ratelimit
from .models import Evento, FotoInvitado


def galeria_invitado(request, evento_id):
    """Muestra la galería interactiva al invitado"""
    evento = get_object_or_404(Evento, id=evento_id)
    
    if evento.esta_expirado() or not evento.activo:
        return render(request, 'galerias/expirado.html', {'evento': evento})
    
    archivos = evento.fotos.all().order_by('-fecha_subida')

    mis_fotos_ids = request.session.get('mis_fotos_ids', [])
    
    # Calcular el almacenamiento usado actualmente en MB
    bytes_ocupados = sum(foto.archivo.size for foto in archivos if foto.archivo)
    espacio_usado_mb = bytes_ocupados / (1024 * 1024)
    
    return render(request, 'galerias/galeria_invitado.html', {
        'evento': evento,
        'archivos': archivos,
        'mis_fotos_ids': mis_fotos_ids,
        'espacio_usado_mb': round(espacio_usado_mb, 2)
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
    bytes_ocupados = 0
    archivos_existentes = evento.fotos.all()
    for f in archivos_existentes:
        if f.archivo:
            try:
                bytes_ocupados += f.archivo.size
            except Exception:
                continue # Si un archivo remoto no responde, salta sin dar 500

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

    # Guardar en base de datos y Google Cloud Storage
    try:
        foto = FotoInvitado.objects.create(
            evento=evento,
            archivo=archivo
        )
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Error al guardar en el almacenamiento: {str(e)}'
        }, status=500)

    mis_fotos = request.session.get('mis_fotos_ids', [])
    if not isinstance(mis_fotos, list):
        mis_fotos = []
    
    mis_fotos.append(foto.id)
    request.session['mis_fotos_ids'] = mis_fotos
    request.session.modified = True

    es_vid = foto.es_video() if callable(getattr(foto, 'es_video', None)) else getattr(foto, 'es_video', False)

    return JsonResponse({
        'success': True,
        'id': foto.id,
        'archivo_url': str(foto.archivo.url),
        'es_video': bool(es_vid)
    })


@require_POST
def eliminar_foto_ajax(request, foto_id):
    """Elimina el archivo (foto o video)"""

    mis_fotos_ids = request.session.get('mis_fotos_ids', [])

    if foto_id not in mis_fotos_ids:
        return JsonResponse({'error': 'No tienes permiso para eliminar esta foto'}, status=403)

    try:
        archivo = FotoInvitado.objects.get(id=foto_id)
        archivo.archivo.delete(save=False)
        archivo.delete()
        mis_fotos_ids.remove(foto_id)
        request.session['mis_fotos_ids'] = mis_fotos_ids
        request.session.modified = True

        return JsonResponse({'success': True})
    except FotoInvitado.DoesNotExist:
        return JsonResponse({'error': 'El archivo no existe'}, status=404)


def galeria_dueno(request, evento_id):
    """Panel para el cliente/dueño del evento"""
    evento = get_object_or_404(Evento, id=evento_id)
    archivos = evento.fotos.all().order_by('-fecha_subida')

    total_archivos = archivos.count()
    
    # Evaluación segura de es_video
    total_videos = 0
    for a in archivos:
        is_vid = a.es_video() if callable(getattr(a, 'es_video', None)) else getattr(a, 'es_video', False)
        if is_vid:
            total_videos += 1
            
    total_fotos = total_archivos - total_videos

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
        'total_archivos': total_archivos,
        'total_fotos': total_fotos,
        'total_videos': total_videos,
        'qr_base64': qr_base64,
    }
    return render(request, 'galerias/galeria_dueno.html', context)


def descargar_todas_las_fotos_zip(request, evento_id):
    """Descarga masiva de todos los archivos en ZIP"""
    evento = get_object_or_404(Evento, id=evento_id)
    archivos = evento.fotos.all()

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for idx, item in enumerate(archivos, start=1):
            if not item.archivo:
                continue
            
            try:
                response = requests.get(item.archivo.url, stream=True)
                if response.status_code == 200:
                    nombre_original = os.path.basename(item.archivo.name)
                    nombre_en_zip = f"{idx}_{nombre_original}"
                    zip_file.writestr(nombre_en_zip, response.content)
            except Exception as e:
                print(f"Error al descargar {item.archivo.name}: {e}")

    buffer.seek(0)
    response = HttpResponse(buffer, content_type='application/zip')
    nombre_zip = f"galeria_{evento.nombre_evento.replace(' ', '_')}_id{evento.id}.zip"
    response['Content-Disposition'] = f'attachment; filename="{nombre_zip}"'
    return response


def descargar_archivo_proxy(request, archivo_id):
    try:
        item = Evento.objects.get(pk=archivo_id)
        # Obtenemos el archivo desde Google Storage
        response = requests.get(item.archivo.url, stream=True)
        
        # Nombre del archivo para guardar
        nombre_original = item.archivo.name.split('/')[-1]
        
        # Respuesta forzando la descarga directa
        res = HttpResponse(response.content, content_type=response.headers.get('Content-Type'))
        res['Content-Disposition'] = f'attachment; filename="{nombre_original}"'
        return res
    except Evento.DoesNotExist:
        raise Http404("El archivo no existe")