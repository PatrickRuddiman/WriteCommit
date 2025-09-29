export interface AppConfiguration {
  openai_api_key?: string;
  default_model?: string;
  openai_endpoint?: string;
  default_temperature?: number;
  default_topp?: number;
  use_azure_openai?: boolean;
}