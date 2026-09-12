from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.shortcuts import get_object_or_404
from .models import Evento, FotoInvitado, Marco, SolicitudEvento
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
        'fecha_hora_inicio',
        'duracion_total_horas',
        'dias_vigencia',
        'activo',
        'pin_dueno',
        'descargas_zip_restantes',
        'ver_panel_dueno',
        'ver_panel_invitado',
    )
    list_filter = ('plan_almacenamiento', 'plantilla_html', 'activo', 'tema_color', 'marco_seleccionado', 'fecha_hora_inicio')
    search_fields = ('id', 'nombre_evento', 'nombre_cliente')
    readonly_fields = ('id', 'fecha_creacion', 'ver_panel_dueno', 'ver_panel_invitado', 'duracion_total_horas')

    fieldsets = (
        ('Información del Evento', {
            'fields': ('nombre_evento', 'nombre_cliente', 'activo', 'dias_vigencia')
        }),
        ('Control de Tiempo y Cotización', {
            'fields': ('fecha_hora_inicio', 'horas_extra', 'duracion_total_horas'),
            'description': 'Configuración de ventana de tiempo del evento y horas extra contratadas.'
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
        ('Límites y Descargas', {
            'fields': ('descargas_zip_restantes',),
            'description': 'Control de descargas ZIP para el dueño del evento.'
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


@admin.register(SolicitudEvento)
class SolicitudEventoAdmin(ModelAdmin):
    list_display = (
        'id',
        'nombre_evento',
        'nombre_solicitante',
        'telefono',
        'email',
        'plan_almacenamiento',
        'fecha_hora_inicio',
        'horas_extra',
        'estado',
        'fecha_creacion',
        'ver_evento_creado',
        'accion_crear_evento',
    )
    list_filter = ('estado', 'plan_almacenamiento', 'fecha_creacion', 'fecha_hora_inicio')
    search_fields = ('nombre_evento', 'nombre_solicitante', 'email', 'telefono')
    readonly_fields = ('fecha_creacion', 'ver_evento_creado', 'accion_crear_evento_detalle')
    actions = ['crear_evento_desde_solicitud']

    fieldsets = (
        ('Información del Solicitante', {
            'fields': ('nombre_solicitante', 'telefono', 'email')
        }),
        ('Información del Evento', {
            'fields': ('nombre_evento', 'nombre_cliente', 'plan_almacenamiento')
        }),
        ('Control de Tiempo y Cotización', {
            'fields': ('fecha_hora_inicio', 'horas_extra'),
            'description': 'Fecha de inicio y horas extra contratadas.'
        }),
        ('Configuración, Plantilla y Apariencia', {
            'fields': ('tema_color', 'marco_seleccionado', 'fondo_personalizado'),
            'description': 'Los marcos y fondos solo se aplicarán si el plan es Experiencia o Premium.'
        }),
        ('Personalización Premium', {
            'fields': ('mensaje_bienvenida',),
            'description': 'Mensaje emergente que se muestra al abrir la galería (Solo activo en Plan Premium).'
        }),
        ('Estado y Metadatos', {
            'fields': ('estado', 'notas_admin', 'fecha_creacion', 'ver_evento_creado', 'accion_crear_evento_detalle')
        }),
    )

    @admin.display(description='Evento Creado')
    def ver_evento_creado(self, obj):
        if not obj.evento_creado:
            return "No creado"

        url = reverse('galeria_dueno', args=[obj.evento_creado.id])
        return format_html(
            '<a href="{}" target="_blank" class="inline-flex items-center gap-1 bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold text-xs px-3 py-1.5 rounded-md transition-colors">'
            'Ver Evento'
            '</a>',
            url
        )

    @admin.display(description='Crear Evento')
    def accion_crear_evento(self, obj):
        if obj.evento_creado or obj.estado != 'pendiente':
            return '-'

        url = reverse('admin:galerias_solicitudevento_crear_evento', args=[obj.id])
        return format_html(
            '<a href="{}" class="button">Crear Evento</a>',
            url
        )

    @admin.display(description='Acción')
    def accion_crear_evento_detalle(self, obj):
        if obj.evento_creado or obj.estado != 'pendiente':
            return 'Evento ya creado o solicitud no pendiente'

        url = reverse('admin:galerias_solicitudevento_crear_evento', args=[obj.id])
        return format_html(
            '<a href="{}" class="button" style="background: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">'
            'Crear Evento desde esta Solicitud'
            '</a>',
            url
        )

    @admin.action(description='Crear evento desde solicitud seleccionada')
    def crear_evento_desde_solicitud(self, request, queryset):
        count = 0
        for solicitud in queryset:
            if solicitud.estado == 'pendiente' and not solicitud.evento_creado:
                try:
                    solicitud.crear_evento_desde_solicitud()
                    count += 1
                except Exception as e:
                    self.message_user(request, f'Error al crear evento para {solicitud.nombre_evento}: {str(e)}', level='error')

        if count > 0:
            self.message_user(request, f'{count} evento(s) creado(s) exitosamente.', level='success')
        else:
            self.message_user(request, 'No se crearon eventos. Solo se pueden crear eventos desde solicitudes pendientes sin evento creado.', level='warning')

    def get_urls(self):
        from django.urls import path
        urls = super().get_urls()
        custom_urls = [
            path('<path:object_id>/crear-evento/', self.admin_site.admin_view(self.crear_evento_view), name='galerias_solicitudevento_crear_evento'),
        ]
        return custom_urls + urls

    def crear_evento_view(self, request, object_id):
        from django.shortcuts import redirect
        from django.contrib import messages

        solicitud = get_object_or_404(SolicitudEvento, pk=object_id)

        if solicitud.evento_creado:
            messages.warning(request, 'Esta solicitud ya tiene un evento creado.')
            return redirect('admin:galerias_solicitudevento_change', object_id)

        if solicitud.estado != 'pendiente':
            messages.warning(request, 'Solo se pueden crear eventos desde solicitudes pendientes.')
            return redirect('admin:galerias_solicitudevento_change', object_id)

        try:
            evento = solicitud.crear_evento_desde_solicitud()
            messages.success(request, f'Evento "{evento.nombre_evento}" creado exitosamente. PIN: {evento.pin_dueno}')
            return redirect('admin:galerias_evento_change', str(evento.id))
        except Exception as e:
            messages.error(request, f'Error al crear evento: {str(e)}')
            return redirect('admin:galerias_solicitudevento_change', object_id)