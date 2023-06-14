/*
 *
 * An error class for codec-related errors when searching the registry.
 *
 * @param {string} message - The error message.
 */

export class CodecError extends Error {
  constructor(message: "invalidContent" | "codecNotFound") {
    super(message);
    this.name = message;
  }
}
