import uuid
import os
import logging
from datetime import timedelta
from django.db import models
from django.utils import timezone
from django.core.validators import RegexValidator
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.conf import settings

logger = logging.getLogger(__name__)

def eliminar_carpeta_evento_gcs(evento_id):
    """
    Elimina físicamente todos los archivos y carpetas del evento en Google Cloud Storage.
    Elimina todos los blobs bajo el prefijo 'eventos/{evento_id}/'.
    """
    prefix = f'eventos/{evento_id}/'
    try:
        from google.cloud import storage
        credentials = getattr(settings, 'GS_CREDENTIALS', None)
        bucket_name = getattr(settings, 'GS_BUCKET_NAME', 'photosdomviewer')
        if credentials:
            client = storage.Client(credentials=credentials)
        else:
            client = storage.Client()
        bucket = client.bucket(bucket_name)
        blobs = list(bucket.list_blobs(prefix=prefix))
        if blobs:
            bucket.delete_blobs(blobs)
            logger.info(f"Se eliminaron {len(blobs)} archivos de GCS con prefijo {prefix}")
        else:
            logger.info(f"No se encontraron blobs en GCS con prefijo {prefix}")
    except Exception as e:
        logger.warning(f"No fue posible conectar con GCS para borrar prefijo {prefix}: {e}")

def get_original_path(instance, filename):
    return f'eventos/{instance.evento.id}/originals/{filename}'

def get_preview_path(instance, filename):
    return f'eventos/{instance.evento.id}/previews/{filename}'

def get_thumb_path(instance, filename):
    return f'eventos/{instance.evento.id}/thumbs/{filename}'

# PALETAS DE COLORES PARA EL HTML
PALETAS_COLOR = [
    ('clasico', 'Clásico / Gris Neumórfico'),
    ('rosa_pastell', 'Rosa & Pastel'),
    ('azul_elegante', 'Azul Noche & Plata'),
    ('verde_bosque', 'Verde Bosque & Muted Teal'),
    ('morado_fiesta', 'Morado & Lavanda'),
    ('blanco_boda', 'Blanco Marfil & Dorado'),
]

# CONFIGURACIÓN DE VARIABLES CSS POR TEMA
CONFIGURACION_TEMAS = {
    'clasico': {
        'bg': '#f8fafc',
        'surface': '#ffffff',
        'text': '#0f172a',
        'muted': '#64748b',
        'primary': '#4f46e5',
        'primary_soft': 'rgba(79, 70, 229, 0.09)',
        'border': 'rgba(148, 163, 184, 0.24)',
        'shadow_dark': 'rgba(15, 23, 42, 0.08)',
        'shadow_light': 'rgba(255, 255, 255, 0.92)',
    },
    'rosa_pastell': {
        'bg': '#fff5f7',
        'surface': '#ffffff',
        'text': '#4c0519',
        'muted': '#9f1239',
        'primary': '#e11d48',
        'primary_soft': 'rgba(225, 29, 72, 0.09)',
        'border': 'rgba(244, 63, 94, 0.16)',
        'shadow_dark': 'rgba(136, 19, 55, 0.07)',
        'shadow_light': 'rgba(255, 255, 255, 0.95)',
    },
    'azul_elegante': {
        'bg': '#f4f7ff',
        'surface': '#ffffff',
        'text': '#0f172a',
        'muted': '#475569',
        'primary': '#3730a3',
        'primary_soft': 'rgba(55, 48, 163, 0.09)',
        'border': 'rgba(99, 102, 241, 0.18)',
        'shadow_dark': 'rgba(30, 27, 75, 0.08)',
        'shadow_light': 'rgba(255, 255, 255, 0.95)',
    },
    'verde_bosque': {
        'bg': '#f3f8f6',
        'surface': '#ffffff',
        'text': '#0f2922',
        'muted': '#3f6257',
        'primary': '#0f766e',
        'primary_soft': 'rgba(15, 118, 110, 0.09)',
        'border': 'rgba(20, 184, 166, 0.18)',
        'shadow_dark': 'rgba(15, 41, 34, 0.07)',
        'shadow_light': 'rgba(255, 255, 255, 0.95)',
    },
    'morado_fiesta': {
        'bg': '#faf5ff',
        'surface': '#ffffff',
        'text': '#2e1065',
        'muted': '#6b21a8',
        'primary': '#7c3aed',
        'primary_soft': 'rgba(124, 58, 237, 0.09)',
        'border': 'rgba(167, 139, 250, 0.22)',
        'shadow_dark': 'rgba(59, 7, 100, 0.08)',
        'shadow_light': 'rgba(255, 255, 255, 0.95)',
    },
    'blanco_boda': {
        'bg': '#fcfbf7',
        'surface': '#ffffff',
        'text': '#292524',
        'muted': '#78716c',
        'primary': '#b45309',
        'primary_soft': 'rgba(180, 83, 9, 0.09)',
        'border': 'rgba(217, 119, 6, 0.18)',
        'shadow_dark': 'rgba(41, 37, 36, 0.07)',
        'shadow_light': 'rgba(255, 255, 255, 0.95)',
    },
}


class Marco(models.Model):
    """Modelo para administrar el catálogo de marcos PNG transparentes"""
    nombre = models.CharField(max_length=100, verbose_name="Nombre del Marco")
    imagen = models.ImageField(upload_to='marcos_eventos/', verbose_name="Imagen PNG del Marco", max_length=500)
    solo_premium = models.BooleanField(
        default=False, 
        verbose_name="Exclusivo Premium",
        help_text="Si se marca, solo los eventos con plan Premium podrán elegir este marco."
    )
    activo = models.BooleanField(default=True, verbose_name="Activo")
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Marco"
        verbose_name_plural = "Marcos"
        ordering = ['nombre']

    def __str__(self):
        return f"{self.nombre}"


def generar_password_acceso(longitud=8):
    """
    Genera una contraseña alfanumérica segura para acceso del dueño desde la página principal.
    Ejemplo: 'K9mX2pL8'
    """
    import secrets
    import string
    caracteres = string.ascii_letters + string.digits
    return ''.join(secrets.choice(caracteres) for _ in range(longitud))


class Evento(models.Model):
    PLANES = [
        (5000, 'Solo Galería QR (5 GB - $500 MXN)'),
        (0, 'Solo Invitación Web ($699 MXN)'),
        (15000, 'Paquete VIP (Los Dos) (15 GB - $1,190 MXN)'),
        (10000, 'Experiencia (10 GB - $900 MXN) [Anterior]'),
        (200, 'DEBUG (200 MB)'),
    ]

    PLANTILLAS = [
        ('clasica', 'Estructura Clásica'),
        ('grid_moderno', 'Grid Moderno'),
        ('editorial', 'Estilo Editorial'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nombre_evento = models.CharField(max_length=150, verbose_name='Nombre del Evento')
    nombre_cliente = models.CharField(max_length=150, verbose_name='Nombre de los Clientes')
    plan_almacenamiento = models.IntegerField(choices=PLANES, default=5000, verbose_name='Plan')
    
    # Elección de estructura HTML y Paleta
    plantilla_html = models.CharField(
        max_length=30, 
        choices=PLANTILLAS, 
        default='clasica', 
        verbose_name='Plantilla de la Galería'
    )
    tema_color = models.CharField(
        max_length=30,
        choices=PALETAS_COLOR,
        default='clasico',
        verbose_name="Paleta de Colores"
    )

    # Marco de superposición seleccionado (Exclusivo Experiencia y Premium)
    marco_seleccionado = models.ForeignKey(
        Marco,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='eventos',
        verbose_name="Marco Personalizado",
        help_text="Marco PNG que se superpondrá sobre las fotos (Disponible en Experiencia y Premium)"
    )

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    dias_vigencia = models.IntegerField(default=20, verbose_name='Días de Vigencia')
    activo = models.BooleanField(default=True)

    # Imagen de fondo opcional (Plan Experiencia y Premium)
    fondo_personalizado = models.ImageField(
        upload_to='fondos_eventos/',
        null=True,
        blank=True,
        verbose_name='Fondo Personalizado',
        max_length=500
    )

    # Mensaje de bienvenida emergente / Modal (Exclusivo Premium)
    mensaje_bienvenida = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        verbose_name='Mensaje de Bienvenida',
        help_text="Mensaje emergente al abrir la galería (ej. '¡Bienvenidos a la boda de Ana y Mario!')"
    )

    pin_dueno = models.CharField(
        max_length=4,
        default='0000',
        help_text='PIN de 4 dígitos para operaciones internas del dueño',
        validators=[RegexValidator(r'^\d{4}$', 'El PIN debe ser exactamente de 4 dígitos numéricos.')]
    )

    password_acceso = models.CharField(
        max_length=64,
        blank=True,
        null=True,
        db_index=True,
        verbose_name='Password de Acceso a la Galería',
        help_text='Contraseña alfanumérica segura para ingresar a la galería desde la página principal.'
    )

    # Campos para cotizador y control de tiempo
    fecha_hora_inicio = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Fecha y hora de inicio del evento'
    )
    horas_extra = models.IntegerField(
        default=0,
        verbose_name='Horas extra (bloques de 24h)',
        help_text='Cada bloque de 24 horas extra cuesta $100 MXN'
    )
    duracion_total_horas = models.IntegerField(
        default=24,
        verbose_name='Duración total en horas',
        help_text='24 horas base + horas extra contratadas'
    )

    # Límite de descargas ZIP
    descargas_zip_restantes = models.IntegerField(
        default=3,
        verbose_name='Descargas ZIP restantes',
        help_text='Número de descargas completas permitidas al dueño'
    )

    # Modo proyector / Live stream en el salón
    incluye_proyector = models.BooleanField(
        default=False,
        verbose_name='Incluye Modo Proyector',
        help_text='Habilita el modo proyector en vivo en pantalla para el salón'
    )

    def save(self, *args, **kwargs):
        # Asigna automáticamente los días de vigencia según el plan al crear el evento
        if self._state.adding:
            dias_por_plan = {
                5000: 30,    # Solo Galería QR (20 - 30 días)
                0: 30,       # Solo Invitación Web
                10000: 30,   # Anterior
                15000: 60,   # Paquete VIP (45 - 60 días)
                200: 20,     # Debug
            }
            self.dias_vigencia = dias_por_plan.get(self.plan_almacenamiento, 30)

        # Paquete VIP siempre incluye modo proyector gratis
        if self.plan_almacenamiento == 15000:
            self.incluye_proyector = True

        # Generar contraseña de acceso automáticamente si no fue asignada
        if not self.password_acceso:
            self.password_acceso = generar_password_acceso(8)

        # Calcular duración total automáticamente
        self.duracion_total_horas = 24 + (self.horas_extra * 24)

        super().save(*args, **kwargs)

    def fecha_expiracion(self):
        return self.fecha_creacion + timedelta(days=self.dias_vigencia)

    def esta_expirado(self):
        return timezone.now() > self.fecha_expiracion()

    def eliminar_completamente(self):
        """Elimina todos los archivos en el storage externo, la carpeta en GCS y luego borra el evento."""
        # Eliminar fondo personalizado si existe
        if self.fondo_personalizado:
            try:
                self.fondo_personalizado.delete(save=False)
            except Exception:
                pass

        # Eliminar todas las fotos del evento
        for foto in self.fotos.all():
            try:
                if foto.original_archivo:
                    foto.original_archivo.delete(save=False)
                if foto.preview_archivo:
                    foto.preview_archivo.delete(save=False)
                if foto.thumb_archivo:
                    foto.thumb_archivo.delete(save=False)
            except Exception:
                pass

        # Eliminar la carpeta completa en GCS
        eliminar_carpeta_evento_gcs(self.id)

        self.delete()

    def delete(self, *args, **kwargs):
        """Override para eliminar todos los archivos del storage externo y la carpeta en GCS"""
        # Eliminar fondo personalizado si existe
        if self.fondo_personalizado:
            try:
                self.fondo_personalizado.delete(save=False)
            except Exception:
                pass

        # Eliminar todas las fotos del evento
        for foto in self.fotos.all():
            try:
                if foto.original_archivo:
                    foto.original_archivo.delete(save=False)
                if foto.preview_archivo:
                    foto.preview_archivo.delete(save=False)
                if foto.thumb_archivo:
                    foto.thumb_archivo.delete(save=False)
            except Exception:
                pass

        # Eliminar la carpeta completa del evento en GCS
        eliminar_carpeta_evento_gcs(self.id)

        super().delete(*args, **kwargs)

    def __str__(self):
        return f'{self.nombre_evento} ({self.get_plan_almacenamiento_display()})'

    # ==========================================================
    # PROPIEDADES DE VALIDACIÓN DE PLANES
    # ==========================================================

    @property
    def es_plan_galeria_qr(self):
        return self.plan_almacenamiento == 5000

    @property
    def es_plan_invitacion(self):
        return self.plan_almacenamiento == 0

    @property
    def es_plan_vip(self):
        return self.plan_almacenamiento == 15000

    @property
    def es_plan_esencial(self):
        return self.plan_almacenamiento == 5000

    @property
    def es_plan_experiencia(self):
        return self.plan_almacenamiento == 10000

    @property
    def es_plan_premium(self):
        return self.plan_almacenamiento == 15000

    # ==========================================================
    # PROPIEDADES DE PERMISOS Y ESTILOS
    # ==========================================================

    @property
    def permite_interaccion(self):
        """Habilita likes, comentarios y fotos destacadas (Solo Galería QR y Paquete VIP)."""
        return self.plan_almacenamiento in [5000, 10000, 15000, 200]

    @property
    def permite_marcos(self):
        """Permite usar marcos si el plan es VIP o Debug."""
        return self.plan_almacenamiento >= 10000 or self.plan_almacenamiento == 200

    @property
    def url_marco_activo(self):
        """Retorna la URL del marco solo si el plan lo permite y hay uno seleccionado."""
        if self.permite_marcos and self.marco_seleccionado and self.marco_seleccionado.activo:
            return self.marco_seleccionado.imagen.url
        return None

    @property
    def permite_portada_hero(self):
        """Devuelve True si el plan permite personalización de fondo y subieron una imagen."""
        return (self.plan_almacenamiento >= 10000 or self.plan_almacenamiento == 200) and bool(self.fondo_personalizado)

    @property
    def permite_mensaje_bienvenida(self):
        """Solo disponible en Paquete VIP."""
        return self.plan_almacenamiento == 15000

    @property
    def permite_proyector(self):
        """Habilita el modo proyector si es Paquete VIP o si contrató el extra opcional."""
        return self.plan_almacenamiento == 15000 or self.incluye_proyector

    @property
    def css_plantilla_clase(self):
        """Asigna la clase CSS del grid según la plantilla elegida o fuerza clásica si es básico."""
        if not self.permite_interaccion:
            return 'layout-clasico'
            
        mapa_clases = {
            'clasica': 'layout-clasico',
            'grid_moderno': 'layout-grid-moderno',
            'editorial': 'layout-editorial',
        }
        return mapa_clases.get(self.plantilla_html, 'layout-clasico')

    @property
    def vars_css_tema(self):
        conf = CONFIGURACION_TEMAS.get(self.tema_color, CONFIGURACION_TEMAS['clasico'])
        return f"""
            --neu-bg: {conf['bg']};
            --neu-surface: {conf['surface']};
            --neu-text: {conf['text']};
            --neu-muted: {conf['muted']};
            --neu-primary: {conf['primary']};
            --neu-primary-soft: {conf['primary_soft']};
            --neu-border: {conf['border']};
            --neu-shadow-dark: {conf['shadow_dark']};
            --neu-shadow-light: {conf['shadow_light']};
        """

    # ==========================================================
    # PROPIEDADES DE COTIZACIÓN Y TIEMPO
    # ==========================================================

    @property
    def precio_base(self):
        """Precio base según el paquete"""
        precios = {
            5000: 500,    # Solo Galería QR ($500 MXN)
            0: 699,       # Solo Invitación Web ($699 MXN)
            10000: 900,   # Anterior
            15000: 1190,  # Paquete VIP ($1,190 MXN)
            200: 500,     # Debug
        }
        return precios.get(self.plan_almacenamiento, 500)

    @property
    def costo_total(self):
        """Costo total incluyendo horas extra y proyector si es opcional"""
        costo = self.precio_base + (self.horas_extra * 100)
        if self.incluye_proyector and self.plan_almacenamiento != 15000:
            costo += 250
        return costo

    @property
    def fecha_fin_evento(self):
        """Fecha y hora de fin del evento (inicio + duración total)"""
        if self.fecha_hora_inicio:
            return self.fecha_hora_inicio + timedelta(hours=self.duracion_total_horas)
        return None

    @property
    def evento_no_ha_comenzado(self):
        """Verifica si el evento aún no ha comenzado (15 min de margen)"""
        if not self.fecha_hora_inicio:
            return False
        margen_inicio = self.fecha_hora_inicio - timedelta(minutes=15)
        return timezone.now() < margen_inicio

    @property
    def evento_ha_terminado(self):
        """Verifica si el evento ya terminó según la duración contratada"""
        if not self.fecha_fin_evento:
            return False
        return timezone.now() > self.fecha_fin_evento

    @property
    def evento_activo_por_ventana_tiempo(self):
        """Verifica si el evento está dentro de la ventana de tiempo activa"""
        return not self.evento_no_ha_comenzado and not self.evento_ha_terminado


class FotoInvitado(models.Model):
    """Modelo para guardar fotos y videos de invitados"""
    evento = models.ForeignKey(Evento, on_delete=models.CASCADE, related_name='fotos')
    
    TIPO_CHOICES = [
        ('IMAGEN', 'Imagen'),
        ('VIDEO', 'Video')
    ]
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES, default='IMAGEN')
    
    ESTADO_CHOICES = [
        ('PROCESANDO', 'Procesando...'),
        ('COMPLETADO', 'Completado'),
        ('ERROR', 'Error')
    ]
    estado_procesamiento = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='COMPLETADO')
    
    peso_bytes = models.BigIntegerField(default=0)
    ancho = models.IntegerField(null=True, blank=True)
    alto = models.IntegerField(null=True, blank=True)

    original_archivo = models.FileField(upload_to=get_original_path, max_length=500)
    preview_archivo = models.FileField(upload_to=get_preview_path, null=True, blank=True, max_length=500)
    thumb_archivo = models.FileField(upload_to=get_thumb_path, null=True, blank=True, max_length=500)
    
    fecha_subida = models.DateTimeField(auto_now_add=True)

    # Campos opcionales de interacción (Para plan Experiencia y Premium)
    likes = models.PositiveIntegerField(default=0)
    destacada = models.BooleanField(default=False)
    mensaje = models.CharField(max_length=250, blank=True, null=True, verbose_name="Mensaje del invitado")

    def __str__(self):
        return f'Archivo en {self.evento.nombre_evento} - {self.fecha_subida.strftime("%H:%M:%S")}'

    def es_video(self):
        return self.tipo == 'VIDEO'


class SolicitudEvento(models.Model):
    """Modelo para solicitudes de eventos desde el formulario público"""
    ESTADO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('aprobada', 'Aprobada'),
        ('rechazada', 'Rechazada'),
    ]

    PLANES = Evento.PLANES
    PLANTILLAS = Evento.PLANTILLAS

    # Información de contacto del solicitante
    nombre_solicitante = models.CharField(max_length=150, verbose_name='Nombre del Solicitante')
    telefono = models.CharField(
        max_length=20,
        verbose_name='Teléfono',
        validators=[RegexValidator(r'^[0-9]{10}$', 'El teléfono debe tener exactamente 10 dígitos.')]
    )
    email = models.EmailField(verbose_name='Email')

    # Información del evento (campos que se piden en admin)
    nombre_evento = models.CharField(max_length=150, verbose_name='Nombre del Evento')
    nombre_cliente = models.CharField(max_length=150, verbose_name='Nombre de los Clientes')
    plan_almacenamiento = models.IntegerField(choices=PLANES, default=5000, verbose_name='Plan')
    plantilla_html = models.CharField(
        max_length=30,
        choices=PLANTILLAS,
        default='clasica',
        verbose_name='Plantilla de la Galería'
    )
    tema_color = models.CharField(
        max_length=30,
        choices=PALETAS_COLOR,
        default='clasico',
        verbose_name="Paleta de Colores"
    )

    # Campos para cotizador y control de tiempo
    fecha_hora_inicio = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Fecha y hora de inicio del evento'
    )
    horas_extra = models.IntegerField(
        default=0,
        verbose_name='Horas extra (bloques de 24h)',
        help_text='Cada bloque de 24 horas extra cuesta $100 MXN'
    )
    incluye_proyector = models.BooleanField(
        default=False,
        verbose_name='Modo Proyector / Live Stream',
        help_text='Habilita el modo proyector en vivo (+ $250 MXN opcional en Galería QR, gratis en VIP)'
    )

    # Campos opcionales (según el plan)
    marco_seleccionado = models.ForeignKey(
        Marco,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='solicitudes',
        verbose_name="Marco Personalizado",
        help_text="Marco PNG que se superpondrá sobre las fotos (Disponible en Paquete VIP)"
    )
    fondo_personalizado = models.ImageField(
        upload_to='fondos_solicitudes/',
        null=True,
        blank=True,
        verbose_name='Fondo Personalizado',
        max_length=500
    )
    mensaje_bienvenida = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        verbose_name='Mensaje de Bienvenida',
        help_text="Mensaje emergente al abrir la galería (ej. '¡Bienvenidos a la boda de Ana y Mario!')"
    )

    password_acceso = models.CharField(
        max_length=64,
        blank=True,
        null=True,
        verbose_name='Password de Acceso Personalizado',
        help_text='Opcional. Si se deja vacío, el sistema generará una contraseña alfanumérica automática al crear el evento.'
    )

    # Estado y metadatos
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente', verbose_name='Estado')
    fecha_creacion = models.DateTimeField(auto_now_add=True, verbose_name='Fecha de Solicitud')
    notas_admin = models.TextField(blank=True, null=True, verbose_name='Notas del Admin')

    # Si se aprobó, referencia al evento creado
    evento_creado = models.ForeignKey(
        Evento,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='solicitud_origen',
        verbose_name='Evento Creado'
    )

    class Meta:
        verbose_name = "Solicitud de Evento"
        verbose_name_plural = "Solicitudes de Eventos"
        ordering = ['-fecha_creacion']

    def __str__(self):
        return f'Solicitud de {self.nombre_evento} - {self.get_estado_display()}'

    @property
    def precio_base(self):
        """Precio base según el paquete solicitado"""
        precios = {
            5000: 500,    # Solo Galería QR
            0: 699,       # Solo Invitación Web
            15000: 1190,  # Paquete VIP
        }
        return precios.get(self.plan_almacenamiento, 500)

    @property
    def costo_total(self):
        """Costo total de la cotización solicitada"""
        costo = self.precio_base + (self.horas_extra * 100)
        if self.incluye_proyector and self.plan_almacenamiento != 15000:
            costo += 250
        return costo

    @property
    def whatsapp_confirmacion_url(self):
        """Genera el enlace de confirmación por WhatsApp en backend con número oficial blindado"""
        import urllib.parse
        numero = getattr(settings, 'WHATSAPP_NUMERO_SOPORTE', '522227751013')
        mensaje = f'Hola PhotoDom! Acabo de enviar mi solicitud para el evento "{self.nombre_evento}" por ${self.costo_total} MXN. ¿Me apoyan con los detalles?'
        return f"https://wa.me/{numero}?text={urllib.parse.quote(mensaje)}"

    def crear_evento_desde_solicitud(self):
        """Crea un evento a partir de los datos de esta solicitud"""
        from django.utils import timezone
        import random

        # Generar PIN aleatorio de 4 dígitos para operaciones administrativas
        pin_dueno = ''.join([str(random.randint(0, 9)) for _ in range(4)])
        # Usar la contraseña personalizada o generar una segura automáticamente
        password_acceso = self.password_acceso or generar_password_acceso(8)

        evento = Evento.objects.create(
            nombre_evento=self.nombre_evento,
            nombre_cliente=self.nombre_cliente,
            plan_almacenamiento=self.plan_almacenamiento,
            plantilla_html=self.plantilla_html or 'clasica',
            tema_color=self.tema_color,
            marco_seleccionado=self.marco_seleccionado,
            fondo_personalizado=self.fondo_personalizado,
            mensaje_bienvenida=self.mensaje_bienvenida,
            fecha_hora_inicio=self.fecha_hora_inicio,
            horas_extra=self.horas_extra,
            incluye_proyector=self.incluye_proyector or (self.plan_almacenamiento == 15000),
            pin_dueno=pin_dueno,
            password_acceso=password_acceso,
            activo=True,
        )

        # Actualizar la solicitud con el evento creado y cambiar estado
        self.evento_creado = evento
        self.estado = 'aprobada'
        self.save()

        return evento

    def delete(self, *args, **kwargs):
        """Override para eliminar el fondo personalizado del storage"""
        if self.fondo_personalizado:
            try:
                self.fondo_personalizado.delete(save=False)
            except Exception:
                pass
        super().delete(*args, **kwargs)


# ==========================================================
# SIGNALS DE LIMPIEZA GCS Y ARCHIVOS
# ==========================================================

@receiver(post_delete, sender=Evento)
def post_delete_evento_gcs_cleanup(sender, instance, **kwargs):
    """
    Garantiza que la carpeta completa del evento en GCS se elimine,
    incluso si el evento fue eliminado vía bulk delete en Django Admin.
    """
    eliminar_carpeta_evento_gcs(instance.id)


@receiver(post_delete, sender=SolicitudEvento)
def post_delete_solicitud_cleanup(sender, instance, **kwargs):
    """Elimina el fondo personalizado de solicitudes si se borra la solicitud."""
    if instance.fondo_personalizado:
        try:
            instance.fondo_personalizado.delete(save=False)
        except Exception:
            pass