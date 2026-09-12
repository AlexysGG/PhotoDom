from django.urls import path
from . import views

urlpatterns = [
    # Ruta del QR para invitados
    path('evento/<uuid:evento_id>/', views.galeria_invitado, name='galeria_invitado'),

    # Endpoint backend para recibir la subida de la imagen
    path('evento/<uuid:evento_id>/subir/', views.subir_foto_ajax, name='subir_foto_ajax'),
    # Nueva ruta para eliminar
    path(
        'foto/<int:foto_id>/eliminar/',
        views.eliminar_foto_ajax,
        name='eliminar_foto_ajax',
    ),
    path('foto/<int:foto_id>/like/', views.dar_like_ajax, name='dar_like_ajax'),
    path('api/fotos/<int:foto_id>/like/', views.dar_like_ajax, name='api_dar_like_ajax'),
    path('', views.home, name='home'),
    path('evento/<uuid:evento_id>/proyector/', views.modo_proyector, name='modo_proyector'),
    path('descargar/<int:archivo_id>/', views.descargar_archivo_proxy, name='descargar_archivo'),
    path('ver/<int:archivo_id>/', views.descargar_archivo_proxy, name='ver_archivo'),

    path('evento/<uuid:evento_id>/panel/', views.galeria_dueno, name='galeria_dueno'),
    path('evento/<uuid:evento_id>/descargar-zip/', views.descargar_todas_las_fotos_zip, name='descargar_todas_zip'),

    # API para modo proyector
    path('api/evento/<uuid:evento_id>/archivos-recientes/', views.api_archivos_proyector, name='api_archivos_proyector'),
    path('api/evento/<uuid:evento_id>/estado-archivos/', views.api_estado_archivos, name='api_estado_archivos'),
    path('api/evento/<uuid:evento_id>/estado-descargas/', views.api_estado_descargas, name='api_estado_descargas'),

    # Solicitud de evento
    path('solicitar-evento/', views.crear_solicitud_evento, name='crear_solicitud_evento'),
]
