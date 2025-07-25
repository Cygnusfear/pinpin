// Game engine types for chat service
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

export interface Direction {
  name: string;
  oppositeDirection?: string;
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

export interface CharacterSheet {
  core: CharacterCore;
  class?: CharacterClass;
  archetype?: CharacterArchetype;
  attributes: CharacterAttributes;
  inventory: Item[];
  abilities: Ability[];
  currency: Currency;
}
