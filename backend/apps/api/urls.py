from django.urls import path

from apps.api.views import health, plan_route

app_name = 'api'

urlpatterns = [
    path('health/', health, name='health'),
    path('routes/plan/', plan_route, name='routes-plan'),
]
