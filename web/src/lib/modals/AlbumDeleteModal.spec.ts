import AlbumDeleteModal from '#lib/modals/AlbumDeleteModal.svelte';
import { factory } from '#test/unit/factories.ts';
import { test } from '#test/unit/fixtures.ts';
import { expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const props = (onClose = vi.fn()) => {
  const parent = factory.album({ albumName: 'Travel' });
  const album = factory.album({ albumName: 'Japan', parentId: parent.id });
  return { album, parent, subAlbumCount: 2, descendantCount: 3, onClose };
};

test('explains both choices and that photos are kept', async ({ app }) => {
  await render(AlbumDeleteModal, props());

  await expect.element(app.albumDelete.text('album_delete_sub_albums_to_parent')).toBeVisible();
  await expect.element(app.albumDelete.text('album_delete_with_sub_albums_description')).toBeVisible();
  await expect.element(app.albumDelete.text(/album_delete_photos_kept/)).toBeVisible();
});

test('mentions the top level for a top-level album', async ({ app }) => {
  await render(AlbumDeleteModal, { ...props(), parent: undefined });

  await expect.element(app.albumDelete.text('album_delete_sub_albums_to_top_level')).toBeVisible();
});

test('closes with the chosen action', async ({ app }) => {
  const onClose = vi.fn();
  await render(AlbumDeleteModal, props(onClose));

  await app.albumDelete.withSubAlbumsButton.click();

  expect(onClose).toHaveBeenCalledWith('branch');
});

test('closes with the album only action', async ({ app }) => {
  const onClose = vi.fn();
  await render(AlbumDeleteModal, props(onClose));

  await app.albumDelete.albumOnlyButton.click();

  expect(onClose).toHaveBeenCalledWith('album');
});
