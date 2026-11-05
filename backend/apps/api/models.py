import uuid

from django.db import models
from django.utils import timezone


class RouteAnalysis(models.Model):
    """A persisted route/weather analysis used for history and 1-hour reuse."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client_id = models.CharField(max_length=64, db_index=True)
    request_hash = models.CharField(max_length=64, db_index=True)

    origin = models.CharField(max_length=255)
    destination = models.CharField(max_length=255)
    departure_time = models.DateTimeField()
    load_weight_lbs = models.PositiveIntegerField()
    sample_interval_miles = models.FloatField(null=True, blank=True)

    request_meta = models.JSONField()
    response_payload = models.JSONField()

    recommended_route_id = models.CharField(max_length=64, null=True, blank=True)
    recommended_route_name = models.CharField(max_length=255, null=True, blank=True)
    total_distance_miles = models.FloatField(null=True, blank=True)
    total_duration_hours = models.FloatField(null=True, blank=True)

    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    objects = models.Manager()

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(
                fields=['client_id', 'request_hash', 'created_at'],
                name='ra_client_hash_created',
            ),
            models.Index(
                fields=['client_id', 'created_at'],
                name='ra_client_created',
            ),
        ]

    def __str__(self) -> str:
        return (
            f'{self.origin} → {self.destination} ({self.created_at:%Y-%m-%d %H:%M} UTC)'
        )
