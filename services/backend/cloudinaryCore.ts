import crypto from 'crypto';

export function generateCloudinarySignatureCore(paramsToSign: Record<string, string | number>) {
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const apiKey = process.env.CLOUDINARY_API_KEY;

  if (!apiKey || !apiSecret) {
    return { status: 500, body: { message: "Cloudinary configuration error on server." } };
  }

  if (!paramsToSign || typeof paramsToSign !== 'object' || typeof paramsToSign.timestamp === 'undefined') {
    return {
      status: 400,
      body: { message: "Invalid parameters: 'paramsToSign' object with at least 'timestamp' is required." }
    };
  }

  for (const key in paramsToSign) {
    if (typeof paramsToSign[key] !== 'string' && typeof paramsToSign[key] !== 'number') {
      return {
        status: 400,
        body: { message: `Invalid type for parameter '${key}'. Must be string or number.` }
      };
    }
  }

  const sortedKeys = Object.keys(paramsToSign).sort();
  let stringToSign = sortedKeys.map(key => `${key}=${paramsToSign[key]}`).join('&') + apiSecret;
  const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

  return {
    status: 200,
    body: { signature, timestamp: paramsToSign.timestamp, apiKey }
  };
}
