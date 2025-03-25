import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { AIAgent, AgentPlatform, ModelInfo } from './agents/types';
import { createAgent } from './agents/createAgent';
import { apiKey, serverClient } from './serverClient';
import { MultiModelAgent } from './agents/MultiModelAgent';
import { AnthropicAgent } from './agents/anthropic/AnthropicAgent';
import { OpenAIAgent } from './agents/openai/OpenAIAgent';
import { LlamaAgent } from './agents/llama/LlamaAgent';
import { AIModelSwitchEvent } from './types/stream';

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

// Map to store the AI Agent instances
// [cid: string]: AI Agent
const aiAgentCache = new Map<string, AIAgent>();
const pendingAiAgents = new Set<string>();

// TODO: temporary set to 8 hours, should be cleaned up at some point
const inactivityThreshold = 480 * 60 * 1000;
setInterval(async () => {
  const now = Date.now();
  for (const [userId, aiAgent] of aiAgentCache) {
    if (now - aiAgent.getLastInteraction() > inactivityThreshold) {
      console.log(`Disposing AI Agent due to inactivity: ${userId}`);
      await disposeAiAgent(aiAgent, userId);
      aiAgentCache.delete(userId);
    }
  }
}, 5000);

app.get('/', (req, res) => {
  res.json({
    message: 'GetStream AI Server is running',
    apiKey: apiKey,
    activeAgents: aiAgentCache.size,
  });
});

/**
 * Handle the request to start the AI Agent
 */
app.post('/start-ai-agent', async (req, res) => {
  const {
    channel_id,
    channel_type = 'messaging',
    platform = AgentPlatform.ANTHROPIC,
  } = req.body;

  // Simple validation
  if (!channel_id) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  let channel_id_updated = channel_id;
  if (channel_id.includes(':')) {
    const parts = channel_id.split(':');
    if (parts.length > 1) {
      channel_id_updated = parts[1];
    }
  }

  const user_id = `ai-bot-${channel_id_updated.replace(/!/g, '')}`;
  try {
    if (!aiAgentCache.has(user_id) && !pendingAiAgents.has(user_id)) {
      pendingAiAgents.add(user_id);

      await serverClient.upsertUser({
        id: user_id,
        name: 'AI Bot',
        role: 'admin',
      });
      const channel = serverClient.channel(channel_type, channel_id_updated);
      try {
        await channel.addMembers([user_id]);
      } catch (error) {
        console.error('Failed to add members to channel', error);
      }

      await channel.watch();

      const agent = await createAgent(
        user_id,
        platform,
        channel_type,
        channel_id_updated,
      );

      await agent.init();
      if (aiAgentCache.has(user_id)) {
        await agent.dispose();
      } else {
        aiAgentCache.set(user_id, agent);
      }
    } else {
      console.log(`AI Agent ${user_id} already started`);
    }

    res.json({ message: 'AI Agent started', data: [] });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error('Failed to start AI Agent', errorMessage);
    res
      .status(500)
      .json({ error: 'Failed to start AI Agent', reason: errorMessage });
  } finally {
    pendingAiAgents.delete(user_id);
  }
});

/**
 * Handle the request to stop the AI Agent
 */
app.post('/stop-ai-agent', async (req, res) => {
  const { channel_id } = req.body;
  try {
    const userId = `ai-bot-${channel_id.replace(/!/g, '')}`;
    const aiAgent = aiAgentCache.get(userId);
    if (aiAgent) {
      await disposeAiAgent(aiAgent, userId);
      aiAgentCache.delete(userId);
    }
    res.json({ message: 'AI Agent stopped', data: [] });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error('Failed to stop AI Agent', errorMessage);
    res
      .status(500)
      .json({ error: 'Failed to stop AI Agent', reason: errorMessage });
  }
});

/**
 * Get available AI models
 */
app.get('/available-models', (req, res) => {
  const models: ModelInfo[] = [
    {
      id: AgentPlatform.ANTHROPIC,
      name: 'Claude',
      description: 'Anthropic\'s Claude, known for helpfulness, harmlessness, and honesty',
      iconUrl: '/model-icons/claude.png',
      available: !!process.env.ANTHROPIC_API_KEY
    },
    {
      id: AgentPlatform.OPENAI,
      name: 'GPT',
      description: 'OpenAI\'s GPT model with function calling capabilities',
      iconUrl: '/model-icons/openai.png',
      available: !!process.env.OPENAI_API_KEY
    },
    {
      id: AgentPlatform.LLAMA,
      name: 'Llama',
      description: 'Meta\'s open-source Llama model',
      iconUrl: '/model-icons/meta.png',
      available: !!process.env.LLAMA_API_ENDPOINT
    }
  ];
  
  res.json({ models });
});

/**
 * Switch AI model for a specific channel
 */
app.post('/switch-model', async (req, res) => {
  const { channel_id, platform } = req.body;
  console.log('Switching model', channel_id, platform);
  
  if (!channel_id || !platform) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }
  
  try {
    const userId = `ai-bot-${channel_id.replace(/!/g, '')}`;
    const aiAgent = aiAgentCache.get(userId);
    console.log('AI agent', aiAgent);
    
    if (!aiAgent) {
      res.status(404).json({ error: 'AI agent not found for this channel' });
      return;
    }
    
    // Check if this is a MultiModelAgent
    if (aiAgent instanceof MultiModelAgent) {
      // Send the model switch event to the channel
      await aiAgent.channel.sendEvent({
        type: 'custom_model_switch' as any,
        data: {
          channel_id: channel_id,
          platform
        }
      });
      
      res.json({ message: 'Model switch initiated', platform });
    } else {
      res.status(400).json({ 
        error: 'Model switching is only available with multi-model agents',
        hint: 'Set USE_MULTI_MODEL=true in your environment variables'
      });
    }
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error('Failed to switch model', errorMessage);
    res
      .status(500)
      .json({ error: 'Failed to switch model', reason: errorMessage });
  }
});

/**
 * Get the active model for a channel
 */
app.get('/active-model/:channel_id', (req, res) => {
  const { channel_id } = req.params;
  
  if (!channel_id) {
    res.status(400).json({ error: 'Missing channel_id' });
    return;
  }
  
  try {
    const userId = `ai-bot-${channel_id.replace(/!/g, '')}`;
    const aiAgent = aiAgentCache.get(userId);
    
    if (!aiAgent) {
      res.status(404).json({ error: 'AI agent not found for this channel' });
      return;
    }
    
    // Check if this is a MultiModelAgent
    if (aiAgent instanceof MultiModelAgent) {
      const activeModel = aiAgent.getActiveModel();
      const availableModels = aiAgent.getAvailableModels();
      
      res.json({ 
        activeModel,
        availableModels
      });
    } else {
      // For single-model agents, return the type of agent
      let activeModel: AgentPlatform;
      
      if (aiAgent instanceof AnthropicAgent) {
        activeModel = AgentPlatform.ANTHROPIC;
      } else if (aiAgent instanceof OpenAIAgent) {
        activeModel = AgentPlatform.OPENAI;
      } else if (aiAgent instanceof LlamaAgent) {
        activeModel = AgentPlatform.LLAMA;
      } else {
        activeModel = AgentPlatform.ANTHROPIC; // Default
      }
      
      res.json({ 
        activeModel,
        availableModels: [activeModel]
      });
    }
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error('Failed to get active model', errorMessage);
    res
      .status(500)
      .json({ error: 'Failed to get active model', reason: errorMessage });
  }
});

async function disposeAiAgent(aiAgent: AIAgent, userId: string) {
  await aiAgent.dispose();

  const channel = serverClient.channel(
    aiAgent.channel.type,
    aiAgent.channel.id,
  );
  await channel.removeMembers([userId]);
}

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});