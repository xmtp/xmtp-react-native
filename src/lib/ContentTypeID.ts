/*
 *
 * This ContentTypeID class represents a content type identifier.
 *
 * @param {string} authorityId - The authority that defined the content type.
 * @param {string} typeId - The unique Id for the content type within the authority, e.g. "number"
 * @param {number} versionMajor -  The major version number of the content type.
 * @param {number} versionMinor - The minor version number of the content type.
 *
 * @returns {string} The full content type ID in the format:
 * <authorityId>:<typeId>
 */

export class ContentTypeID {
  authorityId: string;
  typeId: string;
  versionMajor: number;
  versionMinor: number;
  constructor({ authorityId, typeId, versionMajor, versionMinor }) {
    this.authorityId = authorityId;
    this.typeId = typeId;
    this.versionMajor = versionMajor;
    this.versionMinor = versionMinor;
  }

  id() {
    return `${this.authorityId}:${this.typeId}`;
  }
}
