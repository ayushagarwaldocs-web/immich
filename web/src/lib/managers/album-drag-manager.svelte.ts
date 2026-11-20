import { isValidAlbumMove } from '#lib/utils/album-tree.ts';
import type { AlbumResponseDto } from '@immich/sdk';

class AlbumDragManager {
  #album = $state<AlbumResponseDto>();
  #descendantIds: ReadonlySet<string> = new Set();

  get album() {
    return this.#album;
  }

  start(album: AlbumResponseDto, descendantIds: ReadonlySet<string>) {
    this.#album = album;
    this.#descendantIds = descendantIds;
  }

  end() {
    this.#album = undefined;
    this.#descendantIds = new Set();
  }

  canDropOn(parentId: string | null) {
    return !!this.#album && isValidAlbumMove(this.#album, parentId, this.#descendantIds);
  }
}

export const albumDragManager = new AlbumDragManager();
