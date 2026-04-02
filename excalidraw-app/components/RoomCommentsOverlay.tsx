import {
  getCommonBounds,
  sceneCoordsToViewportCoords,
  useExcalidrawAPI,
  viewportCoordsToSceneCoords,
} from "@excalidraw/excalidraw";
import { t } from "@excalidraw/excalidraw/i18n";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type { AppState } from "@excalidraw/excalidraw/types";

import type { OrderedExcalidrawElement } from "@excalidraw/element/types";

import { collabAPIAtom, isCollaboratingAtom } from "../collab/Collab";
import {
  roomCommentComposerAtom,
  roomCommentPlacementModeAtom,
  roomCommentsAtom,
  type RoomCommentComposerState,
} from "../collab/roomCommentsAtom";
import { generateCommentId, type RoomComment } from "../data/comments";

import { useAtom, useAtomValue } from "../app-jotai";

import "./RoomCommentsOverlay.scss";

import type { CollabAPI } from "../collab/Collab";

const RoomCommentsOverlay = () => {
  const excalidrawAPI = useExcalidrawAPI();
  const collabAPI = useAtomValue(collabAPIAtom);
  /** Must subscribe to the atom: `collabAPI` is a stable ref and does not trigger re-renders when collab starts. */
  const isCollaborating = useAtomValue(isCollaboratingAtom);
  const [comments] = useAtom(roomCommentsAtom);
  const [composer, setComposer] = useAtom(roomCommentComposerAtom);
  const [placementMode, setPlacementMode] = useAtom(
    roomCommentPlacementModeAtom,
  );
  const [, forceRerender] = useState(0);

  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }
    return excalidrawAPI.onChange(() => {
      forceRerender((n) => n + 1);
    });
  }, [excalidrawAPI]);

  const onPointerDown = useCallback(
    (
      activeTool: AppState["activeTool"],
      _pointerDownState: unknown,
      event: ReactPointerEvent<HTMLElement>,
    ) => {
      if (!placementMode || !isCollaborating) {
        return;
      }
      if (activeTool.type !== "selection") {
        return;
      }
      const appState = excalidrawAPI!.getAppState();
      const { x, y } = viewportCoordsToSceneCoords(
        { clientX: event.clientX, clientY: event.clientY },
        appState,
      );
      setPlacementMode(false);
      setComposer({ mode: "scene", x, y });
    },
    [
      placementMode,
      isCollaborating,
      excalidrawAPI,
      setComposer,
      setPlacementMode,
    ],
  );

  useEffect(() => {
    if (!excalidrawAPI || !placementMode) {
      return;
    }
    return excalidrawAPI.onPointerDown(onPointerDown);
  }, [excalidrawAPI, placementMode, onPointerDown]);

  const commentList = useMemo(
    () => Object.values(comments).filter((c) => !c.detached),
    [comments],
  );

  if (!excalidrawAPI || !isCollaborating || !collabAPI) {
    return null;
  }

  const appState = excalidrawAPI.getAppState();

  const selectedIds = Object.keys(appState.selectedElementIds).filter(
    (id) => appState.selectedElementIds[id],
  );
  const singleSelectedElementId =
    selectedIds.length === 1 ? selectedIds[0] : null;

  return (
    <div className="excalidraw-app-room-comments-overlay">
      <div className="excalidraw-app-room-comments-toolbar">
        <button
          type="button"
          className="excalidraw-app-room-comments-toolbar__btn"
          onClick={() => setPlacementMode((p) => !p)}
          aria-pressed={placementMode}
        >
          {placementMode
            ? t("labels.roomCommentCancelPlacement")
            : t("labels.roomCommentPlaceOnCanvas")}
        </button>
        {singleSelectedElementId && (
          <button
            type="button"
            className="excalidraw-app-room-comments-toolbar__btn"
            onClick={() =>
              setComposer({
                mode: "element",
                elementId: singleSelectedElementId,
              })
            }
          >
            {t("labels.roomCommentOnSelection")}
          </button>
        )}
      </div>

      {commentList.map((comment) => (
        <CommentPin
          key={comment.id}
          comment={comment}
          appState={appState}
          elements={excalidrawAPI.getSceneElementsIncludingDeleted()}
          onOpen={() => setComposer({ mode: "edit", commentId: comment.id })}
        />
      ))}

      {composer && (
        <CommentComposerModal
          composer={composer}
          excalidrawAPI={excalidrawAPI}
          collabAPI={collabAPI}
          comments={comments}
          onClose={() => setComposer(null)}
          onSubmit={(text) => {
            const username = collabAPI.getUsername() || "";
            const authorId = collabAPI.getCommentAuthorId();

            if (composer.mode === "edit") {
              const existing = comments[composer.commentId];
              if (!existing) {
                setComposer(null);
                return;
              }
              const updated: RoomComment = {
                ...existing,
                content: text,
                authorName: username,
                updatedAt: Date.now(),
              };
              collabAPI.applyCommentUpdate(
                { comment: updated },
                { broadcast: true, persist: true },
              );
              setComposer(null);
              return;
            }

            const now = Date.now();
            const newComment: RoomComment =
              composer.mode === "scene"
                ? {
                    id: generateCommentId(),
                    authorId,
                    authorName: username,
                    content: text,
                    createdAt: now,
                    updatedAt: now,
                    anchor: { kind: "scene", x: composer.x, y: composer.y },
                  }
                : {
                    id: generateCommentId(),
                    authorId,
                    authorName: username,
                    content: text,
                    createdAt: now,
                    updatedAt: now,
                    anchor: {
                      kind: "element",
                      elementId: composer.elementId,
                    },
                  };

            collabAPI.applyCommentUpdate(
              { comment: newComment },
              { broadcast: true, persist: true },
            );
            setComposer(null);
          }}
          onDelete={
            composer.mode === "edit"
              ? () => {
                  const id = composer.commentId;
                  const c = comments[id];
                  if (c) {
                    collabAPI.applyCommentUpdate(
                      { comment: c, deleted: true },
                      { broadcast: true, persist: true },
                    );
                  }
                  setComposer(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
};

const CommentPin = (props: {
  comment: RoomComment;
  appState: AppState;
  elements: readonly OrderedExcalidrawElement[];
  onOpen: () => void;
}) => {
  const { comment, appState, elements, onOpen } = props;

  let sceneX = 0;
  let sceneY = 0;
  if (comment.anchor.kind === "scene") {
    sceneX = comment.anchor.x;
    sceneY = comment.anchor.y;
  } else {
    const anchor = comment.anchor;
    const el = elements.find((e) => e.id === anchor.elementId);
    if (!el || el.isDeleted) {
      return null;
    }
    const [x1, y1, x2] = getCommonBounds([el]);
    sceneX = (x1 + x2) / 2;
    sceneY = y1 - 8;
  }

  const { x: vx, y: vy } = sceneCoordsToViewportCoords(
    { sceneX, sceneY },
    appState,
  );
  const left = vx - appState.offsetLeft;
  const top = vy - appState.offsetTop;

  return (
    <button
      type="button"
      className="excalidraw-app-room-comment-pin"
      style={{ left, top }}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      title={comment.content.slice(0, 80)}
      aria-label={t("labels.roomComment")}
    >
      💬
    </button>
  );
};

const CommentComposerModal = (props: {
  composer: Exclude<RoomCommentComposerState, null>;
  excalidrawAPI: NonNullable<ReturnType<typeof useExcalidrawAPI>>;
  collabAPI: CollabAPI;
  comments: Record<string, RoomComment>;
  onClose: () => void;
  onSubmit: (text: string) => void;
  onDelete?: () => void;
}) => {
  const { composer, excalidrawAPI, comments, onClose, onSubmit, onDelete } =
    props;
  const initial =
    composer.mode === "edit" ? comments[composer.commentId]?.content ?? "" : "";
  const [text, setText] = useState(initial);

  const appState = excalidrawAPI.getAppState();

  let left = appState.width / 2 - 160;
  let top = appState.height / 2 - 80;
  if (composer.mode === "scene") {
    const { x: vx, y: vy } = sceneCoordsToViewportCoords(
      { sceneX: composer.x, sceneY: composer.y },
      appState,
    );
    left = vx - appState.offsetLeft;
    top = vy - appState.offsetTop + 24;
  } else if (composer.mode === "element") {
    const el = excalidrawAPI
      .getSceneElementsIncludingDeleted()
      .find((e) => e.id === composer.elementId);
    if (el && !el.isDeleted) {
      const [x1, y1, x2] = getCommonBounds([el]);
      const cx = (x1 + x2) / 2;
      const cy = y1 - 8;
      const { x: vx, y: vy } = sceneCoordsToViewportCoords(
        { sceneX: cx, sceneY: cy },
        appState,
      );
      left = vx - appState.offsetLeft;
      top = vy - appState.offsetTop + 24;
    }
  }

  return (
    <div className="excalidraw-app-room-comment-composer" style={{ left, top }}>
      <textarea
        className="excalidraw-app-room-comment-composer__input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
        rows={4}
        placeholder={t("labels.roomCommentPlaceholder")}
      />
      <div className="excalidraw-app-room-comment-composer__actions">
        {onDelete && (
          <button type="button" onClick={onDelete}>
            {t("labels.delete")}
          </button>
        )}
        <button type="button" onClick={onClose}>
          {t("buttons.cancel")}
        </button>
        <button
          type="button"
          className="excalidraw-app-room-comment-composer__submit"
          onClick={() => onSubmit(text.trim())}
          disabled={!text.trim()}
        >
          {t("labels.roomCommentPost")}
        </button>
      </div>
    </div>
  );
};

export default RoomCommentsOverlay;
