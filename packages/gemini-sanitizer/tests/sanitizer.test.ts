/**
 * MCP Tool Sanitizer - Comprehensive Test Suite
 * 
 * Tests for sanitizing MCP tools for Google Gemini API compatibility.
 */

import {
  MCPToolSanitizer,
  sanitizeToolName,
  sanitizeSchema,
  createSanitizedTool,
  isValidGeminiName,
  isSchemaSanitized,
  generateUniqueSanitizedName,
} from '../src/sanitizer';
import {
  MCPTool,
  JSONSchema,
} from '../src/types';

describe('sanitizeToolName', () => {
  describe('basic sanitization', () => {
    it('should return a valid name for simple alphanumeric names', () => {
      expect(sanitizeToolName('simpleTool')).toBe('simpleTool');
      expect(sanitizeToolName('tool123')).toBe('tool123');
      expect(sanitizeToolName('MyTool')).toBe('MyTool');
    });

    it('should preserve underscores but replace dots, colons, and hyphens', () => {
      expect(sanitizeToolName('my_tool')).toBe('my_tool');
      expect(sanitizeToolName('my.tool')).toBe('my_tool');
      expect(sanitizeToolName('my:tool')).toBe('my_tool');
      expect(sanitizeToolName('my-tool')).toBe('my_tool');
    });

    it('should replace spaces with underscores', () => {
      expect(sanitizeToolName('my tool')).toBe('my_tool');
      expect(sanitizeToolName('tool with multiple spaces')).toBe('tool_with_multiple_spaces');
    });

    it('should replace special characters with underscores', () => {
      expect(sanitizeToolName('tool@name')).toBe('tool_name');
      expect(sanitizeToolName('tool#name')).toBe('tool_name');
      expect(sanitizeToolName('tool$name')).toBe('tool_name');
      expect(sanitizeToolName('tool%name')).toBe('tool_name');
      expect(sanitizeToolName('tool&name')).toBe('tool_name');
      expect(sanitizeToolName('tool*name')).toBe('tool_name');
      expect(sanitizeToolName('tool+name')).toBe('tool_name');
      expect(sanitizeToolName('tool=name')).toBe('tool_name');
      expect(sanitizeToolName('tool^name')).toBe('tool_name');
      expect(sanitizeToolName('tool|name')).toBe('tool_name');
      expect(sanitizeToolName('tool\\name')).toBe('tool_name');
      expect(sanitizeToolName('tool/name')).toBe('tool_name');
      expect(sanitizeToolName('tool?name')).toBe('tool_name');
      expect(sanitizeToolName('tool!name')).toBe('tool_name');
      expect(sanitizeToolName('tool"name')).toBe('tool_name');
      expect(sanitizeToolName("tool'name")).toBe("tool_name");
    });
  });

  describe('MCP naming convention handling', () => {
    it('should preserve double underscores from MCP naming', () => {
      expect(sanitizeToolName('server__tool')).toBe('server__tool');
      expect(sanitizeToolName('my-server__complex-tool')).toBe('my_server__complex_tool');
    });

    it('should handle complex MCP tool names', () => {
      expect(sanitizeToolName('filesystem__read-file')).toBe('filesystem__read_file');
      expect(sanitizeToolName('github__create-pull-request')).toBe('github__create_pull_request');
    });
  });

  describe('length constraints', () => {
    it('should truncate names exceeding max length', () => {
      const longName = 'a'.repeat(100);
      const result = sanitizeToolName(longName);
      expect(result.length).toBe(64);
    });

    it('should respect custom max length', () => {
      const longName = 'a'.repeat(50);
      const result = sanitizeToolName(longName, { maxLength: 20 });
      expect(result.length).toBe(20);
    });
  });

  describe('name start character validation', () => {
    it('should prepend underscore if name starts with number', () => {
      expect(sanitizeToolName('123tool')).toBe('_123tool');
      expect(sanitizeToolName('0')).toBe('_0');
    });

    it('should handle name that starts with colon', () => {
      expect(sanitizeToolName(':tool')).toBe('_tool');
    });

    it('should not prepend underscore if name starts with letter', () => {
      expect(sanitizeToolName('tool')).toBe('tool');
      expect(sanitizeToolName('Tool123')).toBe('Tool123');
    });
  });

  describe('edge cases', () => {
    it('should throw error for empty string', () => {
      expect(() => sanitizeToolName('')).toThrow('tool name cannot be empty');
    });

    it('should throw error for non-string input', () => {
      expect(() => sanitizeToolName(123 as unknown as string)).toThrow('must be a string');
      expect(() => sanitizeToolName(null as unknown as string)).toThrow('must be a string');
      expect(() => sanitizeToolName(undefined as unknown as string)).toThrow('must be a string');
    });

    it('should handle names that become empty after sanitization', () => {
      const result = sanitizeToolName('@@@');
      expect(result).toBe('_');
      expect(result.length).toBe(1);
    });
  });

  describe('custom options', () => {
    it('should use custom replacement character', () => {
      expect(sanitizeToolName('tool@name', { replacementChar: '-' })).toBe('tool-name');
      expect(sanitizeToolName('tool#name', { replacementChar: 'x' })).toBe('toolxname');
    });
  });

  describe('consecutive replacement characters', () => {
    it('should collapse consecutive underscores from invalid chars', () => {
      expect(sanitizeToolName('tool@@@name')).toBe('tool_name');
    });

    it('should preserve intentional double underscores from MCP naming', () => {
      expect(sanitizeToolName('server__tool')).toBe('server__tool');
    });
  });
});

describe('sanitizeSchema', () => {
  describe('basic schema sanitization', () => {
    it('should preserve type property', () => {
      const schema: JSONSchema = { type: 'string' };
      const result = sanitizeSchema(schema);
      expect(result.type).toBe('string');
    });

    it('should preserve format property', () => {
      const schema: JSONSchema = { type: 'string', format: 'date-time' };
      const result = sanitizeSchema(schema);
      expect(result.format).toBe('date-time');
    });

    it('should preserve description property', () => {
      const schema: JSONSchema = { type: 'string', description: 'A test string' };
      const result = sanitizeSchema(schema);
      expect(result.description).toBe('A test string');
    });
  });

  describe('properties sanitization', () => {
    it('should preserve and sanitize nested properties', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string', title: 'Name Field' },
          age: { type: 'number', description: 'Age in years' },
        },
      };
      const result = sanitizeSchema(schema);
      expect(result.properties).toBeDefined();
      expect(result.properties!.name.type).toBe('string');
      expect(result.properties!.age.type).toBe('number');
      expect((result.properties!.name as Record<string, unknown>).title).toBeUndefined();
    });
  });

  describe('keys to strip', () => {
    it('should strip $schema', () => {
      const schema: JSONSchema = {
        type: 'object',
        $schema: 'http://json-schema.org/draft-07/schema#',
      };
      const result = sanitizeSchema(schema);
      expect((result as Record<string, unknown>).$schema).toBeUndefined();
    });

    it('should strip title', () => {
      const schema: JSONSchema = { type: 'string', title: 'MyTitle' };
      const result = sanitizeSchema(schema);
      expect((result as Record<string, unknown>).title).toBeUndefined();
    });

    it('should strip additionalProperties', () => {
      const schema: JSONSchema = {
        type: 'object',
        additionalProperties: true,
        properties: { name: { type: 'string' } },
      };
      const result = sanitizeSchema(schema);
      expect((result as Record<string, unknown>).additionalProperties).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should throw error for null input', () => {
      expect(() => sanitizeSchema(null as unknown as JSONSchema)).toThrow('schema must be an object');
    });

    it('should handle empty schema', () => {
      const result = sanitizeSchema({});
      expect(result).toEqual({});
    });
  });
});

describe('MCPToolSanitizer', () => {
  let sanitizer: MCPToolSanitizer;

  beforeEach(() => {
    sanitizer = new MCPToolSanitizer();
  });

  describe('sanitizeTool', () => {
    it('should sanitize a single tool', () => {
      const tool: MCPTool = {
        name: 'my-server__complex-tool',
        description: 'A complex tool',
        inputSchema: {
          type: 'object',
          properties: {
            param: { type: 'string', description: 'A parameter' },
          },
        },
      };

      const result = sanitizer.sanitizeTool(tool);

      expect(result.originalName).toBe('my-server__complex-tool');
      expect(result.sanitizedName).toBe('my_server__complex_tool');
    });
  });

  describe('sanitizeTools', () => {
    it('should sanitize multiple tools', () => {
      const tools: MCPTool[] = [
        { name: 'server1__tool1', description: 'Tool 1' },
        { name: 'server2__tool2', description: 'Tool 2' },
        { name: 'simple-tool', description: 'Tool 3' },
      ];

      const results = sanitizer.sanitizeTools(tools);

      expect(results).toHaveLength(3);
      expect(results[0].sanitizedName).toBe('server1__tool1');
      expect(results[1].sanitizedName).toBe('server2__tool2');
      expect(results[2].sanitizedName).toBe('simple_tool');
    });
  });

  describe('bidirectional mapping', () => {
    it('should maintain consistent mappings', () => {
      const tools: MCPTool[] = [
        { name: 'server1__tool-a', description: 'Tool A' },
        { name: 'server1__tool-b', description: 'Tool B' },
      ];

      sanitizer.sanitizeTools(tools);

      for (const tool of tools) {
        const sanitized = sanitizer.getSanitizedName(tool.name);
        const original = sanitizer.getOriginalName(sanitized!);
        expect(original).toBe(tool.name);
      }
    });
  });

  describe('deduplication', () => {
    it('should add unique suffixes to duplicate tool names', () => {
      const tools: MCPTool[] = [
        { name: 'read_file', description: 'Read file 1' },
        { name: 'read_file', description: 'Read file 2' },
        { name: 'read_file', description: 'Read file 3' },
      ];

      const results = sanitizer.sanitizeTools(tools);

      const uniqueNames = new Set(results.map(t => t.sanitizedName));
      expect(uniqueNames.size).toBe(3);
      expect(results[0].sanitizedName).toBe('read_file_1');
      expect(results[1].sanitizedName).toBe('read_file_2');
      expect(results[2].sanitizedName).toBe('read_file_3');
    });
  });

  describe('toGeminiFunction(s)', () => {
    it('should convert sanitized tool to Gemini function', () => {
      const tool: MCPTool = {
        name: 'my-server__tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {
            param: { type: 'string', description: 'A parameter' },
          },
          required: ['param'],
        },
      };

      const sanitized = sanitizer.sanitizeTool(tool);
      const geminiFunction = sanitizer.toGeminiFunction(sanitized);

      expect(geminiFunction.name).toBe('my_server__tool');
      expect(geminiFunction.description).toBe('A test tool');
    });
  });
});

describe('isValidGeminiName', () => {
  it('should return true for valid names', () => {
    expect(isValidGeminiName('tool')).toBe(true);
    expect(isValidGeminiName('Tool123')).toBe(true);
    expect(isValidGeminiName('my_tool')).toBe(true);
    expect(isValidGeminiName('_tool')).toBe(true);
  });

  it('should return false for invalid names', () => {
    expect(isValidGeminiName('')).toBe(false);
    expect(isValidGeminiName('123tool')).toBe(false);
    expect(isValidGeminiName('tool@name')).toBe(false);
  });
});

describe('Schema $ref resolution', () => {
  it('should resolve $defs references by inlining', () => {
    const schema: JSONSchema = {
      type: 'object',
      $defs: {
        Address: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            city: { type: 'string' },
          },
        },
      },
      properties: {
        home: { $ref: '#/$defs/Address' },
        work: { $ref: '#/$defs/Address' },
      },
    };
    const result = sanitizeSchema(schema);
    expect(result.properties!.home.type).toBe('object');
    expect(result.properties!.home.properties!.street.type).toBe('string');
  });

  it('should handle circular $ref without infinite recursion', () => {
    const schema: JSONSchema = {
      type: 'object',
      $defs: {
        Node: {
          type: 'object',
          properties: {
            value: { type: 'string' },
            child: { $ref: '#/$defs/Node' },
          },
        },
      },
      properties: {
        root: { $ref: '#/$defs/Node' },
      },
    };
    const result = sanitizeSchema(schema);
    expect(result.properties!.root.type).toBe('object');
  });
});

describe('Integration Tests', () => {
  it('should handle realistic MCP tools from server', () => {
    const mcpTools: MCPTool[] = [
      {
        name: 'filesystem__read-file',
        description: 'Read the contents of a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The path to the file to read',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'github__create-pull-request',
        description: 'Create a pull request',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'PR title' },
            body: { type: 'string', description: 'PR body' },
          },
          required: ['title'],
        },
      },
    ];

    const sanitizer = new MCPToolSanitizer();
    const sanitizedTools = sanitizer.sanitizeTools(mcpTools);
    const geminiFunctions = sanitizer.toGeminiFunctions(sanitizedTools);

    expect(sanitizedTools).toHaveLength(2);
    expect(isValidGeminiName(geminiFunctions[0].name)).toBe(true);
    expect(isValidGeminiName(geminiFunctions[1].name)).toBe(true);
  });
});
