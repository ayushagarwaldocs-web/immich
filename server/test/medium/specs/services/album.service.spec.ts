import { Kysely } from 'kysely';
import { AlbumUserRole } from 'src/enum.js';
import { AccessRepository } from 'src/repositories/access.repository.js';
import { AlbumRepository } from 'src/repositories/album.repository.js';
import { AssetRepository } from 'src/repositories/asset.repository.js';
import { DatabaseRepository } from 'src/repositories/database.repository.js';
import { LoggingRepository } from 'src/repositories/logging.repository.js';
import { ResourceRepository } from 'src/repositories/resource.repository.js';
import { UserRepository } from 'src/repositories/user.repository.js';
import { Resource } from 'src/resource-paths.js';
import { DB } from 'src/schema/index.js';
import { AlbumService } from 'src/services/album.service.js';
import { newMediumService } from 'test/medium.factory.js';
import { factory } from 'test/small.factory.js';
import { getKyselyDB } from 'test/utils.js';

let defaultDatabase: Kysely<DB>;

// eslint-disable-next-line unicorn/no-unnecessary-parameters
const setup = (db?: Kysely<DB>) => {
  return newMediumService(AlbumService, {
    database: db || defaultDatabase,
    real: [AccessRepository, AlbumRepository, AssetRepository, DatabaseRepository, UserRepository],
    mock: [LoggingRepository, ResourceRepository],
  });
};

beforeAll(async () => {
  defaultDatabase = await getKyselyDB();
});

describe(AlbumService.name, () => {
  describe('update', () => {
    it('should tell the owner and the shared user, but not a stranger', async () => {
      const { sut, ctx } = setup();
      const { album, owner, sharedWith } = await ctx.newSharedAlbum();
      const { user: stranger } = await ctx.newUser();

      await sut.update(factory.auth({ user: owner }), album.id, { albumName: 'Holiday' });

      const send = ctx.getMock(ResourceRepository).send;
      expect(send).toHaveBeenCalledTimes(1);
      const [{ userIds, changed }] = send.mock.calls[0];
      expect(userIds.toSorted()).toEqual([owner.id, sharedWith.id].toSorted());
      expect(userIds).not.toContain(stranger.id);
      expect(changed).toEqual([Resource.album(album)]);
    });

    it('should move an album and keep its parent when parentId is omitted', async () => {
      const { sut, ctx } = setup();
      const { user } = await ctx.newUser();
      const auth = factory.auth({ user });
      const { album: parent } = await ctx.newAlbum({ ownerId: user.id });
      const { album } = await ctx.newAlbum({ ownerId: user.id });

      await expect(sut.update(auth, album.id, { parentId: parent.id })).resolves.toMatchObject({ parentId: parent.id });
      await expect(sut.update(auth, album.id, { albumName: 'Japan' })).resolves.toMatchObject({
        albumName: 'Japan',
        parentId: parent.id,
      });
      await expect(sut.update(auth, album.id, { parentId: null })).resolves.toMatchObject({ parentId: null });
    });

    it('should not move an album into one of its descendants', async () => {
      const { sut, ctx } = setup();
      const { user } = await ctx.newUser();
      const { album: a } = await ctx.newAlbum({ ownerId: user.id });
      const { album: b } = await ctx.newAlbum({ ownerId: user.id, parentId: a.id });
      const { album: c } = await ctx.newAlbum({ ownerId: user.id, parentId: b.id });

      await expect(sut.update(factory.auth({ user }), a.id, { parentId: c.id })).rejects.toThrow(
        'Cannot move an album into itself or one of its sub-albums',
      );

      await expect(ctx.get(AlbumRepository).getById(a.id)).resolves.toMatchObject({ parentId: null });
    });

    it('should not create a cycle from concurrent moves', async () => {
      const { sut, ctx } = setup();
      const { user } = await ctx.newUser();
      const auth = factory.auth({ user });
      const { album: a } = await ctx.newAlbum({ ownerId: user.id });
      const { album: b } = await ctx.newAlbum({ ownerId: user.id });

      const results = await Promise.allSettled([
        sut.update(auth, a.id, { parentId: b.id }),
        sut.update(auth, b.id, { parentId: a.id }),
      ]);

      expect(results.map(({ status }) => status).toSorted()).toEqual(['fulfilled', 'rejected']);
    });

    it('should not move an album into an album of another user', async () => {
      const { sut, ctx } = setup();
      const { album: parent, sharedWith } = await ctx.newSharedAlbum();
      const { album } = await ctx.newAlbum({ ownerId: sharedWith.id });

      await expect(sut.update(factory.auth({ user: sharedWith }), album.id, { parentId: parent.id })).rejects.toThrow(
        'Not found or no album.delete access',
      );
    });
  });

  describe('delete', () => {
    it('should move the sub-albums to the parent album and tell their users', async () => {
      const { sut, ctx } = setup();
      const { user } = await ctx.newUser();
      const { user: viewer } = await ctx.newUser();
      const { album: a } = await ctx.newAlbum({ ownerId: user.id });
      const { album: b } = await ctx.newAlbum({ ownerId: user.id, parentId: a.id });
      const { album: c } = await ctx.newAlbum({ ownerId: user.id, parentId: b.id });
      const { album: d } = await ctx.newAlbum({ ownerId: user.id, parentId: b.id });
      await ctx.newAlbumUser({ albumId: d.id, userId: viewer.id, role: AlbumUserRole.Viewer });

      await sut.delete(factory.auth({ user }), b.id);

      const albumRepository = ctx.get(AlbumRepository);
      await expect(albumRepository.getById(b.id)).resolves.toBeUndefined();
      await expect(albumRepository.getById(c.id)).resolves.toMatchObject({ parentId: a.id });
      await expect(albumRepository.getById(d.id)).resolves.toMatchObject({ parentId: a.id });

      const events = ctx.getMock(ResourceRepository).send.mock.calls.map(([event]) => event);
      expect(events).toEqual(
        expect.arrayContaining([
          { userIds: [user.id], changed: [Resource.album(c)] },
          { userIds: expect.arrayContaining([user.id, viewer.id]), changed: [Resource.album(d)] },
        ]),
      );
    });

    it('should move the sub-albums of a top-level album to the top level', async () => {
      const { sut, ctx } = setup();
      const { user } = await ctx.newUser();
      const { album: a } = await ctx.newAlbum({ ownerId: user.id });
      const { album: b } = await ctx.newAlbum({ ownerId: user.id, parentId: a.id });

      await sut.delete(factory.auth({ user }), a.id);

      await expect(ctx.get(AlbumRepository).getById(b.id)).resolves.toMatchObject({ parentId: null });
    });
  });

  describe('removeAssets', () => {
    it('should not remove assets from an album of another user', async () => {
      const { sut, ctx } = setup();
      const { user } = await ctx.newUser();
      const { user: otherUser } = await ctx.newUser();
      const { asset } = await ctx.newAsset({ ownerId: user.id });
      const { album } = await ctx.newAlbum({ ownerId: user.id }, [asset.id]);

      await expect(sut.removeAssets(factory.auth({ user: otherUser }), album.id, { ids: [asset.id] })).rejects.toThrow(
        'Not found or no albumAsset.delete access',
      );
      await expect(ctx.get(AlbumRepository).getAssetIds(album.id, [asset.id])).resolves.toContain(asset.id);
    });
  });

  describe('database triggers', () => {
    it('should cascade delete an album when the owner is deleted', async () => {
      const { ctx } = setup();
      const { user } = await ctx.newUser();
      const { album } = await ctx.newAlbum({ ownerId: user.id });

      await ctx.get(UserRepository).delete({ id: user.id }, true);

      await expect(ctx.database.selectFrom('album').selectAll().where('id', '=', album.id).execute()).resolves.toEqual(
        [],
      );
      await expect(
        ctx.database.selectFrom('album_user').selectAll().where('albumId', '=', album.id).execute(),
      ).resolves.toEqual([]);
    });
  });
});
