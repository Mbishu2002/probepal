import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Try to read from the system_prompt.txt file in the project root
    const promptPath = path.join(process.cwd(), 'system_prompt.txt');
    console.log('Looking for system prompt at:', promptPath);
    
    if (fs.existsSync(promptPath)) {
      console.log('System prompt file found');
      const systemPrompt = fs.readFileSync(promptPath, 'utf8');
      console.log('System prompt content length:', systemPrompt.length);
      return NextResponse.json({ prompt: systemPrompt });
    } else {
      console.log('System prompt file not found');
      // Default prompt if file doesn't exist
      const defaultPrompt = "Generate and edit text based on data. Format your response with markdown. Include tables where appropriate. Make sections for demographics, knowledge, practices, and challenges.";
      return NextResponse.json({ prompt: defaultPrompt });
    }
  } catch (error) {
    console.error('Error reading system prompt:', error);
    return NextResponse.json(
      { prompt: "Generate and edit text based on data. Format your response with markdown." },
      { status: 200 }
    );
  }
}
