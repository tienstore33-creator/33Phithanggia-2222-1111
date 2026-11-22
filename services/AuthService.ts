export class AuthService {
  public static CLIENT_ID = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID;
  private static SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

  static login() {
    if (!this.CLIENT_ID) {
      console.error("VITE_GOOGLE_CLIENT_ID chưa được cấu hình trong .env");
      return;
    }

    const redirectUri = window.location.origin;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${this.CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(this.SCOPES)}`;
    
    window.location.href = authUrl;
  }

  static handleCallback() {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      const expiresIn = params.get('expires_in');

      if (accessToken) {
        const expiryTime = Date.now() + parseInt(expiresIn || '3600') * 1000;
        localStorage.setItem('google_access_token', accessToken);
        localStorage.setItem('google_token_expiry', expiryTime.toString());
        // Clear hash from URL
        window.history.replaceState(null, '', window.location.pathname);
        return accessToken;
      }
    }
    return null;
  }

  static getAccessToken(): string | null {
    const token = localStorage.getItem('google_access_token');
    const expiry = localStorage.getItem('google_token_expiry');

    if (token && expiry && Date.now() < parseInt(expiry)) {
      return token;
    }

    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_token_expiry');
    return null;
  }

  static logout() {
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_token_expiry');
  }
}
