'use client';

import React, { useState, useEffect } from 'react';
import MarkdownRenderer from './MarkdownRenderer';

interface AIGeneratedContentProps {
  content: string;
  isLoading: boolean;
}

const AIGeneratedContent: React.FC<AIGeneratedContentProps> = ({ content, isLoading }) => {
  const [editedContent, setEditedContent] = useState<string>(content);

  useEffect(() => {
    setEditedContent(content);
  }, [content]);

  const handleContentChange = (newContent: string) => {
    setEditedContent(newContent);
  };

  return (
    <div className="mt-6 w-full">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">AI Generated Content</h2>
      </div>

      {/* Use the Markdown Renderer */}
      <MarkdownRenderer 
        content={editedContent} 
        isLoading={isLoading} 
        onContentChange={handleContentChange}
      />
    </div>
  );
};

export default AIGeneratedContent;
