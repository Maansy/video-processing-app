from django.contrib import admin
from .models import Video, VideoResolution, VideoVersion


@admin.register(Video)
class VideoAdmin(admin.ModelAdmin):
    list_display = ['title', 'processing_status', 'version', 'created_at', 'duration']
    list_filter = ['processing_status', 'created_at']
    search_fields = ['title', 'description']
    readonly_fields = ['file_size', 'duration', 'processed_at', 'created_at', 'updated_at']


@admin.register(VideoResolution)
class VideoResolutionAdmin(admin.ModelAdmin):
    list_display = ['video', 'resolution', 'width', 'height', 'is_completed', 'processing_completed_at']
    list_filter = ['resolution', 'processing_completed_at']
    search_fields = ['video__title']


@admin.register(VideoVersion)
class VideoVersionAdmin(admin.ModelAdmin):
    list_display = ['video', 'version_number', 'is_current', 'created_at']
    list_filter = ['is_current', 'created_at']
    search_fields = ['video__title']
