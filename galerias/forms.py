from django import forms
from .models import SolicitudEvento, Marco, PALETAS_COLOR

PLANES_CHOICES = [
    (5000, 'Solo Galería QR (5 GB - $500 MXN)'),
    (0, 'Solo Invitación Web ($699 MXN)'),
    (15000, '🔥 Paquete VIP (Los Dos) (15 GB - $1,190 MXN)'),
]

class SolicitudEventoForm(forms.ModelForm):
    # Campos adicionales para checkboxes legales
    aceptar_terminos = forms.BooleanField(
        required=True,
        label='Acepto los Términos y Condiciones',
        widget=forms.CheckboxInput(attrs={'class': 'form-check-input'})
    )
    aceptar_privacidad = forms.BooleanField(
        required=True,
        label='Acepto el Aviso de Privacidad',
        widget=forms.CheckboxInput(attrs={'class': 'form-check-input'})
    )

    class Meta:
        model = SolicitudEvento
        fields = [
            'nombre_solicitante',
            'telefono',
            'email',
            'nombre_evento',
            'nombre_cliente',
            'plan_almacenamiento',
            'incluye_proyector',
            'tema_color',
            'fecha_hora_inicio',
            'horas_extra',
            'marco_seleccionado',
            'fondo_personalizado',
            'mensaje_bienvenida',
        ]
        widgets = {
            'nombre_solicitante': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Tu nombre completo'
            }),
            'telefono': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Tu número de teléfono (10 dígitos)',
                'pattern': '[0-9]{10}',
                'inputmode': 'numeric',
                'maxlength': '10',
                'minlength': '10'
            }),
            'email': forms.EmailInput(attrs={
                'class': 'form-control',
                'placeholder': 'tu@email.com'
            }),
            'nombre_evento': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ej: Boda de Ana y Mario'
            }),
            'nombre_cliente': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ej: Ana y Mario García'
            }),
            'plan_almacenamiento': forms.Select(attrs={
                'class': 'form-control',
                'id': 'plan-selector'
            }),
            'incluye_proyector': forms.CheckboxInput(attrs={
                'class': 'form-check-input',
                'id': 'incluye-proyector-checkbox'
            }),
            'tema_color': forms.Select(attrs={
                'class': 'form-control'
            }),
            'fecha_hora_inicio': forms.DateTimeInput(attrs={
                'class': 'form-control',
                'type': 'datetime-local',
                'id': 'fecha-hora-inicio',
                'step': '60'  # Paso de 1 minuto para mayor precisión
            }),
            'horas_extra': forms.NumberInput(attrs={
                'class': 'form-control',
                'min': '0',
                'step': '1',
                'id': 'horas-extra'
            }),
            'marco_seleccionado': forms.Select(attrs={
                'class': 'form-control'
            }),
            'fondo_personalizado': forms.FileInput(attrs={
                'class': 'form-control',
                'accept': 'image/*'
            }),
            'mensaje_bienvenida': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ej: ¡Bienvenidos a la boda de Ana y Mario!'
            }),
        }
        labels = {
            'nombre_solicitante': 'Nombre del Solicitante',
            'telefono': 'Teléfono',
            'email': 'Email',
            'nombre_evento': 'Nombre del Evento',
            'nombre_cliente': 'Nombre de los Clientes',
            'plan_almacenamiento': 'Paquete',
            'incluye_proyector': 'Modo Proyector / Live Stream en el salón',
            'tema_color': 'Paleta de Colores',
            'fecha_hora_inicio': 'Fecha y hora de inicio del evento',
            'horas_extra': 'Horas extra (bloques de 24h)',
            'marco_seleccionado': 'Marco Personalizado',
            'fondo_personalizado': 'Fondo Personalizado',
            'mensaje_bienvenida': 'Mensaje de Bienvenida',
        }
        help_texts = {
            'fecha_hora_inicio': 'Fecha y hora exacta cuando comenzará el evento. La galería estará disponible 15 minutos antes.',
            'horas_extra': 'La galería de tus invitados se mantiene por defecto 24hrs activada para subidas, usa esta opción si necesitas más días.',
            'incluye_proyector': 'Transmite fotos y videos en tiempo real en la pantalla del salón (+ $250 MXN opcional en Galería QR, ¡incluido gratis en VIP!).',
            'marco_seleccionado': 'Marco PNG que se superpondrá sobre las fotos (Disponible en Paquete VIP) *Las descargas no llevarán el marco superpuesto.*',
            'mensaje_bienvenida': 'Mensaje emergente al abrir la galería (Solo disponible en Paquete VIP)',
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['plan_almacenamiento'].choices = PLANES_CHOICES
        # Filtrar marcos activos
        self.fields['marco_seleccionado'].queryset = Marco.objects.filter(activo=True)
        self.fields['marco_seleccionado'].required = False
        self.fields['fondo_personalizado'].required = False
        self.fields['mensaje_bienvenida'].required = False
        self.fields['incluye_proyector'].required = False
        # Hacer obligatorios los campos clave
        self.fields['fecha_hora_inicio'].required = True
        self.fields['telefono'].required = True

    def clean(self):
        cleaned_data = super().clean()
        plan = cleaned_data.get('plan_almacenamiento')
        if plan is None:
            plan = 5000

        # Plan Solo Invitación Web (0)
        if plan == 0:
            cleaned_data['marco_seleccionado'] = None
            cleaned_data['fondo_personalizado'] = None
            cleaned_data['mensaje_bienvenida'] = None
            cleaned_data['tema_color'] = 'clasico'
            cleaned_data['incluye_proyector'] = False

        # Plan Solo Galería QR (5000)
        elif plan == 5000:
            cleaned_data['marco_seleccionado'] = None
            cleaned_data['fondo_personalizado'] = None
            cleaned_data['mensaje_bienvenida'] = None
            cleaned_data['tema_color'] = 'clasico'

        # Paquete VIP (15000)
        elif plan == 15000:
            # En VIP siempre incluye proyector gratis
            cleaned_data['incluye_proyector'] = True

        return cleaned_data
