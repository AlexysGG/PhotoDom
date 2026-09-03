from django.contrib import admin
from django.utils.html import format_html
from django.shortcuts import render, get_object_or_404
from django.urls import reverse
from .models import Evento, FotoInvitado
from unfold.admin import ModelAdmin


def obtener_vista_previa_html(obj):
    if not obj.archivo:
        return "Sin archivo"

    url = obj.archivo.url.lower()

    # Detección precisa de si es video por extensión o mime type
    extensiones_video = ('.mp4', '.mov', '.avi', '.webm', '.mkv', '.m4v')
    es_video_prop = getattr(obj, 'es_video', False)
    
    # Si la propiedad es un método ejecutable, lo llamamos
    if callable(es_video_prop):
        es_video_prop = es_video_prop()

    es_video = es_video_prop or url.endswith(extensiones_video)

    if es_video:
        # Usamos #t=0.5 para que cargue el primer fotograma como portada sin mostrar controles gigantes
        return format_html(
            '<video src="{}#t=0.5" style="width: 100px; height: 60px; object-fit: cover; border-radius: 6px;" preload="metadata"></video>',
            obj.archivo.url
        )

    # Si es imagen
    return format_html(
        '<a href="{}" target="_blank"><img src="{}" style="width: 100px; height: 60px; object-fit: cover; border-radius: 6px;" /></a>',
        obj.archivo.url,
        obj.archivo.url
    )

# 1. Inline para mostrar archivos dentro del Evento
class FotoInvitadoInline(admin.TabularInline):
    model = FotoInvitado
    extra = 0
    readonly_fields = ('vista_previa', 'fecha_subida')
    fields = ('vista_previa', 'archivo', 'fecha_subida')
    can_delete = True

    @admin.display(description='Vista Previa')
    def vista_previa(self, obj):
        return obtener_vista_previa_html(obj)


# 2. EventoAdmin con InLine y fieldsets para Unfold
@admin.register(Evento)
class EventoAdmin(ModelAdmin):
    list_display = (
        'id',
        'nombre_evento',
        'nombre_cliente',
        'plan_almacenamiento',
        'activo',
        'pin_dueno',  # <- Mantenemos el PIN en la tabla principal
        'fecha_creacion',
        'tema_color',
        'ver_panel_dueno',
        'ver_panel_invitado',
    )
    list_filter = ('plan_almacenamiento', 'activo', 'tema_color')
    search_fields = ('id', 'nombre_evento', 'nombre_cliente')
    readonly_fields = ('id', 'fecha_creacion', 'ver_panel_dueno', 'ver_panel_invitado')

    # Agrupación visual limpia para la vista de edición en Unfold
    fieldsets = (
        ('Información del Evento', {
            'fields': ('nombre_evento', 'nombre_cliente', 'activo')
        }),
        ('Seguridad y Acceso', {
            'fields': ('pin_dueno',),
            'description': 'PIN numérico de 4 dígitos para que el cliente ingrese a su panel privado.'
        }),
        ('Configuración y Apariencia', {
            'fields': ('plan_almacenamiento', 'tema_color')
        }),
        ('Enlaces y Metadatos', {
            'fields': ('id', 'fecha_creacion', 'ver_panel_dueno', 'ver_panel_invitado'),
            'classes': ('collapse',), # Colapsable para no estorbar
        }),
    )

    @admin.display(description='Panel Dueño')
    def ver_panel_dueno(self, obj):
        if not obj or not obj.pk:
            return "-"

        url = reverse('galeria_dueno', args=[obj.id])
        return format_html(
            '<a href="{}" target="_blank" class="inline-flex items-center gap-1 bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold text-xs px-3 py-1.5 rounded-md transition-colors">'
            'Panel Dueño'
            '</a>',
            url
        )

    @admin.display(description='Panel Invitado')
    def ver_panel_invitado(self, obj):
        if not obj or not obj.pk:
            return "-"

        url = reverse('galeria_invitado', args=[obj.id])
        return format_html(
            '<a href="{}" target="_blank" class="inline-flex items-center gap-1 bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold text-xs px-3 py-1.5 rounded-md transition-colors">'
            'Panel Invitado'
            '</a>',
            url
        )

    inlines = [FotoInvitadoInline]


# 3. Vista general de FotoInvitado (list_filter corregido)
@admin.register(FotoInvitado)
class FotoInvitadoAdmin(ModelAdmin):
    list_display = ('id', 'vista_previa', 'evento', 'fecha_subida')
    list_filter = ('evento', 'fecha_subida')
    search_fields = ('evento__id', 'evento__nombre_evento', 'evento__nombre_cliente')
    ordering = ('-fecha_subida',)

    @admin.display(description='Vista Previa')
    def vista_previa(self, obj):
        return obtener_vista_previa_html(obj)