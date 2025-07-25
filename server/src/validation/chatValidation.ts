/**
 * Chat Validation Functions
 *
 * Provides validation for request bodies and response data in the Claude chat system.
 * Ensures data integrity and proper format compliance.
 */

import type { ChatResponse, ValidationResult } from "../types/chat.js";

/**
 * Validates the structure and content of chat request bodies
 *
 * @param body - The request body to validate
 * @returns ValidationResult with isValid flag and error messages
 */
export const validateChatRequest = (body: any): ValidationResult => {
  const errors: string[] = [];

  if (!body.messages || !Array.isArray(body.messages)) {
    errors.push("Messages array is required");
  } else {
    const isValidMessages = body.messages.every(
      (msg: any) =>
        msg &&
        typeof msg === "object" &&
        typeof msg.role === "string" &&
        typeof msg.content === "string",
    );

    if (!isValidMessages) {
      errors.push("Each message must have role and content properties");
    }
  }

  if (!Array.isArray(body.locations)) {
    errors.push("Locations must be an array of LocationNode objects");
  }

  if (!Array.isArray(body.characters)) {
    errors.push("Characters must be an array of CharacterSheet objects");
  }

  return { isValid: errors.length === 0, errors };
};

/**
 * Validates the structure and content of location generation request bodies
 *
 * @param body - The request body to validate
 * @returns ValidationResult with isValid flag and error messages
 */
export const validateLocationRequest = (body: any): ValidationResult => {
  const errors: string[] = [];

  if (!body.character || typeof body.character !== "object") {
    errors.push("Character sheet is required");
  } else {
    if (
      !body.character.core ||
      !body.character.core.id ||
      !body.character.core.name
    ) {
      errors.push("Character must have core information (id and name)");
    }

    if (
      !body.character.attributes ||
      typeof body.character.attributes !== "object"
    ) {
      errors.push("Character must have ability scores (attributes)");
    }
  }

  if (!body.backstory || typeof body.backstory !== "string") {
    errors.push("Backstory description is required");
  }

  return { isValid: errors.length === 0, errors };
};

// Complex validation moved to responseValidation.ts to reduce complexity

/**
 * Validates location generation response format and content
 *
 * @param response - The location response from Claude to validate
 * @returns ValidationResult with isValid flag and error messages
 */
export const validateLocationResponse = (response: any): ValidationResult => {
  const errors: string[] = [];

  // Validate required location field
  if (!response.location || typeof response.location !== "object") {
    errors.push("location field is required and must be an object");
  } else {
    if (!response.location.name || typeof response.location.name !== "string") {
      errors.push("location.name is required and must be a string");
    }
    if (
      !response.location.description ||
      typeof response.location.description !== "string"
    ) {
      errors.push("location.description is required and must be a string");
    }
  }

  // Validate required edges field
  if (!Array.isArray(response.edges)) {
    errors.push("edges field is required and must be an array");
  } else {
    if (response.edges.length === 0) {
      errors.push("edges array must contain at least 1 edge");
    }

    // Validate each edge
    response.edges.forEach((edge: any, index: number) => {
      if (!edge || typeof edge !== "object") {
        errors.push(`edge[${index}] must be an object`);
        return;
      }

      if (!edge.direction || typeof edge.direction !== "string") {
        errors.push(
          `edge[${index}].direction is required and must be a string`,
        );
      }

      if (!edge.description || typeof edge.description !== "string") {
        errors.push(
          `edge[${index}].description is required and must be a string`,
        );
      }

      if (typeof edge.isExplored !== "boolean") {
        errors.push(
          `edge[${index}].isExplored is required and must be a boolean`,
        );
      }

      if (edge.isExplored !== false) {
        errors.push(
          `edge[${index}].isExplored must be false for starting locations`,
        );
      }
    });
  }

  return { isValid: errors.length === 0, errors };
};
