import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import logger, { Logger } from './Logger.js';

describe('Logger', () => {
  let testLogger;
  let consoleLogSpy;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    testLogger = new Logger();
    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with INFO level by default', () => {
      expect(testLogger.getLevel()).toBe('INFO');
    });

    it('should initialize with empty context', () => {
      expect(testLogger.getContext()).toEqual({});
    });

    it('should have all log levels defined', () => {
      expect(testLogger.levels).toHaveProperty('ERROR');
      expect(testLogger.levels).toHaveProperty('WARN');
      expect(testLogger.levels).toHaveProperty('INFO');
      expect(testLogger.levels).toHaveProperty('DEBUG');
    });
  });

  describe('setLevel', () => {
    it('should set log level to ERROR', () => {
      testLogger.setLevel('ERROR');
      expect(testLogger.getLevel()).toBe('ERROR');
    });

    it('should set log level to WARN', () => {
      testLogger.setLevel('WARN');
      expect(testLogger.getLevel()).toBe('WARN');
    });

    it('should set log level to INFO', () => {
      testLogger.setLevel('INFO');
      expect(testLogger.getLevel()).toBe('INFO');
    });

    it('should set log level to DEBUG', () => {
      testLogger.setLevel('DEBUG');
      expect(testLogger.getLevel()).toBe('DEBUG');
    });

    it('should accept lowercase level names', () => {
      testLogger.setLevel('debug');
      expect(testLogger.getLevel()).toBe('DEBUG');
    });

    it('should throw error for invalid log level', () => {
      expect(() => testLogger.setLevel('INVALID')).toThrow('Invalid log level');
    });
  });

  describe('setContext', () => {
    it('should set token name context', () => {
      testLogger.setContext({ tokenName: 'PEPE' });
      expect(testLogger.getContext()).toEqual({ tokenName: 'PEPE' });
    });

    it('should set token address context', () => {
      testLogger.setContext({ tokenAddress: 'So11111111111111111111111111111111111111112' });
      expect(testLogger.getContext().tokenAddress).toBe('So11111111111111111111111111111111111111112');
    });

    it('should set API endpoint context', () => {
      testLogger.setContext({ apiEndpoint: '/defi/ohlcv' });
      expect(testLogger.getContext().apiEndpoint).toBe('/defi/ohlcv');
    });

    it('should merge multiple context calls', () => {
      testLogger.setContext({ tokenName: 'PEPE' });
      testLogger.setContext({ tokenAddress: 'So11111111111111111111111111111111111111112' });
      
      const context = testLogger.getContext();
      expect(context.tokenName).toBe('PEPE');
      expect(context.tokenAddress).toBe('So11111111111111111111111111111111111111112');
    });

    it('should overwrite existing context keys', () => {
      testLogger.setContext({ tokenName: 'PEPE' });
      testLogger.setContext({ tokenName: 'BONK' });
      
      expect(testLogger.getContext().tokenName).toBe('BONK');
    });
  });

  describe('clearContext', () => {
    beforeEach(() => {
      testLogger.setContext({
        tokenName: 'PEPE',
        tokenAddress: 'So11111111111111111111111111111111111111112',
        apiEndpoint: '/defi/ohlcv'
      });
    });

    it('should clear all context when called without arguments', () => {
      testLogger.clearContext();
      expect(testLogger.getContext()).toEqual({});
    });

    it('should clear specific context key', () => {
      testLogger.clearContext('tokenName');
      
      const context = testLogger.getContext();
      expect(context.tokenName).toBeUndefined();
      expect(context.tokenAddress).toBeDefined();
      expect(context.apiEndpoint).toBeDefined();
    });

    it('should clear multiple context keys', () => {
      testLogger.clearContext(['tokenName', 'apiEndpoint']);
      
      const context = testLogger.getContext();
      expect(context.tokenName).toBeUndefined();
      expect(context.apiEndpoint).toBeUndefined();
      expect(context.tokenAddress).toBeDefined();
    });
  });

  describe('formatTimestamp', () => {
    it('should return timestamp in YYYY-MM-DD HH:MM:SS format', () => {
      const timestamp = testLogger.formatTimestamp();
      
      // Check format with regex
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it('should pad single digit values with zeros', () => {
      // Mock Date to return specific values
      const mockDate = new Date('2024-01-05 09:08:07');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate);
      
      const timestamp = testLogger.formatTimestamp();
      expect(timestamp).toBe('2024-01-05 09:08:07');
      
      vi.restoreAllMocks();
    });
  });

  describe('buildContextString', () => {
    it('should return empty string when no context is set', () => {
      expect(testLogger.buildContextString()).toBe('');
    });

    it('should format token name context', () => {
      testLogger.setContext({ tokenName: 'PEPE' });
      expect(testLogger.buildContextString()).toBe(' [token=PEPE]');
    });

    it('should format token address context with truncation', () => {
      testLogger.setContext({ tokenAddress: 'So11111111111111111111111111111111111111112' });
      expect(testLogger.buildContextString()).toBe(' [address=So111111...]');
    });

    it('should format API endpoint context', () => {
      testLogger.setContext({ apiEndpoint: '/defi/ohlcv' });
      expect(testLogger.buildContextString()).toBe(' [endpoint=/defi/ohlcv]');
    });

    it('should format multiple context values', () => {
      testLogger.setContext({
        tokenName: 'PEPE',
        tokenAddress: 'So11111111111111111111111111111111111111112',
        apiEndpoint: '/defi/ohlcv'
      });
      
      expect(testLogger.buildContextString()).toBe(' [token=PEPE, address=So111111..., endpoint=/defi/ohlcv]');
    });
  });

  describe('shouldLog', () => {
    it('should log ERROR when level is ERROR', () => {
      testLogger.setLevel('ERROR');
      expect(testLogger.shouldLog(testLogger.levels.ERROR)).toBe(true);
      expect(testLogger.shouldLog(testLogger.levels.WARN)).toBe(false);
      expect(testLogger.shouldLog(testLogger.levels.INFO)).toBe(false);
      expect(testLogger.shouldLog(testLogger.levels.DEBUG)).toBe(false);
    });

    it('should log ERROR and WARN when level is WARN', () => {
      testLogger.setLevel('WARN');
      expect(testLogger.shouldLog(testLogger.levels.ERROR)).toBe(true);
      expect(testLogger.shouldLog(testLogger.levels.WARN)).toBe(true);
      expect(testLogger.shouldLog(testLogger.levels.INFO)).toBe(false);
      expect(testLogger.shouldLog(testLogger.levels.DEBUG)).toBe(false);
    });

    it('should log ERROR, WARN, and INFO when level is INFO', () => {
      testLogger.setLevel('INFO');
      expect(testLogger.shouldLog(testLogger.levels.ERROR)).toBe(true);
      expect(testLogger.shouldLog(testLogger.levels.WARN)).toBe(true);
      expect(testLogger.shouldLog(testLogger.levels.INFO)).toBe(true);
      expect(testLogger.shouldLog(testLogger.levels.DEBUG)).toBe(false);
    });

    it('should log all levels when level is DEBUG', () => {
      testLogger.setLevel('DEBUG');
      expect(testLogger.shouldLog(testLogger.levels.ERROR)).toBe(true);
      expect(testLogger.shouldLog(testLogger.levels.WARN)).toBe(true);
      expect(testLogger.shouldLog(testLogger.levels.INFO)).toBe(true);
      expect(testLogger.shouldLog(testLogger.levels.DEBUG)).toBe(true);
    });
  });

  describe('error', () => {
    it('should log error message to console.error', () => {
      testLogger.error('Test error message');
      
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('[ERROR]');
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('Test error message');
    });

    it('should include metadata in error log', () => {
      testLogger.error('Test error', { code: 500 });
      
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('{"code":500}');
    });

    it('should include context in error log', () => {
      testLogger.setContext({ tokenName: 'PEPE' });
      testLogger.error('Test error');
      
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('[token=PEPE]');
    });
  });

  describe('warn', () => {
    it('should log warning message to console.warn', () => {
      testLogger.warn('Test warning message');
      
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('[WARN]');
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('Test warning message');
    });

    it('should include metadata in warning log', () => {
      testLogger.warn('Test warning', { retries: 3 });
      
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('{"retries":3}');
    });

    it('should not log warning when level is ERROR', () => {
      testLogger.setLevel('ERROR');
      testLogger.warn('Test warning');
      
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('info', () => {
    it('should log info message to console.log', () => {
      testLogger.info('Test info message');
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy.mock.calls[0][0]).toContain('[INFO]');
      expect(consoleLogSpy.mock.calls[0][0]).toContain('Test info message');
    });

    it('should include metadata in info log', () => {
      testLogger.info('Test info', { count: 100 });
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy.mock.calls[0][0]).toContain('{"count":100}');
    });

    it('should not log info when level is WARN', () => {
      testLogger.setLevel('WARN');
      testLogger.info('Test info');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('debug', () => {
    it('should log debug message to console.log', () => {
      testLogger.setLevel('DEBUG');
      testLogger.debug('Test debug message');
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy.mock.calls[0][0]).toContain('[DEBUG]');
      expect(consoleLogSpy.mock.calls[0][0]).toContain('Test debug message');
    });

    it('should include metadata in debug log', () => {
      testLogger.setLevel('DEBUG');
      testLogger.debug('Test debug', { details: 'verbose' });
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy.mock.calls[0][0]).toContain('{"details":"verbose"}');
    });

    it('should not log debug when level is INFO', () => {
      testLogger.setLevel('INFO');
      testLogger.debug('Test debug');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('log format', () => {
    it('should include timestamp in log message', () => {
      testLogger.info('Test message');
      
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/);
    });

    it('should include log level in log message', () => {
      testLogger.info('Test message');
      
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('[INFO]');
    });

    it('should format complete log message correctly', () => {
      testLogger.setContext({ tokenName: 'PEPE' });
      testLogger.info('Processing token', { count: 5 });
      
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] \[INFO\] \[token=PEPE\] Processing token {"count":5}$/);
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton logger instance', () => {
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should maintain state across imports', () => {
      logger.setContext({ tokenName: 'TEST' });
      expect(logger.getContext().tokenName).toBe('TEST');
      
      // Clean up
      logger.clearContext();
    });
  });

  describe('integration tests', () => {
    it('should handle complete logging workflow', () => {
      testLogger.setLevel('DEBUG');
      testLogger.setContext({
        tokenName: 'PEPE',
        tokenAddress: 'So11111111111111111111111111111111111111112'
      });
      
      testLogger.debug('Starting data collection');
      testLogger.info('Fetching OHLCV data');
      testLogger.warn('Missing 5 intervals', { missing: 5 });
      testLogger.error('API request failed', { statusCode: 500 });
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(2); // debug + info
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle context changes during logging', () => {
      testLogger.setContext({ tokenName: 'PEPE' });
      testLogger.info('Processing PEPE');
      
      testLogger.setContext({ tokenName: 'BONK' });
      testLogger.info('Processing BONK');
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy.mock.calls[0][0]).toContain('[token=PEPE]');
      expect(consoleLogSpy.mock.calls[1][0]).toContain('[token=BONK]');
    });

    it('should handle clearing context between tokens', () => {
      testLogger.setContext({ tokenName: 'PEPE', tokenAddress: 'So111111' });
      testLogger.info('Processing PEPE');
      
      testLogger.clearContext();
      testLogger.info('Processing next token');
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy.mock.calls[0][0]).toContain('[token=PEPE');
      expect(consoleLogSpy.mock.calls[1][0]).not.toContain('[token=');
    });
  });
});
