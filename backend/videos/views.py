from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.http import FileResponse, Http404
from django.conf import settings
from django.shortcuts import get_object_or_404
import os
import mimetypes
import uuid
from datetime import datetime

from .models import Video, VideoResolution
from .serializers import VideoSerializer, VideoUploadSerializer, VideoResolutionSerializer
from .utils import VideoProcessor
from .s3_utils import S3Handler


class VideoViewSet(viewsets.ModelViewSet):
    queryset = Video.objects.all()
    serializer_class = VideoSerializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)  # Added JSONParser
    
    def get_serializer_class(self):
        if self.action == 'create':
            return VideoUploadSerializer
        return VideoSerializer
    
    def create(self, request, *args, **kwargs):
        """Upload a new video and start processing"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Save video
        video = serializer.save()
        
        # Start processing in background (for now, we'll do it synchronously)
        try:
            processor = VideoProcessor(video)
            processor.process_resolutions()
        except Exception as e:
            # If processing fails, still return the video but mark as failed
            video.processing_status = 'failed'
            video.save()
        
        # Return full video data
        response_serializer = VideoSerializer(video)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
    
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
        filename = request.data.get('filename')
        content_type = request.data.get('content_type', 'video/mp4')
        title = request.data.get('title', filename)
        description = request.data.get('description', '')
        
        if not filename:
            return Response(
                {'error': 'filename is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Generate unique file key for S3
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        unique_id = str(uuid.uuid4())[:8]
        file_extension = os.path.splitext(filename)[1]
        s3_key = f"videos/originals/{timestamp}_{unique_id}{file_extension}"
        
        try:
            # Create video record with pending status
            video = Video.objects.create(
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
                'message': 'Upload URL generated successfully'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'], url_path='confirm-upload')
    def confirm_upload(self, request, pk=None):
        """
        Confirm that file was uploaded to S3 and start processing
        
        Request body:
        {
            "s3_key": "videos/originals/20231015_abc123.mp4",
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
            
            # Start processing
            processor = VideoProcessor(video)
            processor.process_resolutions()
            
            # Refresh video from database
            video.refresh_from_db()
            
            serializer = VideoSerializer(video)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            video.processing_status = 'failed'
            video.save()
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def reprocess(self, request, pk=None):
        """Reprocess video with different resolutions"""
        video = self.get_object()
        
        try:
            processor = VideoProcessor(video)
            success = processor.process_resolutions()
            
            if success:
                serializer = self.get_serializer(video)
                return Response(serializer.data)
            else:
                return Response(
                    {'error': 'Video processing failed'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def resolutions(self, request, pk=None):
        """Get all resolutions for a video"""
        video = self.get_object()
        resolutions = video.resolutions.all()
        serializer = VideoResolutionSerializer(resolutions, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def debug(self, request, pk=None):
        """Debug endpoint to check video info"""
        video = self.get_object()
        
        # Check file existence
        original_exists = os.path.exists(video.original_file.path) if video.original_file else False
        
        resolutions_info = []
        for res in video.resolutions.all():
            full_path = os.path.join(settings.MEDIA_ROOT, res.file_path)
            resolutions_info.append({
                'resolution': res.resolution,
                'file_path': res.file_path,
                'full_path': full_path,
                'file_exists': os.path.exists(full_path),
                'file_size': os.path.getsize(full_path) if os.path.exists(full_path) else 0,
                'is_completed': res.is_completed,
                'stream_url': f'/api/videos/{video.id}/stream/{res.resolution}/',
            })
        
        return Response({
            'video_id': video.id,
            'title': video.title,
            'original_file': video.original_file.name if video.original_file else None,
            'original_file_exists': original_exists,
            'original_stream_url': f'/api/videos/{video.id}/stream/',
            'processing_status': video.processing_status,
            'resolutions': resolutions_info,
        })
    
    @action(detail=True, methods=['get'])
    def stream(self, request, pk=None):
        """Stream original video file"""
        video = self.get_object()
        
        # If video is stored in S3, redirect to presigned URL
        if video.is_s3_stored and settings.USE_S3_STORAGE:
            try:
                s3_handler = S3Handler()
                presigned_url = s3_handler.generate_presigned_download_url(
                    video.s3_key,
                    expiration=3600
                )
                from django.http import HttpResponseRedirect
                return HttpResponseRedirect(presigned_url)
            except Exception as e:
                return Response(
                    {'error': f'Failed to generate download URL: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        # Local file streaming
        if video.original_file:
            return self._serve_file(video.original_file.path)
        
        return Response(
            {'error': 'Video file not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    @action(detail=True, methods=['get'], url_path='stream/(?P<resolution>[^/.]+)')
    def stream_resolution(self, request, pk=None, resolution=None):
        """Stream video in specific resolution"""
        video = self.get_object()
        
        try:
            video_resolution = video.resolutions.get(resolution=resolution)
            if not video_resolution.is_completed:
                return Response(
                    {'error': f'Resolution {resolution} is not ready'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # If resolution is stored in S3, redirect to presigned URL
            if video_resolution.is_s3_stored and settings.USE_S3_STORAGE:
                try:
                    s3_handler = S3Handler()
                    presigned_url = s3_handler.generate_presigned_download_url(
                        video_resolution.s3_key,
                        expiration=3600
                    )
                    from django.http import HttpResponseRedirect
                    return HttpResponseRedirect(presigned_url)
                except Exception as e:
                    return Response(
                        {'error': f'Failed to generate download URL: {str(e)}'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
            
            # Local file streaming
            if video_resolution.file_path:
                file_path = os.path.join(settings.MEDIA_ROOT, video_resolution.file_path)
                return self._serve_file(file_path)
            
            return Response(
                {'error': 'Video file not found'},
                status=status.HTTP_404_NOT_FOUND
            )
            
        except VideoResolution.DoesNotExist:
            return Response(
                {'error': f'Resolution {resolution} not found'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    def _serve_file(self, file_path):
        """Helper method to serve video files"""
        if not os.path.exists(file_path):
            raise Http404("Video file not found")
        
        # Guess the content type
        content_type, _ = mimetypes.guess_type(file_path)
        if not content_type:
            content_type = 'video/mp4'
        
        print(f"Serving file: {file_path}")
        print(f"File size: {os.path.getsize(file_path)} bytes")
        print(f"Content type: {content_type}")
        
        response = FileResponse(
            open(file_path, 'rb'),
            content_type=content_type
        )
        
        # Add headers for video streaming
        response['Accept-Ranges'] = 'bytes'
        response['Content-Length'] = os.path.getsize(file_path)
        
        # Add CORS headers for video streaming
        response['Access-Control-Allow-Origin'] = '*'
        response['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'Range'
        
        return response
