from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from .models import Evento, FotoInvitado
from unfold.admin import ModelAdmin


def obtener_vista_previa_html(obj):
    if not obj.archivo:
        return "Sin archivo"

    url = obj.archivo.url.lower()

    extensiones_video = ('.mp4', '.mov', '.avi', '.webm', '.mkv', '.m4v')
    es_video_prop = getattr(obj, 'es_video', False)
    
    if callable(es_video_prop):
        es_video_prop = es_video_prop()

    es_video = es_video_prop or url.endswith(extensiones_video)

    if es_video:
        return format_html(
            '<video src="{}#t=0.5" style="width: 100px; height: 60px; object-fit: cover; border-radius: 6px;" preload="metadata"></video>',
            obj.archivo.url
        )

    return format_html(
        '<a href="{}" target="_blank"><img src="{}" style="width: 100px; height: 60px; object-fit: cover; border-radius: 6px;" /></a>',
        obj.archivo.url,
        obj.archivo.url
    )


class FotoInvitadoInline(admin.TabularInline):
    model = FotoInvitado
    extra = 0
    readonly_fields = ('vista_previa', 'likes', 'destacada', 'mensaje', 'fecha_subida')
    fields = ('vista_previa', 'archivo', 'likes', 'destacada', 'mensaje', 'fecha_subida')
    can_delete = True

    @admin.display(description='Vista Previa')
    def vista_previa(self, obj):
        return obtener_vista_previa_html(obj)


@admin.register(Evento)
class EventoAdmin(ModelAdmin):
    list_display = (
        'id',
        'nombre_evento',
        'nombre_cliente',
        'plan_almacenamiento',
        'plantilla_html',
        'dias_vigencia',
        'activo',
        'pin_dueno',
        'ver_panel_dueno',
        'ver_panel_invitado',
    )
    list_filter = ('plan_almacenamiento', 'plantilla_html', 'activo', 'tema_color')
    search_fields = ('id', 'nombre_evento', 'nombre_cliente')
    readonly_fields = ('id', 'fecha_creacion', 'ver_panel_dueno', 'ver_panel_invitado')

    fieldsets = (
        ('Información del Evento', {
            'fields': ('nombre_evento', 'nombre_cliente', 'activo', 'dias_vigencia')
        }),
        ('Seguridad y Acceso', {
            'fields': ('pin_dueno',),
            'description': 'PIN numérico de 4 dígitos para que el cliente ingrese a su panel privado.'
        }),
        ('Configuración, Plantilla y Apariencia', {
            'fields': ('plan_almacenamiento', 'plantilla_html', 'tema_color', 'fondo_personalizado')
        }),
        ('Personalización Premium (Modal de Bienvenida)', {
            'fields': ('mensaje_bienvenida',),
            'description': 'Mensaje emergente que se muestra al abrir la galería (Solo activo en Plan Premium).'
        }),
        ('Enlaces y Metadatos', {
            'fields': ('id', 'fecha_creacion', 'ver_panel_dueno', 'ver_panel_invitado'),
            'classes': ('collapse',),
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


@admin.register(FotoInvitado)
class FotoInvitadoAdmin(ModelAdmin):
    list_display = ('id', 'vista_previa', 'evento', 'likes', 'destacada', 'mensaje', 'fecha_subida')
    list_filter = ('destacada', 'evento', 'fecha_subida')
    search_fields = ('evento__id', 'evento__nombre_evento', 'evento__nombre_cliente', 'mensaje')
    ordering = ('-fecha_subida',)

    @admin.display(description='Vista Previa')
    def vista_previa(self, obj):
        return obtener_vista_previa_html(obj)