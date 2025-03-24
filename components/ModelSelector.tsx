'use client';

import React from 'react';

interface ModelSelectorProps {
  onModelChange: (model: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ onModelChange }) => {
  const [selectedModel, setSelectedModel] = React.useState<string>('Google Gemini 2.0 Flash');

  const modelOptions = [
    "Google Gemini 2.0 Flash",
    "Google Gemini 2.0 Pro",
    "openai/gpt-3.5-turbo",
    "openai/gpt-4",
    "xai/grok",
    "meta-llama/llama-3-8b-instruct"
  ];

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    onModelChange(model);
  };

  return (
    <div className="space-y-1 md:space-y-2 text-xs md:text-sm">
      {modelOptions.map((model) => (
        <div key={model} className="flex items-center">
          <input
            type="radio"
            id={`model-${model}`}
            name="model"
            value={model}
            checked={selectedModel === model}
            onChange={() => handleModelChange(model)}
            className="h-3 w-3 md:h-4 md:w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
          />
          <label
            htmlFor={`model-${model}`}
            className="ml-2 block text-xs md:text-sm text-gray-900 truncate"
          >
            {model}
          </label>
        </div>
      ))}
    </div>
  );
};

export default ModelSelector;
