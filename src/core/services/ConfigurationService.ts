import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import { AppConfiguration } from '../models';

export class ConfigurationService {
  private configDirectory: string;
  private configFilePath: string;

  constructor() {
    const homeDirectory = os.homedir();
    this.configDirectory = path.join(homeDirectory, '.writecommit');
    this.configFilePath = path.join(this.configDirectory, 'config.json');
  }

  async loadConfigurationAsync(): Promise<AppConfiguration | null> {
    try {
      if (!await fs.pathExists(this.configFilePath)) {
        return null;
      }

      const json = await fs.readFile(this.configFilePath, 'utf-8');
      return JSON.parse(json) as AppConfiguration;
    } catch {
      return null;
    }
  }

  async saveConfigurationAsync(config: AppConfiguration): Promise<void> {
    await fs.ensureDir(this.configDirectory);
    const json = JSON.stringify(config, null, 2);
    await fs.writeFile(this.configFilePath, json, 'utf-8');

    // Set appropriate file permissions on Unix systems
    if (process.platform === 'linux' || process.platform === 'darwin') {
      await fs.chmod(this.configFilePath, 0o600);
    }
  }

  async getOpenAiApiKeyAsync(): Promise<string | null> {
    // First check environment variable (highest priority)
    const envApiKey = process.env.OPENAI_API_KEY;
    if (envApiKey) {
      return envApiKey.trim();
    }

    // Then check config file
    const config = await this.loadConfigurationAsync();
    return config?.openaiApiKey?.trim() || null;
  }

  async getOpenAiEndpointAsync(): Promise<string | null> {
    const config = await this.loadConfigurationAsync();
    return config?.openaiEndpoint || null;
  }

  async getDefaultModelAsync(): Promise<string | null> {
    const config = await this.loadConfigurationAsync();
    return config?.defaultModel || null;
  }

  async getProviderAsync(): Promise<'openai' | 'azure' | 'vscode-lm' | null> {
    const config = await this.loadConfigurationAsync();
    return config?.provider || null;
  }

  async useAzureOpenAIAsync(): Promise<boolean> {
    const config = await this.loadConfigurationAsync();
    return config?.useAzureOpenAI ?? false;
  }

  async setupApiKeyAsync(verbose: boolean = false): Promise<boolean> {
    console.log('WriteCommit Setup');
    console.log('=================');
    console.log();
    console.log('Please enter your OpenAI API key (or Azure OpenAI key).');
    console.log('You can get one from: https://platform.openai.com/api-keys or your Azure portal');
    console.log();

    const apiKey = await this.promptMasked('API Key (leave blank if not required): ');
    console.log();

    const azureInput = await this.prompt('Use Azure OpenAI service? (y/N): ');
    const useAzure = azureInput.toLowerCase() === 'y' || azureInput.toLowerCase() === 'yes';

    const endpointPrompt = useAzure
      ? 'Azure endpoint (leave blank to use OpenAI): '
      : 'Endpoint (default: https://api.openai.com/v1): ';
    
    let endpointInput = await this.prompt(endpointPrompt);
    let endpoint: string;
    let finalUseAzure = useAzure;

    if (!endpointInput.trim()) {
      endpoint = 'https://api.openai.com/v1';
      if (useAzure) {
        finalUseAzure = false;
      }
    } else {
      endpoint = endpointInput.trim();
    }

    const modelPrompt = useAzure
      ? 'Deployment name (default: gpt-4o-mini): '
      : 'Default model (default: gpt-4o-mini): ';
    
    const modelInput = await this.prompt(modelPrompt);
    const model = modelInput.trim() || 'gpt-4o-mini';

    const config = await this.loadConfigurationAsync() || {};
    config.openaiApiKey = apiKey ? apiKey.trim() : undefined;
    config.openaiEndpoint = endpoint;
    config.defaultModel = model;
    config.useAzureOpenAI = finalUseAzure;
    config.provider = finalUseAzure ? 'azure' : 'openai';

    await this.saveConfigurationAsync(config);

    console.log(`✅ Configuration saved to ${this.configFilePath}`);

    if (verbose) {
      console.log('Configuration saved successfully.');
      console.log(`Config location: ${this.configFilePath}`);
    }

    // Optionally test the API key
    console.log();
    const testResponse = await this.prompt('Would you like to test the API key? (y/N): ');

    if ((testResponse.toLowerCase() === 'y' || testResponse.toLowerCase() === 'yes') && apiKey) {
      console.log('API key testing will be implemented in the OpenAI service.');
      return true;
    }

    return true;
  }

  private prompt(question: string): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  private async promptMasked(question: string): Promise<string> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      process.stdout.write(question);
      
      let input = '';
      const stdin = process.stdin;
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf-8');

      const onData = (char: string) => {
        char = char.toString();

        if (char === '\n' || char === '\r' || char === '\u0004') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(input);
        } else if (char === '\u0003') {
          process.exit();
        } else if (char === '\u007f' || char === '\b') {
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          input += char;
          process.stdout.write('*');
        }
      };

      stdin.on('data', onData);
    });
  }
}
