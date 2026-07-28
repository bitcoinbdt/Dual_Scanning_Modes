import { describe, it, expect } from 'vitest';
import {
  validateOHLCVRecord,
  validateTransaction,
  validateFilesystemSafeName,
  validateOHLCVBatch,
  validateTransactionBatch
} from './Validators.js';

describe('Validators', () => {
  describe('validateOHLCVRecord', () => {
    it('should validate a correct OHLCV record', () => {
      const record = {
        timestamp: 1704067200,
        open: 0.000123,
        high: 0.000125,
        low: 0.000122,
        close: 0.000124,
        volume: 15000000
      };

      const result = validateOHLCVRecord(record);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject null or undefined record', () => {
      expect(validateOHLCVRecord(null).valid).toBe(false);
      expect(validateOHLCVRecord(undefined).valid).toBe(false);
      expect(validateOHLCVRecord(null).errors).toContain('OHLCV record must be an object');
    });

    it('should reject record with missing required fields', () => {
      const record = {
        timestamp: 1704067200,
        open: 0.000123
        // missing high, low, close, volume
      };

      const result = validateOHLCVRecord(record);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: high');
      expect(result.errors).toContain('Missing required field: low');
      expect(result.errors).toContain('Missing required field: close');
      expect(result.errors).toContain('Missing required field: volume');
    });

    it('should reject record with invalid timestamp', () => {
      const record = {
        timestamp: 'invalid',
        open: 0.000123,
        high: 0.000125,
        low: 0.000122,
        close: 0.000124,
        volume: 15000000
      };

      const result = validateOHLCVRecord(record);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('timestamp must be an integer');
    });

    it('should reject record with negative timestamp', () => {
      const record = {
        timestamp: -1,
        open: 0.000123,
        high: 0.000125,
        low: 0.000122,
        close: 0.000124,
        volume: 15000000
      };

      const result = validateOHLCVRecord(record);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('timestamp must be positive');
    });

    it('should reject record with non-numeric price fields', () => {
      const record = {
        timestamp: 1704067200,
        open: 'invalid',
        high: 0.000125,
        low: 0.000122,
        close: 0.000124,
        volume: 15000000
      };

      const result = validateOHLCVRecord(record);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('open must be a valid number');
    });

    it('should reject record with negative prices', () => {
      const record = {
        timestamp: 1704067200,
        open: -0.000123,
        high: 0.000125,
        low: 0.000122,
        close: 0.000124,
        volume: 15000000
      };

      const result = validateOHLCVRecord(record);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('open must be non-negative');
    });

    it('should reject record with negative volume', () => {
      const record = {
        timestamp: 1704067200,
        open: 0.000123,
        high: 0.000125,
        low: 0.000122,
        close: 0.000124,
        volume: -15000000
      };

      const result = validateOHLCVRecord(record);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('volume must be non-negative');
    });

    it('should reject record where high < low', () => {
      const record = {
        timestamp: 1704067200,
        open: 0.000123,
        high: 0.000120, // lower than low
        low: 0.000122,
        close: 0.000121,
        volume: 15000000
      };

      const result = validateOHLCVRecord(record);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('high price must be greater than or equal to low price');
    });

    it('should reject record where high < open', () => {
      const record = {
        timestamp: 1704067200,
        open: 0.000125,
        high: 0.000123, // lower than open
        low: 0.000122,
        close: 0.000123,
        volume: 15000000
      };

      const result = validateOHLCVRecord(record);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('high price must be greater than or equal to open price');
    });

    it('should reject record where high < close', () => {
      const record = {
        timestamp: 1704067200,
        open: 0.000123,
        high: 0.000124,
        low: 0.000122,
        close: 0.000126, // higher than high
        volume: 15000000
      };

      const result = validateOHLCVRecord(record);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('high price must be greater than or equal to close price');
    });

    it('should reject record where low > open', () => {
      const record = {
        timestamp: 1704067200,
        open: 0.000120,
        high: 0.000125,
        low: 0.000122, // higher than open
        close: 0.000124,
        volume: 15000000
      };

      const result = validateOHLCVRecord(record);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('low price must be less than or equal to open price');
    });

    it('should reject record where low > close', () => {
      const record = {
        timestamp: 1704067200,
        open: 0.000123,
        high: 0.000125,
        low: 0.000124, // higher than close
        close: 0.000122,
        volume: 15000000
      };

      const result = validateOHLCVRecord(record);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('low price must be less than or equal to close price');
    });

    it('should accept record with zero volume', () => {
      const record = {
        timestamp: 1704067200,
        open: 0.000123,
        high: 0.000123,
        low: 0.000123,
        close: 0.000123,
        volume: 0
      };

      const result = validateOHLCVRecord(record);
      expect(result.valid).toBe(true);
    });

    it('should accept record where all prices are equal', () => {
      const record = {
        timestamp: 1704067200,
        open: 0.000123,
        high: 0.000123,
        low: 0.000123,
        close: 0.000123,
        volume: 15000000
      };

      const result = validateOHLCVRecord(record);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateTransaction', () => {
    it('should validate a correct transaction record', () => {
      const record = {
        txHash: '5J7z...',
        blockTime: 1704067245,
        from: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        to: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
        amount: 1000000000
      };

      const result = validateTransaction(record);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject null or undefined record', () => {
      expect(validateTransaction(null).valid).toBe(false);
      expect(validateTransaction(undefined).valid).toBe(false);
      expect(validateTransaction(null).errors).toContain('Transaction record must be an object');
    });

    it('should reject record with missing required fields', () => {
      const record = {
        txHash: '5J7z...',
        blockTime: 1704067245
        // missing from, to, amount
      };

      const result = validateTransaction(record);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: from');
      expect(result.errors).toContain('Missing required field: to');
      expect(result.errors).toContain('Missing required field: amount');
    });

    it('should reject record with empty txHash', () => {
      const record = {
        txHash: '',
        blockTime: 1704067245,
        from: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        to: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
        amount: 1000000000
      };

      const result = validateTransaction(record);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('txHash must be a non-empty string');
    });

    it('should reject record with invalid blockTime', () => {
      const record = {
        txHash: '5J7z...',
        blockTime: 'invalid',
        from: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        to: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
        amount: 1000000000
      };

      const result = validateTransaction(record);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('blockTime must be an integer');
    });

    it('should reject record with negative blockTime', () => {
      const record = {
        txHash: '5J7z...',
        blockTime: -1,
        from: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        to: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
        amount: 1000000000
      };

      const result = validateTransaction(record);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('blockTime must be positive');
    });

    it('should reject record with empty from address', () => {
      const record = {
        txHash: '5J7z...',
        blockTime: 1704067245,
        from: '',
        to: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
        amount: 1000000000
      };

      const result = validateTransaction(record);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('from address must be a non-empty string');
    });

    it('should reject record with empty to address', () => {
      const record = {
        txHash: '5J7z...',
        blockTime: 1704067245,
        from: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        to: '',
        amount: 1000000000
      };

      const result = validateTransaction(record);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('to address must be a non-empty string');
    });

    it('should reject record with invalid amount', () => {
      const record = {
        txHash: '5J7z...',
        blockTime: 1704067245,
        from: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        to: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
        amount: 'invalid'
      };

      const result = validateTransaction(record);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('amount must be a valid number');
    });

    it('should reject record with negative amount', () => {
      const record = {
        txHash: '5J7z...',
        blockTime: 1704067245,
        from: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        to: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
        amount: -1000000000
      };

      const result = validateTransaction(record);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('amount must be non-negative');
    });

    it('should accept record with zero amount', () => {
      const record = {
        txHash: '5J7z...',
        blockTime: 1704067245,
        from: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        to: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
        amount: 0
      };

      const result = validateTransaction(record);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateFilesystemSafeName', () => {
    it('should validate a safe filename', () => {
      const result = validateFilesystemSafeName('pepe');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('pepe');
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a filename with hyphens and underscores', () => {
      const result = validateFilesystemSafeName('wrapped-eth_token');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('wrapped-eth_token');
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-string input', () => {
      const result = validateFilesystemSafeName(123);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name must be a string');
    });

    it('should reject empty string', () => {
      const result = validateFilesystemSafeName('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name cannot be empty');
    });

    it('should reject whitespace-only string', () => {
      const result = validateFilesystemSafeName('   ');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name cannot be empty');
    });

    it('should sanitize forbidden characters', () => {
      const result = validateFilesystemSafeName('token/name');
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBe('token_name');
      expect(result.errors[0]).toContain('forbidden characters');
    });

    it('should sanitize multiple forbidden characters', () => {
      const result = validateFilesystemSafeName('token:name*test?file');
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBe('token_name_test_file');
      expect(result.errors[0]).toContain('forbidden characters');
    });

    it('should reject reserved Windows names', () => {
      const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1'];
      
      reservedNames.forEach(name => {
        const result = validateFilesystemSafeName(name);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('reserved system name');
      });
    });

    it('should reject names ending with period', () => {
      const result = validateFilesystemSafeName('token.');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name cannot end with a period or space');
    });

    it('should reject names ending with space', () => {
      const result = validateFilesystemSafeName('token ');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name cannot end with a period or space');
    });

    it('should handle case-insensitive reserved names', () => {
      const result = validateFilesystemSafeName('con');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('reserved system name');
    });
  });

  describe('validateOHLCVBatch', () => {
    it('should validate a batch of valid OHLCV records', () => {
      const records = [
        {
          timestamp: 1704067200,
          open: 0.000123,
          high: 0.000125,
          low: 0.000122,
          close: 0.000124,
          volume: 15000000
        },
        {
          timestamp: 1704067260,
          open: 0.000124,
          high: 0.000126,
          low: 0.000123,
          close: 0.000125,
          volume: 18500000
        }
      ];

      const result = validateOHLCVBatch(records);
      expect(result.validCount).toBe(2);
      expect(result.invalidCount).toBe(0);
      expect(result.invalidRecords).toHaveLength(0);
    });

    it('should identify invalid records in a batch', () => {
      const records = [
        {
          timestamp: 1704067200,
          open: 0.000123,
          high: 0.000125,
          low: 0.000122,
          close: 0.000124,
          volume: 15000000
        },
        {
          timestamp: 1704067260,
          open: 0.000124,
          high: 0.000120, // invalid: high < low
          low: 0.000123,
          close: 0.000125,
          volume: 18500000
        },
        {
          timestamp: 1704067320,
          open: 0.000125,
          high: 0.000127,
          low: 0.000124,
          close: 0.000126,
          volume: 20000000
        }
      ];

      const result = validateOHLCVBatch(records);
      expect(result.validCount).toBe(2);
      expect(result.invalidCount).toBe(1);
      expect(result.invalidRecords).toHaveLength(1);
      expect(result.invalidRecords[0].index).toBe(1);
      expect(result.invalidRecords[0].errors).toContain('high price must be greater than or equal to low price');
    });

    it('should throw error for non-array input', () => {
      expect(() => validateOHLCVBatch('not an array')).toThrow('Records must be an array');
    });
  });

  describe('validateTransactionBatch', () => {
    it('should validate a batch of valid transaction records', () => {
      const records = [
        {
          txHash: '5J7z...',
          blockTime: 1704067245,
          from: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          to: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
          amount: 1000000000
        },
        {
          txHash: '3K9m...',
          blockTime: 1704067280,
          from: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
          to: '4vMsoUT2BWatFweudnQM1xedRLfJgJ7hswhcpz4xgBTy',
          amount: 500000000
        }
      ];

      const result = validateTransactionBatch(records);
      expect(result.validCount).toBe(2);
      expect(result.invalidCount).toBe(0);
      expect(result.invalidRecords).toHaveLength(0);
    });

    it('should identify invalid records in a batch', () => {
      const records = [
        {
          txHash: '5J7z...',
          blockTime: 1704067245,
          from: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          to: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
          amount: 1000000000
        },
        {
          txHash: '',
          blockTime: 1704067280,
          from: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
          to: '4vMsoUT2BWatFweudnQM1xedRLfJgJ7hswhcpz4xgBTy',
          amount: 500000000
        }
      ];

      const result = validateTransactionBatch(records);
      expect(result.validCount).toBe(1);
      expect(result.invalidCount).toBe(1);
      expect(result.invalidRecords).toHaveLength(1);
      expect(result.invalidRecords[0].index).toBe(1);
      expect(result.invalidRecords[0].errors).toContain('txHash must be a non-empty string');
    });

    it('should throw error for non-array input', () => {
      expect(() => validateTransactionBatch('not an array')).toThrow('Records must be an array');
    });
  });
});
