import { describe, expect, it } from "vitest";

import { mergeCommentUpdate, type RoomComment } from "./comments";

describe("mergeCommentUpdate", () => {
  const base: RoomComment = {
    id: "c1",
    authorId: "a",
    content: "hello",
    createdAt: 1,
    updatedAt: 1,
    anchor: { kind: "scene", x: 0, y: 0 },
  };

  it("adds or replaces a comment", () => {
    const prev = {};
    const next = mergeCommentUpdate(prev, { comment: base });
    expect(next.c1).toEqual(base);
  });

  it("removes on delete", () => {
    const prev = { c1: base };
    const next = mergeCommentUpdate(prev, { comment: base, deleted: true });
    expect(next.c1).toBeUndefined();
  });
});
