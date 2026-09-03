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
    path('', views.home, name='home'),

    path('descargar/<int:archivo_id>/', views.descargar_archivo_proxy, name='descargar_archivo'),

    path('evento/<uuid:evento_id>/panel/', views.galeria_dueno, name='galeria_dueno'),
    path('evento/<uuid:evento_id>/descargar-zip/', views.descargar_todas_las_fotos_zip, name='descargar_todas_zip'),
]
