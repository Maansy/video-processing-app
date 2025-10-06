import os
import subprocess
from moviepy.editor import VideoFileClip
from django.conf import settings
from django.utils import timezone
from .models import Video, VideoResolution
from .s3_utils import S3Handler
import logging
import tempfile

logger = logging.getLogger(__name__)


class VideoProcessor:
    def __init__(self, video_instance):
        self.video = video_instance
        self.s3_handler = S3Handler() if settings.USE_S3_STORAGE else None
        
        # Determine input path (local or S3)
        if self.video.is_s3_stored:
            # Download from S3 to temp location for processing
            self.temp_dir = tempfile.mkdtemp()
            self.input_path = os.path.join(self.temp_dir, self.video.filename)
            logger.info(f"Downloading video from S3: {self.video.s3_key}")
            self.s3_handler.download_file(self.video.s3_key, self.input_path)
        else:
            self.temp_dir = None
            self.input_path = video_instance.original_file.path
        
    def get_video_info(self):
        """Extract video information using moviepy"""
        try:
            clip = VideoFileClip(self.input_path)
            duration = clip.duration
            width = clip.w
            height = clip.h
            clip.close()
            
            # Get file size
            file_size = os.path.getsize(self.input_path)
            
            return {
                'duration': duration,
                'width': width,
                'height': height,
                'file_size': file_size
            }
        except Exception as e:
            logger.error(f"Error getting video info: {str(e)}")
            return None
    
    def process_resolutions(self, resolutions=None):
        """Process video into different resolutions"""
        if not resolutions:
            resolutions = settings.VIDEO_RESOLUTIONS
        
        # Update video status
        self.video.processing_status = 'processing'
        self.video.save()
        
        # Get video info and update model
        video_info = self.get_video_info()
        if video_info:
            self.video.duration = video_info['duration']
            if not self.video.file_size:  # Only update if not already set
                self.video.file_size = video_info['file_size']
            self.video.save()
        
        processed_count = 0
        
        for resolution_key, resolution_config in resolutions.items():
            try:
                success = self._process_single_resolution(resolution_key, resolution_config)
                if success:
                    processed_count += 1
            except Exception as e:
                logger.error(f"Error processing {resolution_key}: {str(e)}")
        
        # Update video processing status
        if processed_count > 0:
            self.video.processing_status = 'completed'
            self.video.processed_at = timezone.now()
        else:
            self.video.processing_status = 'failed'
        
        self.video.save()
        
        # Cleanup temp directory if used
        if self.temp_dir and os.path.exists(self.temp_dir):
            import shutil
            shutil.rmtree(self.temp_dir)
            logger.info(f"Cleaned up temp directory: {self.temp_dir}")
        
        return processed_count > 0
    
    def _process_single_resolution(self, resolution_key, resolution_config):
        """Process video to a single resolution using FFmpeg"""
        # Create VideoResolution record
        video_resolution, created = VideoResolution.objects.get_or_create(
            video=self.video,
            resolution=resolution_key,
            defaults={
                'width': resolution_config['width'],
                'height': resolution_config['height'],
                'bitrate': resolution_config['bitrate'],
                'processing_started_at': timezone.now()
            }
        )
        
        if not created:
            video_resolution.processing_started_at = timezone.now()
            video_resolution.processing_completed_at = None
            video_resolution.processing_failed_at = None
            video_resolution.error_message = None
            video_resolution.save()
        
        try:
            # Generate output filename
            base_name = os.path.splitext(os.path.basename(self.input_path))[0]
            output_filename = f"{base_name}_{resolution_key}.mp4"
            
            # Determine output location
            if settings.USE_S3_STORAGE and self.s3_handler:
                # Process to temp directory, then upload to S3
                temp_output_dir = tempfile.mkdtemp()
                output_path = os.path.join(temp_output_dir, output_filename)
            else:
                # Process to local media directory
                output_dir = os.path.join(settings.MEDIA_ROOT, 'processed', str(self.video.id), resolution_key)
                os.makedirs(output_dir, exist_ok=True)
                output_path = os.path.join(output_dir, output_filename)
            
            # Use FFmpeg command for processing
            ffmpeg_cmd = [
                'ffmpeg',
                '-i', self.input_path,
                '-vf', f"scale={resolution_config['width']}:{resolution_config['height']}",
                '-b:v', resolution_config['bitrate'],
                '-c:v', 'libx264',
                '-c:a', 'aac',
                '-preset', 'medium',
                '-y',  # Overwrite output file
                output_path
            ]
            
            # Run FFmpeg
            result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                file_size = os.path.getsize(output_path)
                
                if settings.USE_S3_STORAGE and self.s3_handler:
                    # Upload to S3
                    s3_key = f"videos/processed/{self.video.id}/{resolution_key}/{output_filename}"
                    logger.info(f"Uploading {resolution_key} to S3: {s3_key}")
                    
                    upload_success = self.s3_handler.upload_file(
                        output_path,
                        s3_key,
                        content_type='video/mp4'
                    )
                    
                    if upload_success:
                        # Update VideoResolution with S3 key
                        video_resolution.s3_key = s3_key
                        video_resolution.file_size = file_size
                        video_resolution.processing_completed_at = timezone.now()
                        video_resolution.save()
                        
                        # Cleanup temp file
                        import shutil
                        shutil.rmtree(temp_output_dir)
                        
                        logger.info(f"Successfully processed and uploaded {resolution_key} for video {self.video.id}")
                        return True
                    else:
                        raise Exception("Failed to upload to S3")
                else:
                    # Update VideoResolution with local path
                    relative_path = os.path.relpath(output_path, settings.MEDIA_ROOT)
                    video_resolution.file_path = relative_path
                    video_resolution.file_size = file_size
                    video_resolution.processing_completed_at = timezone.now()
                    video_resolution.save()
                    
                    logger.info(f"Successfully processed {resolution_key} for video {self.video.id}")
                    return True
            else:
                raise Exception(f"FFmpeg failed: {result.stderr}")
            
        except Exception as e:
            error_message = str(e)
            logger.error(f"Error processing {resolution_key} for video {self.video.id}: {error_message}")
            
            # Update error status
            video_resolution.processing_failed_at = timezone.now()
            video_resolution.error_message = error_message
            video_resolution.save()
            
            return False


def process_video_async(video_id):
    """Function to be called by Celery for async processing"""
    try:
        video = Video.objects.get(id=video_id)
        processor = VideoProcessor(video)
        return processor.process_resolutions()
    except Video.DoesNotExist:
        logger.error(f"Video with id {video_id} not found")
        return False
    except Exception as e:
        logger.error(f"Error in async video processing: {str(e)}")
        return False