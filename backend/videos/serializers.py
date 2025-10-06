from rest_framework import serializers
from .models import Video, VideoResolution, VideoVersion
from .s3_utils import S3Handler
from django.conf import settings


class VideoResolutionSerializer(serializers.ModelSerializer):
    stream_url = serializers.SerializerMethodField()
    
    class Meta:
        model = VideoResolution
        fields = [
            'id', 'resolution', 'file_path', 's3_key', 'file_size', 'bitrate',
            'width', 'height', 'is_processing', 'is_completed', 'is_failed',
            'processing_started_at', 'processing_completed_at', 'error_message',
            'stream_url', 'is_s3_stored'
        ]
    
    def get_stream_url(self, obj):
        """Get streaming URL (S3 presigned or local endpoint)"""
        if obj.is_s3_stored and settings.USE_S3_STORAGE:
            try:
                s3_handler = S3Handler()
                return s3_handler.generate_presigned_download_url(obj.s3_key, expiration=3600)
            except:
                return None
        else:
            # Return local streaming endpoint
            return f"/api/videos/{obj.video.id}/stream/{obj.resolution}/"


class VideoVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = VideoVersion
        fields = ['id', 'version_number', 'file_path', 'created_at', 'is_current']


class VideoSerializer(serializers.ModelSerializer):
    resolutions = VideoResolutionSerializer(many=True, read_only=True)
    versions = VideoVersionSerializer(many=True, read_only=True)
    filename = serializers.ReadOnlyField()
    original_stream_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Video
        fields = [
            'id', 'title', 'description', 'original_file', 's3_key', 'filename',
            'file_size', 'duration', 'processing_status', 'version',
            'created_at', 'updated_at', 'processed_at',
            'resolutions', 'versions', 'is_s3_stored', 'original_stream_url'
        ]
        read_only_fields = ['file_size', 'duration', 'processing_status', 'processed_at', 's3_key']
    
    def get_original_stream_url(self, obj):
        """Get streaming URL for original video"""
        if obj.is_s3_stored and settings.USE_S3_STORAGE:
            try:
                s3_handler = S3Handler()
                return s3_handler.generate_presigned_download_url(obj.s3_key, expiration=3600)
            except:
                return None
        else:
            return f"/api/videos/{obj.id}/stream/"


class VideoUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Video
        fields = ['title', 'description', 'original_file']