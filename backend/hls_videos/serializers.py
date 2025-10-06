from rest_framework import serializers
from .models import HLSVideo, HLSVariant
from videos.s3_utils import S3Handler


class HLSVariantSerializer(serializers.ModelSerializer):
    stream_url = serializers.SerializerMethodField()
    
    class Meta:
        model = HLSVariant
        fields = [
            'id', 'resolution', 'width', 'height', 'bitrate',
            'playlist_s3_key', 'segment_count', 'segment_duration',
            'stream_url', 'processing_completed_at'
        ]
    
    def get_stream_url(self, obj):
        """Generate presigned URL for the variant playlist"""
        if obj.playlist_s3_key:
            s3_handler = S3Handler()
            return s3_handler.generate_presigned_download_url(
                obj.playlist_s3_key,
                expiration=3600  # 1 hour
            )
        return None


class HLSVideoSerializer(serializers.ModelSerializer):
    variants = HLSVariantSerializer(many=True, read_only=True)
    master_playlist_url = serializers.SerializerMethodField()
    
    class Meta:
        model = HLSVideo
        fields = [
            'id', 'title', 'description', 'duration', 'file_size',
            'processing_status', 'master_playlist_s3_key', 'master_playlist_url',
            'variants', 'created_at', 'processed_at'
        ]
    
    def get_master_playlist_url(self, obj):
        """Generate presigned URL for the master playlist"""
        if obj.master_playlist_s3_key:
            s3_handler = S3Handler()
            return s3_handler.generate_presigned_download_url(
                obj.master_playlist_s3_key,
                expiration=3600  # 1 hour
            )
        return None


class HLSVideoUploadSerializer(serializers.Serializer):
    """Serializer for initial upload request"""
    filename = serializers.CharField(max_length=255)
    content_type = serializers.CharField(max_length=100, default='video/mp4')
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
