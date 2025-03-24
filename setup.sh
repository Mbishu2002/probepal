#!/bin/bash

# Setup script for Research Assistant Next.js App

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js 16.8.0 or later."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)
if [ $NODE_MAJOR -lt 16 ]; then
    echo "Node.js version 16.8.0 or later is required. Current version: $NODE_VERSION"
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Check if .env.local exists, if not create it from .env.example
if [ ! -f .env.local ]; then
    echo "Creating .env.local from .env.example..."
    cp .env.example .env.local
    echo "Please edit .env.local to add your API keys."
fi

# Copy system_prompt.txt if it exists in the parent directory
if [ -f ../system_prompt.txt ]; then
    echo "Copying system_prompt.txt from parent directory..."
    cp ../system_prompt.txt .
fi

echo "Setup complete! Run 'npm run dev' to start the development server."
