/**
 * A best-effort first-frame thumbnail for a video that isn't YouTube (mainly
 * self-hosted R2 uploads — see `youtubeThumbnail` in curriculum/resources.tsx
 * for the YouTube case, which needs no extraction). Native decodes on-device
 * via expo-video-thumbnails; web has no such native module, so it grabs a
 * frame from an offscreen `<video>` + `<canvas>` instead. Never throws — a
 * failed extraction (bad codec, missing CORS headers on the source, a slow
 * network) just means no auto-thumbnail, same as before this existed.
 */
import { Platform } from 'react-native';

function webVideoFrame(url: string): Promise<string | null> {
  return new Promise(resolve => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    let settled = false;
    const finish = (result: string | null) => {
      if (settled) return;
      settled = true;
      video.remove();
      resolve(result);
    };

    video.addEventListener('error', () => finish(null));
    video.addEventListener('loadeddata', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;
        const ctx = canvas.getContext('2d');
        if (!ctx) return finish(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL('image/jpeg', 0.8));
      } catch {
        // A tainted canvas (source missing CORS headers) throws here.
        finish(null);
      }
    });
    setTimeout(() => finish(null), 8000);
    video.src = url;
  });
}

export async function getVideoFrameThumbnail(url: string): Promise<string | null> {
  if (Platform.OS === 'web') return webVideoFrame(url);
  try {
    const VideoThumbnails = await import('expo-video-thumbnails');
    const { uri } = await VideoThumbnails.getThumbnailAsync(url, { time: 1000 });
    return uri;
  } catch {
    return null;
  }
}
