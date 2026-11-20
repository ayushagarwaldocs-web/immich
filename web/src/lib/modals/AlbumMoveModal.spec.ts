import { authManager } from '#lib/managers/auth-manager.svelte.ts';
import AlbumMoveModal from '#lib/modals/AlbumMoveModal.svelte';
import type { MockData } from '#test/common/data.ts';
import { factory } from '#test/unit/factories.ts';
import { test } from '#test/unit/fixtures.ts';
import { expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

const setup = (data: MockData) => {
  const travel = factory.album({ albumName: 'Travel' });
  const japan = factory.album({ albumName: 'Japan', parentId: travel.id });
  const kyoto = factory.album({ albumName: 'Kyoto', parentId: japan.id });
  const family = factory.album({ albumName: 'Family' });
  data.addAlbums([travel, japan, kyoto, family]);
  authManager.setUser(data.user);
  authManager.setPreferences(factory.preferences());
  return { travel, japan, kyoto, family };
};

test('offers the owned albums except the album and its sub-albums', async ({ data, app }) => {
  const { japan } = setup(data);
  data.addAlbums(
    factory.album({
      albumName: 'Shared with me',
      albumUsers: factory.albumUsers({ owner: factory.user(), viewers: [data.user] }),
    }),
  );

  await render(AlbumMoveModal, { album: japan, onClose: vi.fn() });

  await expect.element(app.albumMove.destination('Travel')).toBeVisible();
  await expect.element(app.albumMove.destination('Family')).toBeVisible();
  await expect.element(app.albumMove.destination('Japan')).not.toBeInTheDocument();
  await expect.element(app.albumMove.destination('Kyoto')).not.toBeInTheDocument();
  await expect.element(app.albumMove.destination('Shared with me')).not.toBeInTheDocument();
});

test('lists the albums as a tree sorted by name', async ({ data, app }) => {
  const { family } = setup(data);
  data.addAlbums(factory.album({ albumName: 'Africa' }));

  await render(AlbumMoveModal, { album: family, onClose: vi.fn() });
  await expect.element(app.albumMove.destination('Kyoto')).toBeVisible();

  const names = page
    .getByRole('dialog')
    .getByRole('button')
    .elements()
    .map((element) => element.textContent?.trim())
    .filter(Boolean);
  expect(names).toEqual(['top_level', 'Africa', 'Travel', 'Japan', 'Kyoto']);
});

test('disables the current parent', async ({ data, app }) => {
  const { japan } = setup(data);

  await render(AlbumMoveModal, { album: japan, onClose: vi.fn() });

  await expect.element(app.albumMove.destination('Travel')).toBeDisabled();
  await expect.element(app.albumMove.destination('Family')).toBeEnabled();
  await expect.element(app.albumMove.topLevel).toBeEnabled();
});

test('disables the top level for a top-level album', async ({ data, app }) => {
  const { family } = setup(data);

  await render(AlbumMoveModal, { album: family, onClose: vi.fn() });

  await expect.element(app.albumMove.topLevel).toBeDisabled();
  await expect.element(app.albumMove.destination('Kyoto')).toBeEnabled();
});

test('closes with the chosen album', async ({ data, app }) => {
  const { japan, family } = setup(data);
  const onClose = vi.fn();

  await render(AlbumMoveModal, { album: japan, onClose });
  await app.albumMove.destination('Family').click();

  expect(onClose).toHaveBeenCalledWith(family.id);
});

test('closes with null for the top level', async ({ data, app }) => {
  const { japan } = setup(data);
  const onClose = vi.fn();

  await render(AlbumMoveModal, { album: japan, onClose });
  await app.albumMove.topLevel.click();

  expect(onClose).toHaveBeenCalledWith(null);
});

test('search lists matching albums with their parent albums', async ({ data, app }) => {
  const { family } = setup(data);

  await render(AlbumMoveModal, { album: family, onClose: vi.fn() });
  await app.albumMove.searchInput.fill('kyo');

  await expect.element(app.albumMove.text('Kyoto')).toBeVisible();
  await expect.element(app.albumMove.text('Travel / Japan')).toBeVisible();
  await expect.element(app.albumMove.destination('Travel')).not.toBeInTheDocument();
});

test('search says when no album matches', async ({ data, app }) => {
  const { family } = setup(data);

  await render(AlbumMoveModal, { album: family, onClose: vi.fn() });
  await app.albumMove.searchInput.fill('paris');

  await expect.element(app.albumMove.text('album_search_not_found')).toBeVisible();
  await expect.element(app.albumMove.topLevel).toBeVisible();
});
