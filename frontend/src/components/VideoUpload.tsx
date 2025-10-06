'use client';

import React, { useState } from 'react';
import axios from 'axios';
import { Video } from '@/types/video';

interface VideoUploadProps {
  onUploadSuccess: (video: Video) => void;
}

export default function VideoUpload({ onUploadSuccess }: VideoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<'idle' | 'uploading' | 'processing'>('idle');

  const downloadErrorLogs = () => {
    const logs = localStorage.getItem('uploadErrorLogs') || '[]';
    const blob = new Blob([logs], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `upload-error-logs-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearErrorLogs = () => {
    if (confirm('Are you sure you want to clear all error logs?')) {
      localStorage.removeItem('uploadErrorLogs');
      alert('Error logs cleared');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const logError = async (stage: string, error: unknown, details?: Record<string, unknown>) => {
    const axiosError = error as {
      message?: string;
      name?: string;
      stack?: string;
      response?: {
        status: number;
        statusText: string;
        data: unknown;
        headers: Record<string, string>;
      };
      request?: unknown;
      config?: {
        url?: string;
        method?: string;
        baseURL?: string;
        headers?: Record<string, string>;
      };
    };

    const errorLog = {
      timestamp: new Date().toISOString(),
      stage,
      error: {
        message: axiosError?.message || 'Unknown error',
        name: axiosError?.name || 'Error',
        stack: axiosError?.stack || '',
        response: axiosError?.response ? {
          status: axiosError.response.status,
          statusText: axiosError.response.statusText,
          data: axiosError.response.data,
          headers: axiosError.response.headers,
        } : null,
        request: axiosError?.request ? {
          url: axiosError.config?.url,
          method: axiosError.config?.method,
          headers: axiosError.config?.headers,
        } : null,
        config: axiosError?.config ? {
          url: axiosError.config.url,
          method: axiosError.config.method,
          baseURL: axiosError.config.baseURL,
          headers: axiosError.config.headers,
        } : null,
      },
      details,
    };

    console.error('=== ERROR LOG ===');
    console.error(JSON.stringify(errorLog, null, 2));
    console.error('=== END ERROR LOG ===');

    // Save to localStorage for persistence
    try {
      const logs = JSON.parse(localStorage.getItem('uploadErrorLogs') || '[]');
      logs.push(errorLog);
      // Keep only last 50 logs
      if (logs.length > 50) logs.shift();
      localStorage.setItem('uploadErrorLogs', JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to save error log to localStorage:', e);
    }
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
      console.log('Step 1: Requesting presigned URL...');
      console.log('Request details:', {
        url: 'http://localhost:8000/api/videos/get-upload-url/',
        method: 'POST',
        data: {
          filename: file.name,
          content_type: file.type || 'video/mp4',
          title: title,
          description: description,
        }
      });

      const urlResponse = await axios.post(
        'http://localhost:8000/api/videos/get-upload-url/',
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
      console.log('Received upload URL for video ID:', video_id);
      console.log('S3 upload URL:', upload_data.url);

      // Step 2: Upload directly to S3
      console.log('Step 2: Uploading to S3...');
      const formData = new FormData();
      
      // Add all fields from presigned POST
      Object.keys(upload_data.fields).forEach(key => {
        formData.append(key, upload_data.fields[key]);
      });
      
      // Add the file last
      formData.append('file', file);

      console.log('S3 upload details:', {
        url: upload_data.url,
        fields: upload_data.fields,
        fileSize: file.size,
      });

      // Upload to S3
      const s3Response = await axios.post(upload_data.url, formData, {
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
      console.log('S3 response status:', s3Response.status);

      // Step 3: Confirm upload and trigger processing
      console.log('Step 3: Confirming upload and starting processing...');
      setUploadStage('processing');
      setProgress(0);
      
      const confirmResponse = await axios.post(
        `http://localhost:8000/api/videos/${video_id}/confirm-upload/`,
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

      console.log('Processing started!');
      onUploadSuccess(confirmResponse.data);
      
      // Reset form
      setTitle('');
      setDescription('');
      setFile(null);
      setProgress(0);
      setUploadStage('idle');
      
      // Reset file input
      const fileInput = document.getElementById('video-file') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      
      alert('Video uploaded successfully and processing has started!');
      
    } catch (error: unknown) {
      console.error('Upload failed:', error);
      
      const axiosError = error as {
        message?: string;
        config?: {
          url?: string;
        };
        response?: {
          status: number;
          statusText: string;
          data: unknown;
        };
        request?: unknown;
      };

      // Determine which stage failed
      let stage = 'unknown';
      if (uploadStage === 'uploading') {
        stage = axiosError?.config?.url?.includes('s3') ? 'S3 Upload' : 'Get Presigned URL';
      } else if (uploadStage === 'processing') {
        stage = 'Confirm Upload';
      }

      // Log detailed error
      await logError(stage, error, {
        uploadStage,
        filename: file.name,
        fileSize: file.size,
        fileType: file.type,
        title,
      });

      // User-friendly error message
      let errorMessage = 'Unknown error';
      if (axiosError?.message === 'Network Error') {
        errorMessage = 'Network Error - Please check:\n1. Backend is running (http://localhost:8000)\n2. CORS is configured on S3 bucket\n3. Browser cache is cleared (Cmd+Shift+R)\n\nCheck console for detailed logs.';
      } else if (axiosError?.response) {
        errorMessage = `Server error (${axiosError.response.status}): ${axiosError.response.statusText}\n${JSON.stringify(axiosError.response.data)}`;
      } else if (axiosError?.request) {
        errorMessage = 'No response from server - check if backend is running';
      } else {
        errorMessage = axiosError?.message || 'Unknown error';
      }
      
      alert(`Upload failed: ${errorMessage}`);
    } finally {
      setUploading(false);
      setProcessing(false);
      setUploadStage('idle');
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Upload Video to S3</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={downloadErrorLogs}
            className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
          >
            Download Logs
          </button>
          <button
            type="button"
            onClick={clearErrorLogs}
            className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
          >
            Clear Logs
          </button>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            Title *
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="video-file" className="block text-sm font-medium text-gray-700 mb-2">
            Video File *
          </label>
          <input
            type="file"
            id="video-file"
            accept="video/*"
            onChange={handleFileChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          {file && (
            <p className="text-sm text-gray-500 mt-1">
              Selected: {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
            </p>
          )}
        </div>

        {uploadStage !== 'idle' && (
          <div className="space-y-2">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600">
              {uploadStage === 'uploading' && `Uploading to S3: ${progress}%`}
              {uploadStage === 'processing' && 'Starting video processing...'}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={uploading || !file || !title}
          className={`w-full py-2 px-4 rounded-md font-medium ${
            uploading || !file || !title
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          } text-white transition-colors`}
        >
          {uploading ? (uploadStage === 'uploading' ? 'Uploading to S3...' : 'Processing...') : 'Upload Video'}
        </button>
      </form>
    </div>
  );
}