import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from django.conf import settings
import logging
import os

logger = logging.getLogger(__name__)


class S3Handler:
    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_S3_REGION_NAME,
            config=Config(
                signature_version='s3v4',
                s3={'addressing_style': 'virtual'}
            )
        )
        self.bucket_name = settings.AWS_STORAGE_BUCKET_NAME
        self.region_name = settings.AWS_S3_REGION_NAME
    
    def generate_presigned_upload_url(self, file_key, content_type='video/mp4', expiration=3600):
        """
        Generate a presigned URL for uploading a file to S3
        
        Args:
            file_key: S3 object key (path/filename)
            content_type: MIME type of the file
            expiration: URL expiration time in seconds
            
        Returns:
            dict: Contains 'url' and 'fields' for POST upload, or 'upload_url' for PUT upload
        """
        try:
            # Generate presigned POST URL (recommended for browser uploads)
            response = self.s3_client.generate_presigned_post(
                Bucket=self.bucket_name,
                Key=file_key,
                Fields={'Content-Type': content_type},
                Conditions=[
                    {'Content-Type': content_type},
                    ['content-length-range', 1, 5368709120]  # 5GB max
                ],
                ExpiresIn=expiration
            )
            
            logger.info(f"Generated presigned upload URL for: {file_key}")
            return {
                'type': 'POST',
                'url': response['url'],
                'fields': response['fields'],
                'file_key': file_key
            }
            
        except ClientError as e:
            logger.error(f"Error generating presigned URL: {str(e)}")
            raise
    
    def generate_presigned_download_url(self, file_key, expiration=3600):
        """
        Generate a presigned URL for downloading a file from S3
        
        Args:
            file_key: S3 object key (path/filename)
            expiration: URL expiration time in seconds
            
        Returns:
            str: Presigned download URL
        """
        try:
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': file_key
                },
                ExpiresIn=expiration
            )
            
            logger.info(f"Generated presigned download URL for: {file_key}")
            return url
            
        except ClientError as e:
            logger.error(f"Error generating download URL: {str(e)}")
            raise
    
    def upload_file(self, file_path, s3_key, content_type='video/mp4'):
        """
        Upload a file directly to S3 from server
        
        Args:
            file_path: Local file path
            s3_key: S3 object key (destination)
            content_type: MIME type of the file
            
        Returns:
            bool: True if successful
        """
        try:
            extra_args = {
                'ContentType': content_type,
            }
            
            self.s3_client.upload_file(
                file_path,
                self.bucket_name,
                s3_key,
                ExtraArgs=extra_args
            )
            
            logger.info(f"Uploaded file to S3: {s3_key}")
            return True
            
        except ClientError as e:
            logger.error(f"Error uploading file to S3: {str(e)}")
            return False
    
    def download_file(self, s3_key, local_path):
        """
        Download a file from S3 to local storage
        
        Args:
            s3_key: S3 object key (source)
            local_path: Local file path (destination)
            
        Returns:
            bool: True if successful
        """
        try:
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            
            self.s3_client.download_file(
                self.bucket_name,
                s3_key,
                local_path
            )
            
            logger.info(f"Downloaded file from S3: {s3_key} to {local_path}")
            return True
            
        except ClientError as e:
            logger.error(f"Error downloading file from S3: {str(e)}")
            return False
    
    def delete_file(self, s3_key):
        """
        Delete a file from S3
        
        Args:
            s3_key: S3 object key to delete
            
        Returns:
            bool: True if successful
        """
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            
            logger.info(f"Deleted file from S3: {s3_key}")
            return True
            
        except ClientError as e:
            logger.error(f"Error deleting file from S3: {str(e)}")
            return False
    
    def file_exists(self, s3_key):
        """
        Check if a file exists in S3
        
        Args:
            s3_key: S3 object key to check
            
        Returns:
            bool: True if file exists
        """
        try:
            self.s3_client.head_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            return True
            
        except ClientError:
            return False
    
    def get_file_size(self, s3_key):
        """
        Get the size of a file in S3
        
        Args:
            s3_key: S3 object key
            
        Returns:
            int: File size in bytes, or None if error
        """
        try:
            response = self.s3_client.head_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            return response['ContentLength']
            
        except ClientError as e:
            logger.error(f"Error getting file size from S3: {str(e)}")
            return None
    
    def get_public_url(self, s3_key):
        """
        Get the public URL for an S3 object (if bucket allows public access)
        
        Args:
            s3_key: S3 object key
            
        Returns:
            str: Public URL
        """
        return f"https://{self.bucket_name}.s3.{settings.AWS_S3_REGION_NAME}.amazonaws.com/{s3_key}"
