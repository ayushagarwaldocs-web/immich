import { AlbumTree, isValidAlbumMove, sortAlbumsByName, type AlbumTreeItem } from '#lib/utils/album-tree.ts';

const album = (id: string, parentId: string | null = null, albumName = id): AlbumTreeItem => ({
  id,
  albumName,
  parentId,
});

const travel = album('travel', null, 'Travel');
const year = album('2024', 'travel', '2024');
const japan = album('japan', '2024', 'Japan');
const kyoto = album('kyoto', 'japan', 'Kyoto');
const italy = album('italy', 'travel', 'Italy');
const family = album('family', null, 'Family');

const albums = [travel, year, japan, kyoto, italy, family];

describe('AlbumTree', () => {
  describe('getRoots', () => {
    it('returns the albums without a parent', () => {
      expect(new AlbumTree(albums).getRoots()).toEqual([travel, family]);
    });

    it('treats an album whose parent is not in the list as a root', () => {
      expect(new AlbumTree([japan, kyoto, family]).getRoots()).toEqual([japan, family]);
    });

    it('treats an album that is its own parent as a root', () => {
      const loop = album('loop', 'loop');

      expect(new AlbumTree([loop]).getRoots()).toEqual([loop]);
    });
  });

  describe('getParent', () => {
    it('returns the parent album', () => {
      expect(new AlbumTree(albums).getParent(japan)).toBe(year);
    });

    it('returns nothing for a top-level album or a parent that is not in the list', () => {
      const tree = new AlbumTree([japan, kyoto]);

      expect(tree.getParent(japan)).toBeUndefined();
      expect(new AlbumTree(albums).getParent(travel)).toBeUndefined();
    });
  });

  describe('getChildren', () => {
    it('returns the direct children only', () => {
      expect(new AlbumTree(albums).getChildren('travel')).toEqual([year, italy]);
    });

    it('returns the children of an album that is not in the list', () => {
      expect(new AlbumTree([japan, kyoto]).getChildren('2024')).toEqual([japan]);
    });

    it('returns nothing for an album without children', () => {
      expect(new AlbumTree(albums).getChildren('family')).toEqual([]);
    });
  });

  describe('getAncestors', () => {
    it('returns the ancestors from the top level down to the parent', () => {
      expect(new AlbumTree(albums).getAncestors(kyoto)).toEqual([travel, year, japan]);
    });

    it('returns nothing for a top-level album', () => {
      expect(new AlbumTree(albums).getAncestors(travel)).toEqual([]);
    });

    it('stops at the first parent that is not in the list', () => {
      expect(new AlbumTree([japan, kyoto, travel]).getAncestors(kyoto)).toEqual([japan]);
    });

    it('stops when the albums form a cycle', () => {
      const first = album('first', 'second');
      const second = album('second', 'first');

      expect(new AlbumTree([first, second]).getAncestors(first)).toEqual([second]);
    });
  });

  describe('getDescendantIds', () => {
    it('returns every album below the album', () => {
      expect(new AlbumTree(albums).getDescendantIds('travel')).toEqual(new Set(['2024', 'italy', 'japan', 'kyoto']));
    });

    it('returns nothing for an album without children', () => {
      expect(new AlbumTree(albums).getDescendantIds('kyoto')).toEqual(new Set());
    });

    it('stops when the albums form a cycle', () => {
      const first = album('first', 'second');
      const second = album('second', 'first');

      expect(new AlbumTree([first, second]).getDescendantIds('first')).toEqual(new Set(['second']));
    });
  });

  describe('getCoverAssetId', () => {
    const withCover = (item: AlbumTreeItem, albumThumbnailAssetId: string) => ({ ...item, albumThumbnailAssetId });

    it('returns the cover of the album itself', () => {
      const covered = withCover(travel, 'own');

      expect(new AlbumTree([covered, withCover(italy, 'italy')]).getCoverAssetId(covered)).toBe('own');
    });

    it('returns the first cover found depth-first among the sub-albums sorted by name', () => {
      const tree = new AlbumTree([travel, year, withCover(japan, 'japan'), withCover(italy, 'italy')]);

      expect(tree.getCoverAssetId(travel)).toBe('japan');
    });

    it('returns null when no album in the branch has a cover', () => {
      expect(new AlbumTree(albums).getCoverAssetId(travel)).toBeNull();
    });

    it('stops when the albums form a cycle', () => {
      const first = album('first', 'second');
      const second = album('second', 'first');

      expect(new AlbumTree([first, second]).getCoverAssetId(first)).toBeNull();
    });
  });

  describe('getDeletionOrder', () => {
    it('lists the deepest sub-albums first and the album last', () => {
      expect(new AlbumTree(albums).getDeletionOrder(travel)).toEqual([kyoto, japan, year, italy, travel]);
    });

    it('returns only the album when it has no sub-albums', () => {
      expect(new AlbumTree(albums).getDeletionOrder(family)).toEqual([family]);
    });

    it('stops when the albums form a cycle', () => {
      const first = album('first', 'second');
      const second = album('second', 'first');

      expect(new AlbumTree([first, second]).getDeletionOrder(first)).toEqual([second, first]);
    });
  });

  describe('getPathLabel', () => {
    it('joins the names of the ancestors and the album', () => {
      expect(new AlbumTree(albums).getPathLabel(kyoto)).toBe('Travel / 2024 / Japan / Kyoto');
    });

    it('returns the name of a top-level album', () => {
      expect(new AlbumTree(albums).getPathLabel(family)).toBe('Family');
    });

    it('formats every name', () => {
      const unnamed = album('unnamed', 'travel', '');

      expect(new AlbumTree([travel, unnamed]).getPathLabel(unnamed, ({ albumName }) => albumName || 'Unnamed')).toBe(
        'Travel / Unnamed',
      );
    });
  });
});

describe('sortAlbumsByName', () => {
  it('sorts numbers naturally and ignores case', () => {
    const names = ['day 10', 'Day 2', 'beach', 'Day 1'].map((name) => album(name, null, name));

    expect(sortAlbumsByName(names, 'en').map(({ albumName }) => albumName)).toEqual([
      'beach',
      'Day 1',
      'Day 2',
      'day 10',
    ]);
  });

  it('does not change the original list', () => {
    const names = [album('b'), album('a')];

    sortAlbumsByName(names);

    expect(names.map(({ id }) => id)).toEqual(['b', 'a']);
  });
});

describe('isValidAlbumMove', () => {
  const descendantIds = new AlbumTree(albums).getDescendantIds('travel');

  it('allows moving into another album or to the top level', () => {
    expect(isValidAlbumMove(travel, 'family', descendantIds)).toBe(true);
    expect(isValidAlbumMove(japan, null, new Set(['kyoto']))).toBe(true);
  });

  it('rejects the album itself and its sub-albums', () => {
    expect(isValidAlbumMove(travel, 'travel', descendantIds)).toBe(false);
    expect(isValidAlbumMove(travel, 'kyoto', descendantIds)).toBe(false);
  });

  it('rejects the current parent', () => {
    expect(isValidAlbumMove(japan, '2024', new Set(['kyoto']))).toBe(false);
    expect(isValidAlbumMove(travel, null, descendantIds)).toBe(false);
  });
});
