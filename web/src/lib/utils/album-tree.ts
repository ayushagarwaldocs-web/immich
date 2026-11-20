export type AlbumTreeItem = {
  id: string;
  albumName: string;
  parentId?: string | null;
  albumThumbnailAssetId?: string | null;
};

const pathSeparator = ' / ';

export const sortAlbumsByName = <T extends Pick<AlbumTreeItem, 'albumName'>>(albums: T[], locale?: string) => {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  return [...albums].sort((a, b) => collator.compare(a.albumName, b.albumName));
};

export const isValidAlbumMove = (
  album: Pick<AlbumTreeItem, 'id' | 'parentId'>,
  parentId: string | null,
  descendantIds: ReadonlySet<string>,
) =>
  parentId !== (album.parentId ?? null) && parentId !== album.id && (parentId === null || !descendantIds.has(parentId));

export class AlbumTree<T extends AlbumTreeItem> {
  readonly #albums: T[];
  readonly #albumsById: Map<string, T>;
  readonly #childrenByParentId = new Map<string, T[]>();

  constructor(albums: T[]) {
    this.#albums = albums;
    this.#albumsById = new Map(albums.map((album) => [album.id, album]));

    for (const album of albums) {
      if (!album.parentId || album.parentId === album.id) {
        continue;
      }

      const siblings = this.#childrenByParentId.get(album.parentId);
      if (siblings) {
        siblings.push(album);
      } else {
        this.#childrenByParentId.set(album.parentId, [album]);
      }
    }
  }

  getRoots() {
    return this.#albums.filter((album) => !this.getParent(album));
  }

  getParent({ id, parentId }: Pick<AlbumTreeItem, 'id' | 'parentId'>) {
    return parentId && parentId !== id ? this.#albumsById.get(parentId) : undefined;
  }

  getChildren(id: string) {
    return this.#childrenByParentId.get(id) ?? [];
  }

  getAncestors(album: Pick<AlbumTreeItem, 'id' | 'parentId'>) {
    const ancestors: T[] = [];
    const visited = new Set([album.id]);

    for (let parent = this.getParent(album); parent && !visited.has(parent.id); parent = this.getParent(parent)) {
      visited.add(parent.id);
      ancestors.unshift(parent);
    }

    return ancestors;
  }

  getDescendantIds(id: string) {
    const descendantIds = new Set<string>();
    const pending = [id];

    for (let current = pending.pop(); current !== undefined; current = pending.pop()) {
      for (const child of this.getChildren(current)) {
        if (child.id === id || descendantIds.has(child.id)) {
          continue;
        }

        descendantIds.add(child.id);
        pending.push(child.id);
      }
    }

    return descendantIds;
  }

  getCoverAssetId(album: T, locale?: string) {
    const visited = new Set<string>();

    const findCover = (current: T): string | undefined => {
      if (visited.has(current.id)) {
        return;
      }

      visited.add(current.id);
      if (current.albumThumbnailAssetId) {
        return current.albumThumbnailAssetId;
      }

      for (const child of sortAlbumsByName(this.getChildren(current.id), locale)) {
        const assetId = findCover(child);
        if (assetId) {
          return assetId;
        }
      }
    };

    return findCover(album) ?? null;
  }

  getDeletionOrder(album: T) {
    const visited = new Set([album.id]);
    const levels: T[][] = [];

    for (let level = this.getChildren(album.id); level.length > 0;) {
      const unvisited = level.filter(({ id }) => !visited.has(id));
      for (const { id } of unvisited) {
        visited.add(id);
      }
      levels.push(unvisited);
      level = unvisited.flatMap(({ id }) => this.getChildren(id));
    }

    return [...levels.reverse().flat(), album];
  }

  getPathLabel(album: T, formatName: (album: T) => string = ({ albumName }) => albumName) {
    return [...this.getAncestors(album), album].map((item) => formatName(item)).join(pathSeparator);
  }
}
