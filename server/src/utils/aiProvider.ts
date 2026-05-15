import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import db from '../db';

export type AIProviderType = 'local' | 'gemini' | 'anthropic';

export interface AIConfig {
  activeProvider: AIProviderType;
  providers: {
    local: { endpoint: string; model: string };
    gemini: { apiKey: string; model: string };
    anthropic: { apiKey: string; model: string };
  };
}

export class AIProvider {
  private static config: AIConfig | null = null;

  static async getConfig(): Promise<AIConfig> {
    const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('ai_config') as { value: string } | undefined;
    if (setting) {
      const config = JSON.parse(setting.value);
      // Migration: convert openai to local if it exists in DB
      if (config.providers.openai) {
        config.providers.local = {
          endpoint: 'http://10.100.60.121:11434/api/generate',
          model: 'gemma4:e4b'
        };
        delete config.providers.openai;
        if (config.activeProvider === 'openai') {
          config.activeProvider = 'local';
        }
        // Save migration
        db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(JSON.stringify(config), 'ai_config');
      }
      this.config = config;
    } else {
      // Fallback to env variables if setting not found
      this.config = {
        activeProvider: (process.env.AI_PROVIDER as AIProviderType) || 'local',
        providers: {
          local: { 
            endpoint: process.env.LOCAL_AI_ENDPOINT || 'http://10.100.60.121:11434/api/generate', 
            model: process.env.LOCAL_AI_MODEL || 'gemma4:e4b' 
          },
          gemini: { apiKey: process.env.GEMINI_API_KEY || '', model: 'gemini-1.5-pro' },
          anthropic: { apiKey: process.env.ANTHROPIC_API_KEY || '', model: 'claude-3-5-sonnet-20240620' }
        }
      };
    }
    return this.config!;
  }

  static async chat(options: any) {
    const config = await this.getConfig();
    const provider = config.activeProvider;
    const providerConfig = config.providers[provider];

    if (provider === 'local') {
      return this.chatLocal(providerConfig as { endpoint: string; model: string }, options);
    }

    if (!(providerConfig as { apiKey: string }).apiKey) {
      throw new Error(`API Key for ${provider} is not configured.`);
    }

    switch (provider) {
      case 'gemini':
        return this.chatGemini(providerConfig as { apiKey: string; model: string }, options);
      case 'anthropic':
        return this.chatAnthropic(providerConfig as { apiKey: string; model: string }, options);
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  private static async chatLocal(config: { endpoint: string; model: string }, options: any) {
    // Convert messages to a single prompt for /api/generate
    let prompt = '';
    if (options.messages) {
      prompt = options.messages.map((m: any) => {
        const role = m.role === 'system' ? 'System' : m.role === 'assistant' ? 'Assistant' : 'User';
        return `${role}: ${m.content}`;
      }).join('\n') + '\nAssistant: ';
    } else if (options.prompt) {
      prompt = options.prompt;
    }

    try {
      const body: any = {
        model: config.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          num_predict: options.max_tokens || 2048,
        }
      };

      if (options.response_format?.type === 'json_object') {
        body.format = 'json';
      }

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(300000) // 300 seconds timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Local AI API error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as any;
      const content = data.response;

      return {
        choices: [{
          message: {
            role: 'assistant',
            content: content,
          }
        }],
        usage: {
          total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
          prompt_tokens: data.prompt_eval_count || 0,
          completion_tokens: data.eval_count || 0
        }
      };
    } catch (error: any) {
      console.error('Local AI Request Error:', error);
      if (error.name === 'TimeoutError') {
        throw new Error('Local AI request timed out after 300 seconds');
      }
      throw error;
    }
  }

  private static async chatGemini(config: { apiKey: string; model: string }, options: any) {
    const genAI = new GoogleGenerativeAI(config.apiKey);
    
    // Try primary model, then fallbacks if 404 occurs
    // Updated for 2026 model availability
    const modelsToTry = [
      config.model,
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-flash-latest',
      'gemini-1.5-flash',
      'gemini-2.5-pro',
      'gemini-2.0-pro'
    ].filter((m, i, self) => m && self.indexOf(m) === i); // Unique models

    let lastError: any;
    for (const modelName of modelsToTry) {
      try {
        // Extract system message for Gemini 1.5+ systemInstruction
        const systemMessage = options.messages.find((m: any) => m.role === 'system')?.content;
        
        const modelOptions: any = { 
          model: modelName
        };

        // Use systemInstruction for 1.5+ and newer models (2.x, 3.x, etc.)
        const isNewModel = modelName.includes('1.5') || modelName.includes('2.0') || modelName.includes('2.5') || modelName.includes('3.') || modelName.includes('flash') || modelName.includes('pro');
        
        if (systemMessage && isNewModel) {
          modelOptions.systemInstruction = systemMessage;
        }

        if (options.response_format?.type === 'json_object') {
           modelOptions.generationConfig = {
             responseMimeType: 'application/json'
           };
        }

        const model = genAI.getGenerativeModel(modelOptions);

        // Map messages to Gemini format
        let contents = options.messages
          .filter((m: any) => m.role !== 'system' || !isNewModel)
          .map((m: any) => {
            let role = m.role === 'assistant' ? 'model' : 'user';
            let text = m.content;
            if (m.role === 'system' && !isNewModel) {
              text = `System: ${m.content}`;
            }
            return {
              role: role === 'system' ? 'user' : role,
              parts: [{ text }]
            };
          });

        // Gemini requires at least one message in contents.
        // If we only have a system message (which was extracted to systemInstruction),
        // we must add a placeholder user message or move the system message to user.
        if (contents.length === 0) {
          if (systemMessage) {
            // If we have a system message but nothing else, use the system message as the prompt
            contents = [{
              role: 'user',
              parts: [{ text: systemMessage }]
            }];
            // Optionally clear systemInstruction to avoid duplication, 
            // but usually it's better to keep it as instruction and add a simple "Please proceed" user message.
            // Let's go with a simple prompt if systemInstruction is already set.
            if (modelOptions.systemInstruction) {
               contents = [{ role: 'user', parts: [{ text: "Please provide the requested output." }] }];
            }
          } else {
            // Absolute fallback
            contents = [{ role: 'user', parts: [{ text: "Hello" }] }];
          }
        }

        // Handle tools if present
        const tools = options.tools ? [{
          functionDeclarations: options.tools.map((t: any) => ({
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters
          }))
        }] : undefined;

        const result = await model.generateContent({
          contents,
          tools
        });

        const response = result.response;
        let text = '';
        try {
          text = response.text();
        } catch (e) {
          // No text response is fine if tool calls exist
        }

        const toolCalls = response.candidates?.[0]?.content?.parts
          ?.filter(p => p.functionCall)
          ?.map(p => ({
            id: Math.random().toString(36).substring(7),
            type: 'function',
            function: {
              name: p.functionCall!.name,
              arguments: JSON.stringify(p.functionCall!.args)
            }
          }));

        return {
          choices: [{
            message: {
              role: 'assistant',
              content: text,
              tool_calls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined
            }
          }],
          usage: {
            total_tokens: response.usageMetadata?.totalTokenCount || 0,
            prompt_tokens: response.usageMetadata?.promptTokenCount || 0,
            completion_tokens: response.usageMetadata?.candidatesTokenCount || 0
          }
        };
      } catch (error: any) {
        lastError = error;
        // If it's not a 404, throw immediately (e.g. invalid API key)
        if (error.status !== 404 && !error.message?.includes('404')) {
          throw error;
        }
        console.log(`Gemini model ${modelName} not found, trying next fallback...`);
      }
    }
    
    throw lastError;
  }

  private static async chatAnthropic(config: { apiKey: string; model: string }, options: any) {
    const anthropic = new Anthropic({ apiKey: config.apiKey });
    
    // Extract system message
    const system = options.messages.find((m: any) => m.role === 'system')?.content;
    const messages = options.messages
      .filter((m: any) => m.role !== 'system')
      .map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));

    const response = await anthropic.messages.create({
      model: config.model || 'claude-3-5-sonnet-20240620',
      max_tokens: options.max_tokens || 1024,
      system,
      messages,
      tools: options.tools?.map((t: any) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters
      }))
    });

    const text = response.content.find(c => c.type === 'text')?.type === 'text' ? (response.content.find(c => c.type === 'text') as any).text : '';
    const toolCalls = response.content
      .filter(c => c.type === 'tool_use')
      .map((c: any) => ({
        id: c.id,
        type: 'function',
        function: {
          name: c.name,
          arguments: JSON.stringify(c.input)
        }
      }));

    return {
      choices: [{
        message: {
          role: 'assistant',
          content: text,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined
        }
      }],
      usage: {
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens
      }
    };
  }

  static async createEmbedding(text: string) {
     const config = await this.getConfig();
     const provider = config.activeProvider;
     const providerConfig = config.providers[provider];

     if (provider === 'local') {
        const localConfig = providerConfig as { endpoint: string; model: string };
        const endpoint = localConfig.endpoint.replace('/generate', '/embeddings');
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: localConfig.model,
              prompt: text
            })
          });
          const data = await response.json() as any;
          return data.embedding;
        } catch (error) {
          console.error('Local embedding error:', error);
          // Fallback to Gemini if available
          if (config.providers.gemini.apiKey) {
            return this.createEmbeddingWithProvider('gemini', config.providers.gemini.apiKey, text);
          }
          throw error;
        }
     } else if (provider === 'gemini') {
        const geminiConfig = providerConfig as { apiKey: string; model: string };
        const genAI = new GoogleGenerativeAI(geminiConfig.apiKey);
        const model = genAI.getGenerativeModel({ model: "text-embedding-004"});
        const result = await model.embedContent(text);
        return result.embedding.values;
     } else {
        // Anthropic doesn't have an embedding API
        if (config.providers.gemini.apiKey) {
           return this.createEmbeddingWithProvider('gemini', config.providers.gemini.apiKey, text);
        }
        throw new Error("No provider available for embeddings (Anthropic does not support embeddings)");
     }
  }

  private static async createEmbeddingWithProvider(provider: 'gemini', apiKey: string, text: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "text-embedding-004"});
    const result = await model.embedContent(text);
    return result.embedding.values;
  }
}
