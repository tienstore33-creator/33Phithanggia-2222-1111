export class GoogleDriveService {
  // 1. Trích xuất File ID từ URL chia sẻ của Drive
  static extractFileId(url: string): string | null {
    try {
      const urlObj = new URL(url);
      // Case 1: /file/d/ID/...
      if (urlObj.pathname.includes('/file/d/')) {
        return urlObj.pathname.split('/file/d/')[1].split('/')[0];
      }
      // Case 2: /open?id=ID
      if (urlObj.searchParams.has('id')) {
        return urlObj.searchParams.get('id');
      }
      // Fallback: regex
      const match = url.match(/[-\w]{25,}/);
      return match ? match[0] : null;
    } catch (e) {
      // Not a valid URL
      return null;
    }
  }

  // 2. Tải nội dung file text
  static async fetchTextContent(fileId: string, apiKey: string): Promise<string> {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Lỗi tải file (${response.status} ${response.statusText}): ${errorText}`);
    }
    return await response.text();
  }

  static async getFileMetadata(fileId: string, apiKey: string, accessToken?: string) {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType&key=${apiKey}`;
    const headers: HeadersInit = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    const res = await fetch(url, { headers });
    return await res.json();
  }

  static async fetchBlob(fileId: string, apiKey: string, accessToken?: string): Promise<Blob> {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
    const headers: HeadersInit = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error("Quyền truy cập bị từ chối. Hãy đăng nhập Google hoặc share Public file này.");
    return await res.blob();
  }
}
