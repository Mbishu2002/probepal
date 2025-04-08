import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: Request) {
  try {
    const { model, systemPrompt, messages, data } = await request.json();
    
    if (model.toLowerCase().includes('gemini')) {
      // Call Google Gemini API
      const response = await callGeminiAPI(systemPrompt, data);
      return NextResponse.json({ content: response });
    } else {
      // Call OpenRouter API
      const response = await callOpenRouterAPI(model, messages, systemPrompt);
      return NextResponse.json({ content: response });
    }
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate content' },
      { status: 500 }
    );
  }
}

async function callGeminiAPI(systemPrompt: string, data?: any[]) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('Google API key not found');
    }

    // Prepare the prompt with data if available
    let fullPrompt = systemPrompt;
    if (data && data.length > 0) {
      // Format data as a simple table for better understanding
      const sampleSize = Math.min(data.length, 10); // Limit to 10 rows for the sample
      const sampleData = data.slice(0, sampleSize);
      const headers = Object.keys(sampleData[0]);
      
      let tableStr = "Analyze this data:\n\n";
      
      // Add headers
      tableStr += headers.join(',') + '\n';
      
      // Add rows
      sampleData.forEach(row => {
        tableStr += headers.map(h => row[h]).join(',') + '\n';
      });
      
      // Add data statistics
      tableStr += `\nTotal rows in dataset: ${data.length}\n`;
      tableStr += `\nFull dataset: ${JSON.stringify(data, null, 2)}\n\n`;
      
      fullPrompt = `${tableStr}\n\n${systemPrompt}\n\n`;
    }

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }]
      }
    );

    // Check if response has the expected structure
    if (response.data && 
        response.data.candidates && 
        response.data.candidates[0] && 
        response.data.candidates[0].content && 
        response.data.candidates[0].content.parts && 
        response.data.candidates[0].content.parts[0]) {
      
      // Extract the text from the response
      const responseText = response.data.candidates[0].content.parts[0].text;
      
      // Extract markdown content from the response
      // Look for markdown content between triple backticks
      const markdownMatch = responseText.match(/```(?:markdown)?\n([\s\S]*?)\n```/);
      
      // If markdown is found between backticks, return just that content
      // Otherwise return the full response
      return markdownMatch ? markdownMatch[1] : responseText;
    } else {
      console.log('Unexpected API response structure:', JSON.stringify(response.data));
      return 'The AI model did not return a valid response. Please try again.';
    }
  } catch (error: any) {
    console.error('Gemini API error:', error);
    throw new Error(`Gemini API error: ${error.message}`);
  }
}

async function callOpenRouterAPI(model: string, messages: any, systemPrompt: string) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenRouter API key not found');
    }

    // Format messages properly
    let formattedMessages = [];
    if (Array.isArray(messages)) {
      formattedMessages = messages;
    } else {
      formattedMessages = [{ role: 'user', content: messages }];
    }

    // Add system prompt if provided
    if (systemPrompt) {
      formattedMessages.unshift({ role: 'system', content: systemPrompt });
    }

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: model,
        messages: formattedMessages
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content;
  } catch (error: any) {
    console.error('OpenRouter API error:', error);
    throw new Error(`OpenRouter API error: ${error.message}`);
  }
}
