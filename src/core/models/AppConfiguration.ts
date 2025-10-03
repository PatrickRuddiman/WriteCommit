export interface AppConfiguration {
  provider?: 'openai' | 'azure' | 'vscode-lm';
  openaiApiKey?: string;
  openaiEndpoint?: string;
  azureEndpoint?: string;
  defaultModel?: string;
  defaultTemperature?: number;
  defaultTopP?: number;
  useAzureOpenAI?: boolean;
}
