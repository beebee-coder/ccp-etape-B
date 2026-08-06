import { query } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import type { ChatMessage } from "@/lib/types/chat";
import type { Json } from "@/lib/types/json";

const log = createLogger({ module: "ai-chat-server-store" });

interface ChatMessageRow {
  id: string;
  conversation_id: string;
  user_id: string;
  role: string;
  content: string;
  provider: string | null;
  timestamp: string;
  media: string | null;
  procedure_id: string | null;
  source: string | null;
  client_id: string | null;
}

function parseMedia(media: string | null): Json | null {
  if (!media) return null;
  try {
    return JSON.parse(media) as Json;
  } catch {
    return null;
  }
}

function rowToChatMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    userId: row.user_id,
    role: row.role as ChatMessage["role"],
    content: row.content,
    provider: row.provider ?? undefined,
    timestamp: new Date(row.timestamp),
    media: parseMedia(row.media) ?? undefined,
    procedureId: row.procedure_id ?? undefined,
    source: row.source ?? undefined,
    clientId: row.client_id ?? undefined,
  };
}

export async function saveChatMessage(
  message: Omit<ChatMessage, "timestamp"> & { timestamp?: Date },
): Promise<ChatMessage> {
  const id = message.id;
  const now = (message.timestamp ?? new Date()).toISOString();
  const mediaJson = message.media ? JSON.stringify(message.media) : null;

  log.debug("saveChatMessage: inserting chat message", {
    messageId: id,
    conversationId: message.conversationId,
    userId: message.userId,
    role: message.role,
  });

  try {
    const result = await query<ChatMessageRow>(
      `INSERT INTO chat_messages (id, conversation_id, user_id, role, content, provider, timestamp, media, procedure_id, source, client_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, conversation_id, user_id, role, content, provider, timestamp, media, procedure_id, source, client_id`,
      [
        id,
        message.conversationId,
        message.userId,
        message.role,
        message.content,
        message.provider ?? null,
        now,
        mediaJson,
        message.procedureId ?? null,
        message.source ?? null,
        message.clientId ?? null,
      ],
    );

    log.info("saveChatMessage: message saved", {
      messageId: id,
      role: message.role,
    });
    return rowToChatMessage(result.rows[0]);
  } catch (error) {
    log.error("saveChatMessage: database error", { messageId: id, error });
    throw error;
  }
}

export async function getChatHistory(
  userId: string,
  conversationId: string,
  limit = 100,
): Promise<ChatMessage[]> {
  log.debug("getChatHistory: fetching chat history", {
    userId,
    conversationId,
    limit,
  });

  try {
    const result = await query<ChatMessageRow>(
      `SELECT id, conversation_id, user_id, role, content, provider, timestamp, media, procedure_id, source, client_id
       FROM chat_messages
       WHERE user_id = $1 AND conversation_id = $2
       ORDER BY timestamp ASC
       LIMIT $3`,
      [userId, conversationId, limit],
    );

    const messages = result.rows.map(rowToChatMessage);
    log.debug("getChatHistory: messages fetched", {
      userId,
      conversationId,
      count: messages.length,
    });
    return messages;
  } catch (error) {
    log.error("getChatHistory: database error", {
      userId,
      conversationId,
      error,
    });
    throw error;
  }
}

export async function deleteChatHistory(
  userId: string,
  conversationId: string,
): Promise<number> {
  log.debug("deleteChatHistory: deleting conversation history", {
    userId,
    conversationId,
  });

  try {
    const result = await query<{ id: string }>(
      `DELETE FROM chat_messages WHERE user_id = $1 AND conversation_id = $2 RETURNING id`,
      [userId, conversationId],
    );

    log.info("deleteChatHistory: conversation deleted", {
      userId,
      conversationId,
      deletedCount: result.rows.length,
    });
    return result.rows.length;
  } catch (error) {
    log.error("deleteChatHistory: database error", {
      userId,
      conversationId,
      error,
    });
    throw error;
  }
}
