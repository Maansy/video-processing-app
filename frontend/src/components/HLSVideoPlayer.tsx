'use client';

import React, { useEffect, useRef, useState } from 'react';

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
  master_playlist_url: string | null;
  variants: HLSVariant[];
  processing_status: string;
}

interface HLSVideoPlayerProps {
  video: HLSVideo | null;
  onClose: () => void;
}

export default function HLSVideoPlayer({ video, onClose }: HLSVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!video || !videoRef.current) return;

    const videoElement = videoRef.current;

    // Check if browser supports HLS natively (Safari)
    if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      console.log('Native HLS support detected (Safari)');
      if (video.master_playlist_url) {
        videoElement.src = video.master_playlist_url;
      }
    } else {
      // For other browsers, we would need hls.js
      console.log('Native HLS not supported, would need hls.js library');
      setError('HLS playback requires hls.js library for this browser. Please install: npm install hls.js');
    }

    return () => {
      if (videoElement) {
        videoElement.src = '';
      }
    };
  }, [video]);

  if (!video) return null;

  if (video.processing_status !== 'completed') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <h3 className="text-xl font-bold mb-4 text-purple-900">Processing in Progress</h3>
          <p className="text-gray-600 mb-4">
            This video is still being processed into HLS format. Please wait 10-15 minutes and refresh the page.
          </p>
          <div className="flex items-center gap-2 text-blue-600 mb-6">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Processing: {video.processing_status}</span>
          </div>
          <button
            onClick={onClose}
            className="w-full bg-purple-600 text-white py-2 rounded-md hover:bg-purple-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-purple-200">
          <div>
            <h2 className="text-2xl font-bold text-purple-900">{video.title}</h2>
            {video.description && (
              <p className="text-gray-600 mt-2">{video.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Video Player */}
        <div className="p-6">
          {error ? (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>⚠️ HLS.js Required:</strong> {error}
              </p>
              <p className="text-xs text-yellow-700 mt-2">
                For now, you can test with Safari browser which has native HLS support,
                or we can install hls.js library for cross-browser compatibility.
              </p>
            </div>
          ) : null}

          <div className="bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              controls
              className="w-full"
              style={{ maxHeight: '60vh' }}
            >
              Your browser does not support the video tag.
            </video>
          </div>

          {/* HLS Info */}
          <div className="mt-6 bg-purple-50 rounded-lg p-4">
            <h3 className="font-semibold text-purple-900 mb-3">🎬 HLS Adaptive Streaming Info</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Master Playlist:</p>
                <p className="text-xs font-mono bg-white p-2 rounded mt-1 truncate">
                  {video.master_playlist_url ? 'Available' : 'Not available'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Available Variants:</p>
                <p className="text-sm font-semibold mt-1">{video.variants.length} quality levels</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Quality Levels:</p>
              {video.variants.map((variant) => (
                <div
                  key={variant.id}
                  className="flex justify-between items-center bg-white p-3 rounded"
                >
                  <div>
                    <span className="font-semibold text-purple-700">{variant.resolution}</span>
                    <span className="text-sm text-gray-600 ml-2">
                      ({variant.width}×{variant.height})
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">
                      Bitrate: {variant.bitrate}
                    </div>
                    <div className="text-xs text-gray-500">
                      {variant.segment_count} segments
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
              <p className="text-xs text-blue-800">
                <strong>💡 How it works:</strong> The player automatically switches between quality levels 
                based on your internet speed. Slow connection = lower quality (480p). Fast connection = highest quality (1080p).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
