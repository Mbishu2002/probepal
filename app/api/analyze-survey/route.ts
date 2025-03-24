import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(req: Request) {
  try {
    const { documentText, systemPrompt } = await req.json();

    // Call Gemini API directly using axios
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('Google API key not found');
    }

    console.log('Sending request to Gemini API with prompt:', systemPrompt.substring(0, 100) + '...');
    
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        contents: [{
          parts: [{
            text: systemPrompt + '\n\nDocument to analyze:\n' + documentText
          }]
        }]
      }
    );

    // Log the raw response structure
    console.log('Gemini API response structure:', JSON.stringify(response.data, null, 2).substring(0, 500) + '...');

    // Check if response has the expected structure
    if (response.data && 
        response.data.candidates && 
        response.data.candidates[0] && 
        response.data.candidates[0].content && 
        response.data.candidates[0].content.parts && 
        response.data.candidates[0].content.parts[0]) {
      
      // Extract the text from the response
      const responseText = response.data.candidates[0].content.parts[0].text;
      console.log('Raw response text:', responseText.substring(0, 500) + '...');
      
      // Try to extract JSON from the response
      let jsonData;
      
      // First try to extract JSON from markdown code blocks
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch && jsonMatch[1]) {
        console.log('Found JSON in code block');
        try {
          jsonData = JSON.parse(jsonMatch[1].trim());
          console.log('Successfully parsed JSON from code block');
        } catch (jsonError) {
          console.error('Error parsing JSON from code block:', jsonError);
        }
      }
      
      // If that fails, try direct JSON parsing
      if (!jsonData) {
        try {
          jsonData = JSON.parse(responseText);
          console.log('Successfully parsed JSON directly');
        } catch (error) {
          console.error('Direct JSON parsing failed:', error);
        }
      }
      
      // If both methods fail, try to extract JSON by finding the first { and last }
      if (!jsonData) {
        const firstBrace = responseText.indexOf('{');
        const lastBrace = responseText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const jsonString = responseText.substring(firstBrace, lastBrace + 1);
          console.log('Extracted JSON substring');
          try {
            jsonData = JSON.parse(jsonString);
            console.log('Successfully parsed JSON substring');
          } catch (jsonError) {
            console.error('Error parsing JSON substring:', jsonError);
          }
        }
      }
      
      // If we successfully parsed JSON, return it
      if (jsonData) {
        // Validate the expected structure
        if (!jsonData.sections) {
          console.error('Invalid JSON structure: missing sections');
          return NextResponse.json(
            { 
              error: 'The AI response does not have the expected structure (missing sections)',
              rawResponse: responseText 
            },
            { status: 500 }
          );
        }
        
        return NextResponse.json(jsonData);
      } else {
        // If all parsing attempts fail, return a structured error
        console.error('All JSON parsing attempts failed');
        return NextResponse.json(
          { 
            error: 'Failed to parse JSON from AI response',
            rawResponse: responseText 
          },
          { status: 500 }
        );
      }
    } else {
      console.error('Unexpected API response structure:', JSON.stringify(response.data));
      return NextResponse.json(
        { 
          error: 'The AI model did not return a valid response',
          rawResponse: JSON.stringify(response.data)
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in survey analysis:', error);
    return NextResponse.json(
      { error: `Failed to analyze survey: ${error.message}` },
      { status: 500 }
    );
  }
}