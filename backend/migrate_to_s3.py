#!/usr/bin/env python
"""
Migrate existing local videos to S3
This will upload your current videos to S3 and update the database
"""
import os
import sys
import django

sys.path.append('/Users/mansy/Documents/video-processing-app/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'video_processor.settings')
django.setup()

from videos.models import Video, VideoResolution
from videos.s3_utils import S3Handler
from django.conf import settings

def migrate_videos_to_s3():
    print("=" * 60)
    print("📦 Migrate Local Videos to S3")
    print("=" * 60)
    
    s3_handler = S3Handler()
    videos = Video.objects.filter(s3_key__isnull=True)  # Only local videos
    
    print(f"\n📊 Found {videos.count()} local videos to migrate:")
    for v in videos:
        print(f"   • ID: {v.id} - {v.title}")
    
    if videos.count() == 0:
        print("\n✨ No local videos to migrate!")
        return
    
    confirm = input(f"\n📤 Migrate {videos.count()} videos to S3? (yes/no): ")
    
    if confirm.lower() != 'yes':
        print("❌ Cancelled.")
        return
    
    print("\n🚀 Starting migration...\n")
    
    for video in videos:
        try:
            print(f"📹 Processing: {video.title}")
            
            # Upload original video
            if video.original_file:
                local_path = video.original_file.path
                if os.path.exists(local_path):
                    filename = os.path.basename(local_path)
                    s3_key = f"videos/originals/migrated_{video.id}_{filename}"
                    
                    print(f"   ⬆️  Uploading original to S3...")
                    success = s3_handler.upload_file(local_path, s3_key, 'video/mp4')
                    
                    if success:
                        video.s3_key = s3_key
                        video.save()
                        print(f"   ✅ Original uploaded: {s3_key}")
                    else:
                        print(f"   ❌ Failed to upload original")
                        continue
            
            # Upload processed resolutions
            for resolution in video.resolutions.all():
                if resolution.file_path:
                    local_path = os.path.join(settings.MEDIA_ROOT, resolution.file_path)
                    if os.path.exists(local_path):
                        filename = os.path.basename(local_path)
                        s3_key = f"videos/processed/{video.id}/{resolution.resolution}/migrated_{filename}"
                        
                        print(f"   ⬆️  Uploading {resolution.resolution}...")
                        success = s3_handler.upload_file(local_path, s3_key, 'video/mp4')
                        
                        if success:
                            resolution.s3_key = s3_key
                            resolution.save()
                            print(f"   ✅ {resolution.resolution} uploaded")
                        else:
                            print(f"   ⚠️  Failed to upload {resolution.resolution}")
            
            print(f"   🎉 Completed: {video.title}\n")
            
        except Exception as e:
            print(f"   ❌ Error: {str(e)}\n")
    
    print("✨ Migration complete!")
    print(f"\n📊 Summary:")
    s3_videos = Video.objects.filter(s3_key__isnull=False).count()
    local_videos = Video.objects.filter(s3_key__isnull=True).count()
    print(f"   S3 videos: {s3_videos}")
    print(f"   Local videos: {local_videos}")

if __name__ == '__main__':
    migrate_videos_to_s3()
