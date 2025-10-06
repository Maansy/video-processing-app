from django.db import models
from django.utils import timezone


class HLSVideo(models.Model):
    """Model for HLS videos with adaptive streaming"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    # S3 storage
    s3_key = models.CharField(max_length=500, blank=True, help_text="Original video S3 key")
    master_playlist_s3_key = models.CharField(max_length=500, blank=True, help_text="Master playlist (master.m3u8) S3 key")
    
    # Video metadata
    duration = models.FloatField(null=True, blank=True, help_text="Duration in seconds")
    file_size = models.BigIntegerField(null=True, blank=True, help_text="Original file size in bytes")
    
    # Processing status
    processing_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    processing_started_at = models.DateTimeField(null=True, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'HLS Video'
        verbose_name_plural = 'HLS Videos'
    
    def __str__(self):
        return self.title
    
    @property
    def is_s3_stored(self):
        """Check if original video is stored in S3"""
        return bool(self.s3_key)
    
    @property
    def filename(self):
        """Extract filename from S3 key"""
        if self.s3_key:
            return self.s3_key.split('/')[-1]
        return None


class HLSVariant(models.Model):
    """Model for HLS resolution variants (480p, 720p, 1080p)"""
    
    video = models.ForeignKey(HLSVideo, on_delete=models.CASCADE, related_name='variants')
    resolution = models.CharField(max_length=10, help_text="e.g., 480p, 720p, 1080p")
    
    # Resolution specs
    width = models.IntegerField()
    height = models.IntegerField()
    bitrate = models.CharField(max_length=20, help_text="e.g., 1000k, 2500k")
    
    # S3 storage
    playlist_s3_key = models.CharField(max_length=500, blank=True, help_text="Variant playlist S3 key")
    segments_s3_prefix = models.CharField(max_length=500, blank=True, help_text="S3 prefix for .ts segments")
    
    # Segment info
    segment_duration = models.IntegerField(default=10, help_text="Segment duration in seconds")
    segment_count = models.IntegerField(default=0, help_text="Number of segments")
    
    # Processing timestamps
    processing_started_at = models.DateTimeField(null=True, blank=True)
    processing_completed_at = models.DateTimeField(null=True, blank=True)
    processing_failed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    
    class Meta:
        ordering = ['width']  # Order by resolution (480p, 720p, 1080p)
        unique_together = ['video', 'resolution']
        verbose_name = 'HLS Variant'
        verbose_name_plural = 'HLS Variants'
    
    def __str__(self):
        return f"{self.video.title} - {self.resolution}"
    
    @property
    def is_completed(self):
        return bool(self.processing_completed_at)
    
    @property
    def is_failed(self):
        return bool(self.processing_failed_at)

