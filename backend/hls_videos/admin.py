from django.contrib import admin
from .models import HLSVideo, HLSVariant


@admin.register(HLSVideo)
class HLSVideoAdmin(admin.ModelAdmin):
    list_display = ('title', 'processing_status', 'duration', 'created_at', 'processed_at')
    list_filter = ('processing_status', 'created_at')
    search_fields = ('title', 'description')
    readonly_fields = ('created_at', 'processed_at', 'processing_started_at')


@admin.register(HLSVariant)
class HLSVariantAdmin(admin.ModelAdmin):
    list_display = ('video', 'resolution', 'width', 'height', 'bitrate', 'segment_count', 'processing_completed_at')
    list_filter = ('resolution', 'processing_completed_at')
    search_fields = ('video__title',)
