'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import HLSVideoUpload from '@/components/HLSVideoUpload';
import HLSVideoList from '@/components/HLSVideoList';
import HLSVideoPlayer from '@/components/HLSVideoPlayer';
import Link from 'next/link';

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

export default function HLSPage() {
  const [videos, setVideos] = useState<HLSVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<HLSVideo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchVideos = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/hls-videos/');
      setVideos(response.data);
    } catch (error) {
      console.error('Error fetching HLS videos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchVideos, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleUploadSuccess = (video: HLSVideo) => {
    setVideos([video, ...videos]);
  };

  const handleSelectVideo = (video: HLSVideo) => {
    setSelectedVideo(video);
  };

  const handleClosePlayer = () => {
    setSelectedVideo(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-blue-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-6 shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">🎬 HLS Video Streaming</h1>
              <p className="text-purple-100 mt-1">Adaptive bitrate streaming with automatic quality switching</p>
            </div>
            <Link
              href="/"
              className="bg-white text-purple-600 px-4 py-2 rounded-md font-medium hover:bg-purple-50 transition-colors"
            >
              ← Regular Videos
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Section */}
          <div className="lg:col-span-1">
            <HLSVideoUpload onUploadSuccess={handleUploadSuccess} />
            
            {/* Info Card */}
            <div className="mt-6 bg-white rounded-lg p-6 shadow-md">
              <h3 className="font-bold text-lg mb-3 text-purple-900">🚀 HLS Benefits</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Automatic quality adaptation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Faster playback start time</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Better buffering prevention</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Mobile-friendly streaming</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>3 quality levels (480p, 720p, 1080p)</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Video List Section */}
          <div className="lg:col-span-2">
            {loading ? (
              <div className="bg-white rounded-lg p-12 text-center shadow-md">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
                <p className="mt-4 text-gray-600">Loading HLS videos...</p>
              </div>
            ) : (
              <HLSVideoList videos={videos} onSelectVideo={handleSelectVideo} />
            )}
          </div>
        </div>
      </div>

      {/* Video Player Modal */}
      {selectedVideo && (
        <HLSVideoPlayer video={selectedVideo} onClose={handleClosePlayer} />
      )}
    </div>
  );
}
