import type { Channel, MessageResponse, StreamChat } from 'stream-chat';
import { AIResponseHandler } from '../AIResponseHandler';

export class LlamaResponseHandler implements AIResponseHandler {
  private message_text = '';
  private chunk_counter = 0;
  private controller = new AbortController();

  constructor(
    private readonly llama_stream: NodeJS.ReadableStream,
    private readonly chatClient: StreamChat,
    private readonly channel: Channel,
    private readonly message: MessageResponse,
  ) {
    this.chatClient.on('ai_indicator.stop', this.handleStopGenerating);
  }

  run = async () => {
    try {
      // Process the stream
      for await (const chunk of this.llama_stream) {
        // Convert the chunk to text
        const chunkText = this.parseChunk(chunk);
        
        if (chunkText) {
          this.message_text += chunkText;
          this.chunk_counter++;
          
          // Update the message periodically
          // More frequent updates at the beginning for responsiveness
          if (
            this.chunk_counter % 15 === 0 ||
            (this.chunk_counter < 8 && this.chunk_counter % 3 === 0)
          ) {
            try {
              await this.chatClient.partialUpdateMessage(this.message.id, {
                set: { text: this.message_text, generating: true },
              });
            } catch (error) {
              console.error('Error updating message', error);
            }
          }
        }
      }

      // Final update when stream is complete
      await this.chatClient.partialUpdateMessage(this.message.id, {
        set: { text: this.message_text, generating: false },
      });
      
      // Clear the indicator
      await this.channel.sendEvent({
        type: 'ai_indicator.clear',
        message_id: this.message.id,
      });
    } catch (error) {
      console.error('Error handling Llama stream', error);
      
      // Update with error state
      await this.channel.sendEvent({
        type: 'ai_indicator.update',
        ai_state: 'AI_STATE_ERROR',
        message_id: this.message.id,
      });
      
      // Update the message with error
      if (this.message_text) {
        await this.chatClient.partialUpdateMessage(this.message.id, {
          set: { 
            text: this.message_text + "\n\n[Message generation was interrupted]",
            generating: false 
          },
        });
      } else {
        await this.chatClient.partialUpdateMessage(this.message.id, {
          set: { 
            text: "I'm sorry, but there was an error generating a response.",
            generating: false 
          },
        });
      }
    }
  };

  dispose = () => {
    this.chatClient.off('ai_indicator.stop', this.handleStopGenerating);
  };

  private handleStopGenerating = async () => {
    console.log('Stop generating');
    
    // Abort the request
    this.controller.abort();
    
    // Update the message state
    await this.chatClient.partialUpdateMessage(this.message.id, {
      set: { generating: false },
    });
    
    // Clear the indicator
    await this.channel.sendEvent({
      type: 'ai_indicator.clear',
      message_id: this.message.id,
    });
  };

  // Helper method to parse streaming chunks from Ollama
  private parseChunk(chunk: any): string {
    try {
      const data = chunk.toString().trim();
      
      // Handle empty chunks
      if (!data) return '';
      
      // Split by newlines to handle multiple JSON objects
      const lines: string[] = data.split('\n').filter((line: string) => line.trim());
      let content = '';
      
      // Parse each line as a separate JSON object
      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          
          // Extract the content from the message
          if (json.message && json.message.content) {
            content += json.message.content;
          }
        } catch (e) {
          console.error('Error parsing JSON line:', e);
          // If we can't parse as JSON, try to extract content directly
          const match = line.match(/"content":"([^"]+)"/);
          if (match) {
            content += match[1];
          }
        }
      }
      
      return content;
    } catch (error) {
      console.error('Error parsing chunk', error);
      return '';
    }
  }
}