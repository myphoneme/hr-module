import * as https from 'https';
import * as dotenv from 'dotenv';
import db from './src/db';

dotenv.config();

async function listGeminiModels() {
  console.log('--- Native Gemini API Model List ---');
  
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('ai_config') as { value: string } | undefined;
  if (!setting) {
    console.error('No AI configuration found in database.');
    return;
  }
  
  const config = JSON.parse(setting.value);
  const apiKey = config.providers.gemini.apiKey;
  
  if (!apiKey) {
    console.error('No Gemini API key found.');
    return;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

  https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.error) {
           console.error(`API Error ${parsed.error.code}: ${parsed.error.message}`);
           return;
        }
        
        if (parsed.models) {
          console.log('Available Models:');
          parsed.models.forEach((m: any) => {
            console.log(`- ${m.name} (${m.displayName})`);
          });
        } else {
          console.log('No models found for this key.');
        }
      } catch (e) {
        console.error('Failed to parse response:', e);
        console.log('Raw data:', data);
      }
    });
  }).on('error', (err) => {
    console.error('Request error:', err.message);
  });
}

listGeminiModels();
