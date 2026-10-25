import { useCallback } from 'react';

/** Electron captures a WebView directly; Tauri uses an explicitly consented OS screen/window capture.
 * Never hide the native WebView before capture: that produces a blank image on Windows. */
export function useBrowserScreenshot(tabId: string, isElectronWebview: boolean, webviewEl: any) {
  return useCallback(async () => {
    const filename = 'screenshot-' + tabId + '-' + Date.now() + '.png';
    let stream: MediaStream | null = null;
    try {
      let image: string;
      if (isElectronWebview && webviewEl?.capturePage) {
        const picture = await webviewEl.capturePage();
        image = picture.toDataURL();
      } else {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          throw new Error('Screen capture is not available. Open in the desktop app or use your OS screenshot tool.');
        }
        // User selects the capture surface. We never capture the desktop silently.
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        const video = document.createElement('video');
        video.muted = true;
        video.srcObject = stream;
        await video.play();
        if (!video.videoWidth || !video.videoHeight) {
          await new Promise<void>((resolve, reject) => {
            video.onloadedmetadata = () => resolve();
            video.onerror = () => reject(new Error('Unable to read the selected capture surface.'));
          });
        }
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas capture failed.');
        context.drawImage(video, 0, 0);
        image = canvas.toDataURL('image/png');
        video.pause();
        video.srcObject = null;
      }
      const link = document.createElement('a');
      link.href = image;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.dispatchEvent(new CustomEvent('tline-toast', {
        detail: { message: 'Capture saved to browser downloads: ' + filename },
      }));
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Capture canceled or unavailable';
      window.dispatchEvent(new CustomEvent('tline-toast', {
        detail: { message: 'Screenshot not saved: ' + detail },
      }));
    } finally {
      stream?.getTracks().forEach(track => track.stop());
    }
  }, [tabId, isElectronWebview, webviewEl]);
}
