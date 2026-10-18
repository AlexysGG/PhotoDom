import uuid
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.utils import timezone
from galerias.models import Evento, SolicitudEvento, Marco, eliminar_carpeta_evento_gcs
from galerias.forms import SolicitudEventoForm, PLANES_CHOICES


class PaquetesBackendTestCase(TestCase):
    def test_precios_y_detalles_solo_galeria_qr(self):
        evento = Evento.objects.create(
            nombre_evento="Boda Civil",
            nombre_cliente="Ana y Mario",
            plan_almacenamiento=5000,
            incluye_proyector=False,
        )
        self.assertEqual(evento.precio_base, 500)
        self.assertEqual(evento.costo_total, 500)
        self.assertEqual(evento.dias_vigencia, 30)
        self.assertTrue(evento.permite_interaccion)
        self.assertFalse(evento.permite_proyector)

        # Con modo proyector opcional (+ $250 MXN)
        evento.incluye_proyector = True
        evento.save()
        self.assertEqual(evento.costo_total, 750)
        self.assertTrue(evento.permite_proyector)

    def test_precios_y_detalles_solo_invitacion_web(self):
        evento = Evento.objects.create(
            nombre_evento="Invitacion XV",
            nombre_cliente="Sofia",
            plan_almacenamiento=0,
            incluye_proyector=False,
        )
        self.assertEqual(evento.precio_base, 699)
        self.assertEqual(evento.costo_total, 699)
        self.assertEqual(evento.dias_vigencia, 30)
        self.assertFalse(evento.permite_proyector)

    def test_precios_y_detalles_paquete_vip(self):
        evento = Evento.objects.create(
            nombre_evento="Boda Grande",
            nombre_cliente="Laura y Carlos",
            plan_almacenamiento=15000,
            incluye_proyector=False,  # En VIP se fuerza a True automáticamente
        )
        self.assertEqual(evento.precio_base, 1190)
        self.assertEqual(evento.costo_total, 1190)  # Proyector incluido gratis, no suma extra
        self.assertEqual(evento.dias_vigencia, 60)
        self.assertTrue(evento.incluye_proyector)
        self.assertTrue(evento.permite_proyector)
        self.assertTrue(evento.permite_interaccion)
        self.assertTrue(evento.permite_mensaje_bienvenida)
        self.assertTrue(evento.permite_marcos)

    def test_formulario_solicitudes_solo_galeria_qr(self):
        data = {
            'nombre_solicitante': 'Juan Pérez',
            'telefono': '1234567890',
            'email': 'juan@example.com',
            'nombre_evento': 'Cumpleaños Juan',
            'nombre_cliente': 'Juan Pérez',
            'plan_almacenamiento': 5000,
            'incluye_proyector': True,
            'fecha_hora_inicio': timezone.now().strftime('%Y-%m-%dT%H:%M'),
            'horas_extra': 0,
            'tema_color': 'rosa_pastell',  # Debería forzarse a 'clasico' en Galería QR básica
            'aceptar_terminos': True,
            'aceptar_privacidad': True,
        }
        form = SolicitudEventoForm(data=data)
        self.assertTrue(form.is_valid(), form.errors)
        solicitud = form.save()
        self.assertEqual(solicitud.plan_almacenamiento, 5000)
        self.assertEqual(solicitud.tema_color, 'clasico')
        self.assertTrue(solicitud.incluye_proyector)
        self.assertEqual(solicitud.precio_base, 500)
        self.assertEqual(solicitud.costo_total, 750)

    def test_formulario_solicitudes_solo_invitacion_web(self):
        data = {
            'nombre_solicitante': 'Carla Ruiz',
            'telefono': '9876543210',
            'email': 'carla@example.com',
            'nombre_evento': 'Baby Shower Carla',
            'nombre_cliente': 'Carla Ruiz',
            'plan_almacenamiento': 0,
            'fecha_hora_inicio': timezone.now().strftime('%Y-%m-%dT%H:%M'),
            'horas_extra': 0,
            'tema_color': 'azul_elegante',
            'aceptar_terminos': True,
            'aceptar_privacidad': True,
        }
        form = SolicitudEventoForm(data=data)
        self.assertTrue(form.is_valid(), form.errors)
        solicitud = form.save()
        self.assertEqual(solicitud.plan_almacenamiento, 0)
        self.assertFalse(solicitud.incluye_proyector)
        self.assertEqual(solicitud.precio_base, 699)
        self.assertEqual(solicitud.costo_total, 699)

    def test_formulario_solicitudes_paquete_vip(self):
        data = {
            'nombre_solicitante': 'Mariana Díaz',
            'telefono': '5544332211',
            'email': 'mariana@example.com',
            'nombre_evento': 'Boda VIP Mariana',
            'nombre_cliente': 'Mariana y Luis',
            'plan_almacenamiento': 15000,
            'fecha_hora_inicio': timezone.now().strftime('%Y-%m-%dT%H:%M'),
            'horas_extra': 1,
            'tema_color': 'morado_fiesta',
            'mensaje_bienvenida': '¡Bienvenidos a nuestra gran noche!',
            'aceptar_terminos': True,
            'aceptar_privacidad': True,
        }
        form = SolicitudEventoForm(data=data)
        self.assertTrue(form.is_valid(), form.errors)
        solicitud = form.save()
        self.assertEqual(solicitud.plan_almacenamiento, 15000)
        self.assertTrue(solicitud.incluye_proyector)
        self.assertEqual(solicitud.precio_base, 1190)
        # 1190 + (1 * 100 extra) = 1290 (proyector no suma extra en VIP)
        self.assertEqual(solicitud.costo_total, 1290)

        # Crear evento desde la solicitud
        evento = solicitud.crear_evento_desde_solicitud()
        self.assertEqual(evento.plan_almacenamiento, 15000)
        self.assertTrue(evento.incluye_proyector)
        self.assertEqual(evento.precio_base, 1190)


class GCSCleanupTestCase(TestCase):
    @patch('google.cloud.storage.Client')
    def test_eliminar_carpeta_evento_gcs(self, mock_client_cls):
        mock_client = MagicMock()
        mock_bucket = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.bucket.return_value = mock_bucket

        # Simular dos blobs en GCS bajo la carpeta del evento
        mock_blob1 = MagicMock()
        mock_blob1.name = "eventos/test-uuid-1234/originals/foto1.jpg"
        mock_blob2 = MagicMock()
        mock_blob2.name = "eventos/test-uuid-1234/thumbs/foto1.webp"
        mock_bucket.list_blobs.return_value = [mock_blob1, mock_blob2]

        evento_id = "test-uuid-1234"
        eliminar_carpeta_evento_gcs(evento_id)

        # Verificar que consultó el prefijo exacto de la carpeta del evento
        mock_bucket.list_blobs.assert_called_once_with(prefix="eventos/test-uuid-1234/")
        # Verificar que eliminó los blobs de GCS
        mock_bucket.delete_blobs.assert_called_once_with([mock_blob1, mock_blob2])

    @patch('galerias.models.eliminar_carpeta_evento_gcs')
    def test_evento_delete_llama_a_eliminar_carpeta_gcs(self, mock_eliminar_gcs):
        evento = Evento.objects.create(
            nombre_evento="Evento Para Borrar",
            nombre_cliente="Cliente Test",
            plan_almacenamiento=5000,
        )
        evento_id = evento.id

        # Borrado del evento
        evento.delete()

        # Comprobar que en efecto se llamó a eliminar la carpeta del evento
        mock_eliminar_gcs.assert_called_with(evento_id)

    @patch('galerias.models.eliminar_carpeta_evento_gcs')
    def test_bulk_delete_dispara_post_delete_signal(self, mock_eliminar_gcs):
        evento1 = Evento.objects.create(
            nombre_evento="Evento 1",
            nombre_cliente="Cliente 1",
            plan_almacenamiento=5000,
        )
        evento2 = Evento.objects.create(
            nombre_evento="Evento 2",
            nombre_cliente="Cliente 2",
            plan_almacenamiento=15000,
        )
        id1, id2 = evento1.id, evento2.id

        # Bulk delete (como en Django Admin)
        Evento.objects.filter(id__in=[id1, id2]).delete()

        # Comprobar que la señal post_delete llamó a eliminar las carpetas de ambos eventos
        mock_eliminar_gcs.assert_any_call(id1)
        mock_eliminar_gcs.assert_any_call(id2)


class WhatsAppBackendTestCase(TestCase):
    def test_whatsapp_numero_y_url_en_backend(self):
        solicitud = SolicitudEvento.objects.create(
            nombre_solicitante="Carlos Vera",
            telefono="2221234567",
            email="carlos@example.com",
            nombre_evento="Boda Vera",
            nombre_cliente="Carlos y Sofía",
            plan_almacenamiento=5000,
        )
        url = solicitud.whatsapp_confirmacion_url
        self.assertTrue(url.startswith("https://wa.me/522227751013?text="))
        self.assertIn("Boda%20Vera", url)
        self.assertIn("%24500", url)


class AccesoDuenoPasswordTestCase(TestCase):
    def setUp(self):
        self.evento = Evento.objects.create(
            nombre_evento="Fiesta Aniversario",
            nombre_cliente="Elena y Roberto",
            plan_almacenamiento=5000,
            activo=True,
        )

    def test_password_acceso_generado_automaticamente(self):
        # Debe ser alfanumérico, de longitud 8 y diferente al pin_dueno de 4 dígitos
        self.assertIsNotNone(self.evento.password_acceso)
        self.assertEqual(len(self.evento.password_acceso), 8)
        self.assertNotEqual(self.evento.password_acceso, self.evento.pin_dueno)
        self.assertTrue(self.evento.password_acceso.isalnum())

    def test_verificar_acceso_dueno_clave_vacia(self):
        response = self.client.post('/acceso-galeria/', {}, content_type='application/json')
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertFalse(data['success'])

    def test_verificar_acceso_dueno_clave_incorrecta(self):
        response = self.client.post('/acceso-galeria/', {'password_acceso': 'INCORRECTO'}, content_type='application/json')
        self.assertEqual(response.status_code, 404)
        data = response.json()
        self.assertFalse(data['success'])

    def test_verificar_acceso_dueno_clave_correcta(self):
        response = self.client.post('/acceso-galeria/', {'password_acceso': self.evento.password_acceso}, content_type='application/json')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['evento_id'], str(self.evento.id))
        self.assertEqual(data['redirect_url'], f'/evento/{self.evento.id}/panel/')
        
        # Verificar que la sesión quedó autorizada
        session = self.client.session
        self.assertTrue(session.get(f'acceso_evento_{self.evento.id}'))
        self.assertTrue(session.get(f'es_dueno_{self.evento.id}'))
