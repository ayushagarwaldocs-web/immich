import { mapAlbum } from 'src/dtos/album.dto.js';
import { AlbumFactory } from 'test/factories/album.factory.js';
import { AuthFactory } from 'test/factories/auth.factory.js';
import { getForAlbum } from 'test/mappers.js';
import { newUuid } from 'test/small.factory.js';

describe('mapAlbum', () => {
  it('should set start and end dates', () => {
    const startDate = new Date('2023-02-22T05:06:29.716Z');
    const endDate = new Date('2025-01-01T01:02:03.456Z');
    const album = AlbumFactory.from()
      .asset({ localDateTime: endDate }, (builder) => builder.exif())
      .asset({ localDateTime: startDate }, (builder) => builder.exif())
      .build();
    const dto = mapAlbum(getForAlbum(album));
    expect(dto.startDate).toEqual(startDate.toISOString());
    expect(dto.endDate).toEqual(endDate.toISOString());
  });

  it('should not set start and end dates for empty assets', () => {
    const dto = mapAlbum(getForAlbum(AlbumFactory.create()));
    expect(dto.startDate).toBeUndefined();
    expect(dto.endDate).toBeUndefined();
  });

  it('should include the parent album id', () => {
    const parentId = newUuid();
    expect(mapAlbum(getForAlbum(AlbumFactory.create({ parentId }))).parentId).toBe(parentId);
    expect(mapAlbum(getForAlbum(AlbumFactory.create())).parentId).toBeNull();
  });

  it('should not expose the parent album id through a shared link', () => {
    const album = AlbumFactory.create({ parentId: newUuid() });
    const dto = mapAlbum(getForAlbum(album), { auth: AuthFactory.from().sharedLink().build() });
    expect(dto.parentId).toBeNull();
  });
});
