import { Kysely } from 'kysely';
import { AlbumRepository } from 'src/repositories/album.repository.js';
import { LoggingRepository } from 'src/repositories/logging.repository.js';
import { DB } from 'src/schema/index.js';
import { BaseService } from 'src/services/base.service.js';
import { newMediumService } from 'test/medium.factory.js';
import { getKyselyDB } from 'test/utils.js';

let defaultDatabase: Kysely<DB>;

const setup = () => {
  const { ctx } = newMediumService(BaseService, {
    database: defaultDatabase,
    real: [],
    mock: [LoggingRepository],
  });
  return { ctx, sut: ctx.get(AlbumRepository) };
};

beforeAll(async () => {
  defaultDatabase = await getKyselyDB();
});

describe(AlbumRepository.name, () => {
  describe('getUserIds', () => {
    it('should return the owner and shared users of the album', async () => {
      const { ctx, sut } = setup();
      const { album, owner, sharedWith } = await ctx.newSharedAlbum();
      await ctx.newSharedAlbum();

      const userIds = await sut.getUserIds(album.id);

      expect(userIds.toSorted()).toEqual([owner.id, sharedWith.id].toSorted());
    });

    it('should return no users for a deleted album', async () => {
      const { ctx, sut } = setup();
      const { album, owner } = await ctx.newSharedAlbum();
      await sut.softDeleteAll(owner.id);

      const userIds = await sut.getUserIds(album.id);

      expect(userIds).toEqual([]);
    });
  });

  describe('getAll', () => {
    it('should return the parent album id', async () => {
      const { ctx, sut } = setup();
      const { user } = await ctx.newUser();
      const { album: parent } = await ctx.newAlbum({ ownerId: user.id });
      const { album: child } = await ctx.newAlbum({ ownerId: user.id, parentId: parent.id });

      const albums = await sut.getAll(user.id);

      expect(albums).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: parent.id, parentId: null }),
          expect.objectContaining({ id: child.id, parentId: parent.id }),
        ]),
      );
    });
  });

  describe('getLineageIds', () => {
    it('should return the album and all of its ancestors', async () => {
      const { ctx, sut } = setup();
      const { user } = await ctx.newUser();
      const { album: a } = await ctx.newAlbum({ ownerId: user.id });
      const { album: b } = await ctx.newAlbum({ ownerId: user.id, parentId: a.id });
      const { album: c } = await ctx.newAlbum({ ownerId: user.id, parentId: b.id });
      await ctx.newAlbum({ ownerId: user.id, parentId: c.id });

      const lineageIds = await sut.getLineageIds(c.id);

      expect(lineageIds.toSorted()).toEqual([a.id, b.id, c.id].toSorted());
    });

    it('should return nothing for a deleted album', async () => {
      const { ctx, sut } = setup();
      const { user } = await ctx.newUser();
      const { album } = await ctx.newAlbum({ ownerId: user.id });
      await sut.softDeleteAll(user.id);

      await expect(sut.getLineageIds(album.id)).resolves.toEqual([]);
    });

    it('should terminate on a cycle', async () => {
      const { ctx, sut } = setup();
      const { user } = await ctx.newUser();
      const { album: a } = await ctx.newAlbum({ ownerId: user.id });
      const { album: b } = await ctx.newAlbum({ ownerId: user.id, parentId: a.id });
      await ctx.database.updateTable('album').set({ parentId: b.id }).where('id', '=', a.id).execute();

      const lineageIds = await sut.getLineageIds(a.id);

      expect(lineageIds.toSorted()).toEqual([a.id, b.id].toSorted());
    });
  });

  describe('delete', () => {
    it('should move the sub-albums to the top level when the parent album is deleted directly', async () => {
      const { ctx, sut } = setup();
      const { user } = await ctx.newUser();
      const { album: parent } = await ctx.newAlbum({ ownerId: user.id });
      const { album: child } = await ctx.newAlbum({ ownerId: user.id, parentId: parent.id });

      await sut.delete(parent.id);

      await expect(sut.getById(child.id)).resolves.toMatchObject({ parentId: null });
    });
  });
});
