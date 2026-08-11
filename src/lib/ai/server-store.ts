import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { createLogger } from "@/lib/logger";
import type { ChatMessage } from "@/lib/types/chat";
import type { Json } from "@/lib/types/json";

const log = createLogger({ module: "ai-chat-server-store" });

function rowToChatMessage(row: {
  id: string;
  conversationId: string;
  userId: string;
  role: string;
  content: string;
  provider: string | null;
  timestamp: Date;
  media: unknown;
  procedureId: string | null;
  source: string | null;
  clientId: string | null;
}): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversationId,
    userId: row.userId,
    role: row.role as ChatMessage["role"],
    content: row.content,
    provider: row.provider ?? undefined,
    timestamp: row.timestamp,
    media: row.media as Json,
    procedureId: row.procedureId ?? undefined,
    source: row.source ?? undefined,
    clientId: row.clientId ?? undefined,
  };
}

export async function saveChatMessage(
  message: Omit<ChatMessage, "timestamp"> & { timestamp?: Date },
): Promise<ChatMessage> {
  const now = message.timestamp ?? new Date();

  log.debug("saveChatMessage: inserting chat message", {
    messageId: message.id,
    conversationId: message.conversationId,
    userId: message.userId,
    role: message.role,
  });

  try {
    const created = await prisma.chatMessage.create({
      data: {
        id: message.id,
        conversationId: message.conversationId,
        userId: message.userId,
        role: message.role,
        content: message.content,
        provider: message.provider ?? null,
        timestamp: now,
        media: message.media as unknown as Prisma.InputJsonValue,
        procedureId: message.procedureId ?? null,
        source: message.source ?? null,
        clientId: message.clientId ?? null,
      },
    });

    log.info("saveChatMessage: message saved", {
      messageId: message.id,
      role: message.role,
    });
    return rowToChatMessage(created);
  } catch (error) {
    log.error("saveChatMessage: database error", { messageId: message.id, error });
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
    const messages = await prisma.chatMessage.findMany({
      where: {
        userId,
        conversationId,
      },
      orderBy: { timestamp: "asc" },
      take: limit,
    });

    log.debug("getChatHistory: messages fetched", {
      userId,
      conversationId,
      count: messages.length,
    });
    return messages.map(rowToChatMessage);
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
    const result = await prisma.chatMessage.deleteMany({
      where: {
        userId,
        conversationId,
      },
    });

    log.info("deleteChatHistory: conversation deleted", {
      userId,
      conversationId,
      deletedCount: result.count,
    });
    return result.count;
  } catch (error) {
    log.error("deleteChatHistory: database error", {
      userId,
      conversationId,
      error,
    });
    throw error;
  }
}
