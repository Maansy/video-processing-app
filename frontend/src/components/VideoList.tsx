'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Video, VideoResolution } from '@/types/video';

interface VideoListProps {
  onVideoSelect: (video: Video) => void;
  refreshTrigger?: number;
}

export default function VideoList({ onVideoSelect, refreshTrigger }: VideoListProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVideos();
  }, [refreshTrigger]);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('http://localhost:8000/api/videos/');
      setVideos(response.data);
    } catch (err) {
      console.error('Failed to fetch videos:', err);
      setError('Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getCompletedResolutions = (resolutions: VideoResolution[]) => {
    const completed = resolutions.filter(r => r.is_completed);
    return completed.length > 0 ? completed.map(r => r.resolution).join(', ') : 'None';
  };

  if (loading) {
    return (
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Videos</h2>
        <div className="animate-pulse">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Videos</h2>
        <div className="text-red-600 text-center py-4">
          <p>{error}</p>
          <button
            onClick={fetchVideos}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Videos</h2>
        <button
          onClick={fetchVideos}
          className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
        >
          Refresh
        </button>
      </div>

      {videos.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No videos uploaded yet.</p>
          <p className="text-sm">Upload your first video to get started!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {videos.map((video) => (
            <div
              key={video.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onVideoSelect(video)}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold text-gray-900">{video.title}</h3>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(video.processing_status)}
                  <span className="text-xs text-gray-500">v{video.version}</span>
                </div>
              </div>
              
              {video.description && (
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">{video.description}</p>
              )}
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">File:</span>
                  <p className="text-gray-900 truncate">{video.filename}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Size:</span>
                  <p className="text-gray-900">{formatFileSize(video.file_size || 0)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Duration:</span>
                  <p className="text-gray-900">{video.duration ? `${Math.round(video.duration)}s` : 'Unknown'}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Resolutions:</span>
                  <p className="text-gray-900">{getCompletedResolutions(video.resolutions)}</p>
                </div>
              </div>
              
              <div className="mt-3 text-xs text-gray-500">
                Created: {new Date(video.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}