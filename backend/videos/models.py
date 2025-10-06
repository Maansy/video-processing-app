from django.db import models
from django.utils import timezone
import os


class Video(models.Model):
    PROCESSING_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    original_file = models.FileField(upload_to='videos/original/', blank=True, null=True)
    s3_key = models.CharField(max_length=500, blank=True, null=True, help_text="S3 object key for original file")
    file_size = models.BigIntegerField(null=True, blank=True)
    duration = models.FloatField(null=True, blank=True)  # in seconds
    
    # Processing status
    processing_status = models.CharField(
        max_length=20,
        choices=PROCESSING_STATUS_CHOICES,
        default='pending'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    
    # Version control
    version = models.IntegerField(default=1)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.title} (v{self.version})"
    
    @property
    def filename(self):
        if self.original_file:
            return os.path.basename(self.original_file.name)
        elif self.s3_key:
            return os.path.basename(self.s3_key)
        return "unknown"
    
    @property
    def is_s3_stored(self):
        """Check if video is stored in S3"""
        return bool(self.s3_key)


class VideoResolution(models.Model):
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name='resolutions')
    resolution = models.CharField(max_length=10)  # e.g., '720p', '1080p'
    file_path = models.CharField(max_length=500, blank=True, null=True)  # relative path to processed file (local)
    s3_key = models.CharField(max_length=500, blank=True, null=True, help_text="S3 object key for processed file")
    file_size = models.BigIntegerField(null=True, blank=True)
    bitrate = models.CharField(max_length=20, null=True, blank=True)
    width = models.IntegerField()
    height = models.IntegerField()
    
    # Processing info
    processing_started_at = models.DateTimeField(null=True, blank=True)
    processing_completed_at = models.DateTimeField(null=True, blank=True)
    processing_failed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(null=True, blank=True)
    
    class Meta:
        unique_together = ['video', 'resolution']
        ordering = ['width']
    
    def __str__(self):
        return f"{self.video.title} - {self.resolution}"
    
    @property
    def is_processing(self):
        return self.processing_started_at and not self.processing_completed_at and not self.processing_failed_at
    
    @property
    def is_completed(self):
        return self.processing_completed_at is not None
    
    @property
    def is_failed(self):
        return self.processing_failed_at is not None
    
    @property
    def is_s3_stored(self):
        """Check if this resolution is stored in S3"""
        return bool(self.s3_key)


class VideoVersion(models.Model):
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name='versions')
    version_number = models.IntegerField()
    file_path = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)
    is_current = models.BooleanField(default=False)
    
    class Meta:
        unique_together = ['video', 'version_number']
        ordering = ['-version_number']
    
    def __str__(self):
        return f"{self.video.title} - Version {self.version_number}"
