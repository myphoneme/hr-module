import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import db from './src/db';

dotenv.config();

async function testGemini() {
  console.log('--- Gemini API Diagnostic ---');
  
  // Get config from DB
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('ai_config') as { value: string } | undefined;
  if (!setting) {
    console.error('No AI configuration found in database.');
    return;
  }
  
  const config = JSON.parse(setting.value);
  const apiKey = config.providers.gemini.apiKey;
  
  if (!apiKey) {
    console.error('No Gemini API key found in configuration.');
    return;
  }

  console.log(`Using API Key: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 4)}`);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // There isn't a direct "listModels" in the simple SDK, but we can try a very basic generateContent
    // with the most common model names.
    
    const testModels = [
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
      'gemini-1.5-pro',
      'gemini-pro'
    ];

    for (const modelName of testModels) {
      try {
        console.log(`Testing model: ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Say 'Hello'");
        console.log(`✅ ${modelName} is working! Response: ${result.response.text().trim()}`);
      } catch (err: any) {
        console.error(`❌ ${modelName} failed: ${err.message}`);
        if (err.status === 401 || err.message?.includes('API_KEY_INVALID')) {
           console.error('CRITICAL: Your API Key appears to be invalid.');
           return;
        }
      }
    }

  } catch (error: any) {
    console.error('Diagnostic failed:', error.message);
  }
}

testGemini();
