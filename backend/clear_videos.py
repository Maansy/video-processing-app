#!/usr/bin/env python
"""
Clear all videos from database and local storage
Use this to start fresh with S3-only storage
"""
import os
import sys
import django
import shutil

sys.path.append('/Users/mansy/Documents/video-processing-app/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'video_processor.settings')
django.setup()

from videos.models import Video, VideoResolution

def clear_all_videos():
    print("=" * 60)
    print("🗑️  Clear All Videos")
    print("=" * 60)
    
    videos = Video.objects.all()
    print(f"\n📊 Found {videos.count()} videos in database:")
    for v in videos:
        storage = "S3" if v.is_s3_stored else "Local"
        print(f"   • ID: {v.id} - {v.title} ({storage})")
    
    if videos.count() == 0:
        print("\n✨ Database is already empty!")
        return
    
    confirm = input(f"\n⚠️  Delete all {videos.count()} videos? (yes/no): ")
    
    if confirm.lower() != 'yes':
        print("❌ Cancelled. No videos were deleted.")
        return
    
    # Delete from database
    resolution_count = VideoResolution.objects.count()
    videos.delete()
    
    print(f"\n✅ Deleted {videos.count()} videos and {resolution_count} resolutions from database")
    
    # Clean up local media files (optional)
    media_paths = [
        '/Users/mansy/Documents/video-processing-app/media/videos',
        '/Users/mansy/Documents/video-processing-app/media/processed'
    ]
    
    for path in media_paths:
        if os.path.exists(path):
            try:
                shutil.rmtree(path)
                print(f"✅ Deleted local files: {path}")
            except Exception as e:
                print(f"⚠️  Could not delete {path}: {e}")
    
    print(f"\n✨ All videos cleared! Ready for fresh S3 uploads.")

if __name__ == '__main__':
    clear_all_videos()
