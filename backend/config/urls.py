from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def health(_request):
    """Pour que Railway (ou toi) vérifie que le serveur répond."""
    return JsonResponse({'status': 'ok'})


urlpatterns = [
    path('', health),
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/rooms/', include('lobby.urls')),
]
