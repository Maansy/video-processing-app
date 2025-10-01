'use client';

import React, { useState } from 'react';
import VideoUpload from '@/components/VideoUpload';
import VideoList from '@/components/VideoList';
import VideoPlayer from '@/components/VideoPlayer';
import { Video } from '@/types/video';

export default function Home() {
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadSuccess = (video: Video) => {
    setSelectedVideo(video);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleVideoSelect = (video: Video) => {
    setSelectedVideo(video);
  };

  const handleVideoReprocess = () => {
    // Refresh the video list and selected video after reprocessing
    setRefreshTrigger(prev => prev + 1);
    if (selectedVideo) {
      // In a real app, you might want to fetch the updated video data
      setSelectedVideo(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Video Processing Platform
          </h1>
          <p className="text-gray-600">
            Upload videos and automatically generate multiple resolutions for optimal streaming
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Upload and List */}
          <div className="space-y-6">
            <VideoUpload onUploadSuccess={handleUploadSuccess} />
            <VideoList 
              onVideoSelect={handleVideoSelect} 
              refreshTrigger={refreshTrigger}
            />
          </div>

          {/* Right Column - Video Player */}
          <div>
            {selectedVideo ? (
              <VideoPlayer 
                video={selectedVideo} 
                onReprocess={handleVideoReprocess}
                username="Ahmed Hagag" // You can make this dynamic later
              />
            ) : (
              <div className="bg-white shadow-md rounded-lg p-6 h-96 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <svg 
                    className="mx-auto h-12 w-12 mb-4" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" 
                    />
                  </svg>
                  <h3 className="text-lg font-medium mb-2">No Video Selected</h3>
                  <p>Upload a video or select one from the list to start watching</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
