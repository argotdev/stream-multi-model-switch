/**
 * Common interface for all AI response handlers
 */
export interface AIResponseHandler {
    /**
     * Start processing the AI response stream
     */
    run(): Promise<void>;
    
    /**
     * Clean up any resources used by the handler
     */
    dispose(): void;
  }