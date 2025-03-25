import React, { useState, useEffect } from 'react';
import { useChannelStateContext } from 'stream-chat-react';
import axios from 'axios';
import './ModelSwitcher.css';

// Define type for model information
interface ModelInfo {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  available: boolean;
}

// Your backend API base URL
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

export const ModelSwitcher: React.FC = () => {
  const { channel } = useChannelStateContext();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [activeModel, setActiveModel] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize AI agent and fetch models on component mount
  useEffect(() => {
    const initializeAI = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Start the AI agent if we have a channel
        if (channel.id) {
          try {
            await axios.post(`${API_BASE_URL}/start-ai-agent`, {
              channel_id: channel.id,
              channel_type: 'messaging',
              platform: 'anthropic' // Default to Anthropic
            });
          } catch (err) {
            // If the agent is already started, this will throw an error
            // We can ignore it as it means the agent is already running
            console.log('AI agent may already be running:', err);
          }
        }
        
        // Fetch available models
        const modelsResponse = await axios.get(`${API_BASE_URL}/available-models`);
        console.log('Models response:', modelsResponse.data);
        setModels(modelsResponse.data.models);
        
        // Fetch active model for this channel
        if (channel.id) {
          const activeModelResponse = await axios.get(`${API_BASE_URL}/active-model/${channel.id}`);
          setActiveModel(activeModelResponse.data.activeModel);
        }
      } catch (err) {
        console.error('Error initializing AI:', err);
        //setError('Failed to initialize AI. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    initializeAI();
  }, [channel.id]);

  // Handle model selection
  const handleModelChange = async (modelId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Call the API to switch the model
      await axios.post(`${API_BASE_URL}/switch-model`, {
        channel_id: channel.id,
        platform: modelId
      });
      
      // Update the active model locally
      setActiveModel(modelId);
    } catch (err) {
      console.error('Error switching model:', err);
      setError('Failed to switch AI model. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && models.length === 0) {
    return <div className="model-switcher-loading">Loading AI models...</div>;
  }

  if (error && models.length === 0) {
    return <div className="model-switcher-error">{error}</div>;
  }

  return (
    <div className="model-switcher">
      <h3 className="model-switcher-title">Select AI Model</h3>
      
      {error && <div className="model-switcher-error">{error}</div>}
      
      <div className="model-switcher-models">
        {models.map((model) => (
          <div
            key={model.id}
            className={`model-option ${activeModel === model.id ? 'active' : ''} ${!model.available ? 'disabled' : ''}`}
            onClick={() => model.available && handleModelChange(model.id)}
          >
            {model.iconUrl && (
              <img 
                src={model.iconUrl} 
                alt={`${model.name} icon`} 
                className="model-icon" 
              />
            )}
            <div className="model-details">
              <h4 className="model-name">{model.name}</h4>
              <p className="model-description">{model.description}</p>
              {!model.available && <span className="model-unavailable">Unavailable</span>}
              {activeModel === model.id && <span className="model-active">Active</span>}
            </div>
          </div>
        ))}
      </div>
      
      {loading && <div className="model-switcher-loading-overlay">Updating...</div>}
    </div>
  );
}; 