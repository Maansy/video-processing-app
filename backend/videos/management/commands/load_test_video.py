from django.core.management.base import BaseCommand
from django.core.files import File
from videos.models import Video
import os
import shutil


class Command(BaseCommand):
    help = 'Load test video into the database'
    
    def handle(self, *args, **options):
        # Path to your test video
        video_path = '/Users/mansy/Documents/stearming/video-processing-app/media/videos/EY-EG 106 - carer coach preparing - ahmed hagag.mp4'
        
        if not os.path.exists(video_path):
            self.stdout.write(
                self.style.ERROR(f'Video file not found at: {video_path}')
            )
            return
        
        # Check if video already exists
        if Video.objects.filter(title='Test Video - Ahmed Hagag').exists():
            self.stdout.write(
                self.style.WARNING('Test video already exists in database')
            )
            return
        
        # Create video record
        video = Video.objects.create(
            title='Test Video - Ahmed Hagag',
            description='Test video for demonstrating video processing with multiple resolutions'
        )
        
        # Create the upload directory if it doesn't exist
        upload_dir = os.path.join(os.path.dirname(video_path), '..', 'videos', 'original')
        os.makedirs(upload_dir, exist_ok=True)
        
        # Copy file to upload directory
        filename = os.path.basename(video_path)
        upload_path = os.path.join(upload_dir, filename)
        shutil.copy2(video_path, upload_path)
        
        # Set the file field
        with open(upload_path, 'rb') as f:
            video.original_file.save(filename, File(f), save=True)
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully created video: {video.title} (ID: {video.id})')
        )
        self.stdout.write(
            self.style.SUCCESS(f'File saved to: {video.original_file.path}')
        )