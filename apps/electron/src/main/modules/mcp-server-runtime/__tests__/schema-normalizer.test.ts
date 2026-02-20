import { describe, expect, it } from "vitest";
import {
  normalizeToolInputSchema,
  shouldStripCombinatorsForClient,
} from "../schema-normalizer";

describe("normalizeToolInputSchema", () => {
  it("moves combinator siblings into each anyOf branch", () => {
    const input = {
      type: "object",
      properties: {
        filter: {
          type: "object",
          properties: {
            filters: {
              description: "Meeting notes filter node",
              anyOf: [
                {
                  type: "array",
                  items: { type: "string" },
                },
                {
                  type: "null",
                },
              ],
            },
          },
        },
      },
    };

    const normalized = normalizeToolInputSchema(input) as {
      properties: {
        filter: {
          properties: {
            filters: Record<string, unknown>;
          };
        };
      };
    };

    expect(normalized.properties.filter.properties.filters).toEqual({
      anyOf: [
        {
          description: "Meeting notes filter node",
          type: "array",
          items: { type: "string" },
        },
        {
          description: "Meeting notes filter node",
          type: "null",
        },
      ],
    });
  });

  it("moves snake_case combinator siblings into each any_of branch", () => {
    const input = {
      type: "object",
      properties: {
        condition_values: {
          description: "Condition values",
          any_of: [
            { type: "string" },
            {
              type: "array",
              items: { type: "string" },
            },
          ],
        },
      },
    };

    const normalized = normalizeToolInputSchema(input) as {
      properties: {
        condition_values: Record<string, unknown>;
      };
    };

    expect(normalized.properties.condition_values).toEqual({
      any_of: [
        {
          description: "Condition values",
          type: "string",
        },
        {
          description: "Condition values",
          type: "array",
          items: { type: "string" },
        },
      ],
    });
  });

  it("merges required arrays when shared and branch-specific constraints exist", () => {
    const input = {
      anyOf: [
        {
          type: "object",
          required: ["title"],
          properties: {
            title: { type: "string" },
          },
        },
        {
          type: "object",
          required: ["attendee"],
          properties: {
            attendee: { type: "string" },
          },
        },
      ],
      type: "object",
      required: ["date"],
      properties: {
        date: { type: "string" },
      },
    };

    const normalized = normalizeToolInputSchema(input) as {
      anyOf: Array<{ required: string[] }>;
    };

    expect(normalized.anyOf[0].required).toEqual(["date", "title"]);
    expect(normalized.anyOf[1].required).toEqual(["date", "attendee"]);
  });

  it("does not mutate the original schema object", () => {
    const input = {
      anyOf: [{ type: "string" }, { type: "number" }],
      description: "shared",
    };
    const before = JSON.parse(JSON.stringify(input));

    normalizeToolInputSchema(input);

    expect(input).toEqual(before);
  });

  it("leaves simple schemas unchanged", () => {
    const input = {
      type: "object",
      properties: {
        query: { type: "string" },
      },
    };

    expect(normalizeToolInputSchema(input)).toEqual(input);
  });

  it("drops default values within combinator branches for compatibility", () => {
    const input = {
      properties: {
        condition_values: {
          anyOf: [
            { type: "string", default: null },
            {
              type: "array",
              default: null,
              items: {
                anyOf: [
                  { type: "string", default: null },
                  { type: "integer" },
                ],
              },
            },
          ],
          default: null,
        },
      },
    };

    const normalized = normalizeToolInputSchema(input) as {
      properties: {
        condition_values: {
          anyOf: Array<Record<string, unknown>>;
        };
      };
    };

    expect(normalized.properties.condition_values).toEqual({
      anyOf: [
        { type: "string" },
        {
          type: "array",
          items: {
            anyOf: [{ type: "string" }, { type: "integer" }],
          },
        },
      ],
    });
  });

  it("strips combinator nodes entirely when requested", () => {
    const input = {
      type: "object",
      properties: {
        condition_values: {
          any_of: [{ type: "string" }, { type: "array" }],
          description: "Union value",
          default: null,
        },
      },
    };

    const normalized = normalizeToolInputSchema(input, {
      stripCombinators: true,
    }) as {
      properties: {
        condition_values: Record<string, unknown>;
      };
    };

    expect(normalized.properties.condition_values).toEqual({
      description: "Union value",
    });
  });

  it("marks Cursor as combinator-sensitive", () => {
    expect(shouldStripCombinatorsForClient("cursor")).toBe(true);
    expect(shouldStripCombinatorsForClient("CuRsOr")).toBe(true);
  });
});
