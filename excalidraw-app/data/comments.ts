/**
 * Room comments: floating scene anchors or single-element anchors.
 * Synced over collab WebSocket and persisted encrypted in Firestore.
 */

export type CommentAnchor =
  | { kind: "scene"; x: number; y: number }
  | { kind: "element"; elementId: string };

export type RoomComment = {
  id: string;
  /** Stable author id for this session (socket id or local id). */
  authorId: string;
  /** Display name at time of last edit (optional for v1 display). */
  authorName?: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  anchor: CommentAnchor;
  /** True when element anchor no longer exists in scene. */
  detached?: boolean;
};

export type CommentUpdatePayload = {
  comment: RoomComment;
  /** When true, removes the comment by id. */
  deleted?: boolean;
};

export const mergeCommentUpdate = (
  prev: Record<string, RoomComment>,
  update: CommentUpdatePayload,
): Record<string, RoomComment> => {
  const next = { ...prev };
  if (update.deleted) {
    delete next[update.comment.id];
    return next;
  }
  next[update.comment.id] = update.comment;
  return next;
};

export const generateCommentId = (): string => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
};
