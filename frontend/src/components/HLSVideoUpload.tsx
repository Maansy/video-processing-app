'use client';

import React, { useState } from 'react';
import axios from 'axios';

interface HLSVideo {
  id: number;
  title: string;
  description: string;
  duration: number | null;
  file_size: number | null;
  processing_status: string;
  master_playlist_url: string | null;
  variants: Array<{
    id: number;
    resolution: string;
    width: number;
    height: number;
    bitrate: string;
    segment_count: number;
    stream_url: string | null;
  }>;
  created_at: string;
  processed_at: string | null;
}

interface HLSVideoUploadProps {
  onUploadSuccess: (video: HLSVideo) => void;
}

export default function HLSVideoUpload({ onUploadSuccess }: HLSVideoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<'idle' | 'uploading' | 'processing'>('idle');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const logError = async (stage: string, error: unknown) => {
    const errorLog = {
      timestamp: new Date().toISOString(),
      stage,
      error: JSON.stringify(error, null, 2),
    };

    console.error('=== HLS ERROR LOG ===');
    console.error(JSON.stringify(errorLog, null, 2));
    console.error('=== END ERROR LOG ===');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file || !title) {
      alert('Please fill in all required fields');
      return;
    }

    setUploading(true);
    setProgress(0);
    setUploadStage('uploading');

    try {
      // Step 1: Get presigned upload URL from backend
      console.log('Step 1: Requesting presigned URL for HLS...');
      const urlResponse = await axios.post(
        'http://localhost:8000/api/hls-videos/get-upload-url/',
        {
          filename: file.name,
          content_type: file.type || 'video/mp4',
          title: title,
          description: description,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const { video_id, upload_data, s3_key } = urlResponse.data;
      console.log('Received HLS upload URL for video ID:', video_id);

      // Step 2: Upload directly to S3
      console.log('Step 2: Uploading to S3...');
      const formData = new FormData();
      
      // Add all fields from presigned POST
      Object.keys(upload_data.fields).forEach(key => {
        formData.append(key, upload_data.fields[key]);
      });
      
      // Add the file last
      formData.append('file', file);

      // Upload to S3
      await axios.post(upload_data.url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setProgress(percentCompleted);
            console.log(`Upload progress: ${percentCompleted}%`);
          }
        },
      });

      console.log('Upload to S3 completed!');

      // Step 3: Confirm upload and trigger HLS processing
      console.log('Step 3: Confirming upload and starting HLS processing...');
      setUploadStage('processing');
      setProgress(0);
      
      const confirmResponse = await axios.post(
        `http://localhost:8000/api/hls-videos/${video_id}/confirm-upload/`,
        {
          s3_key: s3_key,
          file_size: file.size,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('HLS Processing started!');
      onUploadSuccess(confirmResponse.data);
      
      // Reset form
      setTitle('');
      setDescription('');
      setFile(null);
      setProgress(0);
      setUploadStage('idle');
      
      // Reset file input
      const fileInput = document.getElementById('hls-video-file') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      
      alert('Video uploaded successfully! HLS processing will take 10-15 minutes for adaptive streaming.');
      
    } catch (error: unknown) {
      console.error('HLS Upload failed:', error);
      
      const stage = uploadStage === 'uploading' ? 'HLS Upload' : 'HLS Processing';
      await logError(stage, error);

      const axiosError = error as {
        message?: string;
        response?: {
          status: number;
          statusText: string;
          data: unknown;
        };
      };

      let errorMessage = 'Unknown error';
      if (axiosError?.message === 'Network Error') {
        errorMessage = 'Network Error - Check console for detailed logs.';
      } else if (axiosError?.response) {
        errorMessage = `Server error (${axiosError.response.status}): ${axiosError.response.statusText}`;
      } else {
        errorMessage = axiosError?.message || 'Unknown error';
      }
      
      alert(`HLS Upload failed: ${errorMessage}`);
    } finally {
      setUploading(false);
      setUploadStage('idle');
    }
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 shadow-lg rounded-lg p-6 mb-6 border-2 border-purple-200">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-purple-600 text-white px-4 py-2 rounded-full text-sm font-bold">
          HLS
        </div>
        <h2 className="text-2xl font-bold text-purple-900">Upload Video for HLS Streaming</h2>
      </div>
      
      <div className="bg-purple-100 border-l-4 border-purple-600 p-4 mb-4">
        <p className="text-sm text-purple-900">
          <strong>🚀 HLS (Adaptive Streaming):</strong> Video will be converted into multiple quality levels (480p, 720p, 1080p) 
          with automatic quality switching based on internet speed. Processing takes 10-15 minutes.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="hls-title" className="block text-sm font-medium text-gray-700 mb-2">
            Title *
          </label>
          <input
            type="text"
            id="hls-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
          />
        </div>

        <div>
          <label htmlFor="hls-description" className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            id="hls-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div>
          <label htmlFor="hls-video-file" className="block text-sm font-medium text-gray-700 mb-2">
            Video File *
          </label>
          <input
            type="file"
            id="hls-video-file"
            accept="video/*"
            onChange={handleFileChange}
            className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
          />
          {file && (
            <p className="text-sm text-gray-600 mt-1">
              Selected: {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
            </p>
          )}
        </div>

        {uploadStage !== 'idle' && (
          <div className="space-y-2">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600">
              {uploadStage === 'uploading' && `Uploading to S3: ${progress}%`}
              {uploadStage === 'processing' && 'Starting HLS processing (this will take 10-15 minutes)...'}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={uploading || !file || !title}
          className={`w-full py-3 px-4 rounded-md font-medium ${
            uploading || !file || !title
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700'
          } text-white transition-colors`}
        >
          {uploading ? (uploadStage === 'uploading' ? 'Uploading to S3...' : 'Starting HLS Processing...') : 'Upload for HLS Streaming'}
        </button>
      </form>
    </div>
  );
}
