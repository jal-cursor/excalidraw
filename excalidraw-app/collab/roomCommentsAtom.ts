import { atom } from "../app-jotai";

import type { RoomComment } from "../data/comments";

/** Map of comment id → comment while in a collaboration room. */
export const roomCommentsAtom = atom<Record<string, RoomComment>>({});

export type RoomCommentComposerState =
  | { mode: "scene"; x: number; y: number }
  | { mode: "element"; elementId: string }
  | { mode: "edit"; commentId: string }
  | null;

/** Opens the comment composer (floating or element-anchored). */
export const roomCommentComposerAtom = atom<RoomCommentComposerState>(null);

/** When true, next click on canvas (selection tool) places a scene comment. */
export const roomCommentPlacementModeAtom = atom(false);
