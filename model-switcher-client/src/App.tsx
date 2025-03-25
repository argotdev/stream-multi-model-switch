import React, { useEffect, useState } from 'react';
import { StreamChat } from 'stream-chat';
import {
  Chat,
  Channel,
  ChannelHeader,
  MessageList,
  MessageInput,
  Window,
} from 'stream-chat-react';
import { ModelSwitcher } from './components/ModelSwitcher';

// Initialize Stream Chat client
const chatClient = StreamChat.getInstance(process.env.REACT_APP_STREAM_API_KEY || '');

const App: React.FC = () => {
  const [channel, setChannel] = useState<any>(null);

  useEffect(() => {
    const setupChat = async () => {
      // Add check for API key
      if (!process.env.REACT_APP_STREAM_API_KEY) {
        console.error('Stream API key is not defined');
        return;
      }

      // Add check for user token
      if (!process.env.REACT_APP_STREAM_USER_TOKEN) {
        console.error('Stream user token is not defined');
        return;
      }

      try {
        // Connect user with role
        await chatClient.connectUser(
          {
            id: 'andrew356',
            role: 'admin',
          },
          process.env.REACT_APP_STREAM_USER_TOKEN
        );
        console.log('User connected');

        // Create or join a channel
        const channel = chatClient.channel('messaging', 'demo-channel', {
          name: 'Demo Channel',
        });
        
        await channel.watch();
        setChannel(channel);
        console.log('Channel created or joined');

        console.log('Token available:', !!process.env.REACT_APP_STREAM_USER_TOKEN);
      } catch (error) {
        console.error('Error connecting to Stream:', error);
      }
    };

    setupChat();
  }, []);

  if (!channel) {
    return <div>Loading...</div>;
  }

  return (
    <Chat client={chatClient}>
      <Channel channel={channel}>
        <Window>
          <ChannelHeader />
          <ModelSwitcher />
          <MessageList />
          <MessageInput />
        </Window>
      </Channel>
    </Chat>
  );
};

export default App; 