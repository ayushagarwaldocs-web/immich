import { albumDragManager } from '#lib/managers/album-drag-manager.svelte.ts';
import { isAlbumOwner, moveAlbum } from '#lib/services/album.service.ts';
import type { AlbumTree } from '#lib/utils/album-tree.ts';
import type { AlbumResponseDto } from '@immich/sdk';
import type { Attachment } from 'svelte/attachments';

export const albumDragSource =
  (album: AlbumResponseDto, tree?: AlbumTree<AlbumResponseDto>): Attachment<HTMLElement> =>
  (element) => {
    element.draggable = false;
    if (!tree || !isAlbumOwner(album)) {
      return;
    }

    const ondragstart = (event: DragEvent) => {
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'all';
      }
      albumDragManager.start(album, tree.getDescendantIds(album.id));
    };
    const ondragend = () => albumDragManager.end();

    element.draggable = true;
    element.addEventListener('dragstart', ondragstart);
    element.addEventListener('dragend', ondragend);

    return () => {
      element.draggable = false;
      element.removeEventListener('dragstart', ondragstart);
      element.removeEventListener('dragend', ondragend);
    };
  };

export const albumDropTarget =
  (target: AlbumResponseDto | null): Attachment<HTMLElement> =>
  (element) => {
    const canDrop = () => (target === null || isAlbumOwner(target)) && albumDragManager.canDropOn(target?.id ?? null);
    const clearHighlight = () => delete element.dataset.dropTarget;

    const ondragover = (event: DragEvent) => {
      if (!canDrop()) {
        return;
      }

      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
      element.dataset.dropTarget = '';
    };

    const ondragleave = (event: DragEvent) => {
      if (!(event.relatedTarget instanceof Node && element.contains(event.relatedTarget))) {
        clearHighlight();
      }
    };

    const ondrop = (event: DragEvent) => {
      clearHighlight();
      const album = albumDragManager.album;
      if (!album || !canDrop()) {
        return;
      }

      event.preventDefault();
      albumDragManager.end();
      void moveAlbum(album, target?.id ?? null);
    };

    element.addEventListener('dragover', ondragover);
    element.addEventListener('dragleave', ondragleave);
    element.addEventListener('drop', ondrop);

    return () => {
      element.removeEventListener('dragover', ondragover);
      element.removeEventListener('dragleave', ondragleave);
      element.removeEventListener('drop', ondrop);
    };
  };
