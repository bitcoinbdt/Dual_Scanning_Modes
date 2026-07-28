import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import ConfigManager from './ConfigManager.js';

describe('ConfigManager', () => {
  let configManager;
  let originalEnv;

  beforeEach(() => {
    configManager = new ConfigManager();
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('loadEnvironment', () => {
    it('should load API key from environment variable', () => {
      process.env.BIRDEYE_API_KEY = 'test-api-key-123';
      
      configManager.loadEnvironment();
      
      expect(configManager.getApiKey()).toBe('test-api-key-123');
    });

    it('should trim whitespace from API key', () => {
      process.env.BIRDEYE_API_KEY = '  test-api-key-123  ';
      
      configManager.loadEnvironment();
      
      expect(configManager.getApiKey()).toBe('test-api-key-123');
    });

    it('should throw error if BIRDEYE_API_KEY is not set', () => {
      delete process.env.BIRDEYE_API_KEY;
      
      expect(() => configManager.loadEnvironment()).toThrow(
        'BIRDEYE_API_KEY environment variable is not set'
      );
    });

    it('should throw error if BIRDEYE_API_KEY is empty string', () => {
      process.env.BIRDEYE_API_KEY = '';
      
      expect(() => configManager.loadEnvironment()).toThrow(
        'BIRDEYE_API_KEY environment variable is not set'
      );
    });

    it('should throw error if BIRDEYE_API_KEY is only whitespace', () => {
      process.env.BIRDEYE_API_KEY = '   ';
      
      expect(() => configManager.loadEnvironment()).toThrow(
        'BIRDEYE_API_KEY environment variable is not set'
      );
    });
  });

  describe('validateApiKey', () => {
    it('should return true when API key is loaded', () => {
      process.env.BIRDEYE_API_KEY = 'test-key';
      configManager.loadEnvironment();
      
      expect(configManager.validateApiKey()).toBe(true);
    });

    it('should throw error when API key is not loaded', () => {
      expect(() => configManager.validateApiKey()).toThrow(
        'API key not loaded'
      );
    });
  });

  describe('loadTokensFile', () => {
    const testFilePath = 'test-tokens.json';

    afterEach(() => {
      // Clean up test file if it exists
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    });

    it('should load valid tokens file', () => {
      const tokens = [
        {
          name: 'TestToken',
          address: 'So11111111111111111111111111111111111111112',
          launch_time: 1704067200
        }
      ];
      fs.writeFileSync(testFilePath, JSON.stringify(tokens));

      configManager.loadTokensFile(testFilePath);

      expect(configManager.getTokens()).toEqual(tokens);
    });

    it('should throw error if file does not exist', () => {
      expect(() => configManager.loadTokensFile('nonexistent.json')).toThrow(
        'Tokens file not found'
      );
    });

    it('should throw error if file contains invalid JSON', () => {
      fs.writeFileSync(testFilePath, '{ invalid json }');

      expect(() => configManager.loadTokensFile(testFilePath)).toThrow(
        'Invalid JSON in tokens file'
      );
    });

    it('should throw error if JSON is not an array', () => {
      fs.writeFileSync(testFilePath, '{"name": "token"}');

      expect(() => configManager.loadTokensFile(testFilePath)).toThrow(
        'Tokens file must contain a JSON array'
      );
    });

    it('should throw error if tokens array is empty', () => {
      fs.writeFileSync(testFilePath, '[]');

      expect(() => configManager.loadTokensFile(testFilePath)).toThrow(
        'Tokens file must contain at least one token'
      );
    });
  });

  describe('validateTokenSpecification', () => {
    it('should validate token with all required fields', () => {
      const token = {
        name: 'TestToken',
        address: 'So11111111111111111111111111111111111111112',
        launch_time: 1704067200
      };

      expect(() => configManager.validateTokenSpecification(token, 0)).not.toThrow();
    });

    it('should throw error if name is missing', () => {
      const token = {
        address: 'So11111111111111111111111111111111111111112',
        launch_time: 1704067200
      };

      expect(() => configManager.validateTokenSpecification(token, 0)).toThrow(
        "Missing required field 'name'"
      );
    });

    it('should throw error if address is missing', () => {
      const token = {
        name: 'TestToken',
        launch_time: 1704067200
      };

      expect(() => configManager.validateTokenSpecification(token, 0)).toThrow(
        "Missing required field 'address'"
      );
    });

    it('should throw error if launch_time is missing', () => {
      const token = {
        name: 'TestToken',
        address: 'So11111111111111111111111111111111111111112'
      };

      expect(() => configManager.validateTokenSpecification(token, 0)).toThrow(
        "Missing required field 'launch_time'"
      );
    });

    it('should throw error if name is empty string', () => {
      const token = {
        name: '   ',
        address: 'So11111111111111111111111111111111111111112',
        launch_time: 1704067200
      };

      expect(() => configManager.validateTokenSpecification(token, 0)).toThrow(
        "'name' must be a non-empty string"
      );
    });

    it('should throw error if name is not a string', () => {
      const token = {
        name: 123,
        address: 'So11111111111111111111111111111111111111112',
        launch_time: 1704067200
      };

      expect(() => configManager.validateTokenSpecification(token, 0)).toThrow(
        "'name' must be a non-empty string"
      );
    });
  });

  describe('validateAddress', () => {
    it('should accept valid Solana address', () => {
      const address = 'So11111111111111111111111111111111111111112';
      
      expect(() => configManager.validateAddress(address, 'TestToken')).not.toThrow();
    });

    it('should accept valid Ethereum address', () => {
      const address = '0x1234567890123456789012345678901234567890';
      
      expect(() => configManager.validateAddress(address, 'TestToken')).not.toThrow();
    });

    it('should accept Ethereum address with mixed case', () => {
      const address = '0xAbCdEf1234567890123456789012345678901234';
      
      expect(() => configManager.validateAddress(address, 'TestToken')).not.toThrow();
    });

    it('should throw error for empty address', () => {
      expect(() => configManager.validateAddress('   ', 'TestToken')).toThrow(
        "'address' must be a non-empty string"
      );
    });

    it('should throw error for address with invalid characters', () => {
      const address = 'Invalid@Address#123';
      
      expect(() => configManager.validateAddress(address, 'TestToken')).toThrow(
        'Invalid address format'
      );
    });

    it('should throw error for Ethereum address without 0x prefix', () => {
      const address = '1234567890123456789012345678901234567890';
      
      expect(() => configManager.validateAddress(address, 'TestToken')).toThrow(
        'Invalid address format'
      );
    });

    it('should throw error for Ethereum address with wrong length', () => {
      const address = '0x12345678901234567890123456789012345678';
      
      expect(() => configManager.validateAddress(address, 'TestToken')).toThrow(
        'Invalid address format'
      );
    });

    it('should throw error for Solana address that is too short', () => {
      const address = 'So1111111111111111111111111111';
      
      expect(() => configManager.validateAddress(address, 'TestToken')).toThrow(
        'Invalid address format'
      );
    });

    it('should throw error for Solana address that is too long', () => {
      const address = 'So111111111111111111111111111111111111111111111';
      
      expect(() => configManager.validateAddress(address, 'TestToken')).toThrow(
        'Invalid address format'
      );
    });

    it('should throw error for Solana address with invalid base58 characters', () => {
      const address = 'So1111111111111111111111111111111O111112'; // 'O' is not valid base58
      
      expect(() => configManager.validateAddress(address, 'TestToken')).toThrow(
        'Invalid address format'
      );
    });

    it('should throw error if address is not a string', () => {
      expect(() => configManager.validateAddress(12345, 'TestToken')).toThrow(
        "'address' must be a non-empty string"
      );
    });
  });

  describe('validateLaunchTimestamp', () => {
    it('should accept valid Unix timestamp', () => {
      const timestamp = 1704067200; // 2024-01-01
      
      expect(() => configManager.validateLaunchTimestamp(timestamp, 'TestToken')).not.toThrow();
    });

    it('should throw error if timestamp is not a number', () => {
      expect(() => configManager.validateLaunchTimestamp('1704067200', 'TestToken')).toThrow(
        "'launch_time' must be a valid number"
      );
    });

    it('should throw error if timestamp is NaN', () => {
      expect(() => configManager.validateLaunchTimestamp(NaN, 'TestToken')).toThrow(
        "'launch_time' must be a valid number"
      );
    });

    it('should throw error if timestamp is not an integer', () => {
      expect(() => configManager.validateLaunchTimestamp(1704067200.5, 'TestToken')).toThrow(
        "'launch_time' must be an integer"
      );
    });

    it('should throw error if timestamp is negative', () => {
      expect(() => configManager.validateLaunchTimestamp(-1704067200, 'TestToken')).toThrow(
        "'launch_time' must be a positive Unix timestamp"
      );
    });

    it('should throw error if timestamp is zero', () => {
      expect(() => configManager.validateLaunchTimestamp(0, 'TestToken')).toThrow(
        "'launch_time' must be a positive Unix timestamp"
      );
    });

    it('should throw error if timestamp is before year 2000', () => {
      const timestamp = 946684799; // 1999-12-31 23:59:59
      
      expect(() => configManager.validateLaunchTimestamp(timestamp, 'TestToken')).toThrow(
        "'launch_time' is too old (before year 2000)"
      );
    });

    it('should throw error if timestamp is after year 2100', () => {
      const timestamp = 4102444801; // 2100-01-01 00:00:01
      
      expect(() => configManager.validateLaunchTimestamp(timestamp, 'TestToken')).toThrow(
        "'launch_time' is too far in the future (after year 2100)"
      );
    });

    it('should accept timestamp at year 2000 boundary', () => {
      const timestamp = 946684800; // 2000-01-01 00:00:00
      
      expect(() => configManager.validateLaunchTimestamp(timestamp, 'TestToken')).not.toThrow();
    });

    it('should accept timestamp at year 2100 boundary', () => {
      const timestamp = 4102444800; // 2100-01-01 00:00:00
      
      expect(() => configManager.validateLaunchTimestamp(timestamp, 'TestToken')).not.toThrow();
    });
  });

  describe('getConfig', () => {
    it('should return configuration object', () => {
      process.env.BIRDEYE_API_KEY = 'test-key';
      configManager.loadEnvironment();

      const config = configManager.getConfig();

      expect(config).toHaveProperty('apiKey');
      expect(config).toHaveProperty('tokensFilePath');
      expect(config).toHaveProperty('outputDirectory');
      expect(config).toHaveProperty('tokens');
    });

    it('should return a copy of tokens array', () => {
      const testFilePath = 'test-tokens.json';
      const tokens = [
        {
          name: 'TestToken',
          address: 'So11111111111111111111111111111111111111112',
          launch_time: 1704067200
        }
      ];
      fs.writeFileSync(testFilePath, JSON.stringify(tokens));
      configManager.loadTokensFile(testFilePath);

      const config = configManager.getConfig();
      config.tokens.push({ name: 'Modified' });

      // Original should not be modified
      expect(configManager.getTokens()).toHaveLength(1);
      
      fs.unlinkSync(testFilePath);
    });
  });

  describe('integration tests', () => {
    const testFilePath = 'test-integration-tokens.json';

    afterEach(() => {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    });

    it('should load and validate complete configuration', () => {
      process.env.BIRDEYE_API_KEY = 'integration-test-key';
      const tokens = [
        {
          name: 'SolanaToken',
          address: 'So11111111111111111111111111111111111111112',
          launch_time: 1704067200
        },
        {
          name: 'EthereumToken',
          address: '0x1234567890123456789012345678901234567890',
          launch_time: 1704153600
        }
      ];
      fs.writeFileSync(testFilePath, JSON.stringify(tokens));

      configManager.loadEnvironment();
      configManager.loadTokensFile(testFilePath);

      const config = configManager.getConfig();
      expect(config.apiKey).toBe('integration-test-key');
      expect(config.tokens).toHaveLength(2);
      expect(config.tokens[0].name).toBe('SolanaToken');
      expect(config.tokens[1].name).toBe('EthereumToken');
    });

    it('should validate multiple tokens and report first error', () => {
      const tokens = [
        {
          name: 'ValidToken',
          address: 'So11111111111111111111111111111111111111112',
          launch_time: 1704067200
        },
        {
          name: 'InvalidToken',
          address: 'invalid-address',
          launch_time: 1704153600
        }
      ];
      fs.writeFileSync(testFilePath, JSON.stringify(tokens));

      expect(() => configManager.loadTokensFile(testFilePath)).toThrow(
        'Invalid address format'
      );
    });
  });
});
