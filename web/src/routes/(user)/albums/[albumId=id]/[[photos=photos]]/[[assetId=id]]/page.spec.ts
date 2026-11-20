import { getAlbumInfoQuery } from '#lib/queries/album.query.ts';
import { queryClient } from '#lib/queries/client.ts';
import { Route } from '#lib/route.ts';
import { factory } from '#test/unit/factories.ts';
import { test } from '#test/unit/fixtures.ts';
import { ReactionType } from '@immich/sdk';
import { expect } from 'vitest';
import { page, userEvent, type Locator } from 'vitest/browser';
import Page from './+page.svelte';
import { load } from './+page.ts';

test('shows the album date range', async ({ data, router, render }) => {
  const assets = [
    factory.asset({ fileCreatedAt: '2026-06-20T12:00:00.000Z' }),
    factory.asset({ fileCreatedAt: '2026-06-10T12:00:00.000Z' }),
  ];
  data.addAssets(assets);
  const album = factory.album();
  data.addAlbums(album).addToAlbum(album.id, assets);
  await router.goto(Route.viewAlbum(album), { albumId: album.id });

  await render(Page, load);

  await expect.element(page.getByText('Jun 10 – 20, 2026', { exact: true })).toBeVisible();
});

test('owner saves a new description when leaving the field', async ({ data, router, render, settle, api, app }) => {
  const album = factory.album({ albumUsers: factory.albumUsers({ owner: data.user }) });
  data.addAlbums(album);
  await router.goto(Route.viewAlbum(album), { albumId: album.id });
  await render(Page, load);

  await app.album.descriptionInput.fill('A week in the mountains');
  await userEvent.keyboard('{Control>}{Enter}{/Control}');
  await settle();

  expect(api.updateAlbumInfo).toHaveBeenCalledWith({
    params: { id: album.id },
    body: { description: 'A week in the mountains' },
  });
});

test('keeps a typed description when the album is renamed', async ({ data, router, render, settle, api, app }) => {
  const album = factory.album({ albumUsers: factory.albumUsers({ owner: data.user }) });
  data.addAlbums(album);
  await router.goto(Route.viewAlbum(album), { albumId: album.id });
  await render(Page, load);
  await settle();
  await app.album.descriptionInput.fill('Typed description');

  data.updateAlbum(album.id, { albumName: 'Renamed elsewhere' });
  await queryClient.invalidateQueries({ queryKey: getAlbumInfoQuery(album.id).queryKey });
  await settle();

  await expect.element(app.album.descriptionInput).toHaveValue('Typed description');
  await userEvent.keyboard('{Control>}{Enter}{/Control}');
  await settle();
  expect(api.updateAlbumInfo).toHaveBeenCalledWith({
    params: { id: album.id },
    body: { description: 'Typed description' },
  });
});

test('keeps a typed title when a photo is added elsewhere', async ({ data, router, render, settle, api, app }) => {
  const album = factory.album({ albumName: 'Car', albumUsers: factory.albumUsers({ owner: data.user }) });
  const asset = factory.asset();
  data.addAssets(asset);
  data.addAlbums(album);
  await router.goto(Route.viewAlbum(album), { albumId: album.id });
  await render(Page, load);
  await settle();
  await app.album.titleInput.fill('Car typed');

  data.addToAlbum(album.id, asset);
  await queryClient.invalidateQueries({ queryKey: getAlbumInfoQuery(album.id).queryKey });
  await settle();

  await expect.element(app.album.titleInput).toHaveValue('Car typed');
  await userEvent.keyboard('{Enter}');
  await settle();
  expect(api.updateAlbumInfo).toHaveBeenCalledWith({ params: { id: album.id }, body: { albumName: 'Car typed' } });
});

test('shows a title renamed elsewhere when not editing it', async ({ data, router, render, settle, app }) => {
  const album = factory.album({ albumName: 'Car', albumUsers: factory.albumUsers({ owner: data.user }) });
  data.addAlbums(album);
  await router.goto(Route.viewAlbum(album), { albumId: album.id });
  await render(Page, load);
  await settle();

  data.updateAlbum(album.id, { albumName: 'Car remote' });
  await queryClient.invalidateQueries({ queryKey: getAlbumInfoQuery(album.id).queryKey });
  await settle();

  await expect.element(app.album.titleInput).toHaveValue('Car remote');
});

test('editor can edit the description', async ({ data, router, render, settle, app }) => {
  const album = factory.album({ albumUsers: factory.albumUsers({ owner: factory.user(), editors: [data.user] }) });
  data.addAlbums(album);
  await router.goto(Route.viewAlbum(album), { albumId: album.id });

  await render(Page, load);
  await settle();

  await expect.element(app.album.descriptionInput).toBeVisible();
});

test('viewer cannot edit the description', async ({ data, router, render, settle, api, app }) => {
  const album = factory.album({ albumUsers: factory.albumUsers({ owner: factory.user(), viewers: [data.user] }) });
  data.addAlbums(album);
  await router.goto(Route.viewAlbum(album), { albumId: album.id });

  await render(Page, load);
  await settle();

  await expect.element(app.album.descriptionInput).not.toBeInTheDocument();
  expect(api.updateAlbumInfo).not.toHaveBeenCalled();
});

test('deleting a comment keeps the other comments', async ({ data, router, render, settle, api, app }) => {
  const album = factory.album({ albumUsers: factory.albumUsers({ owner: data.user, editors: [factory.user()] }) });
  const comments = ['first', 'second', 'third'].map((comment) => factory.activity({ user: data.user, comment }));
  data.addAlbums(album).addActivities(comments);
  await router.goto(Route.viewAlbum(album), { albumId: album.id });
  await render(Page, load);
  await settle();
  await app.album.commentsButton.click();
  await expect.element(page.getByText('second', { exact: true })).toBeVisible();

  await app.album.activity.commentMenu(1).click();
  await app.album.activity.removeMenuItem.click();
  await settle();

  await expect.element(page.getByText('second', { exact: true })).not.toBeInTheDocument();
  await expect.element(page.getByText('first', { exact: true })).toBeVisible();
  await expect.element(page.getByText('third', { exact: true })).toBeVisible();
  expect(api.deleteActivity).toHaveBeenCalledWith({ params: { id: comments[1].id } });
});

test('posting a comment shows it and updates the comment count', async ({ data, router, render, settle, api, app }) => {
  const album = factory.album({ albumUsers: factory.albumUsers({ owner: data.user, editors: [factory.user()] }) });
  data.addAlbums(album).addActivities(factory.activity({ user: data.user, comment: 'first' }));
  await router.goto(Route.viewAlbum(album), { albumId: album.id });
  await render(Page, load);
  await settle();
  await app.album.commentsButton.click();

  await app.album.activity.commentInput.fill('second');
  await userEvent.keyboard('{Enter}');
  await settle();

  await expect.element(page.getByText('second', { exact: true })).toBeVisible();
  await expect.element(app.album.commentsButton).toHaveTextContent('2');
  expect(api.createActivity).toHaveBeenCalledWith({
    body: { albumId: album.id, type: ReactionType.Comment, comment: 'second' },
  });
});

test('liking an album and liking it again removes the like', async ({ data, router, render, settle, api, app }) => {
  const album = factory.album({ albumUsers: factory.albumUsers({ owner: data.user, editors: [factory.user()] }) });
  data.addAlbums(album);
  await router.goto(Route.viewAlbum(album), { albumId: album.id });
  await render(Page, load);
  await settle();

  await app.album.likeButton.click();
  await expect.element(app.album.likedButton).toBeVisible();
  await settle();
  const [{ id }] = data.activityList();
  await app.album.likedButton.click();
  await expect.element(app.album.likeButton).toBeVisible();
  await settle();

  expect(api.createActivity).toHaveBeenCalledWith({ body: { albumId: album.id, type: ReactionType.Like } });
  expect(api.deleteActivity).toHaveBeenCalledWith({ params: { id } });
});

test('unliking an album removes only my album like', async ({ data, router, render, settle, api, app }) => {
  const other = factory.user();
  const album = factory.album({ albumUsers: factory.albumUsers({ owner: data.user, editors: [other] }) });
  const myLike = factory.activity({ user: data.user, type: ReactionType.Like, comment: null });
  data
    .addAlbums(album)
    .addActivities([
      factory.activity({ user: other, type: ReactionType.Like, comment: null }),
      factory.activity({ user: data.user, type: ReactionType.Like, comment: null, assetId: crypto.randomUUID() }),
      factory.activity({ user: data.user, comment: 'nice' }),
      myLike,
    ]);
  await router.goto(Route.viewAlbum(album), { albumId: album.id });
  await render(Page, load);
  await settle();
  await expect.element(app.album.likedButton).toBeVisible();

  await app.album.likedButton.click();
  await settle();

  expect(api.deleteActivity).toHaveBeenCalledWith({ params: { id: myLike.id } });
  expect(api.deleteActivity.calls).toHaveLength(1);
});

test('deletes an album', async ({ data, router, render, settle, api, app }) => {
  const album = factory.album({ albumUsers: factory.albumUsers({ owner: data.user }) });
  data.addAlbums(album);
  await router.goto(Route.viewAlbum(album), { albumId: album.id });
  await render(Page, load);
  await settle();

  await app.album.optionsMenuButton.click();
  await app.album.deleteMenuItem.click();
  await app.cancelButton.click();
  await settle();

  expect(api.deleteAlbum).not.toHaveBeenCalled();

  await app.album.optionsMenuButton.click();
  await app.album.deleteMenuItem.click();
  await app.confirmButton.click();
  await settle();

  expect(api.deleteAlbum).toHaveBeenCalledWith({ params: { id: album.id } });
});

test('leaves an album', async ({ data, router, render, settle, api, app }) => {
  const album = factory.album({ albumUsers: factory.albumUsers({ owner: factory.user(), viewers: [data.user] }) });
  data.addAlbums(album);
  await router.goto(Route.viewAlbum(album), { albumId: album.id });
  await render(Page, load);
  await settle();

  await app.album.optionsMenuButton.click();
  await app.album.leaveMenuItem.click();
  await app.cancelButton.click();
  await settle();

  expect(api.removeUserFromAlbum).not.toHaveBeenCalled();

  await app.album.optionsMenuButton.click();
  await app.album.leaveMenuItem.click();
  await app.dialogButton('leave').click();
  await settle();

  expect(api.removeUserFromAlbum).toHaveBeenCalledWith({ params: { id: album.id, userId: 'me' } });
});

test('shows the parent albums as breadcrumbs', async ({ data, router, render, app }) => {
  const travel = factory.album({ albumName: 'Travel' });
  const year = factory.album({ albumName: '2024', parentId: travel.id });
  const japan = factory.album({ albumName: 'Japan', parentId: year.id });
  data.addAlbums([travel, year, japan]);
  await router.goto(Route.viewAlbum(japan), { albumId: japan.id });

  await render(Page, load);

  const link = (name: string) => app.album.breadcrumbs.getByRole('link', { name, exact: true });
  await expect.element(link('albums')).toHaveAttribute('href', Route.albums());
  await expect.element(link('Travel')).toHaveAttribute('href', Route.viewAlbum(travel));
  await expect.element(link('2024')).toHaveAttribute('href', Route.viewAlbum(year));
  await expect.element(link('Japan')).not.toBeInTheDocument();
});

test('top-level album has no breadcrumbs or sub-albums', async ({ data, router, render, settle, app }) => {
  const album = factory.album({ albumName: 'Travel' });
  data.addAlbums(album);
  await router.goto(Route.viewAlbum(album), { albumId: album.id });

  await render(Page, load);
  await settle();

  await expect.element(app.album.emptyPlaceholder).toBeVisible();
  await expect.element(app.album.breadcrumbs).not.toBeInTheDocument();
  await expect.element(app.album.subAlbums).not.toBeInTheDocument();
});

test('lists the sub-albums by name instead of the empty placeholder', async ({ data, router, render, settle, app }) => {
  const album = factory.album({ albumName: 'Travel' });
  data.addAlbums([
    album,
    factory.album({ albumName: 'Day 10', parentId: album.id }),
    factory.album({ albumName: 'day 2', parentId: album.id }),
  ]);
  await router.goto(Route.viewAlbum(album), { albumId: album.id });

  await render(Page, load);
  await settle();

  await expect.element(app.album.subAlbums.getByTestId('album-name').first()).toBeVisible();
  const names = app.album.subAlbums
    .getByTestId('album-name')
    .elements()
    .map((element) => element.textContent?.trim());
  expect(names).toEqual(['day 2', 'Day 10']);
  await expect.element(app.album.emptyPlaceholder).not.toBeInTheDocument();
});

test('owner creates a sub-album and opens it', async ({ data, router, render, settle, api, app }) => {
  const album = factory.album({ albumName: 'Travel', albumUsers: factory.albumUsers({ owner: data.user }) });
  data.addAlbums(album);
  await router.goto(Route.viewAlbum(album), { albumId: album.id });
  await render(Page, load);
  await settle();

  await app.album.optionsMenuButton.click();
  await app.album.newSubAlbumMenuItem.click();
  await settle();

  expect(api.createAlbum).toHaveBeenCalledWith({ body: { albumName: '', parentId: album.id } });
  expect(router.url.pathname).toMatch(/^\/albums\/[0-9a-f-]+$/);
  expect(router.url.pathname).not.toBe(Route.viewAlbum(album));
});

test('owner moves the album into another album', async ({ data, router, render, settle, api, app }) => {
  const album = factory.album({ albumName: 'Japan', albumUsers: factory.albumUsers({ owner: data.user }) });
  const travel = factory.album({ albumName: 'Travel', albumUsers: factory.albumUsers({ owner: data.user }) });
  data.addAlbums([album, travel]);
  await router.goto(Route.viewAlbum(album), { albumId: album.id });
  await render(Page, load);
  await settle();

  await app.album.optionsMenuButton.click();
  await app.album.moveMenuItem.click();
  await app.albumMove.destination('Travel').click();
  await settle();

  expect(api.updateAlbumInfo).toHaveBeenCalledWith({ params: { id: album.id }, body: { parentId: travel.id } });
  await expect
    .element(app.album.breadcrumbs.getByRole('link', { name: 'Travel', exact: true }))
    .toHaveAttribute('href', Route.viewAlbum(travel));
});

test('viewer cannot create sub-albums or move the album', async ({ data, router, render, settle, app }) => {
  const album = factory.album({ albumUsers: factory.albumUsers({ owner: factory.user(), viewers: [data.user] }) });
  data.addAlbums(album);
  await router.goto(Route.viewAlbum(album), { albumId: album.id });
  await render(Page, load);
  await settle();

  await expect.element(app.album.newSubAlbumButton).not.toBeInTheDocument();
  await app.album.optionsMenuButton.click();

  await expect.element(app.album.leaveMenuItem).toBeVisible();
  await expect.element(app.album.newSubAlbumMenuItem).not.toBeInTheDocument();
  await expect.element(app.album.moveMenuItem).not.toBeInTheDocument();
});

test('deleting an album with sub-albums says they move to its parent', async ({
  data,
  router,
  render,
  settle,
  api,
  app,
}) => {
  const travel = factory.album({ albumName: 'Travel' });
  const japan = factory.album({ albumName: 'Japan', parentId: travel.id });
  data.addAlbums([travel, japan, factory.album({ albumName: 'Kyoto', parentId: japan.id })]);
  await router.goto(Route.viewAlbum(japan), { albumId: japan.id });
  await render(Page, load);
  await settle();

  await app.album.optionsMenuButton.click();
  await app.album.deleteMenuItem.click();
  await expect.element(app.albumDelete.text('album_delete_sub_albums_to_parent')).toBeVisible();
  await app.albumDelete.albumOnlyButton.click();
  await settle();

  expect(api.deleteAlbum).toHaveBeenCalledWith({ params: { id: japan.id } });
  expect(api.deleteAlbum.calls).toHaveLength(1);
  expect(router.url.pathname).toBe(Route.viewAlbum(travel));
});

test('deleting a top-level album with sub-albums says they move to the top level', async ({
  data,
  router,
  render,
  settle,
  api,
  app,
}) => {
  const travel = factory.album({ albumName: 'Travel' });
  data.addAlbums([travel, factory.album({ albumName: 'Japan', parentId: travel.id })]);
  await router.goto(Route.viewAlbum(travel), { albumId: travel.id });
  await render(Page, load);
  await settle();

  await app.album.optionsMenuButton.click();
  await app.album.deleteMenuItem.click();
  await expect.element(app.albumDelete.text('album_delete_sub_albums_to_top_level')).toBeVisible();
  await app.cancelButton.click();
  await settle();

  expect(api.deleteAlbum).not.toHaveBeenCalled();
});

test('going back opens the parent album', async ({ data, router, render, settle, app }) => {
  const travel = factory.album({ albumName: 'Travel' });
  const japan = factory.album({ albumName: 'Japan', parentId: travel.id });
  data.addAlbums([travel, japan]);
  await router.goto(Route.viewAlbum(japan), { albumId: japan.id });
  await render(Page, load);
  await settle();

  await app.album.closeButton.click();

  expect(router.url.pathname).toBe(Route.viewAlbum(travel));
});

test('going back from a sub-album with a hidden parent opens the album list', async ({
  data,
  router,
  render,
  settle,
  app,
}) => {
  const album = factory.album({
    albumName: 'Shared trip',
    parentId: crypto.randomUUID(),
    albumUsers: factory.albumUsers({ owner: factory.user(), viewers: [data.user] }),
  });
  data.addAlbums(album);
  await router.goto(Route.viewAlbum(album), { albumId: album.id });
  await render(Page, load);
  await settle();

  await expect.element(app.album.breadcrumbs).not.toBeInTheDocument();
  await app.album.closeButton.click();

  expect(router.url.pathname).toBe(Route.albums());
});

test('deleting an album with its sub-albums deletes the deepest albums first', async ({
  data,
  router,
  render,
  settle,
  api,
  app,
}) => {
  const travel = factory.album({ albumName: 'Travel' });
  const japan = factory.album({ albumName: 'Japan', parentId: travel.id });
  const kyoto = factory.album({ albumName: 'Kyoto', parentId: japan.id });
  const italy = factory.album({ albumName: 'Italy', parentId: travel.id });
  data.addAlbums([travel, japan, kyoto, italy]);
  await router.goto(Route.viewAlbum(travel), { albumId: travel.id });
  await render(Page, load);
  await settle();

  await app.album.optionsMenuButton.click();
  await app.album.deleteMenuItem.click();
  await app.albumDelete.withSubAlbumsButton.click();
  await settle();

  for (const { id } of [kyoto, japan, italy, travel]) {
    expect(api.deleteAlbum).toHaveBeenCalledWith({ params: { id } });
  }
  expect(api.deleteAlbum.calls.map(({ params }) => params.id)).toEqual([kyoto.id, japan.id, italy.id, travel.id]);
  expect(router.url.pathname).toBe(Route.albums());
});

test('deleting an album with its sub-albums stops at the first failure', async ({
  data,
  router,
  render,
  settle,
  api,
  app,
  logger,
}) => {
  const travel = factory.album({ albumName: 'Travel' });
  const japan = factory.album({ albumName: 'Japan', parentId: travel.id });
  const kyoto = factory.album({ albumName: 'Kyoto', parentId: japan.id });
  data.addAlbums([travel, japan, kyoto]);
  api.on({
    deleteAlbum: ({ params }) => {
      if (params.id === japan.id) {
        return { status: 500, json: { message: 'Server error', statusCode: 500 } };
      }
      data.deleteAlbum(params.id);
      return { status: 204 };
    },
  });
  await router.goto(Route.viewAlbum(travel), { albumId: travel.id });
  await render(Page, load);
  await settle();

  await app.album.optionsMenuButton.click();
  await app.album.deleteMenuItem.click();
  await app.albumDelete.withSubAlbumsButton.click();
  await settle();

  expect(api.deleteAlbum).toHaveBeenCalledWith({ params: { id: kyoto.id } });
  expect(api.deleteAlbum).toHaveBeenCalledWith({ params: { id: japan.id } });
  expect(api.deleteAlbum.calls).toHaveLength(2);
  expect(logger.error).toHaveBeenCalledWith(/handleError/);
  expect(router.url.pathname).toBe(Route.viewAlbum(travel));
});

test('shows sub-albums as compact tiles with counts and a menu', async ({ data, router, render, settle, app }) => {
  const album = factory.album({ albumName: 'Travel' });
  const japan = factory.album({ albumName: 'Japan', parentId: album.id });
  data.addAlbums([
    album,
    japan,
    factory.album({ albumName: 'Kyoto', parentId: japan.id }),
    factory.album({ albumName: 'Italy', parentId: album.id }),
  ]);
  await router.goto(Route.viewAlbum(album), { albumId: album.id });

  await render(Page, load);
  await settle();

  const tile = app.album.subAlbumTile('Japan');
  await expect.element(tile.getByTestId('album-details')).toHaveTextContent('items_count · sub_albums_count');
  await expect.element(tile.getByRole('button', { name: 'show_album_options', exact: true })).toBeInTheDocument();
  await expect.element(app.album.subAlbums.getByTestId('album-card')).not.toBeInTheDocument();
  await expect.element(tile.getByTestId('album-folder-badge')).toBeInTheDocument();
  await expect.element(app.album.subAlbumTile('Italy').getByTestId('album-folder-badge')).not.toBeInTheDocument();
});

test('owner creates a sub-album from the toolbar and the sub-albums header', async ({
  data,
  router,
  render,
  settle,
  api,
  app,
}) => {
  const album = factory.album({ albumName: 'Travel', albumUsers: factory.albumUsers({ owner: data.user }) });
  data.addAlbums([album, factory.album({ albumName: 'Japan', parentId: album.id })]);
  await router.goto(Route.viewAlbum(album), { albumId: album.id });
  await render(Page, load);
  await settle();

  await app.album.newSubAlbumButton.click();
  await settle();
  (app.album.subAlbums.getByRole('button', { name: 'new_sub_album', exact: true }).element() as HTMLElement).click();
  await settle();

  expect(api.createAlbum).toHaveBeenCalledWith({ body: { albumName: '', parentId: album.id } });
  expect(api.createAlbum.calls).toHaveLength(2);
});

const dragAndDrop = (source: Locator, target: Locator) => {
  const dataTransfer = new DataTransfer();
  const fire = (locator: Locator, type: string) =>
    locator.element().dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));
  fire(source, 'dragstart');
  fire(target, 'dragover');
  fire(target, 'drop');
  fire(source, 'dragend');
};

test('dropping a sub-album onto another one moves it there', async ({ data, router, render, settle, api, app }) => {
  const travel = factory.album({ albumName: 'Travel' });
  const japan = factory.album({ albumName: 'Japan', parentId: travel.id });
  const italy = factory.album({ albumName: 'Italy', parentId: travel.id });
  data.addAlbums([travel, japan, italy]);
  await router.goto(Route.viewAlbum(travel), { albumId: travel.id });
  await render(Page, load);
  await settle();

  dragAndDrop(app.album.subAlbumTile('Italy'), app.album.subAlbumTile('Japan'));
  await settle();

  expect(api.updateAlbumInfo).toHaveBeenCalledWith({ params: { id: italy.id }, body: { parentId: japan.id } });
  await expect.element(app.album.subAlbumTile('Italy')).not.toBeInTheDocument();
});

test('dropping a sub-album onto a breadcrumb moves it up', async ({ data, router, render, settle, api, app }) => {
  const travel = factory.album({ albumName: 'Travel' });
  const japan = factory.album({ albumName: 'Japan', parentId: travel.id });
  const kyoto = factory.album({ albumName: 'Kyoto', parentId: japan.id });
  const osaka = factory.album({ albumName: 'Osaka', parentId: japan.id });
  data.addAlbums([travel, japan, kyoto, osaka]);
  await router.goto(Route.viewAlbum(japan), { albumId: japan.id });
  await render(Page, load);
  await settle();

  dragAndDrop(app.album.subAlbumTile('Kyoto'), app.album.breadcrumbs.getByRole('link', { name: 'Travel' }));
  await settle();
  dragAndDrop(app.album.subAlbumTile('Osaka'), app.album.breadcrumbs.getByRole('link', { name: 'albums' }));
  await settle();

  expect(api.updateAlbumInfo).toHaveBeenCalledWith({ params: { id: kyoto.id }, body: { parentId: travel.id } });
  expect(api.updateAlbumInfo).toHaveBeenCalledWith({ params: { id: osaka.id }, body: { parentId: null } });
});

test('a sub-album cannot be dropped onto itself or dragged by a viewer', async ({
  data,
  router,
  render,
  settle,
  api,
  app,
}) => {
  const owner = factory.user();
  const shared = factory.album({
    albumName: 'Shared',
    albumUsers: factory.albumUsers({ owner, viewers: [data.user] }),
  });
  const travel = factory.album({ albumName: 'Travel' });
  data.addAlbums([
    travel,
    shared,
    factory.album({ albumName: 'Japan', parentId: travel.id }),
    factory.album({
      albumName: 'Trip',
      parentId: shared.id,
      albumUsers: factory.albumUsers({ owner, viewers: [data.user] }),
    }),
  ]);
  await router.goto(Route.viewAlbum(travel), { albumId: travel.id });
  await render(Page, load);
  await settle();

  dragAndDrop(app.album.subAlbumTile('Japan'), app.album.subAlbumTile('Japan'));
  await settle();
  expect(api.updateAlbumInfo).not.toHaveBeenCalled();

  await router.goto(Route.viewAlbum(shared), { albumId: shared.id });
  await render(Page, load);
  await settle();
  expect(app.album.subAlbumTile('Trip').element().closest('a')?.draggable).toBe(false);
});
