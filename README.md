# EthGlobal Judge Agent

## Overview

The EthGlobal Judge Agent is an AI-powered tool designed to score hackathon submissions from EthGlobal. This repository contains the source code for the agent, which is built using a combination of TypeScript, Bun, and various dependencies.

The project makes two key architectural choices:

- Leverages Bun's native shell capabilities for Git operations, enabling fast and type-safe repository management
- Uses long-context AI models (R1, Gemini) to analyze entire codebases without chunking, prioritizing development speed and comprehensive analysis

## Future Improvements

The EthGlobal Judge Agent could be enhanced with several key improvements:

- **Smart Chunking Strategy**: Implement an advanced chunking system with semantic similarity search to handle larger codebases more efficiently while maintaining context coherence.
- **Intelligent File Selection**: Develop a search algorithm to automatically identify and prioritize the most relevant files for analysis, optimizing processing time and resource usage.

## Tech Stack

The EthGlobal Judge Agent leverages the following technologies:

- **TypeScript**: A superset of JavaScript that adds optional static typing and other features to enhance development experience and code reliability.

- **Bun**: A fast all-in-one JavaScript runtime and toolkit with built-in bundler, test runner, and package manager.

- **AI Models**: Multiple state-of-the-art language models for enhanced reasoning and analysis
  - Groq: High-performance inference engine for rapid processing
  - Gemini Pro & Gemini 2.0: Advanced reasoning and complex analysis
  - DeepSeek: Specialized technical understanding and code analysis

## Architecture

The agent's codebase is organized into several key components:

- **Services**: Houses the core business logic

  - Collect Service: Handles repository and submission data retrieval
  - Report Service: Manages report generation and processing

- **Utils**: Contains shared utility functions

  - Logging utilities
  - File system operations
  - Common helper functions

- **Config**: Manages configuration and environment settings

  - Environment variable definitions
  - Schema configurations
  - System constants

- **Index**: Application entry point and main execution logic

## Getting Started

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Environment

Create a `.env` file based on `.env.example` and configure your environment variables:

```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Start the script

```bash
bun run start
```

### 4. Run Tests

```bash
bun run test
```
