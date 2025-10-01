from rest_framework import serializers
from .models import Video, VideoResolution, VideoVersion


class VideoResolutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = VideoResolution
        fields = [
            'id', 'resolution', 'file_path', 'file_size', 'bitrate',
            'width', 'height', 'is_processing', 'is_completed', 'is_failed',
            'processing_started_at', 'processing_completed_at', 'error_message'
        ]


class VideoVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = VideoVersion
        fields = ['id', 'version_number', 'file_path', 'created_at', 'is_current']


class VideoSerializer(serializers.ModelSerializer):
    resolutions = VideoResolutionSerializer(many=True, read_only=True)
    versions = VideoVersionSerializer(many=True, read_only=True)
    filename = serializers.ReadOnlyField()
    
    class Meta:
        model = Video
        fields = [
            'id', 'title', 'description', 'original_file', 'filename',
            'file_size', 'duration', 'processing_status', 'version',
            'created_at', 'updated_at', 'processed_at',
            'resolutions', 'versions'
        ]
        read_only_fields = ['file_size', 'duration', 'processing_status', 'processed_at']


class VideoUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Video
        fields = ['title', 'description', 'original_file']