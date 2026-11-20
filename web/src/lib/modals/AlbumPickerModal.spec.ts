import { authManager } from '#lib/managers/auth-manager.svelte.ts';
import AlbumPickerModal from '#lib/modals/AlbumPickerModal.svelte';
import { factory } from '#test/unit/factories.ts';
import { test } from '#test/unit/fixtures.ts';
import { expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

test('shows the parent path of nested albums when browsing and searching', async ({ data }) => {
  const travel = factory.album({ albumName: 'Travel' });
  const year = factory.album({ albumName: '2024', parentId: travel.id });
  const family = factory.album({ albumName: 'Family' });
  data.addAlbums([
    travel,
    year,
    family,
    factory.album({ albumName: 'Day 1', parentId: year.id }),
    factory.album({ albumName: 'Day 1', parentId: family.id }),
  ]);
  authManager.setUser(data.user);
  authManager.setPreferences(factory.preferences());

  await render(AlbumPickerModal, { onClose: vi.fn() });
  const dialog = page.getByRole('dialog');
  await expect.element(dialog.getByText('Travel / 2024', { exact: true }).first()).toBeVisible();

  await dialog.getByPlaceholder('search', { exact: true }).fill('day');

  await expect.element(dialog.getByText('Travel / 2024', { exact: true }).first()).toBeVisible();
  await expect.element(dialog.getByText('Family', { exact: true }).first()).toBeVisible();
  expect(dialog.getByText('Travel', { exact: true }).elements()).toHaveLength(0);
});
