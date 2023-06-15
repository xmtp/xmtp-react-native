/*
 *
 * This ContentTypeID class represents a content type identifier.
 *
 * @param {string} authorityID - The authority that defined the content type.
 * @param {string} typeID - The unique ID for the content type within the authority, e.g. "number"
 * @param {number} versionMajor -  The major version number of the content type.
 * @param {number} versionMinor - The minor version number of the content type.
 *
 * @returns {string} The full content type ID in the format:
 * <authorityID>:<typeID>
 */

export class ContentTypeID {
  authorityID: string;
  typeID: string;
  versionMajor: number;
  versionMinor: number;
  constructor({ authorityID, typeID, versionMajor, versionMinor }) {
    this.authorityID = authorityID;
    this.typeID = typeID;
    this.versionMajor = versionMajor;
    this.versionMinor = versionMinor;
  }

  id() {
    return `${this.authorityID}:${this.typeID}`;
  }
}
