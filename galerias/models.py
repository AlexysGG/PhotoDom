import uuid
import os
from datetime import timedelta
from django.db import models
from django.utils import timezone
from django.core.validators import RegexValidator

# PALETAS DE COLORES PARA EL HTML
PALETAS_COLOR = [
    ('clasico', 'Clásico / Gris Neumórfico (#e0e5ec)'),
    ('rosa_pastell', 'Rosa & Pastel (Baby Shower / XV Años)'),
    ('azul_elegante', 'Azul Noche & Plata (Graduaciones / Bodas)'),
    ('verde_bosque', 'Verde Bosque & Muted Teal (Botánico / Orgánico)'),
    ('morado_fiesta', 'Morado & Lavanda (Fiestas / Neón)'),
    ('blanco_boda', 'Blanco Marfil & Dorado (Bodas Elegantes)'),
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


class Evento(models.Model):
    PLANES = [
        (200, 'DEBUG (200 MB)'),
        (5000, 'Esencial (5 GB - $650 MXN)'),
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

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    dias_vigencia = models.IntegerField(default=20, verbose_name='Días de Vigencia')
    activo = models.BooleanField(default=True)

    # Imagen de fondo opcional (Plan Experiencia y Premium)
    fondo_personalizado = models.ImageField(
        upload_to='fondos_eventos/', 
        null=True, 
        blank=True, 
        verbose_name='Fondo Personalizado'
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

    def save(self, *args, **kwargs):
        # Asigna automáticamente los días de vigencia según el plan al crear el evento
        if not self.pk:
            dias_por_plan = {
                200: 30,     # Debug
                5000: 20,    # Esencial
                10000: 30,   # Experiencia
                15000: 45,   # Premium
            }
            self.dias_vigencia = dias_por_plan.get(self.plan_almacenamiento, 20)
        super().save(*args, **kwargs)

    def fecha_expiracion(self):
        return self.fecha_creacion + timedelta(days=self.dias_vigencia)

    def esta_expirado(self):
        return timezone.now() > self.fecha_expiracion()

    def eliminar_completamente(self):
        """Elimina todos los archivos en el storage externo y luego borra el evento."""
        for foto in self.fotos.all():
            if foto.archivo:
                foto.archivo.delete(save=False)
        self.delete()

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


class FotoInvitado(models.Model):
    """Modelo para guardar fotos y videos de invitados"""
    evento = models.ForeignKey(Evento, on_delete=models.CASCADE, related_name='fotos')
    archivo = models.FileField(upload_to='archivos_eventos/')
    fecha_subida = models.DateTimeField(auto_now_add=True)

    # Campos opcionales de interacción (Para plan Experiencia y Premium)
    likes = models.PositiveIntegerField(default=0)
    destacada = models.BooleanField(default=False)
    mensaje = models.CharField(max_length=250, blank=True, null=True, verbose_name="Mensaje del invitado")

    def __str__(self):
        return f'Archivo en {self.evento.nombre_evento} - {self.fecha_subida.strftime("%H:%M:%S")}'

    def es_video(self):
        ext = os.path.splitext(self.archivo.name)[1].lower()
        return ext in ['.mp4', '.mov', '.avi', '.mpeg']