import { AIAgent, AgentPlatform } from './types';
import { StreamChat, Channel, DefaultGenerics, Event } from 'stream-chat';
import { AnthropicAgent } from './anthropic/AnthropicAgent';
import { OpenAIAgent } from './openai/OpenAIAgent';
import { LlamaAgent } from './llama/LlamaAgent';
import { AIResponseHandler } from './AIResponseHandler';
import { AIModelSwitchEvent, AIModelSwitchedEvent, AIModelSwitchErrorEvent } from '../types/stream';

export class MultiModelAgent implements AIAgent {
  private agents: Map<AgentPlatform, AIAgent> = new Map();
  private activeAgent: AgentPlatform;
  private lastInteractionTs = Date.now();
  private handlers: AIResponseHandler[] = [];

  constructor(
    readonly chatClient: StreamChat,
    readonly channel: Channel,
    initialPlatform: AgentPlatform = AgentPlatform.ANTHROPIC
  ) {
    this.activeAgent = initialPlatform;
  }

  init = async () => {
    // Initialize all supported agents
    this.agents.set(AgentPlatform.ANTHROPIC, new AnthropicAgent(this.chatClient, this.channel));
    this.agents.set(AgentPlatform.OPENAI, new OpenAIAgent(this.chatClient, this.channel));
    this.agents.set(AgentPlatform.LLAMA, new LlamaAgent(this.chatClient, this.channel));

    // Initialize all agents
    await Promise.all(
      Array.from(this.agents.values()).map((agent) => agent.init()),
    );

    // Set up event listeners
    this.chatClient.on('message.new', this.handleMessage);
    this.chatClient.on('custom_model_switch', this.handleModelSwitch);
    this.chatClient.on('custom_model_switch_error', this.handleModelSwitchError);
  };

  dispose = async () => {
    // Clean up event listeners
    this.chatClient.off('message.new', this.handleMessage);
    this.chatClient.off('custom_model_switch', this.handleModelSwitch);
    this.chatClient.off('custom_model_switch_error', this.handleModelSwitchError);

    // Clean up all agents
    await Promise.all(
      Array.from(this.agents.values()).map((agent) => agent.dispose()),
    );
    
    this.agents.clear();
    
    // Disconnect the chat client
    await this.chatClient.disconnectUser();

    // Dispose all handlers
    this.handlers.forEach(handler => handler.dispose());
    this.handlers = [];
  };

  getLastInteraction = (): number => this.lastInteractionTs;

  private handleModelSwitch = async (e: Event<DefaultGenerics>) => {
    const platform = (e as any).data?.platform as AgentPlatform;
    if (!platform) {
      console.error('No platform specified in model switch event');
      return;
    }

    if (!this.agents.has(platform)) {
      console.error(`Agent for platform ${platform} is not initialized`);
      
      // Send error event to the channel
      await this.channel.sendEvent({
        type: 'custom_model_switch_error' as any,
        data: {
          channel_id: this.channel.cid,
          error: `AI model ${platform} is not available`
        }
      });
      
      return;
    }

    const agent = this.agents.get(platform);
    if (!agent) {
      await this.channel.sendEvent({
        type: 'custom_model_switch_error' as any,
        data: {
          channel_id: this.channel.cid,
          error: `Agent not initialized for platform: ${platform}`
        }
      });
      return;
    }

    this.activeAgent = platform;
    console.log(`Switched to ${platform} agent`);
    
    // Send confirmation event to the channel
    await this.channel.sendEvent({
      type: 'custom_model_switched' as any,
      data: {
        channel_id: this.channel.cid,
        platform
      }
    });
  };

  private handleModelSwitchError = async (e: Event<DefaultGenerics>) => {
    const error = (e as any).data?.error;
    if (!error) return;

    console.log('Model switch error:', error);

    // Try to fall back to a different model
    const currentPlatform = this.activeAgent;
    for (const [platform, agent] of this.agents.entries()) {
      if (platform !== currentPlatform && agent) {
        console.log(`Attempting to fall back to ${platform} agent`);
        this.activeAgent = platform;
        
        // Send confirmation event
        await this.channel.sendEvent({
          type: 'custom_model_switched' as any,
          data: {
            channel_id: this.channel.cid,
            platform
          }
        });
        
        return;
      }
    }

    // If no fallback is available, send an error message
    await this.channel.sendMessage({
      text: "I'm sorry, but all AI models are currently unavailable. Please try again later.",
      ai_generated: true
    });
  };

  private handleMessage = async (e: Event<DefaultGenerics>) => {
    // Update the last interaction timestamp
    this.lastInteractionTs = Date.now();
    
    // Get the active agent
    const agent = this.agents.get(this.activeAgent);
    
    if (!agent) {
      console.error(`Active agent ${this.activeAgent} is not initialized`);
      
      // Try to fall back to a different agent
      for (const [platform, fallbackAgent] of this.agents.entries()) {
        if (fallbackAgent) {
          this.activeAgent = platform;
          console.log(`Falling back to ${platform} agent`);
          
          // Process the message with the fallback agent
          await this.processMessageWithAgent(fallbackAgent, e);
          return;
        }
      }
      
      // If no fallback is available, send an error message
      await this.channel.sendMessage({
        text: "I'm sorry, but all AI models are currently unavailable. Please try again later.",
        ai_generated: true
      });
      
      return;
    }
    
    // Process the message with the active agent
    await this.processMessageWithAgent(agent, e);
  };

  private processMessageWithAgent = async (agent: AIAgent, e: Event<DefaultGenerics>) => {
    if (!e.message || e.message.ai_generated) {
      // Skip AI-generated messages or events without messages
      return;
    }

    const message = e.message.text;
    if (!message) return;

    // Let the agent handle the message
    // Since each agent has its own message handler,
    // we simply forward the event and let the agent process it
    if (typeof (agent as any).handleMessage === 'function') {
      await (agent as any).handleMessage(e);
    }
  };

  // Method to get available models
  getAvailableModels = (): AgentPlatform[] => {
    return Array.from(this.agents.keys());
  };

  // Method to get the currently active model
  getActiveModel = (): AgentPlatform => {
    return this.activeAgent;
  };
}