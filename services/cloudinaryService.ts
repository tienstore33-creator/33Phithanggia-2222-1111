
import { 
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_FOLDER_PLAYER,
  CLOUDINARY_FOLDER_NPC_MALE,
  CLOUDINARY_FOLDER_NPC_WOMEN,
  CLOUDINARY_FOLDER_YEU_THU,
} from '../constants';

// Express API endpoint
const SIGNATURE_FUNCTION_ENDPOINT = '/api/generate-cloudinary-signature';
const SIGNATURE_FETCH_TIMEOUT = 15000; // 15 seconds

/**
 * Wraps the native fetch API with a timeout mechanism.
 * @param resource The resource to fetch.
 * @param options The fetch options.
 * @param timeout The timeout duration in milliseconds.
 * @returns A Promise that resolves with the Response or rejects on timeout.
 */
const fetchWithTimeout = (resource: RequestInfo, options: RequestInit, timeout: number): Promise<Response> => {
    return Promise.race([
        fetch(resource, options),
        new Promise<Response>((_, reject) =>
            setTimeout(() => reject(new Error('Yêu cầu lấy chữ ký đã hết hạn (timeout). Máy chủ có thể đang bận hoặc không khả dụng.')), timeout)
        )
    ]);
};

export async function uploadImageToCloudinary(
  base64ImageString: string,
  type: 'player' | 'npc_male' | 'npc_female' | 'yeu_thu', 
  publicId?: string
): Promise<string> {

  const effectiveCloudinaryCloudName = CLOUDINARY_CLOUD_NAME;
  if (!effectiveCloudinaryCloudName) {
    const errorMessage = "Cloudinary Cloud Name (từ constants.ts) is missing. Cannot upload image.";
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
  
  let folderName: string;
  if (type === 'player') {
    folderName = CLOUDINARY_FOLDER_PLAYER;
  } else if (type === 'npc_male') {
    folderName = CLOUDINARY_FOLDER_NPC_MALE;
  } else if (type === 'yeu_thu') {
    folderName = CLOUDINARY_FOLDER_YEU_THU;
  } else { // npc_female
    folderName = CLOUDINARY_FOLDER_NPC_WOMEN;
  }
  
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign: Record<string, string | number> = {
    timestamp: timestamp,
    folder: folderName,
  };

  let sanitizedPublicId: string | undefined = undefined;
  if (publicId) {
    sanitizedPublicId = publicId.replace(/[\/\?&#%<>]/g, '_');
    paramsToSign.public_id = sanitizedPublicId;
  }
  
  let signature: string;
  let apiKeyToUse: string;
  let timestampToUse: number;

  try {
    const sigResponse = await fetchWithTimeout(SIGNATURE_FUNCTION_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paramsToSign }),
    }, SIGNATURE_FETCH_TIMEOUT);

    if (!sigResponse.ok) {
      let errorBodyText = `Server responded with ${sigResponse.status} ${sigResponse.statusText}.`;
      try {
        const errorBodyJson = await sigResponse.json(); 
        errorBodyText += ` Details: ${errorBodyJson?.message || JSON.stringify(errorBodyJson) || 'Unknown server error content.'}`;
      } catch (jsonError) {
        try {
            const textResponse = await sigResponse.text();
            errorBodyText += ` Raw response: ${textResponse || '(empty response body)'}`;
        } catch (textError) {
            errorBodyText += ` Could not retrieve error body text.`;
        }
      }
      throw new Error(errorBodyText);
    }
    
    const sigData = await sigResponse.json();
    signature = sigData.signature;
    apiKeyToUse = sigData.apiKey;
    timestampToUse = sigData.timestamp;
    
    if (!signature || !apiKeyToUse || typeof timestampToUse !== 'number') {
        throw new Error("Invalid signature data received from server. Signature, API key, or timestamp missing/invalid.");
    }

  } catch (error) {
    console.error("Error fetching Cloudinary signature:", error);
    const userMessage = error instanceof Error ? error.message : "Lỗi kết nối đến dịch vụ ký Cloudinary.";
    throw new Error(`Không thể lấy chữ ký Cloudinary: ${userMessage}`);
  }
  
  const formData = new FormData();
  
  // Ensure we have a proper data URI for Cloudinary
  const fileData = base64ImageString.startsWith('data:image') 
    ? base64ImageString 
    : `data:image/png;base64,${base64ImageString}`;

  formData.append('file', fileData);
  formData.append('api_key', apiKeyToUse);
  formData.append('timestamp', timestampToUse.toString());
  formData.append('signature', signature);
  formData.append('folder', folderName);
  if (sanitizedPublicId) {
    formData.append('public_id', sanitizedPublicId);
  }
  
  const cloudinaryUploadUrl = `https://api.cloudinary.com/v1_1/${effectiveCloudinaryCloudName}/image/upload`;
  try {
    const uploadResponse = await fetch(cloudinaryUploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorBody = await uploadResponse.text(); 
      throw new Error(`Cloudinary upload failed: ${uploadResponse.status} ${uploadResponse.statusText}. Details: ${errorBody}`);
    }

    const uploadResult = await uploadResponse.json();
    if (!uploadResult.secure_url) {
      throw new Error("Cloudinary upload succeeded but did not return a secure_url.");
    }
    return uploadResult.secure_url;
  } catch (error) {
    console.error("Error during Cloudinary upload POST request:", error);
    throw new Error(`Tải ảnh lên Cloudinary thất bại: ${error instanceof Error ? error.message : String(error)}`);
  }
}
