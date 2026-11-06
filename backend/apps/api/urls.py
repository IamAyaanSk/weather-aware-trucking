from django.urls import path

from apps.api.views import health, plan_route, verify_access_code

app_name = 'api'

urlpatterns = [
    path('health/', health, name='health'),
    path('auth/verify/', verify_access_code, name='auth-verify'),
    path('routes/plan/', plan_route, name='routes-plan'),
]
