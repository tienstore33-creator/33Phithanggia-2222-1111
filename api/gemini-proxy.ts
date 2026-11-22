import { handleGeminiProxyCore } from '../services/backend/geminiCore.js';

export interface VercelApiRequest {
  method?: string;
  body?: any;
}

export interface VercelApiResponse {
  status: (statusCode: number) => VercelApiResponse;
  json: (data: any) => void;
}

export default async function handler(req: VercelApiRequest, res: VercelApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
  const result = await handleGeminiProxyCore(req.body || {});
  return res.status(result.status).json(result.body);
}
