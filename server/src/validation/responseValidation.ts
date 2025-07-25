/**
 * Response Validation Functions
 *
 * Specialized validation functions for Claude responses with reduced complexity.
 */

import type { ValidationResult } from "../types/chat.js";

/**
 * Validates character movement field format
 */
const validateCharacterMoved = (characterMoved: any, errors: string[]) => {
  if (typeof characterMoved !== "string") {
    errors.push("character_moved must be a string");
    return;
  }

  const directionNames = [
    "north",
    "south",
    "east",
    "west",
    "northeast",
    "northwest",
    "southeast",
    "southwest",
    "up",
    "down",
  ];
  if (directionNames.includes(characterMoved.toLowerCase())) {
    errors.push(
      `character_moved cannot be a direction name like "${characterMoved}". Use the destination location UUID or "unexplored_location".`,
    );
    return;
  }

  if (characterMoved !== "unexplored_location") {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const idRegex = /^[a-zA-Z0-9_-]+$/;

    if (!uuidRegex.test(characterMoved) && !idRegex.test(characterMoved)) {
      errors.push(
        `character_moved must be either "unexplored_location" or a valid location UUID/ID, got: "${characterMoved}"`,
      );
    }
  }
};

/**
 * Validates the relationship between character_moved and new_location fields
 */
const validateMovementRelationship = (
  characterMoved: string,
  newLocation: any,
  errors: string[],
) => {
  if (characterMoved === "unexplored_location" && !newLocation) {
    errors.push(
      'when character_moved is "unexplored_location", new_location must be provided',
    );
  }

  if (characterMoved !== "unexplored_location" && newLocation) {
    errors.push("when character_moved is a UUID, new_location must be omitted");
  }
};

/**
 * Validates new_location structure
 */
const validateNewLocation = (newLocation: any, errors: string[]) => {
  if (
    !newLocation.location ||
    !newLocation.location.name ||
    !newLocation.location.description
  ) {
    errors.push("new_location.location must have name and description");
  }
  if (!Array.isArray(newLocation.edges) || newLocation.edges.length === 0) {
    errors.push("new_location.edges must be a non-empty array");
  }
};

/**
 * Validates Claude's chat response format and content (simplified)
 *
 * @param response - The response from Claude to validate
 * @returns ValidationResult with isValid flag and error messages
 */
export const validateChatResponse = (response: any): ValidationResult => {
  const errors: string[] = [];

  // Validate required message field
  if (!response.message || typeof response.message !== "string") {
    errors.push("message field is required and must be a string");
  }

  // Validate character_moved field if present
  if (response.character_moved !== undefined) {
    validateCharacterMoved(response.character_moved, errors);

    if (typeof response.character_moved === "string") {
      validateMovementRelationship(
        response.character_moved,
        response.new_location,
        errors,
      );
    }
  }

  // Validate new_location structure if present
  if (response.new_location) {
    validateNewLocation(response.new_location, errors);
  }

  return { isValid: errors.length === 0, errors };
};
