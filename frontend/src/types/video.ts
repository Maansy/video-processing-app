export interface VideoResolution {
  id: number;
  resolution: string;
  file_path: string;
  file_size: number;
  bitrate: string;
  width: number;
  height: number;
  is_processing: boolean;
  is_completed: boolean;
  is_failed: boolean;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  error_message: string | null;
}

export interface Video {
  id: number;
  title: string;
  description: string;
  original_file: string;
  filename: string;
  file_size: number;
  duration: number;
  processing_status: string;
  version: number;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
  resolutions: VideoResolution[];
}

export interface VideoUploadData {
  title: string;
  description: string;
  original_file: File;
}