import uuid
import os # Necesitamos esto para verificar extensiones
from datetime import timedelta
from django.db import models
from django.utils import timezone

#COLORES PARA EL HTML
PALETAS_COLOR = [
    ('clasico', 'Clásico / Gris Neumórfico (#e0e5ec)'),
    ('rosa_pastell', 'Rosa & Pastel (Baby Shower / XV Años)'),
    ('azul_elegante', 'Azul Noche & Plata (Graduaciones / Bodas)'),
    ('verde_bosque', 'Verde Bosque & Muted Teal (Botánico / Orgánico)'),
    ('morado_fiesta', 'Morado & Lavanda (Fiestas / Neón)'),
    ('blanco_boda', 'Blanco Marfil & Dorado (Bodas Elegantes)'),
]

# Definición de variables CSS para cada paquete
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
        'primary': '#db2777',    # rosa más profundo, con más carácter que el original
        'shadow_dark': '#dba9c4', # variante oscura del MISMO rosa del bg, no un rosa nuevo
        'shadow_light': '#ffffff',
    },
    'azul_elegante': {
        'bg': '#e0e7ff',
        'text': '#1e1b4b',
        'primary': '#4338ca',    # índigo más rico que el azul plano anterior
        'shadow_dark': '#b8c2ed',
        'shadow_light': '#ffffff',
    },
    'verde_bosque': {
        'bg': '#e6f0ed',
        'text': '#1f352d',
        'primary': '#4f7d6d',    # verde bosque más profundo, menos "lavado"
        'shadow_dark': '#b9d4c9',
        'shadow_light': '#ffffff',
    },
    'morado_fiesta': {
        'bg': '#f3e8ff',
        'text': '#3b0764',
        'primary': '#7e22ce',    # morado vibrante pero no neón
        'shadow_dark': '#d3b8f5',
        'shadow_light': '#ffffff',
    },
    'blanco_boda': {
        'bg': '#f8f6f0',
        'text': '#44403c',
        'primary': '#b8860b',    # dorado más terroso/elegante que el naranja-dorado original
        'shadow_dark': '#ddd7c9',
        'shadow_light': '#ffffff',
    },
}



class Evento(models.Model):
    # (El modelo Evento queda igual que antes)
    PLANES = [
        (200, 'DEBUG 200MB'),
        (5000, 'Básico (5 GB)'),
        (10000, 'Estándar (10 GB)'),
        (15000, 'Premium (15 GB)'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nombre_evento = models.CharField(max_length=150, verbose_name='Nombre del Evento')
    nombre_cliente = models.CharField(max_length=150, verbose_name='Nombre de los Clientes')
    plan_almacenamiento = models.IntegerField(choices=PLANES, default=5000, verbose_name='Plan')
    tema_color= models.CharField(
        max_length=30,
        choices=PALETAS_COLOR,
        default='clasico',
        verbose_name="Paleta de Colores"
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    dias_vigencia = models.IntegerField(default=30)
    activo = models.BooleanField(default=True)

    def fecha_expiracion(self):
        return self.fecha_creacion + timedelta(days=self.dias_vigencia)

    def esta_expirado(self):
        return timezone.now() > self.fecha_expiracion()

    def __str__(self):
        return f'{self.nombre_evento} ({self.get_plan_almacenamiento_display()})'

    @property
    def vars_css_tema(self):
        """Retorna las variables CSS del tema seleccionado."""
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
    
    # CAMBIO IMPORTANTE: FileField en lugar de ImageField
    archivo = models.FileField(upload_to='archivos_eventos/')
    
    fecha_subida = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Archivo en {self.evento.nombre_evento} - {self.fecha_subida.strftime("%H:%M:%S")}'

    # Método para que la plantilla sepa qué es foto y qué es video
    def es_video(self):
        ext = os.path.splitext(self.archivo.name)[1].lower()
        return ext in ['.mp4', '.mov', '.avi', '.mpeg']


