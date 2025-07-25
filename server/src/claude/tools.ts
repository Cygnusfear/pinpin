/**
 * Claude AI Tool Definitions
 *
 * Defines the tool schemas that Claude uses for structured responses
 * in the D&D chat system including narrative generation, location creation,
 * file system operations, and general conversation.
 */

/**
 * Claude tool for generating D&D narrative responses with mechanical changes
 *
 * This tool allows Claude to return structured narrative content along with
 * any game mechanical changes like item gains, character movement, etc.
 */
export const chatNarrativeTool = {
  name: "returnNarrative",
  description:
    "Respond to user messages with narrative content, general conversation, or D&D gameplay with mechanical changes",
  input_schema: {
    type: "object" as const,
    required: ["message"],
    additionalProperties: false,
    properties: {
      message: {
        type: "string",
        description: "Your immersive narrative response (200-800 words)",
      },
      items_lost: {
        type: "array",
        description: "Items lost by characters",
        items: {
          type: "object",
          required: ["characterId", "itemId"],
          additionalProperties: false,
          properties: {
            characterId: { type: "string" },
            itemId: { type: "string" },
          },
        },
      },
      abilities_lost: {
        type: "array",
        description: "Abilities lost by characters",
        items: {
          type: "object",
          required: ["characterId", "itemId"],
          additionalProperties: false,
          properties: {
            characterId: { type: "string" },
            itemId: { type: "string" },
          },
        },
      },
      items_gained: {
        type: "array",
        description: "Items gained by characters",
        items: {
          type: "object",
          required: ["characterId", "item"],
          additionalProperties: false,
          properties: {
            characterId: { type: "string" },
            item: {
              type: "object",
              required: ["name", "properties"],
              additionalProperties: false,
              properties: {
                name: { type: "string" },
                properties: {
                  type: "object",
                  required: ["description", "type", "rarity"],
                  additionalProperties: true,
                  properties: {
                    description: { type: "string" },
                    type: {
                      type: "string",
                      enum: ["equipment", "consumable", "misc"],
                    },
                    rarity: {
                      type: "string",
                      enum: ["common", "uncommon", "rare", "legendary"],
                    },
                  },
                },
              },
            },
          },
        },
      },
      ability_gained: {
        type: "array",
        description: "Abilities gained by characters",
        items: {
          type: "object",
          required: ["characterId", "ability"],
          additionalProperties: false,
          properties: {
            characterId: { type: "string" },
            ability: {
              type: "object",
              required: ["name", "properties"],
              additionalProperties: false,
              properties: {
                name: { type: "string" },
                properties: {
                  type: "object",
                  required: ["description", "type"],
                  additionalProperties: true,
                  properties: {
                    description: { type: "string" },
                    type: {
                      type: "string",
                      enum: ["active", "passive"],
                    },
                    cooldown: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
      money_gained: {
        type: "array",
        description: "Money gained by characters",
        items: {
          type: "object",
          required: ["characterId", "currency"],
          additionalProperties: false,
          properties: {
            characterId: { type: "string" },
            currency: {
              type: "object",
              additionalProperties: false,
              properties: {
                gold: { type: "number", minimum: 0 },
                silver: { type: "number", minimum: 0 },
                copper: { type: "number", minimum: 0 },
              },
            },
          },
        },
      },
      money_lost: {
        type: "array",
        description: "Money lost by characters",
        items: {
          type: "object",
          required: ["characterId", "currency"],
          additionalProperties: false,
          properties: {
            characterId: { type: "string" },
            currency: {
              type: "object",
              additionalProperties: false,
              properties: {
                gold: { type: "number", minimum: 0 },
                silver: { type: "number", minimum: 0 },
                copper: { type: "number", minimum: 0 },
              },
            },
          },
        },
      },
      character_moved: {
        type: "string",
        description:
          "MUST be either: (1) A destination location UUID/ID string when moving to an existing location, OR (2) 'unexplored_location' when creating a new location. NEVER use direction names like 'north', 'south', etc.",
      },
      new_location: {
        type: "object",
        description:
          "New location data when character moves to unexplored area",
        required: ["location", "edges"],
        additionalProperties: false,
        properties: {
          location: {
            type: "object",
            required: ["name", "description"],
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              description: { type: "string" },
            },
          },
          edges: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["direction", "description", "isExplored"],
              additionalProperties: false,
              properties: {
                direction: { type: "string" },
                description: { type: "string" },
                isExplored: { type: "boolean" },
              },
            },
          },
        },
      },
    },
  },
};

/**
 * Claude tool for generating starting locations for D&D characters
 *
 * This tool generates detailed starting locations based on character
 * background, class, and backstory information.
 */
export const locationGenerationTool = {
  name: "generateLocation",
  description: "Generate a starting location for a character",
  input_schema: {
    type: "object" as const,
    required: ["location", "edges"],
    additionalProperties: false,
    properties: {
      location: {
        type: "object",
        required: ["name", "description"],
        additionalProperties: false,
        properties: {
          name: {
            type: "string",
            description: "Evocative and memorable location name",
          },
          description: {
            type: "string",
            description:
              "Rich, detailed description (200-400 words) with atmospheric details",
          },
        },
      },
      edges: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        description: "Unexplored exits from this location",
        items: {
          type: "object",
          required: ["direction", "description", "isExplored"],
          additionalProperties: false,
          properties: {
            direction: {
              type: "string",
              description: "Direction name (usually north/south/east/west)",
            },
            description: {
              type: "string",
              description:
                "Description of the path and hints at what lies beyond",
            },
            isExplored: {
              type: "boolean",
              description: "Must be false for starting locations",
            },
          },
        },
      },
    },
  },
};

/**
 * Claude tool for listing directory contents
 *
 * This tool allows Claude to explore the project structure by listing
 * files and directories, useful for understanding codebase organization.
 */
export const listDirectoryTool = {
  name: "listDirectory",
  description: "List contents of a directory in the project",
  input_schema: {
    type: "object" as const,
    required: ["path"],
    additionalProperties: false,
    properties: {
      path: {
        type: "string",
        description:
          "Directory path relative to project root (use '.' for root directory)",
      },
    },
  },
};

/**
 * Claude tool for reading file contents
 *
 * This tool allows Claude to read and analyze file contents,
 * useful for understanding existing code or configuration.
 */
export const readFileTool = {
  name: "readFile",
  description: "Read contents of a file in the project",
  input_schema: {
    type: "object" as const,
    required: ["path"],
    additionalProperties: false,
    properties: {
      path: {
        type: "string",
        description: "File path relative to project root",
      },
      encoding: {
        type: "string",
        description: "File encoding (default: utf8)",
        enum: ["utf8", "ascii", "base64", "hex"],
      },
    },
  },
};

/**
 * Claude tool for writing file contents
 *
 * This tool allows Claude to create or modify files in the project,
 * useful for generating code, configuration, or documentation.
 */
export const writeFileTool = {
  name: "writeFile",
  description: "Write content to a file in the project",
  input_schema: {
    type: "object" as const,
    required: ["path", "content"],
    additionalProperties: false,
    properties: {
      path: {
        type: "string",
        description: "File path relative to project root",
      },
      content: {
        type: "string",
        description: "Content to write to the file",
      },
      encoding: {
        type: "string",
        description: "File encoding (default: utf8)",
        enum: ["utf8", "ascii", "base64", "hex"],
      },
    },
  },
};
