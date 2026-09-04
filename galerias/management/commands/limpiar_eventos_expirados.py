from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from galerias.models import Evento

class Command(BaseCommand):
    help = 'Elimina los eventos cuyo periodo de vigencia ha expirado junto a sus archivos'

    def handle(self, *args, **options):
        ahora = timezone.now()
        eventos = Evento.objects.all()
        eliminados_count = 0

        for evento in eventos:
            # Comprobamos si la fecha actual sobrepasa la fecha de creación + días de vigencia
            if evento.esta_expirado():
                nombre = evento.nombre_evento
                evento.eliminar_completamente()
                eliminados_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'Evento "{nombre}" (ID: {evento.id}) eliminado con éxito.')
                )

        if eliminados_count == 0:
            self.stdout.write(self.style.SUCCESS('No hay eventos expirados para eliminar.'))
        else:
            self.stdout.write(
                self.style.SUCCESS(f'Proceso completado. Total de eventos eliminados: {eliminados_count}')
            )