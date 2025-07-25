/**
 * TypeScript interfaces for Claude AI Chat System
 *
 * Defines all types used across the D&D chat service including
 * request/response formats, character data, and location information.
 */

export interface CharacterCore {
  id: string;
  name: string;
}

export interface CharacterClass {
  name: string;
  likes: string;
}

export interface CharacterArchetype {
  name: string;
  description: string;
}

export interface CharacterAttributes {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface Currency {
  gold: number;
  silver: number;
  copper: number;
}

export interface Item {
  name: string;
  properties: {
    description: string;
    type: "equipment" | "consumable" | "misc";
    rarity: "common" | "uncommon" | "rare" | "legendary";
    [key: string]: any;
  };
}

export interface Ability {
  name: string;
  properties: {
    description: string;
    type: "active" | "passive";
    cooldown?: string;
    [key: string]: any;
  };
}

export interface CharacterSheet {
  core: CharacterCore;
  class?: CharacterClass;
  archetype?: CharacterArchetype;
  attributes: CharacterAttributes;
  inventory: Item[];
  abilities: Ability[];
  currency: Currency;
}

export interface Location {
  id: string;
  name: string;
  description: string;
}

export interface LocationEdge {
  direction: string;
  description: string;
  destinationId?: string;
  isExplored: boolean;
}

export interface LocationNode {
  location: Location;
  edges: LocationEdge[];
}

export interface ChatMessage {
  role: string;
  content: string;
  location?: string;
  roll?: number;
  [key: string]: any;
}

export interface ChatRequestBody {
  messages: ChatMessage[];
  locations: LocationNode[];
  characters: CharacterSheet[];
}

export interface LocationRequestBody {
  character: CharacterSheet;
  backstory: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ItemChange {
  characterId: string;
  itemId: string;
}

export interface ItemGained {
  characterId: string;
  item: Item;
}

export interface AbilityGained {
  characterId: string;
  ability: Ability;
}

export interface MoneyChange {
  characterId: string;
  currency: {
    gold?: number;
    silver?: number;
    copper?: number;
  };
}

export interface NewLocationData {
  location: {
    name: string;
    description: string;
  };
  edges: Array<{
    direction: string;
    description: string;
    isExplored: boolean;
  }>;
}

export interface ChatResponse {
  message: string;
  items_lost?: ItemChange[];
  abilities_lost?: ItemChange[];
  items_gained?: ItemGained[];
  ability_gained?: AbilityGained[];
  money_gained?: MoneyChange[];
  money_lost?: MoneyChange[];
  character_moved?: string;
  new_location?: NewLocationData;
}
