import { API_BASE_URL } from '../config/api';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  response: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export const aiApi = {
  chat: async (message: string, conversationHistory: ChatMessage[]): Promise<ChatResponse> => {
    const res = await fetch(`${API_BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ message, conversationHistory }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to get AI response');
    }

    return res.json();
  },
};
