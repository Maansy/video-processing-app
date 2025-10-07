'use client';

import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

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
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    if (!video || !videoRef.current || !video.master_playlist_url) return;

    const videoElement = videoRef.current;
    const videoSrc = video.master_playlist_url;

    // Check if browser supports HLS natively (Safari)
    if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      console.log('✅ Native HLS support detected (Safari)');
      videoElement.src = videoSrc;
      setError(null);
    } else if (Hls.isSupported()) {
      // Use hls.js for other browsers (Chrome, Firefox, Edge)
      console.log('✅ Using hls.js for HLS playback');
      
      const hls = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: false,
      });
      
      hlsRef.current = hls;
      
      hls.loadSource(videoSrc);
      hls.attachMedia(videoElement);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('✅ HLS manifest loaded successfully');
        setError(null);
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('❌ HLS error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('Network error, trying to recover...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Media error, trying to recover...');
              hls.recoverMediaError();
              break;
            default:
              setError(`Fatal error: ${data.details}`);
              hls.destroy();
              break;
          }
        }
      });
    } else {
      console.log('❌ HLS not supported');
      setError('Your browser does not support HLS playback');
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
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
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
              <p className="text-sm text-red-800">
                <strong>❌ Playback Error:</strong> {error}
              </p>
              <p className="text-xs text-red-700 mt-2">
                Please try using a modern browser (Chrome, Firefox, Safari, Edge).
              </p>
            </div>
          )}

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

          {/* Browser Compatibility Info */}
          <div className="mt-4 p-3 bg-green-50 rounded border border-green-200">
            <p className="text-xs text-green-800">
              <strong>✅ Browser Support:</strong> This player works with Chrome, Firefox, Safari, and Edge using hls.js library.
            </p>
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
