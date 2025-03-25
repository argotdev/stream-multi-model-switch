import { DefaultGenerics, Event } from 'stream-chat';
import { AgentPlatform } from '../agents/types';

export interface AIModelSwitchEvent {
  type: 'custom_model_switch';
  data: {
    channel_id: string;
    platform: AgentPlatform;
  };
}

export interface AIModelSwitchedEvent {
  type: 'custom_model_switched';
  data: {
    channel_id: string;
    platform: AgentPlatform;
  };
}

export interface AIModelSwitchErrorEvent {
  type: 'custom_model_switch_error';
  data: {
    channel_id: string;
    error: string;
  };
}

declare module 'stream-chat' {
  interface Events {
    'custom_model_switch': AIModelSwitchEvent;
    'custom_model_switched': AIModelSwitchedEvent;
    'custom_model_switch_error': AIModelSwitchErrorEvent;
  }
}

export interface CustomStreamGenerics extends DefaultGenerics {
  EventType: AIModelSwitchEvent['type'] | AIModelSwitchedEvent['type'] | AIModelSwitchErrorEvent['type'];
}

export interface CustomEvents {
  'custom_model_switch': AIModelSwitchEvent;
  'custom_model_switched': AIModelSwitchedEvent;
  'custom_model_switch_error': AIModelSwitchErrorEvent;
} 