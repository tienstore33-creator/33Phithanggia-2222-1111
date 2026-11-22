import { VerificationResult } from '../services/chatbotVerifierService';

export interface GroundingSource {
  title: string;
  url: string;
  domain?: string;
}

export interface GroundingData {
  webSearchQueries?: string[];
  sources: GroundingSource[];
  searchEntryPointHtml?: string;
}

export interface ChatMessageAttachment {
  name: string;
  mimeType: string;
  previewUrl?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'model';
  text: string;
  timestamp: string;
  attachments?: ChatMessageAttachment[];
  verification?: VerificationResult;
  grounding?: GroundingData;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}
