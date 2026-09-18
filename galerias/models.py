import uuid
import os
from datetime import timedelta
from django.db import models
from django.utils import timezone
from django.core.validators import RegexValidator
import os

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
        'bg': '#e0e5ec',
        'text': '#4a5568',
        'primary': '#4f46e5',
        'shadow_dark': '#a3b1c6',
        'shadow_light': '#ffffff',
    },
    'rosa_pastell': {
        'bg': '#fce7f3',
        'text': '#831843',
        'primary': '#db2777',
        'shadow_dark': '#dba9c4',
        'shadow_light': '#ffffff',
    },
    'azul_elegante': {
        'bg': '#e0e7ff',
        'text': '#1e1b4b',
        'primary': '#4338ca',
        'shadow_dark': '#b8c2ed',
        'shadow_light': '#ffffff',
    },
    'verde_bosque': {
        'bg': '#e6f0ed',
        'text': '#1f352d',
        'primary': '#4f7d6d',
        'shadow_dark': '#b9d4c9',
        'shadow_light': '#ffffff',
    },
    'morado_fiesta': {
        'bg': '#f3e8ff',
        'text': '#3b0764',
        'primary': '#7e22ce',
        'shadow_dark': '#d3b8f5',
        'shadow_light': '#ffffff',
    },
    'blanco_boda': {
        'bg': '#f8f6f0',
        'text': '#44403c',
        'primary': '#b8860b',
        'shadow_dark': '#ddd7c9',
        'shadow_light': '#ffffff',
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


class Evento(models.Model):
    PLANES = [
        (5000, 'Esencial (5 GB - $500 MXN)'),
        (10000, 'Experiencia (10 GB - $900 MXN)'),
        (15000, 'Premium (15 GB - $1,500 MXN)'),
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
        help_text='PIN de 4 dígitos para acceso del dueño',
        validators=[RegexValidator(r'^\d{4}$', 'El PIN debe ser exactamente de 4 dígitos numéricos.')]
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

    def save(self, *args, **kwargs):
        # Asigna automáticamente los días de vigencia según el plan al crear el evento
        if not self.pk:
            dias_por_plan = {
                5000: 20,    # Esencial
                10000: 30,   # Experiencia
                15000: 45,   # Premium
            }
            self.dias_vigencia = dias_por_plan.get(self.plan_almacenamiento, 20)

        # Calcular duración total automáticamente
        self.duracion_total_horas = 24 + (self.horas_extra * 24)

        super().save(*args, **kwargs)

    def fecha_expiracion(self):
        return self.fecha_creacion + timedelta(days=self.dias_vigencia)

    def esta_expirado(self):
        return timezone.now() > self.fecha_expiracion()

    def eliminar_completamente(self):
        """Elimina todos los archivos en el storage externo y luego borra el evento."""
        # Eliminar fondo personalizado si existe
        if self.fondo_personalizado:
            self.fondo_personalizado.delete(save=False)

        # Eliminar todas las fotos del evento
        for foto in self.fotos.all():
            if foto.original_archivo:
                foto.original_archivo.delete(save=False)
            if foto.preview_archivo:
                foto.preview_archivo.delete(save=False)
            if foto.thumb_archivo:
                foto.thumb_archivo.delete(save=False)

        self.delete()

    def delete(self, *args, **kwargs):
        """Override para eliminar todos los archivos del storage externo"""
        # Eliminar fondo personalizado si existe
        if self.fondo_personalizado:
            self.fondo_personalizado.delete(save=False)

        # Eliminar todas las fotos del evento
        for foto in self.fotos.all():
            if foto.original_archivo:
                foto.original_archivo.delete(save=False)
            if foto.preview_archivo:
                foto.preview_archivo.delete(save=False)
            if foto.thumb_archivo:
                foto.thumb_archivo.delete(save=False)

        super().delete(*args, **kwargs)

    def __str__(self):
        return f'{self.nombre_evento} ({self.get_plan_almacenamiento_display()})'

    # ==========================================================
    # PROPIEDADES DE VALIDACIÓN DE PLANES
    # ==========================================================

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
        """Habilita likes, mensajes en fotos y destacar fotos (Experiencia y Premium)."""
        return self.plan_almacenamiento >= 10000

    @property
    def permite_marcos(self):
        """Permite usar marcos si el plan es Experiencia, Premium o Debug."""
        return self.plan_almacenamiento >= 10000 or self.plan_almacenamiento == 200

    @property
    def url_marco_activo(self):
        """Retorna la URL del marco solo si el plan lo permite y hay uno seleccionado."""
        if self.permite_marcos and self.marco_seleccionado and self.marco_seleccionado.activo:
            return self.marco_seleccionado.imagen.url
        return None

    @property
    def permite_portada_hero(self):
        """Devuelve True si el plan es Experiencia o Premium y subieron una imagen de fondo."""
        return self.permite_interaccion and bool(self.fondo_personalizado)

    @property
    def css_plantilla_clase(self):
        """Asigna la clase CSS del grid según la plantilla elegida o fuerza clásica si es Esencial."""
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
            --neu-text: {conf['text']};
            --neu-primary: {conf['primary']};
            --neu-shadow-dark: {conf['shadow_dark']};
            --neu-shadow-light: {conf['shadow_light']};
        """

    # ==========================================================
    # PROPIEDADES DE COTIZACIÓN Y TIEMPO
    # ==========================================================

    @property
    def precio_base(self):
        """Precio base según el plan"""
        precios = {
            5000: 500,   # Esencial
            10000: 900,  # Experiencia
            15000: 1500, # Premium
        }
        return precios.get(self.plan_almacenamiento, 500)

    @property
    def costo_total(self):
        """Costo total incluyendo horas extra"""
        return self.precio_base + (self.horas_extra * 100)

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

    # Campos opcionales (según el plan)
    marco_seleccionado = models.ForeignKey(
        Marco,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='solicitudes',
        verbose_name="Marco Personalizado",
        help_text="Marco PNG que se superpondrá sobre las fotos (Disponible en Experiencia y Premium)"
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

    def crear_evento_desde_solicitud(self):
        """Crea un evento a partir de los datos de esta solicitud"""
        from django.utils import timezone
        import random

        # Generar PIN aleatorio de 4 dígitos
        pin_dueno = ''.join([str(random.randint(0, 9)) for _ in range(4)])

        evento = Evento.objects.create(
            nombre_evento=self.nombre_evento,
            nombre_cliente=self.nombre_cliente,
            plan_almacenamiento=self.plan_almacenamiento,
            plantilla_html='clasica',
            tema_color=self.tema_color,
            marco_seleccionado=self.marco_seleccionado,
            fondo_personalizado=self.fondo_personalizado,
            mensaje_bienvenida=self.mensaje_bienvenida,
            fecha_hora_inicio=self.fecha_hora_inicio,
            horas_extra=self.horas_extra,
            pin_dueno=pin_dueno,
            activo=True,
        )

        # Actualizar la solicitud con el evento creado y cambiar estado
        self.evento_creado = evento
        self.estado = 'aprobada'
        self.save()

        return evento

    def delete(self, *args, **kwargs):
        """Override para eliminar el fondo personalizado del storage"""
        # Eliminar fondo personalizado si existe
        if self.fondo_personalizado:
            self.fondo_personalizado.delete(save=False)
        super().delete(*args, **kwargs)