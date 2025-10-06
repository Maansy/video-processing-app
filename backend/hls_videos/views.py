from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import JSONParser
from django.conf import settings
import os
import uuid
from datetime import datetime

from .models import HLSVideo, HLSVariant
from .serializers import HLSVideoSerializer, HLSVideoUploadSerializer, HLSVariantSerializer
from .hls_processor import HLSProcessor
from videos.s3_utils import S3Handler


class HLSVideoViewSet(viewsets.ModelViewSet):
    """ViewSet for HLS video streaming"""
    queryset = HLSVideo.objects.all()
    serializer_class = HLSVideoSerializer
    parser_classes = (JSONParser,)
    
    @action(detail=False, methods=['post'], url_path='get-upload-url')
    def get_upload_url(self, request):
        """
        Generate a presigned URL for direct S3 upload from frontend
        
        Request body:
        {
            "filename": "my-video.mp4",
            "content_type": "video/mp4",
            "title": "My Video Title",
            "description": "Optional description"
        }
        """
        serializer = HLSVideoUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        filename = serializer.validated_data['filename']
        content_type = serializer.validated_data.get('content_type', 'video/mp4')
        title = serializer.validated_data['title']
        description = serializer.validated_data.get('description', '')
        
        # Generate unique file key for S3
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        unique_id = str(uuid.uuid4())[:8]
        file_extension = os.path.splitext(filename)[1]
        s3_key = f"hls_videos/originals/{timestamp}_{unique_id}{file_extension}"
        
        try:
            # Create HLS video record with pending status
            video = HLSVideo.objects.create(
                title=title,
                description=description,
                processing_status='pending'
            )
            
            # Generate presigned URL
            s3_handler = S3Handler()
            presigned_data = s3_handler.generate_presigned_upload_url(
                file_key=s3_key,
                content_type=content_type,
                expiration=3600  # 1 hour
            )
            
            return Response({
                'video_id': video.id,
                'upload_data': presigned_data,
                's3_key': s3_key,
                'message': 'Upload URL generated successfully for HLS processing'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'], url_path='confirm-upload')
    def confirm_upload(self, request, pk=None):
        """
        Confirm that file was uploaded to S3 and start HLS processing
        
        Request body:
        {
            "s3_key": "hls_videos/originals/20231015_abc123.mp4",
            "file_size": 1048576
        }
        """
        video = self.get_object()
        s3_key = request.data.get('s3_key')
        file_size = request.data.get('file_size')
        
        if not s3_key:
            return Response(
                {'error': 's3_key is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Verify file exists in S3
            s3_handler = S3Handler()
            if not s3_handler.file_exists(s3_key):
                return Response(
                    {'error': 'File not found in S3'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Get file size from S3 if not provided
            if not file_size:
                file_size = s3_handler.get_file_size(s3_key)
            
            # Update video record with S3 information
            video.s3_key = s3_key
            video.file_size = file_size
            video.processing_status = 'processing'
            video.save()
            
            # Start HLS processing
            processor = HLSProcessor(video)
            processor.process_to_hls()
            
            # Refresh video from database
            video.refresh_from_db()
            
            serializer = HLSVideoSerializer(video)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            video.processing_status = 'failed'
            video.error_message = str(e)
            video.save()
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'], url_path='status')
    def processing_status(self, request, pk=None):
        """Check processing status of a video"""
        video = self.get_object()
        serializer = HLSVideoSerializer(video)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], url_path='reprocess')
    def reprocess(self, request, pk=None):
        """Reprocess video to HLS format"""
        video = self.get_object()
        
        if not video.s3_key:
            return Response(
                {'error': 'No original video file found'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Reset processing status
            video.processing_status = 'processing'
            video.error_message = ''
            video.save()
            
            # Start HLS processing
            processor = HLSProcessor(video)
            processor.process_to_hls()
            
            video.refresh_from_db()
            serializer = HLSVideoSerializer(video)
            return Response(serializer.data)
            
        except Exception as e:
            video.processing_status = 'failed'
            video.error_message = str(e)
            video.save()
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
