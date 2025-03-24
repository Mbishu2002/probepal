# Research Assistant Next.js App

A Next.js application for analyzing and visualizing research data, with AI-powered content generation, the ability to switch between table and chart views, select columns, and export to PDF or Word.

## Features

- Upload Excel (.xlsx) files for data analysis
- AI-powered content generation using Google Gemini or OpenRouter models
- Interactive chat interface for refining and editing content
- Switch between table and chart views
- Multiple chart types (bar, pie, line)
- Select specific columns to display
- Export to PDF or Word document
- Modern, responsive UI built with Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 16.8.0 or later
- npm or yarn
- API keys for Google Gemini and OpenRouter

### Installation

1. Clone this repository
2. Install dependencies:

```bash
cd nextjs-app
npm install
# or
yarn install
```

3. Create a `.env.local` file in the root directory with your API keys:

```
GOOGLE_API_KEY=your_google_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

4. Run the development server:

```bash
npm run dev
# or
yarn dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. Upload an Excel file using the file uploader
2. The AI will automatically generate content based on the data
3. Use the chat interface to refine or ask questions about the data
4. The data will be displayed in a table by default
5. Use the "Switch to Chart View" button to toggle between table and chart views
6. In chart view, select the chart type (bar, pie, or line)
7. Use the column selector to choose which columns to display
8. Export the generated content to PDF or Word using the export buttons

## AI Models

This application supports multiple AI models:

- Google Gemini (default)
- OpenAI GPT-3.5 Turbo
- OpenAI GPT-4
- Anthropic Claude
- Meta Llama 3

Select your preferred model from the model selector in the sidebar.

## Technologies Used

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Chart.js
- xlsx for Excel file parsing
- jsPDF for PDF export
- docx for Word document export
- Google Generative AI API
- OpenRouter API for accessing various LLMs

## License

MIT
