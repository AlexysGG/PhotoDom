from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from .models import Evento, FotoInvitado, Marco
from unfold.admin import ModelAdmin


def obtener_vista_previa_html(obj):
    if not obj:
        return "Sin archivo"

    archivo = obj.thumb_archivo or obj.preview_archivo or obj.original_archivo
    if not archivo:
        return "Sin archivo"

    url_preview = obj.preview_archivo.url if obj.preview_archivo else (obj.original_archivo.url if obj.original_archivo else archivo.url)
    url_thumb = obj.thumb_archivo.url if obj.thumb_archivo else url_preview

    return format_html(
        '<a href="{}" target="_blank"><img src="{}" style="width: 100px; height: 60px; object-fit: cover; border-radius: 6px;" /></a>',
        url_preview,
        url_thumb
    )


@admin.register(Marco)
class MarcoAdmin(ModelAdmin):
    list_display = ('id', 'vista_previa', 'nombre', 'solo_premium', 'activo', 'fecha_creacion')
    list_filter = ('solo_premium', 'activo')
    search_fields = ('nombre',)
    ordering = ('nombre',)

    @admin.display(description='Vista Previa')
    def vista_previa(self, obj):
        if obj.imagen:
            return format_html(
                '<div style="background: #cbd5e1; display: inline-block; padding: 4px; border-radius: 6px;">'
                '<img src="{}" style="width: 60px; height: 60px; object-fit: contain;" />'
                '</div>',
                obj.imagen.url
            )
        return "Sin imagen"


class FotoInvitadoInline(admin.TabularInline):
    model = FotoInvitado
    extra = 0
    readonly_fields = ('vista_previa', 'likes', 'destacada', 'mensaje', 'fecha_subida', 'estado_procesamiento')
    fields = ('vista_previa', 'original_archivo', 'preview_archivo', 'thumb_archivo', 'tipo', 'estado_procesamiento', 'likes', 'destacada', 'mensaje', 'fecha_subida')
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
        'marco_seleccionado',
        'dias_vigencia',
        'activo',
        'pin_dueno',
        'ver_panel_dueno',
        'ver_panel_invitado',
    )
    list_filter = ('plan_almacenamiento', 'plantilla_html', 'activo', 'tema_color', 'marco_seleccionado')
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
            'fields': ('plan_almacenamiento', 'plantilla_html', 'tema_color', 'marco_seleccionado', 'fondo_personalizado'),
            'description': 'Los marcos solo se mostrarán si el evento está en Plan Experiencia o Premium.'
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
    list_display = ('id', 'vista_previa', 'evento', 'tipo', 'estado_procesamiento', 'likes', 'destacada', 'mensaje', 'fecha_subida')
    list_filter = ('tipo', 'estado_procesamiento', 'destacada', 'evento', 'fecha_subida')
    search_fields = ('evento__id', 'evento__nombre_evento', 'evento__nombre_cliente', 'mensaje')
    ordering = ('-fecha_subida',)

    @admin.display(description='Vista Previa')
    def vista_previa(self, obj):
        return obtener_vista_previa_html(obj)