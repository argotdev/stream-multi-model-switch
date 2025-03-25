import type { Channel, StreamChat } from 'stream-chat';

export interface AIAgent {
  init(): Promise<void>;
  dispose(): Promise<void>;
  getLastInteraction(): number;

  chatClient: StreamChat;
  channel: Channel;
}

export enum AgentPlatform {
  ANTHROPIC = 'anthropic',
  OPENAI = 'openai',
  LLAMA = 'llama'
}

export interface ModelInfo {
  id: AgentPlatform;
  name: string;
  description: string;
  iconUrl?: string;
  available: boolean;
}