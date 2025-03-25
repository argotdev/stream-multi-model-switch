# Multi-Model AI Chat for Stream.io

This project demonstrates how to build a flexible multi-model AI chat system using Stream's chat platform. It allows users to seamlessly switch between different AI models (Claude, GPT, and Llama) within the same chat interface.

## Features

- Support for multiple AI models:
  - Anthropic Claude
  - OpenAI GPT
  - Meta Llama
- Dynamic model switching during a conversation
- Real-time streaming responses from all models
- Consistent UI experience across different models
- Model availability status and metadata API
- Support for both single-model and multi-model operation modes

## Prerequisites

- Node.js v20 or higher
- Stream.io account with API key and secret
- API keys for the AI models you want to use (Anthropic, OpenAI)
- Optional: Llama API endpoint (self-hosted or third-party)

## Project Structure

```
├── src/
│   ├── agents/
│   │   ├── anthropic/     # Anthropic Claude implementation
│   │   ├── openai/        # OpenAI GPT implementation
│   │   ├── llama/         # Llama implementation
│   │   ├── AIResponseHandler.ts      # Common response handler interface
│   │   ├── MultiModelAgent.ts         # Multi-model agent implementation
│   │   ├── createAgent.ts             # Factory function for creating agents
│   │   └── types.ts                   # Common types and interfaces
│   ├── index.ts           # Express server and API endpoints
│   └── serverClient.ts    # Stream server client setup
├── .env.example          # Example environment variables
├── package.json
├── tsconfig.json
└── README.md
```

## Setup and Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/stream-multimodel-ai-chat.git
   cd stream-multimodel-ai-chat
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Edit the `.env` file and add your API keys:
   ```
   STREAM_API_KEY=your_stream_api_key
   STREAM_API_SECRET=your_stream_api_secret
   
   # Set to true for multi-model support
   USE_MULTI_MODEL=true
   
   # Add keys for the models you want to use
   ANTHROPIC_API_KEY=your_anthropic_api_key
   OPENAI_API_KEY=your_openai_api_key
   OPENWEATHER_API_KEY=your_openweather_api_key  # Optional for weather function
   LLAMA_API_ENDPOINT=your_llama_api_endpoint
   ```

5. Build and start the server:
   ```bash
   npm start
   ```

## API Endpoints

- `GET /available-models` - Get all available AI models
- `GET /active-model/:channel_id` - Get the active model for a channel
- `POST /switch-model` - Switch the AI model for a channel
- `POST /start-ai-agent` - Start the AI agent for a channel
- `POST /stop-ai-agent` - Stop the AI agent for a channel

## Frontend Integration

The repository includes example React components for integrating with the multi-model system:

- `ModelSwitcher.tsx` - A UI component for selecting and switching AI models
- `useAIModel.ts` - A custom React hook for managing AI model state and listening for model switch events

To use these components in your frontend application:

1. Install the required dependencies:
   ```bash
   npm install stream-chat stream-chat-react axios
   ```

2. Import and use the components in your application:
   ```jsx
   import { ModelSwitcher } from './components/ModelSwitcher';
   import { useAIModel } from './hooks/useAIModel';
   
   function ChatHeader() {
     const { activeModel, availableModels, switchModel } = useAIModel();
     
     return (
       <div className="chat-header">
         <h2>Chat with AI</h2>
         <ModelSwitcher />
       </div>
     );
   }
   ```

## Events

The system uses custom Stream events to communicate between the client and server:

- `ai_model.switch` - Client-to-server event to request a model switch
- `ai_model.switched` - Server-to-client event when a model switch is complete
- `ai_model.switch_error` - Server-to-client event when a model switch fails
- `ai_indicator.update` - Server-to-client event to update the AI indicator state
- `ai_indicator.clear` - Server-to-client event to clear the AI indicator
- `ai_indicator.stop` - Client-to-server event to stop AI generation

## Configuration Options

### Multi-Model Mode

Set `USE_MULTI_MODEL=true` in your environment variables to enable the multi-model mode. When enabled, the system will:

1. Initialize all available models based on provided API keys
2. Allow real-time switching between models
3. Provide model metadata through the API

If set to `false`, the system will use a single model based on the `platform` parameter when starting the AI agent.

### Environment Variables

- `STREAM_API_KEY` & `STREAM_API_SECRET` - Your Stream credentials
- `USE_MULTI_MODEL` - Enable multi-model mode (`true` or `false`)
- `ANTHROPIC_API_KEY` - API key for Anthropic Claude
- `OPENAI_API_KEY` - API key for OpenAI GPT
- `OPENWEATHER_API_KEY` - API key for OpenWeather (used by OpenAI function calling)
- `LLAMA_API_ENDPOINT` - API endpoint for Llama model

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [Stream.io](https://getstream.io/) for the Chat API
- [Anthropic](https://www.anthropic.com/) for Claude
- [OpenAI](https://openai.com/) for GPT
- [Meta](https://ai.meta.com/llama/) for Llama