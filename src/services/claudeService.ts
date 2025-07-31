/**
 * Claude AI Service for D&D Chat Integration
 *
 * Provides client-side functions to interact with the Claude AI endpoints
 * running on the server for D&D narrative generation and location creation.
 */

// Import types from server (you may need to adjust this path based on your setup)
type CharacterSheet = {
  core: {
    id: string;
    name: string;
  };
  class?: {
    name: string;
    likes: string;
  };
  archetype?: {
    name: string;
    description: string;
  };
  attributes: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  inventory: Array<{
    name: string;
    properties: {
      description: string;
      type: "equipment" | "consumable" | "misc";
      rarity: "common" | "uncommon" | "rare" | "legendary";
      [key: string]: any;
    };
  }>;
  abilities: Array<{
    name: string;
    properties: {
      description: string;
      type: "active" | "passive";
      cooldown?: string;
      [key: string]: any;
    };
  }>;
  currency: {
    gold: number;
    silver: number;
    copper: number;
  };
};

type LocationNode = {
  location: {
    id: string;
    name: string;
    description: string;
  };
  edges: Array<{
    direction: string;
    description: string;
    destinationId?: string;
    isExplored: boolean;
  }>;
};

type ChatMessage = {
  role: string;
  content: string;
  location?: string;
  roll?: number;
  [key: string]: any;
};

type ChatResponse = {
  success: boolean;
  data: {
    message: string;
    items_lost?: Array<{
      characterId: string;
      itemId: string;
    }>;
    abilities_lost?: Array<{
      characterId: string;
      itemId: string;
    }>;
    items_gained?: Array<{
      characterId: string;
      item: {
        name: string;
        properties: {
          description: string;
          type: "equipment" | "consumable" | "misc";
          rarity: "common" | "uncommon" | "rare" | "legendary";
          [key: string]: any;
        };
      };
    }>;
    ability_gained?: Array<{
      characterId: string;
      ability: {
        name: string;
        properties: {
          description: string;
          type: "active" | "passive";
          cooldown?: string;
          [key: string]: any;
        };
      };
    }>;
    money_gained?: Array<{
      characterId: string;
      currency: {
        gold?: number;
        silver?: number;
        copper?: number;
      };
    }>;
    money_lost?: Array<{
      characterId: string;
      currency: {
        gold?: number;
        silver?: number;
        copper?: number;
      };
    }>;
    character_moved?: string;
    new_location?: {
      location: {
        name: string;
        description: string;
      };
      edges: Array<{
        direction: string;
        description: string;
        isExplored: boolean;
      }>;
    };
  };
};

type LocationResponse = {
  success: boolean;
  data: {
    location: {
      name: string;
      description: string;
    };
    edges: Array<{
      direction: string;
      description: string;
      isExplored: boolean;
    }>;
  };
};

/**
 * Configuration for the Claude service
 */
const CLAUDE_API_BASE = "/api/claude";

/**
 * Send a chat message to Claude and get a narrative response
 *
 * @param messages - Array of chat messages in the conversation
 * @param locations - Current location data for the game world
 * @param characters - Character sheets for all players
 * @returns Promise with Claude's narrative response and any mechanical changes
 *
 * @example
 * ```typescript
 * const response = await sendChatMessage(
 *   [{ role: 'user', content: 'I examine the mysterious door', roll: 15 }],
 *   [currentLocation],
 *   [playerCharacter]
 * );
 *
 * console.log(response.data.message); // Claude's narrative response
 * if (response.data.items_gained) {
 *   // Handle items gained by characters
 * }
 * ```
 */
export const sendChatMessage = async (
  messages: ChatMessage[],
  locations: LocationNode[],
  characters: CharacterSheet[],
): Promise<ChatResponse> => {
  try {
    const response = await fetch(`${CLAUDE_API_BASE}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages,
        locations,
        characters,
      }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error sending chat message to Claude:", error);
    throw error;
  }
};

/**
 * Generate a starting location for a character based on their background
 *
 * @param character - The character sheet to generate a location for
 * @param backstory - The character's backstory to inform location creation
 * @returns Promise with the generated starting location
 *
 * @example
 * ```typescript
 * const location = await generateStartingLocation(
 *   wizardCharacter,
 *   "A young apprentice seeking ancient knowledge in forgotten libraries..."
 * );
 *
 * console.log(location.data.location.name); // "The Dusty Archive"
 * console.log(location.data.edges); // Available exits from the location
 * ```
 */
export const generateStartingLocation = async (
  character: CharacterSheet,
  backstory: string,
): Promise<LocationResponse> => {
  try {
    const response = await fetch(
      `${CLAUDE_API_BASE}/generate-starting-location`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          character,
          backstory,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error generating starting location:", error);
    throw error;
  }
};

/**
 * Check the health status of the Claude service
 *
 * @returns Promise with service health information
 *
 * @example
 * ```typescript
 * const health = await checkServiceHealth();
 * if (health.anthropic_configured) {
 *   console.log('Claude service is ready!');
 * }
 * ```
 */
export const checkServiceHealth = async () => {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error checking service health:", error);
    throw error;
  }
};

/**
 * Utility function to create a d20 roll for character actions
 *
 * @returns A random number between 1 and 20
 *
 * @example
 * ```typescript
 * const roll = rollD20();
 * const message = {
 *   role: 'user',
 *   content: 'I try to pick the lock',
 *   roll: roll
 * };
 * ```
 */
export const rollD20 = (): number => {
  return Math.floor(Math.random() * 20) + 1;
};

/**
 * Example usage patterns for the Claude service
 */
export const exampleUsage = {
  /**
   * Basic chat interaction
   */
  async basicChat() {
    const messages: ChatMessage[] = [
      {
        role: "user",
        content: "I look around the tavern for any interesting NPCs",
        roll: rollD20(),
      },
    ];

    // You would get these from your game state
    const locations: LocationNode[] = [
      /* current game locations */
    ];
    const characters: CharacterSheet[] = [
      /* player characters */
    ];

    const response = await sendChatMessage(messages, locations, characters);

    // Handle the response
    console.log("DM Response:", response.data.message);

    // Check for mechanical changes
    if (response.data.items_gained) {
      console.log("Items gained:", response.data.items_gained);
    }

    if (response.data.character_moved) {
      console.log("Party moved to:", response.data.character_moved);
      if (response.data.new_location) {
        console.log("New location discovered:", response.data.new_location);
      }
    }
  },

  /**
   * Character creation with starting location
   */
  async createCharacterWithLocation() {
    const newCharacter: CharacterSheet = {
      core: { id: "char-1", name: "Elara Moonwhisper" },
      class: {
        name: "Wizard",
        likes: "ancient knowledge and magical artifacts",
      },
      archetype: { name: "Scholar", description: "Bookish and intellectual" },
      attributes: {
        strength: 8,
        dexterity: 12,
        constitution: 10,
        intelligence: 18,
        wisdom: 14,
        charisma: 11,
      },
      inventory: [],
      abilities: [],
      currency: { gold: 50, silver: 0, copper: 0 },
    };

    const backstory = `Elara spent her youth in the great libraries of the capital, 
      apprenticed to a renowned wizard who vanished mysteriously. Now she seeks 
      answers about her mentor's disappearance while pursuing her own magical studies.`;

    const location = await generateStartingLocation(newCharacter, backstory);

    console.log("Starting location:", location.data.location.name);
    console.log("Description:", location.data.location.description);
    console.log(
      "Available exits:",
      location.data.edges.map((e) => e.direction),
    );
  },

  /**
   * Check service status
   */
  async checkStatus() {
    try {
      const health = await checkServiceHealth();
      console.log("Service status:", health.status);
      console.log("Claude configured:", health.anthropic_configured);
    } catch (error) {
      console.error("Service unavailable:", error);
    }
  },
};
