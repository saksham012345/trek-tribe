// Upload Test Utility
// This utility helps test and verify all upload endpoints are working correctly

import axios from 'axios';

interface UploadTestResult {
  endpoint: string;
  success: boolean;
  error?: string;
  response?: any;
}

export class UploadTester {
  private baseURL: string;

  constructor(baseURL = '') {
    this.baseURL = baseURL;
  }

  // Create a test image file (1x1 pixel PNG)
  private createTestImageFile(): File {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, 1, 1);
    }
    
    return new Promise<File>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(new File([blob], 'test-image.png', { type: 'image/png' }));
        } else {
          // Fallback: create a simple text file pretending to be an image
          const textBlob = new Blob(['fake image data'], { type: 'image/png' });
          resolve(new File([textBlob], 'test-image.png', { type: 'image/png' }));
        }
      }, 'image/png');
    }) as any;
  }

  // Create test base64 image
  private createTestBase64(): string {
    // 1x1 red pixel PNG in base64
    return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }

  // Test profile photo upload via /profile/photo endpoint
  async testProfilePhotoUpload(): Promise<UploadTestResult> {
    try {
      const base64Data = this.createTestBase64();
      const response = await axios.post('/profile/photo', {
        photo: `data:image/png;base64,${base64Data}`
      });

      return {
        endpoint: '/profile/photo',
        success: true,
        response: response.data
      };
    } catch (error: any) {
      return {
        endpoint: '/profile/photo',
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  // Test base64 file upload via /files/upload/base64
  async testBase64Upload(): Promise<UploadTestResult> {
    try {
      const base64Data = this.createTestBase64();
      const response = await axios.post('/files/upload/base64', {
        data: base64Data,
        filename: 'test-upload.png',
        mimeType: 'image/png'
      });

      return {
        endpoint: '/files/upload/base64',
        success: true,
        response: response.data
      };
    } catch (error: any) {
      return {
        endpoint: '/files/upload/base64',
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  // Test traditional multipart upload (if available)
  async testMultipartUpload(): Promise<UploadTestResult> {
    try {
      const file = this.createTestImageFile();
      const formData = new FormData();
      formData.append('profilePhoto', file);

      const response = await axios.post('/uploads/profile-photo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      return {
        endpoint: '/uploads/profile-photo',
        success: true,
        response: response.data
      };
    } catch (error: any) {
      return {
        endpoint: '/uploads/profile-photo',
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  // Run all upload tests
  async runAllTests(): Promise<UploadTestResult[]> {
    console.log('🧪 Starting upload functionality tests...');

    const tests = [
      this.testProfilePhotoUpload(),
      this.testBase64Upload(),
      this.testMultipartUpload()
    ];

    const results = await Promise.all(tests);
    
    console.log('📊 Upload Test Results:');
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.endpoint}: ${result.success ? 'PASS' : `FAIL - ${result.error}`}`);
    });

    const successCount = results.filter(r => r.success).length;
    console.log(`\n📈 Summary: ${successCount}/${results.length} tests passed`);

    return results;
  }

  // Test authentication endpoints
  async testAuthStatus(): Promise<{ authenticated: boolean; user?: any; error?: string }> {
    try {
      const response = await axios.get('/profile/me');
      const responseData = response.data as { user: any };
      return {
        authenticated: true,
        user: responseData.user
      };
    } catch (error: any) {
      return {
        authenticated: false,
        error: error.response?.status === 401 ? 'Not authenticated' : error.message
      };
    }
  }
}

// Helper function to run tests from console
export const runUploadTests = async () => {
  const tester = new UploadTester();
  
  // Check auth first
  const authStatus = await tester.testAuthStatus();
  if (!authStatus.authenticated) {
    console.warn('⚠️  User not authenticated. Upload tests may fail.');
    console.log('Please log in first and then run the tests.');
    return;
  }

  console.log(`👋 Authenticated as: ${authStatus.user?.name} (${authStatus.user?.role})`);
  
  const results = await tester.runAllTests();
  return results;
};

// Make it available globally for easy testing in browser console
if (typeof window !== 'undefined') {
  (window as any).runUploadTests = runUploadTests;
  (window as any).UploadTester = UploadTester;
}

export default UploadTester;