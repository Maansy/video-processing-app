import os
import subprocess
import tempfile
import shutil
import logging
from pathlib import Path
from moviepy.editor import VideoFileClip
from django.conf import settings
from django.utils import timezone
from videos.s3_utils import S3Handler
from .models import HLSVideo, HLSVariant

logger = logging.getLogger(__name__)


class HLSProcessor:
    """Process videos into HLS format with adaptive bitrate streaming"""
    
    def __init__(self, video_instance):
        self.video = video_instance
        self.s3_handler = S3Handler()
        self.temp_dir = None
        self.input_path = None
        
    def process_to_hls(self, resolutions=None):
        """
        Main method to process video into HLS format
        
        Args:
            resolutions: dict of resolution configs (uses settings.VIDEO_RESOLUTIONS if None)
        
        Returns:
            bool: True if successful
        """
        if not resolutions:
            resolutions = settings.VIDEO_RESOLUTIONS
        
        try:
            # Update status
            self.video.processing_status = 'processing'
            self.video.processing_started_at = timezone.now()
            self.video.save()
            
            # Create temp directory
            self.temp_dir = tempfile.mkdtemp(prefix='hls_processing_')
            logger.info(f"Created temp directory: {self.temp_dir}")
            
            # Download original video from S3
            self.input_path = os.path.join(self.temp_dir, self.video.filename)
            logger.info(f"Downloading video from S3: {self.video.s3_key}")
            
            if not self.s3_handler.download_file(self.video.s3_key, self.input_path):
                raise Exception("Failed to download video from S3")
            
            # Extract video info
            video_info = self._get_video_info()
            if video_info:
                self.video.duration = video_info['duration']
                if not self.video.file_size:
                    self.video.file_size = video_info['file_size']
                self.video.save()
            
            # Create HLS output directory
            hls_output_dir = os.path.join(self.temp_dir, 'hls_output')
            os.makedirs(hls_output_dir, exist_ok=True)
            
            # Process all variants simultaneously with FFmpeg
            success = self._process_all_variants_ffmpeg(resolutions, hls_output_dir)
            
            if success:
                # Create master playlist
                master_playlist_path = self._create_master_playlist(resolutions, hls_output_dir)
                
                # Upload all HLS files to S3
                upload_success = self._upload_hls_to_s3(hls_output_dir)
                
                if upload_success:
                    self.video.processing_status = 'completed'
                    self.video.processed_at = timezone.now()
                    self.video.save()
                    logger.info(f"HLS processing completed for video {self.video.id}")
                    return True
                else:
                    raise Exception("Failed to upload HLS files to S3")
            else:
                raise Exception("FFmpeg processing failed")
                
        except Exception as e:
            logger.error(f"HLS processing failed: {str(e)}")
            self.video.processing_status = 'failed'
            self.video.error_message = str(e)
            self.video.save()
            return False
            
        finally:
            # Cleanup temp directory
            if self.temp_dir and os.path.exists(self.temp_dir):
                shutil.rmtree(self.temp_dir)
                logger.info(f"Cleaned up temp directory: {self.temp_dir}")
    
    def _get_video_info(self):
        """Extract video information using moviepy"""
        try:
            clip = VideoFileClip(self.input_path)
            duration = clip.duration
            width = clip.w
            height = clip.h
            clip.close()
            
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
    
    def _process_all_variants_ffmpeg(self, resolutions, output_dir):
        """
        Process all HLS variants
        
        Processes each resolution separately to avoid FFmpeg multi-output complexity
        """
        try:
            # Create variant records
            for resolution_key, resolution_config in resolutions.items():
                HLSVariant.objects.get_or_create(
                    video=self.video,
                    resolution=resolution_key,
                    defaults={
                        'width': resolution_config['width'],
                        'height': resolution_config['height'],
                        'bitrate': resolution_config['bitrate'],
                        'segment_duration': 10,
                        'processing_started_at': timezone.now()
                    }
                )
            
            # Process each resolution
            for res_key, res_config in resolutions.items():
                logger.info(f"Processing {res_key} variant...")
                
                variant_dir = os.path.join(output_dir, res_key)
                os.makedirs(variant_dir, exist_ok=True)
                
                # Build FFmpeg command for this variant
                ffmpeg_cmd = [
                    'ffmpeg',
                    '-i', self.input_path,
                    '-vf', f"scale={res_config['width']}:{res_config['height']}",
                    '-c:v', 'libx264',
                    '-b:v', res_config['bitrate'],
                    '-preset', 'medium',
                    '-g', '48',
                    '-sc_threshold', '0',
                    '-c:a', 'aac',
                    '-b:a', '128k',
                    '-ar', '48000',
                    '-f', 'hls',
                    '-hls_time', '10',
                    '-hls_playlist_type', 'vod',
                    '-hls_segment_filename', os.path.join(variant_dir, 'segment_%03d.ts'),
                    os.path.join(variant_dir, 'playlist.m3u8')
                ]
                
                logger.info(f"Running FFmpeg for {res_key}: {' '.join(ffmpeg_cmd)}")
                
                # Run FFmpeg
                result = subprocess.run(
                    ffmpeg_cmd,
                    capture_output=True,
                    text=True,
                    timeout=3600  # 1 hour timeout
                )
                
                if result.returncode != 0:
                    logger.error(f"FFmpeg error for {res_key}: {result.stderr}")
                    return False
                
                logger.info(f"FFmpeg processing completed for {res_key}")
            
            # Update variant records with segment counts
            self._update_variant_info(resolutions, output_dir)
            return True
                
        except subprocess.TimeoutExpired:
            logger.error("FFmpeg processing timed out")
            return False
        except Exception as e:
            logger.error(f"Error in FFmpeg processing: {str(e)}")
            return False
    
    def _update_variant_info(self, resolutions, output_dir):
        """Update HLSVariant records with segment counts"""
        for res_key in resolutions.keys():
            variant = HLSVariant.objects.get(video=self.video, resolution=res_key)
            
            variant_dir = os.path.join(output_dir, res_key)
            
            # Count segments
            segment_files = list(Path(variant_dir).glob('segment_*.ts'))
            variant.segment_count = len(segment_files)
            
            # Set S3 keys (will be used during upload)
            variant.playlist_s3_key = f"hls_videos/{self.video.id}/{res_key}/playlist.m3u8"
            variant.segments_s3_prefix = f"hls_videos/{self.video.id}/{res_key}/"
            
            variant.processing_completed_at = timezone.now()
            variant.save()
            
            logger.info(f"Variant {res_key}: {variant.segment_count} segments created")
    
    def _create_master_playlist(self, resolutions, output_dir):
        """Create master playlist that lists all variants"""
        master_playlist_path = os.path.join(output_dir, 'master.m3u8')
        
        with open(master_playlist_path, 'w') as f:
            f.write('#EXTM3U\n')
            f.write('#EXT-X-VERSION:3\n\n')
            
            for res_key, res_config in resolutions.items():
                # Calculate bandwidth (bitrate in kbps * 1000)
                bandwidth = int(res_config['bitrate'].replace('k', '')) * 1000
                
                f.write(f'#EXT-X-STREAM-INF:BANDWIDTH={bandwidth},'
                       f'RESOLUTION={res_config["width"]}x{res_config["height"]}\n')
                f.write(f'{res_key}/playlist.m3u8\n\n')
        
        logger.info(f"Master playlist created: {master_playlist_path}")
        return master_playlist_path
    
    def _upload_hls_to_s3(self, hls_output_dir):
        """Upload all HLS files (playlists and segments) to S3"""
        try:
            video_id = self.video.id
            
            # Upload master playlist
            master_playlist_path = os.path.join(hls_output_dir, 'master.m3u8')
            master_s3_key = f"hls_videos/{video_id}/master.m3u8"
            
            if not self.s3_handler.upload_file(master_playlist_path, master_s3_key, 'application/vnd.apple.mpegurl'):
                return False
            
            self.video.master_playlist_s3_key = master_s3_key
            self.video.save()
            
            logger.info(f"Master playlist uploaded: {master_s3_key}")
            
            # Upload each variant's files
            for variant in self.video.variants.all():
                variant_dir = os.path.join(hls_output_dir, variant.resolution)
                
                # Upload variant playlist
                playlist_path = os.path.join(variant_dir, 'playlist.m3u8')
                if not self.s3_handler.upload_file(
                    playlist_path,
                    variant.playlist_s3_key,
                    'application/vnd.apple.mpegurl'
                ):
                    return False
                
                logger.info(f"Uploaded playlist: {variant.playlist_s3_key}")
                
                # Upload all segment files
                segment_files = sorted(Path(variant_dir).glob('segment_*.ts'))
                for segment_file in segment_files:
                    segment_s3_key = f"{variant.segments_s3_prefix}{segment_file.name}"
                    if not self.s3_handler.upload_file(
                        str(segment_file),
                        segment_s3_key,
                        'video/mp2t'
                    ):
                        return False
                
                logger.info(f"Uploaded {len(segment_files)} segments for {variant.resolution}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error uploading HLS files to S3: {str(e)}")
            return False
