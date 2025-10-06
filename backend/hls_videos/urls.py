from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import HLSVideoViewSet

router = DefaultRouter()
router.register(r'hls-videos', HLSVideoViewSet, basename='hls-video')

urlpatterns = [
    path('', include(router.urls)),
]
