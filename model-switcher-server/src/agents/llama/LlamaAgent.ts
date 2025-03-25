import axios from 'axios';
import { AIAgent } from '../types';
import { LlamaResponseHandler } from './LlamaResponseHandler';
import type { Channel, DefaultGenerics, Event, StreamChat } from 'stream-chat';

export class LlamaAgent implements AIAgent {
  private apiEndpoint?: string;
  private modelName?: string;
  private handlers: LlamaResponseHandler[] = [];
  private lastInteractionTs = Date.now();

  constructor(
    readonly chatClient: StreamChat,
    readonly channel: Channel,
  ) {}

  dispose = async () => {
    this.handlers.forEach((handler) => handler.dispose());
    this.handlers = [];
  };

  getLastInteraction = (): number => this.lastInteractionTs;

  init = async () => {
    const apiEndpoint = process.env.LLAMA_API_ENDPOINT || 'http://localhost:11434';
    const modelName = process.env.LLAMA_MODEL_NAME || 'llama2';
    
    if (!apiEndpoint) {
      throw new Error('Llama API endpoint is required');
    }
    
    this.apiEndpoint = apiEndpoint;
    this.modelName = modelName;
  };

  handleMessage = async (e: Event<DefaultGenerics>) => {
    if (!this.apiEndpoint || !this.modelName) {
      console.error('Llama API endpoint or model name is not initialized');
      return;
    }

    if (!e.message || e.message.ai_generated) {
      console.log('Skip handling ai generated message');
      return;
    }

    const message = e.message.text;
    if (!message) return;

    this.lastInteractionTs = Date.now();

    // Extract the last few messages for context
    const messages = this.channel.state.messages
      .slice(-5)
      .filter((msg) => msg.text && msg.text.trim() !== '')
      .map((message) => ({
        role: message.user?.id.startsWith('ai-bot') ? 'assistant' : 'user',
        content: message.text || '',
      }));

    // Add the current message if it's a reply
    if (e.message.parent_id !== undefined) {
      messages.push({
        role: 'user',
        content: message,
      });
    }

    // Create a placeholder message while we wait for the response
    const { message: channelMessage } = await this.channel.sendMessage({
      text: '',
      ai_generated: true,
    });

    try {
      // Send thinking indicator
      await this.channel.sendEvent({
        type: 'ai_indicator.update',
        ai_state: 'AI_STATE_THINKING',
        message_id: channelMessage.id,
      });

      // Start streaming process with Llama
      const response = await this.startLlamaStream(messages);
      
      // Create handler for the response
      const handler = new LlamaResponseHandler(
        response,
        this.chatClient,
        this.channel,
        channelMessage,
      );
      
      void handler.run();
      this.handlers.push(handler);
    } catch (error) {
      console.error('Error creating Llama stream:', error);
      
      // Update the message to show the error
      await this.chatClient.partialUpdateMessage(channelMessage.id, {
        set: { 
          text: 'Sorry, I encountered an error while processing your request.', 
          generating: false 
        },
      });
      
      // Clear the indicator
      await this.channel.sendEvent({
        type: 'ai_indicator.clear',
        message_id: channelMessage.id,
      });
    }
  };

  private startLlamaStream = async (messages: any[]) => {
    try {
      // Make the API call to Ollama
      const response = await axios.post(
        `${this.apiEndpoint}/api/chat`,
        {
          model: this.modelName,
          messages: messages,
          stream: true
        },
        {
          responseType: 'stream'
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error calling Ollama API:', error);
      throw error;
    }
  };
}