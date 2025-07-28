/**
 * Context Generation Functions
 *
 * Functions to generate context strings and system messages for Claude AI
 * based on game state, character information, and location data.
 */

import type {
  CharacterSheet,
  ChatMessage,
  LocationNode,
} from "../types/chat.js";

/**
 * Helper function to roll a 20-sided dice
 *
 * @returns A random number between 1 and 20
 */
export const rollD20 = (): number => {
  return Math.floor(Math.random() * 20) + 1;
};

/**
 * Generates location context string for Claude system message
 *
 * @param locations - Array of location nodes in the game world
 * @param messages - Array of chat messages to determine current location
 * @returns Object with context string and current location info
 */
export const generateLocationContext = (
  locations: LocationNode[],
  messages: ChatMessage[],
): {
  context: string;
  currentLocationId?: string;
  currentLocation?: LocationNode;
} => {
  let currentLocationId: string | undefined;
  let currentLocation: LocationNode | undefined;

  if (locations && locations.length > 0 && messages.length > 0) {
    // Get location directly from the last message
    const lastMessage = messages[messages.length - 1];

    if (lastMessage.location) {
      currentLocationId = lastMessage.location;
      currentLocation = locations.find(
        (loc) => loc.location.id === currentLocationId,
      );
    }

    // If we still don't have a current location, use the first location as fallback
    if (!currentLocationId && locations.length > 0) {
      currentLocationId = locations[0].location.id;
      currentLocation = locations[0];
    }
  }

  let context = "";
  if (locations && locations.length > 0) {
    context = `

**CURRENT LOCATION:** ${currentLocationId || "unknown"}

${currentLocation ? JSON.stringify(currentLocation, null, 2) : "Current location not found"}

**ALL LOCATION DATA:**
${JSON.stringify(locations, null, 2)}`;
  }

  return { context, currentLocationId, currentLocation };
};

/**
 * Generates character context string for Claude system message
 *
 * @param characters - Array of character sheets
 * @returns Formatted character context string
 */
export const generateCharacterContext = (
  characters: CharacterSheet[],
): string => {
  if (!characters || characters.length === 0) {
    return "";
  }

  return `

**CHARACTER INFORMATION:**
${JSON.stringify(characters, null, 2)}

**CHARACTER USAGE INSTRUCTIONS:**
- **Ability Scores (attributes)**: Each character has six core abilities that determine their natural aptitude:
  - Strength: Physical power for combat, lifting, breaking things
  - Dexterity: Agility, reflexes, stealth, ranged attacks
  - Constitution: Health, endurance, resistance to poison/disease
  - Intelligence: Reasoning, memory, investigation, arcane knowledge
  - Wisdom: Perception, insight, survival, divine magic
  - Charisma: Force of personality, persuasion, intimidation, social situations
  
- **Class & Archetype System**: 
  - **Class**: Defines what the character "likes" (their interests/specialization) and primary abilities
  - **Archetype**: Provides ability score modifiers that reflect physical/mental build (Scholar, Brute, Charmer, etc.)
  - **Final Scores**: Base attributes + archetype modifiers = character's effective abilities
  
- **Inventory System**: Characters can only use items they possess. Each item has:
  - **Name**: The item's designation
  - **Properties**: Flexible object containing description, type, rarity, and special effects
  - Consider item types: equipment, consumable, misc
  - Consider rarity: common, uncommon, rare, legendary
  - **AUTOMATIC ACQUISITION**: When characters take, grab, pick up, receive, are given, are handed, pocket, or otherwise acquire any item through their actions or interactions, automatically add it to their inventory using items_gained. Do NOT require explicit "put in inventory" statements.
  
- **Abilities System**: Characters have special abilities beyond basic actions:
  - **Name**: The ability's designation  
  - **Properties**: Contains description, type (active/passive), cooldown, and mechanical effects
  - Active abilities may have usage limitations or cooldowns
  - Passive abilities provide ongoing benefits
  
- **Currency System**: Track character wealth across three coin types:
  - **Gold**: Most valuable (1 gold = 10 silver = 100 copper)
  - **Silver**: Medium value (1 silver = 10 copper)
  - **Copper**: Base currency unit
  
- **Contextual Application**: 
  - Match character actions to their strengths (class interests + high ability scores)
  - Consider archetype when describing physical appearance and mannerisms
  - Reference specific inventory items when characters attempt to use them
  - Apply ability score modifiers to determine action success probability
  - Create opportunities for characters to use their special abilities
  - Factor in currency when dealing with merchants, bribes, or economic challenges`;
};

/**
 * Generates dice roll context string for Claude system message
 *
 * @param worldRoll - Random world roll (1-20)
 * @param characterRoll - Character's action roll (1-20 or null)
 * @returns Formatted dice roll context string
 */
export const generateDiceRollContext = (
  worldRoll: number,
  characterRoll: number | null,
): string => {
  return `

**DICE ROLL MECHANICS:**
- **World Roll**: ${worldRoll} (determines how challenging/powerful the world response should be)
  - 1-5: World is favorable, challenges are mild, outcomes favor the characters
  - 6-10: World is neutral, balanced challenges and outcomes
  - 11-15: World is challenging, moderate obstacles and complications
  - 16-20: World is harsh, significant challenges and powerful opposition

${
  characterRoll !== null
    ? `- **Character Roll**: ${characterRoll} (from the character's action)
  - 1-5: Character action fails badly, negative consequences
  - 6-10: Character action partially succeeds or has mixed results
  - 11-15: Character action succeeds as intended
  - 16-20: Character action succeeds spectacularly, with additional benefits

**ROLL INTERACTION**: Use both rolls together - the character roll determines how well they execute their action, while the world roll determines how the world responds to that action. A high character roll with a high world roll creates dramatic tension. A low character roll with a low world roll might lead to comedic mishaps rather than serious consequences.

**NARRATIVE INTEGRATION**: Weave the dice results naturally into your storytelling:
- Don't explicitly mention the dice rolls or numbers
- Let the outcomes speak for themselves through vivid descriptions
- Use the rolls to determine the degree of success/failure and world reaction
- Create interesting complications or benefits based on the roll combinations`
    : `- **Character Roll**: No character roll this turn (DM message or system message)`
}`;
};

/**
 * Creates complete system message for Claude chat interactions
 *
 * @param locationContext - Generated location context string
 * @param characterContext - Generated character context string
 * @param diceRollContext - Generated dice roll context string
 * @returns Complete system message for Claude
 */
export const createChatSystemMessage = (
  locationContext: string,
  characterContext: string,
  diceRollContext: string,
): string => {
  return `You are Tonk 🌈, you're a hyped to the rainbows AI assistant specialized in helping with the pinpin pinboard. You're knowledgeable about plugin architecture, widget development, and modern web development practices. But you're also a great conversationalist, you keep it brief, you listen. You don't give huge responses, just familiar friendly chat.
  
  Make sure you use the Tools you have at your disposal! ALWAYS TRY TO USE A TOOL.`;
};

const wallOfText = `
**TOOL SELECTION GUIDANCE:**
You have access to multiple tools. Choose the appropriate one based on the user's request:
- **returnNarrative**: Use for ALL conversation, development assistance, code explanations, and general responses. This is your PRIMARY tool for most interactions.
- **listDirectory**: Use when asked to explore project structure, list files, or examine directories
- **readFile**: Use when asked to read specific files, examine documentation, or analyze code
- **writeFile**: Use when asked to create new files, modify existing code, or generate documentation
- **DEFAULT**: When in doubt, use returnNarrative for conversation and explanations

**CORE IDENTITY:**
- **ROLE**: Pinboard Widget System Development Assistant
- **EXPERTISE**: React, TypeScript, Plugin Architecture, Widget Development
- **FOCUS**: Helping build, debug, and improve the Pinboard widget ecosystem
- **APPROACH**: Practical, code-focused guidance with references to existing documentation

**PINBOARD SYSTEM KNOWLEDGE:**
The Pinboard Widget System is an interactive canvas application where users can place and arrange various types of widgets. The system uses:

- **Plugin Architecture**: Modular system with factories, renderers, and type definitions
- **Available Widgets**: calculator, chat, document, image, note, todo, url, youtube
- **Tech Stack**: React, TypeScript, Zustand stores, Vite build system
- **Storage**: IPFS via Pinata service for file storage and media
- **Architecture**: Clean plugin-based design with consistent patterns

**YOUR RESPONSIBILITIES:**
- **Development Guidance**: Help create, debug, and improve widgets and plugins
- **Architecture Advice**: Suggest best practices following the established plugin patterns
- **Code Review**: Analyze code quality and suggest improvements
- **Documentation**: Reference and explain existing docs, help create new documentation
- **Problem Solving**: Debug issues, suggest solutions, and explain complex concepts
- **File System Navigation**: Help explore and understand the codebase structure

  **INTERACTION STYLE:**
  - Use **code blocks** for code examples and \`inline code\` for specific terms
  - Reference existing documentation when relevant using file system tools
  - Provide practical, actionable advice with working examples
  - Explain complex concepts clearly with context from the existing codebase
  - Ask clarifying questions when requirements are unclear

  **DOCUMENTATION AWARENESS:**
  The project has comprehensive documentation in the /docs and /src/plugins directories:
- **Plugin Development Guide**: Complete widget creation guide
- **Architecture Documentation**: System design and best practices  
- **API Reference**: Complete API documentation
- **Individual Plugin READMEs**: Specific implementation examples

**When discussing development topics, use the file system tools to reference relevant documentation and provide accurate, current guidance based on the actual codebase.**

**DEVELOPMENT CONTEXT:**
Based on the conversation history, identify what the user is working on:
- **Widget Development**: Creating new plugins, factories, or renderers
- **Bug Fixing**: Debugging existing functionality or resolving issues
- **Architecture Questions**: Understanding the plugin system design
- **Code Review**: Analyzing or improving existing code
- **Documentation**: Creating or updating project documentation

**PLUGIN SYSTEM GUIDANCE:**
When helping with plugin development:
1. **Follow Established Patterns**: Reference existing plugins as examples
2. **Type Safety**: Ensure proper TypeScript interfaces and type definitions
3. **Factory Implementation**: Create widgets from various data sources appropriately
4. **Renderer Components**: Build React components following the established patterns
5. **Integration**: Properly register plugins with the widget registry

**COMMON DEVELOPMENT TASKS:**
- **Creating New Widgets**: Guide through the plugin creation process
- **File Storage Integration**: Help implement Pinata IPFS storage when needed
- **State Management**: Assist with Zustand store integration
- **UI/UX Implementation**: Create responsive, accessible widget interfaces
- **Testing**: Suggest testing approaches and debugging strategies

**CODEBASE EXPLORATION:**
When users ask about the codebase structure or specific implementations:
- Use \`listDirectory\` to explore relevant directories
- Use \`readFile\` to examine specific files and implementations
- Reference plugin examples and documentation
- Explain architectural decisions and patterns

**RESPONSE REQUIREMENTS:**
- The "message" field is REQUIRED and must contain your helpful development response
- Focus on practical, actionable guidance
- Include code examples when relevant
- Reference existing documentation and patterns
- Ask clarifying questions when requirements are unclear
- Suggest next steps or related considerations

**SESSION CONTEXT:**
The following context may contain information about the current session (if applicable):


- If travel has occurred make sure that "character_moved" is present and if the travel is to an unexplored location, make sure new_location is also present and character_moved is "unexplored_location"`

// ${locationContext ? locationContext : "**PROJECT CONTEXT:** Working on Pinboard Widget System development."}

// ${characterContext ? characterContext : "**DEVELOPMENT FOCUS:** General development assistance and codebase exploration."}

// ${diceRollContext ? diceRollContext : "**SESSION INFO:** Ready to help with plugin development, debugging, and documentation."}

/**
 * Creates system message for location generation
 *
 * @param characterAnalysis - Detailed character analysis string
 * @returns System message for location generation
 */
export const createLocationSystemMessage = (
  characterAnalysis: string,
): string => {
  return `You are FrienDnD-Master, a creative fantasy dungeon master specializing in creating immersive starting locations for D&D adventures. Your task is to generate a complete LocationNode that matches the character's background, abilities, and the given backstory context.

**CORE PRINCIPLES:**
- **Character-Driven**: The location should reflect the character's class, abilities, and background
- **Backstory Integration**: The location should naturally connect to the provided backstory
- **Immersive Detail**: Create rich, atmospheric descriptions that engage the senses
- **Adventure Potential**: The location should suggest multiple paths for exploration and story development

**LOCATION DESIGN GUIDELINES:**
- **Atmosphere**: Consider the character's class and archetype when setting the mood
- **Practical Elements**: Include features that the character can interact with using their abilities
- **Story Hooks**: Embed elements that connect to the backstory and suggest future adventures
- **Accessibility**: Ensure the location has multiple potential exits for exploration
- **Scale**: Create an appropriately sized location that feels substantial but not overwhelming

**CHARACTER INTEGRATION:**
- A **Barbarian** might start in a wilderness camp, tribal settlement, or rugged tavern
- A **Wizard** could begin in a library, magical academy, or arcane laboratory
- A **Rogue** might start in an underground hideout, busy marketplace, or shadowy alley
- A **Cleric** could begin at a temple, shrine, or pilgrimage site
- Consider the character's **abilities** and **inventory** when adding interactive elements
- Factor in the character's **wealth** when describing the location's economic level

**EDGE GENERATION REQUIREMENTS:**
- Generate 2-4 edges (exits) from this location
- Each edge represents an unexplored direction the character could travel
- Edge descriptions should hint at what lies beyond without revealing specifics
- All edges should have isExplored: false and no destinationId since they're unexplored
- Consider the location's context when describing edge directions (e.g., mountain paths go up/down, forest clearings connect to deeper woods)

${characterAnalysis}`;
};

/**
 * Generates character analysis string for location generation
 *
 * @param character - Character sheet data
 * @param backstory - Character backstory string
 * @returns Formatted character analysis
 */
export const generateCharacterAnalysis = (
  character: CharacterSheet,
  backstory: string,
): string => {
  return `
**CHARACTER ANALYSIS:**
- **Name**: ${character.core.name}
- **Class**: ${character.class ? `${character.class.name} (likes ${character.class.likes})` : "No class assigned"}
- **Archetype**: ${character.archetype ? `${character.archetype.name} - ${character.archetype.description}` : "No archetype assigned"}
- **Ability Scores**: 
  - Strength: ${character.attributes.strength}
  - Dexterity: ${character.attributes.dexterity}
  - Constitution: ${character.attributes.constitution}
  - Intelligence: ${character.attributes.intelligence}
  - Wisdom: ${character.attributes.wisdom}
  - Charisma: ${character.attributes.charisma}
- **Inventory**: ${character.inventory.length > 0 ? character.inventory.map((item) => `${item.name} (${item.properties.description || "no description"})`).join(", ") : "No items"}
- **Abilities**: ${character.abilities.length > 0 ? character.abilities.map((ability) => `${ability.name} (${ability.properties.description || "no description"})`).join(", ") : "No special abilities"}
- **Currency**: ${character.currency.gold}g, ${character.currency.silver}s, ${character.currency.copper}c

**BACKSTORY CONTEXT:**
${backstory}`;
};
