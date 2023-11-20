import {
  ContentTypeId,
  EncodedContent,
} from "@xmtp/proto/ts/dist/types/message_contents/content.pb";
import * as XMTP from "../index";
import XMTPModule from "../XMTPModule";

// Native Content Codecs have two generic types:
//
// T: The type of content being encoded/decoded
// E: The Expo type (must be supported by expo)
export interface NativeContentCodec<T, E> {
  nativeName: string;
  contentType: ContentTypeId;
  encode(content: T): E;
  decode(encodedContent: E): T;
  fallback(content: T): string | undefined;
}

export interface JSContentCodec<T> {
  contentType: ContentTypeId;
  encode(content: T): EncodedContent;
  decode(encodedContent: EncodedContent): T;
  fallback(content: T): string | undefined;
}

export const ContentTypeText: ContentTypeId = {
  authorityId: "xmtp.org",
  typeId: "text",
  versionMajor: 1,
  versionMinor: 0,
};

export class TextCodec implements NativeContentCodec<string, string> {
  nativeName = "text";

  contentType = ContentTypeText;

  encode(content: string): string {
    return content;
  }

  decode(encodedContent: string): string {
    return encodedContent;
  }

  fallback(content: string): string | undefined {
    return content;
  }
}

export const ContentTypeReaction = {
  authorityId: "xmtp.org",
  typeId: "reaction",
  versionMajor: 1,
  versionMinor: 0,
};

export type Reaction = {
  /**
   * The message ID for the message that is being reacted to
   */
  reference: string;
  /**
   * The action of the reaction
   */
  action: "added" | "removed";
  /**
   * The content of the reaction
   */
  content: string;
  /**
   * The schema of the content to provide guidance on how to display it
   */
  schema: "unicode" | "shortcode" | "custom";
};

type LegacyReactionParameters = Pick<
  Reaction,
  "action" | "reference" | "schema"
> & {
  encoding: "UTF-8";
};

export class ReactionCodec implements JSContentCodec<Reaction> {
  contentType = ContentTypeReaction;

  encode(reaction: Reaction): EncodedContent {
    const { action, reference, schema, content } = reaction;
    return {
      type: ContentTypeReaction,
      parameters: {},
      content: new TextEncoder().encode(
        JSON.stringify({ action, reference, schema, content })
      ),
    };
  }

  decode(encodedContent: EncodedContent): Reaction {
    const decodedContent = new TextDecoder().decode(encodedContent.content);

    // First try to decode it in the canonical form.
    try {
      const reaction = JSON.parse(decodedContent) as Reaction;
      const { action, reference, schema, content } = reaction;
      return { action, reference, schema, content };
    } catch (e) {
      // ignore, fall through to legacy decoding
    }

    // If that fails, try to decode it in the legacy form.
    const parameters = encodedContent.parameters as LegacyReactionParameters;
    return {
      action: parameters.action,
      reference: parameters.reference,
      schema: parameters.schema,
      content: decodedContent,
    };
  }

  fallback(content: Reaction): string | undefined {
    switch (content.action) {
      case "added":
        return `Reacted “${content.content}” to an earlier message`;
      case "removed":
        return `Removed “${content.content}” from an earlier message`;
      default:
        return undefined;
    }
  }
}
