'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Video, VideoResolution } from '@/types/video';

interface VideoPlayerProps {
  video: Video;
  onReprocess?: () => void;
  username?: string;
}

export default function VideoPlayer({ video, onReprocess, username = "User" }: VideoPlayerProps) {
  const [selectedResolution, setSelectedResolution] = useState<string>('original');
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [reprocessing, setReprocessing] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [wasPlaying, setWasPlaying] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [blurVideo, setBlurVideo] = useState(false);
  const [watermarkPosition, setWatermarkPosition] = useState({ x: 20, y: 20 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showEnhancedWatermarks, setShowEnhancedWatermarks] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Update video URL when resolution changes
  React.useEffect(() => {
    // Save current time and playing state before changing URL
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setWasPlaying(!videoRef.current.paused);
    }
    
    let newUrl;
    // Add cache-busting parameter to ensure fresh load
    const timestamp = Date.now();
    if (selectedResolution === 'original') {
      newUrl = `http://localhost:8000/api/videos/${video.id}/stream/?t=${timestamp}`;
    } else {
      newUrl = `http://localhost:8000/api/videos/${video.id}/stream/${selectedResolution}/?t=${timestamp}`;
    }
    
    console.log('Updating video URL:', {
      selectedResolution,
      videoId: video.id,
      newUrl,
      wasPlaying: videoRef.current ? !videoRef.current.paused : false,
      currentTime: videoRef.current?.currentTime || 0
    });
    
    setVideoUrl(newUrl);
  }, [selectedResolution, video.id]);

  // Force video reload when URL changes
  useEffect(() => {
    if (videoRef.current && videoUrl) {
      console.log('Force loading new video URL:', videoUrl);
      videoRef.current.load(); // Force reload
    }
  }, [videoUrl]);

  // Close quality menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showQualityMenu) {
        setShowQualityMenu(false);
      }
    };

    if (showQualityMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showQualityMenu]);

  // Prevent keyboard shortcuts that could be used to download/save video
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent Ctrl+S (Save), Ctrl+Shift+I (DevTools), F12 (DevTools), etc.
      if (
        (e.ctrlKey && e.key === 's') || // Save
        (e.ctrlKey && e.key === 'S') || // Save
        (e.ctrlKey && e.shiftKey && e.key === 'I') || // DevTools
        (e.ctrlKey && e.shiftKey && e.key === 'i') || // DevTools
        e.key === 'F12' || // DevTools
        (e.ctrlKey && e.key === 'u') || // View Source
        (e.ctrlKey && e.key === 'U') // View Source
      ) {
        e.preventDefault();
        e.stopPropagation();
        setShowWarning(true);
        setTimeout(() => setShowWarning(false), 3000); // Hide warning after 3 seconds
        console.log('Blocked keyboard shortcut:', e.key);
        return false;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Screen recording detection and prevention measures
  React.useEffect(() => {
    let warningTimeout: NodeJS.Timeout;

    // Detect when user switches tabs/windows (potential screen recording setup)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('Tab/window lost focus - potential recording setup');
        if (videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
          setShowWarning(true);
          warningTimeout = setTimeout(() => setShowWarning(false), 5000);
        }
      }
    };

    // Detect screen capture attempts (modern browsers)
    const detectScreenCapture = () => {
      if ('getDisplayMedia' in navigator.mediaDevices) {
        // Override getDisplayMedia to detect screen capture attempts
        const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;
        navigator.mediaDevices.getDisplayMedia = function(constraints) {
          console.log('Screen recording attempt detected!');
          setIsRecording(true);
          setBlurVideo(true);
          setShowWarning(true);
          
          // Show extended warning
          setTimeout(() => {
            setShowWarning(false);
            setBlurVideo(false);
            setIsRecording(false);
          }, 10000);
          
          // Still call original function (can't prevent it)
          return originalGetDisplayMedia.call(this, constraints);
        };
      }
    };

    // Detect developer tools opening (common for advanced users)
    const detectDevTools = () => {
      let devtools = false;
      const threshold = 160;
      
      const checkDevTools = () => {
        if (window.outerHeight - window.innerHeight > threshold || 
            window.outerWidth - window.innerWidth > threshold) {
          if (!devtools) {
            devtools = true;
            console.log('Developer tools detected - potential recording/screenshot');
            setBlurVideo(true);
            setShowWarning(true);
            if (videoRef.current) {
              videoRef.current.pause();
            }
          }
        } else {
          if (devtools) {
            devtools = false;
            setBlurVideo(false);
          }
        }
      };

      setInterval(checkDevTools, 1000);
    };

    // Blur content when Print Screen is pressed
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        console.log('Print Screen detected!');
        setBlurVideo(true);
        setShowWarning(true);
        setTimeout(() => {
          setBlurVideo(false);
          setShowWarning(false);
        }, 3000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('keydown', handleKeyDown);
    detectScreenCapture();
    detectDevTools();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('keydown', handleKeyDown);
      if (warningTimeout) clearTimeout(warningTimeout);
    };
  }, []);

  // Handle rotating watermarks and fullscreen detection
  React.useEffect(() => {
    // Rotate watermark position every 5 seconds
    const rotateWatermark = () => {
      const positions = [
        { x: 20, y: 20 },     // Top-left
        { x: 80, y: 20 },     // Top-right  
        { x: 20, y: 80 },     // Bottom-left
        { x: 80, y: 80 },     // Bottom-right
        { x: 50, y: 15 },     // Top-center
        { x: 50, y: 85 },     // Bottom-center
        { x: 15, y: 50 },     // Middle-left
        { x: 85, y: 50 },     // Middle-right
      ];
      
      setWatermarkPosition(positions[Math.floor(Math.random() * positions.length)]);
    };

    // Detect fullscreen changes
    const handleFullscreenChange = () => {
      const doc = document as Document & {
        webkitFullscreenElement?: Element;
        mozFullScreenElement?: Element;
        msFullscreenElement?: Element;
      };
      
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
      setShowEnhancedWatermarks(isCurrentlyFullscreen);
      console.log('Fullscreen state:', isCurrentlyFullscreen);
      console.log('Fullscreen element:', document.fullscreenElement);
      console.log('Webkit fullscreen:', doc.webkitFullscreenElement);
    };

    // Start watermark rotation
    const watermarkInterval = setInterval(rotateWatermark, 5000);
    rotateWatermark(); // Initial position

    // Enhanced fullscreen detection for Mac Safari
    const handleWindowResize = () => {
      const isLargeScreen = window.innerWidth >= screen.width && window.innerHeight >= screen.height - 100;
      if (isLargeScreen && !isFullscreen) {
        console.log('Detected fullscreen via window size');
        setIsFullscreen(true);
        setShowEnhancedWatermarks(true);
      } else if (!isLargeScreen && isFullscreen) {
        console.log('Detected exit fullscreen via window size');
        setIsFullscreen(false);
        setShowEnhancedWatermarks(false);
      }
    };

    // Listen for fullscreen events
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    window.addEventListener('resize', handleWindowResize);

    return () => {
      clearInterval(watermarkInterval);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [isFullscreen]);

  const handleReprocess = async () => {
    setReprocessing(true);
    try {
      await axios.post(`http://localhost:8000/api/videos/${video.id}/reprocess/`);
      if (onReprocess) {
        onReprocess();
      }
    } catch (error) {
      console.error('Reprocessing failed:', error);
      alert('Failed to reprocess video');
    } finally {
      setReprocessing(false);
    }
  };

  const getResolutionStatus = (resolution: VideoResolution) => {
    if (resolution.is_processing) {
      return <span className="text-yellow-600">Processing...</span>;
    }
    if (resolution.is_completed) {
      return <span className="text-green-600">Ready</span>;
    }
    if (resolution.is_failed) {
      return <span className="text-red-600">Failed</span>;
    }
    return <span className="text-gray-600">Pending</span>;
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

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{video.title}</h2>
          {video.description && (
            <p className="text-gray-600 mt-2">{video.description}</p>
          )}
        </div>
        <div className="flex items-center space-x-4">
          {getStatusBadge(video.processing_status)}
          <span className="text-sm text-gray-500">v{video.version}</span>
        </div>
      </div>

      {/* Video Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
        <div>
          <span className="font-medium text-gray-700">File Size:</span>
          <p className="text-gray-900">{formatFileSize(video.file_size || 0)}</p>
        </div>
        <div>
          <span className="font-medium text-gray-700">Duration:</span>
          <p className="text-gray-900">{video.duration ? `${Math.round(video.duration)}s` : 'Unknown'}</p>
        </div>
        <div>
          <span className="font-medium text-gray-700">Created:</span>
          <p className="text-gray-900">{new Date(video.created_at).toLocaleDateString()}</p>
        </div>
        <div>
          <span className="font-medium text-gray-700">Filename:</span>
          <p className="text-gray-900 truncate">{video.filename}</p>
        </div>
      </div>

      {/* Video Player with Overlay Controls */}
      <div className="mb-6">
        <div 
          ref={containerRef}
          className="relative bg-black rounded-lg overflow-hidden group select-none"
          onContextMenu={(e: React.MouseEvent) => {
            e.preventDefault();
            setShowWarning(true);
            setTimeout(() => setShowWarning(false), 3000);
            return false;
          }}
          onDragStart={(e: React.DragEvent) => {
            e.preventDefault();
            return false;
          }}
          style={{
            WebkitTouchCallout: 'none',
            WebkitUserSelect: 'none',
            KhtmlUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            userSelect: 'none',
          }}
        >
          <video
            ref={videoRef}
            className={`w-full h-auto max-h-96 transition-all duration-300 ${blurVideo ? 'blur-lg brightness-50' : ''}`}
            crossOrigin="anonymous"
            controls
            src={videoUrl}
            controlsList="nodownload noremoteplayback nofullscreen"
            disablePictureInPicture
            disableRemotePlayback
            onContextMenu={(e: React.MouseEvent) => {
              e.preventDefault();
              setShowWarning(true);
              setTimeout(() => setShowWarning(false), 3000);
              return false;
            }}
            onDragStart={(e: React.DragEvent) => {
              e.preventDefault();
              return false;
            }}
            onError={(e) => {
              console.error('Video error:', e);
              console.error('Video URL:', videoUrl);
            }}
            onLoadStart={() => {
              console.log('Video loading started:', videoUrl);
            }}
            onLoadedData={() => {
              console.log('Video loaded successfully:', videoUrl);
              console.log('Video duration:', videoRef.current?.duration);
              console.log('Video source URL:', videoRef.current?.currentSrc);
              // Restore time position after video loads
              if (videoRef.current && currentTime > 0) {
                console.log('Restoring time to:', currentTime, 'was playing:', wasPlaying);
                videoRef.current.currentTime = currentTime;
                
                // Auto-resume if video was playing before resolution change
                if (wasPlaying) {
                  videoRef.current.play().then(() => {
                    console.log('Auto-resumed playback after resolution change');
                  }).catch((error) => {
                    console.log('Auto-play failed (user interaction may be required):', error);
                  });
                }
                
                setCurrentTime(0); // Reset after setting
                setWasPlaying(false); // Reset playing state
              }
            }}
            onCanPlay={() => {
              console.log('Video can play:', videoUrl);
            }}
            onTimeUpdate={() => {
              // Continuously save current time
              if (videoRef.current && !videoRef.current.paused) {
                setCurrentTime(videoRef.current.currentTime);
              }
            }}
          >
            Your browser does not support the video tag.
          </video>

          {/* Invisible Protection Layer - covers video but not controls */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{ bottom: '50px' }} // Leave space for video controls
            onContextMenu={(e: React.MouseEvent) => {
              e.preventDefault();
              return false;
            }}
          />

          {/* Dynamic Rotating Watermarks */}
          <div 
            className={`absolute text-white pointer-events-none select-none transition-all duration-1000 font-bold shadow-lg ${
              isFullscreen 
                ? 'text-2xl px-6 py-3 bg-red-600 bg-opacity-80 z-50 rounded-lg' 
                : 'text-xs px-3 py-1 bg-black bg-opacity-60 z-30 rounded'
            }`}
            style={{
              left: `${watermarkPosition.x}%`,
              top: `${watermarkPosition.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {isFullscreen ? `🔴 ${username.toUpperCase()} | PROTECTED CONTENT` : `👤 ${username} | © Protected`}
          </div>
          
          {/* Timestamp Watermark - Bottom Right */}
          <div className={`absolute text-white pointer-events-none select-none font-bold shadow-lg ${
            isFullscreen 
              ? 'bottom-8 right-8 text-lg px-6 py-3 bg-red-600 bg-opacity-80 z-50 rounded-lg' 
              : 'bottom-4 right-4 text-xs px-2 py-1 bg-black bg-opacity-60 z-30 rounded'
          }`}>
            🕒 {new Date().toLocaleString()}
          </div>

          {/* Always Visible Test Watermark */}
          <div className="absolute top-2 left-2 text-white text-sm bg-green-600 bg-opacity-90 px-3 py-1 rounded z-50 pointer-events-none select-none font-bold border-2 border-white">
            TEST: ALWAYS VISIBLE
          </div>

          {/* Additional Fixed Watermarks for Fullscreen */}
          {(isFullscreen || showEnhancedWatermarks) && (
            <>
              <div className="absolute top-1/2 left-2 text-black text-2xl bg-yellow-400 bg-opacity-95 px-6 py-4 rounded-lg z-50 pointer-events-none select-none transform -rotate-90 font-extrabold shadow-2xl border-4 border-red-600">
                PROTECTED: {username}
              </div>
              <div className="absolute top-1/2 right-4 text-white text-lg bg-red-600 bg-opacity-70 px-4 py-2 rounded z-50 pointer-events-none select-none transform rotate-90 font-bold shadow-lg">
                🔒 {username} - PROTECTED
              </div>
              <div className="absolute top-4 left-1/2 text-white text-xl bg-red-600 bg-opacity-70 px-6 py-3 rounded z-50 pointer-events-none select-none transform -translate-x-1/2 font-bold shadow-lg">
                � {username} | LICENSED CONTENT | {new Date().toLocaleTimeString()}
              </div>
              <div className="absolute bottom-4 left-1/2 text-white text-xl bg-red-600 bg-opacity-70 px-6 py-3 rounded z-50 pointer-events-none select-none transform -translate-x-1/2 font-bold shadow-lg">
                © PROTECTED BY COPYRIGHT - USER: {username.toUpperCase()}
              </div>
            </>
          )}

          {/* Custom Fullscreen Button */}
          <div className="absolute top-4 right-16 z-10">
            <button
              onClick={async () => {
                if (containerRef.current) {
                  try {
                    if (!document.fullscreenElement) {
                      await containerRef.current.requestFullscreen();
                      console.log('Entered custom fullscreen with watermarks');
                    } else {
                      await document.exitFullscreen();
                      console.log('Exited custom fullscreen');
                    }
                  } catch (error) {
                    console.error('Fullscreen error:', error);
                  }
                }
              }}
              className="bg-black bg-opacity-50 hover:bg-opacity-75 text-white p-2 rounded transition-opacity"
              title="Fullscreen with watermarks"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Custom Quality Selector Overlay */}
          <div className="absolute top-4 right-4 z-10">
            <div className="relative">
              <button
                onClick={() => setShowQualityMenu(!showQualityMenu)}
                className="bg-black bg-opacity-60 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-opacity-80 transition-all flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                </svg>
                <span>{selectedResolution === 'original' ? 'Original' : selectedResolution}</span>
                <svg className={`w-4 h-4 transition-transform ${showQualityMenu ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                </svg>
              </button>
              
              {/* Quality Menu Dropdown */}
              {showQualityMenu && (
                <div className="absolute top-full right-0 mt-2 bg-black bg-opacity-90 text-white rounded-md shadow-lg min-w-[120px] z-20">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        // Save current time before switching
                        if (videoRef.current) {
                          setCurrentTime(videoRef.current.currentTime);
                        }
                        setSelectedResolution('original');
                        setShowQualityMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-white hover:bg-opacity-20 transition-colors ${
                        selectedResolution === 'original' ? 'bg-blue-600' : ''
                      }`}
                    >
                      Original
                      {selectedResolution === 'original' && (
                        <span className="float-right">✓</span>
                      )}
                    </button>
                    {video.resolutions.map((resolution) => (
                      <button
                        key={resolution.id}
                        onClick={() => {
                          if (resolution.is_completed) {
                            // Save current time before switching
                            if (videoRef.current) {
                              setCurrentTime(videoRef.current.currentTime);
                            }
                            setSelectedResolution(resolution.resolution);
                            setShowQualityMenu(false);
                          }
                        }}
                        disabled={!resolution.is_completed}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                          resolution.is_completed 
                            ? 'hover:bg-white hover:bg-opacity-20' 
                            : 'text-gray-400 cursor-not-allowed'
                        } ${
                          selectedResolution === resolution.resolution ? 'bg-blue-600' : ''
                        }`}
                      >
                        {resolution.resolution}
                        {!resolution.is_completed && ' (Processing...)'}
                        {selectedResolution === resolution.resolution && (
                          <span className="float-right">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Warning Message for Security Violations */}
          {showWarning && (
            <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-600 text-white rounded-lg shadow-lg z-50 text-center ${
              isFullscreen ? 'px-12 py-8 max-w-2xl' : 'px-6 py-4 max-w-md'
            }`}>
              <div className={`mb-2 ${isFullscreen ? 'text-6xl' : 'text-2xl'}`}>🚫</div>
              <p className={`font-bold mb-2 ${isFullscreen ? 'text-2xl' : 'text-sm'}`}>RECORDING DETECTED</p>
              <p className={`${isFullscreen ? 'text-lg' : 'text-xs'}`}>
                {isRecording ? 'Screen recording attempt blocked' : 
                 blurVideo ? 'Suspicious activity detected' :
                 'Video protection active'}
              </p>
              <p className={`mt-2 opacity-75 ${isFullscreen ? 'text-base' : 'text-xs'}`}>
                User: {username} | Content is protected by copyright
              </p>
            </div>
          )}

          {/* Recording Detection Overlay */}
          {blurVideo && (
            <div className="absolute inset-0 bg-red-500 bg-opacity-20 flex items-center justify-center z-40">
              <div className={`bg-black bg-opacity-75 text-white rounded-lg text-center ${
                isFullscreen ? 'p-8' : 'p-4'
              }`}>
                <p className={`font-bold ${isFullscreen ? 'text-4xl mb-4' : 'text-lg'}`}>🔴 PROTECTED CONTENT</p>
                <p className={`${isFullscreen ? 'text-xl mb-2' : 'text-sm'}`}>Recording/Screenshot blocked</p>
                <p className={`opacity-75 ${isFullscreen ? 'text-lg' : 'text-xs'}`}>User: {username}</p>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-3 flex justify-between items-center text-sm text-gray-500">
          <span>
            Currently playing: {selectedResolution === 'original' ? 'Original' : selectedResolution}
          </span>
          
          {/* Debug Fullscreen Toggle */}
          <button
            onClick={() => {
              const newState = !isFullscreen;
              setIsFullscreen(newState);
              setShowEnhancedWatermarks(newState);
              console.log('Manual fullscreen toggle:', newState);
            }}
            className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
          >
            {isFullscreen ? '🟢 FS Mode ON' : '🔴 FS Mode OFF'}
          </button>
          <a 
            href={videoUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800"
          >
            Open in new tab
          </a>
        </div>
        
        {/* Fallback Quality Buttons for Testing */}
        <div className="mt-4 p-3 bg-gray-100 rounded-md">
          <p className="text-sm text-gray-700 mb-2">Quick Quality Test (Debug):</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                if (videoRef.current) {
                  setCurrentTime(videoRef.current.currentTime);
                }
                setSelectedResolution('original');
              }}
              className={`px-3 py-1 text-sm rounded ${
                selectedResolution === 'original' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'
              }`}
            >
              Original
            </button>
            {video.resolutions.map((resolution) => (
              <button
                key={resolution.id}
                onClick={() => {
                  if (resolution.is_completed) {
                    if (videoRef.current) {
                      setCurrentTime(videoRef.current.currentTime);
                    }
                    setSelectedResolution(resolution.resolution);
                  }
                }}
                disabled={!resolution.is_completed}
                className={`px-3 py-1 text-sm rounded ${
                  selectedResolution === resolution.resolution 
                    ? 'bg-blue-600 text-white' 
                    : resolution.is_completed
                    ? 'bg-white text-gray-700 border hover:bg-gray-50'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {resolution.resolution}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Resolution Details */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Available Resolutions</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Resolution
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dimensions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  File Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {video.resolutions.map((resolution) => (
                <tr key={resolution.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {resolution.resolution}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {resolution.width} × {resolution.height}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {resolution.file_size ? formatFileSize(resolution.file_size) : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {getResolutionStatus(resolution)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-4">
        <button
          onClick={handleReprocess}
          disabled={reprocessing || video.processing_status === 'processing'}
          className={`px-4 py-2 rounded-md font-medium ${
            reprocessing || video.processing_status === 'processing'
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700'
          } text-white transition-colors`}
        >
          {reprocessing ? 'Reprocessing...' : 'Reprocess Video'}
        </button>
      </div>
    </div>
  );
}