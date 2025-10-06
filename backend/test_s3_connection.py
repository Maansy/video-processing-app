#!/usr/bin/env python
"""
Test S3 connection and credentials
"""
import os
import sys
import django

# Setup Django
sys.path.append('/Users/mansy/Documents/video-processing-app/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'video_processor.settings')
django.setup()

from videos.s3_utils import S3Handler
from django.conf import settings

def test_s3_connection():
    print("=" * 50)
    print("Testing S3 Connection")
    print("=" * 50)
    
    print(f"\n📋 Configuration:")
    print(f"   Bucket: {settings.AWS_STORAGE_BUCKET_NAME}")
    print(f"   Region: {settings.AWS_S3_REGION_NAME}")
    print(f"   Access Key: {settings.AWS_ACCESS_KEY_ID[:10]}...")
    print(f"   Use S3: {settings.USE_S3_STORAGE}")
    
    try:
        s3_handler = S3Handler()
        print(f"\n✅ S3Handler initialized successfully")
        
        # Test generating a presigned URL
        test_key = "test/connection-test.txt"
        print(f"\n📝 Testing presigned URL generation...")
        presigned_data = s3_handler.generate_presigned_upload_url(
            file_key=test_key,
            content_type='text/plain'
        )
        print(f"✅ Presigned URL generated successfully")
        print(f"   URL: {presigned_data['url']}")
        print(f"   Key: {presigned_data['file_key']}")
        
        print(f"\n✨ S3 connection test PASSED!")
        print(f"\n🚀 You're ready to upload videos to S3!")
        
    except Exception as e:
        print(f"\n❌ S3 connection test FAILED!")
        print(f"   Error: {str(e)}")
        print(f"\n💡 Check your credentials in .env file")
        return False
    
    return True

if __name__ == '__main__':
    test_s3_connection()
