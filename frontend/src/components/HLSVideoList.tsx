'use client';

import React from 'react';

interface HLSVariant {
  id: number;
  resolution: string;
  width: number;
  height: number;
  bitrate: string;
  segment_count: number;
  stream_url: string | null;
}

interface HLSVideo {
  id: number;
  title: string;
  description: string;
  duration: number | null;
  file_size: number | null;
  processing_status: string;
  master_playlist_url: string | null;
  variants: HLSVariant[];
  created_at: string;
  processed_at: string | null;
}

interface HLSVideoListProps {
  videos: HLSVideo[];
  onSelectVideo: (video: HLSVideo) => void;
}

export default function HLSVideoList({ videos, onSelectVideo }: HLSVideoListProps) {
  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    };
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800';
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-4 text-purple-900">HLS Videos (Adaptive Streaming)</h2>
      
      {videos.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="text-lg mb-2">No HLS videos uploaded yet</p>
          <p className="text-sm">Upload a video above to get started with adaptive streaming</p>
        </div>
      ) : (
        <div className="space-y-4">
          {videos.map((video) => (
            <div
              key={video.id}
              className="border border-purple-200 rounded-lg p-4 hover:bg-purple-50 transition-colors cursor-pointer"
              onClick={() => onSelectVideo(video)}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-purple-900">{video.title}</h3>
                  {video.description && (
                    <p className="text-sm text-gray-600 mt-1">{video.description}</p>
                  )}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(video.processing_status)}`}>
                  {video.processing_status}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                <div>
                  <span className="text-gray-500">Duration:</span>
                  <span className="ml-2 font-medium">{formatDuration(video.duration)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Size:</span>
                  <span className="ml-2 font-medium">{formatFileSize(video.file_size)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Variants:</span>
                  <span className="ml-2 font-medium">{video.variants?.length || 0}</span>
                </div>
                <div>
                  <span className="text-gray-500">Uploaded:</span>
                  <span className="ml-2 font-medium">
                    {new Date(video.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {video.processing_status === 'completed' && video.variants?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-purple-100">
                  <p className="text-xs text-gray-600 mb-2">Available Qualities:</p>
                  <div className="flex flex-wrap gap-2">
                    {video.variants.map((variant) => (
                      <span
                        key={variant.id}
                        className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium"
                      >
                        {variant.resolution} ({variant.width}×{variant.height}) - {variant.segment_count} segments
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {video.processing_status === 'processing' && (
                <div className="mt-3 pt-3 border-t border-blue-100">
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Processing HLS variants... This will take 10-15 minutes</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
