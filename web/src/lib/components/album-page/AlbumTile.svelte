<script lang="ts">
  import AlbumCover from '#lib/components/album-page/AlbumCover.svelte';
  import { type AlbumResponseDto } from '@immich/sdk';
  import { ContextMenuButton, type MenuItems } from '@immich/ui';
  import { t } from 'svelte-i18n';

  type Props = {
    album: AlbumResponseDto;
    subAlbumCount?: number;
    coverAssetId?: string | null;
    preload?: boolean;
    contextMenuItems?: MenuItems;
  };

  const { album, subAlbumCount = 0, coverAssetId, preload = false, contextMenuItems }: Props = $props();

  const name = $derived(album.albumName || $t('unnamed_album'));
</script>

<div class="group relative rounded-xl p-2 hover:bg-gray-100 dark:hover:bg-gray-900" data-testid="album-tile">
  {#if contextMenuItems}
    <div class="absolute inset-e-3 top-3 z-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
      <ContextMenuButton
        translations={{ open_menu: $t('show_album_options') }}
        position="top-left"
        variant="filled"
        size="small"
        class="icon-white-drop-shadow"
        items={contextMenuItems}
      />
    </div>
  {/if}

  <AlbumCover {album} {preload} {coverAssetId} isFolder={subAlbumCount > 0} class="rounded-lg" />

  <p
    class="mt-2 truncate text-sm font-semibold text-black group-hover:text-primary dark:text-white"
    data-testid="album-name"
    title={name}
  >
    {name}
  </p>
  <p class="truncate text-xs text-gray-600 dark:text-gray-400" data-testid="album-details">
    {$t('items_count', { values: { count: album.assetCount } })}
    {#if subAlbumCount > 0}
      · {$t('sub_albums_count', { values: { count: subAlbumCount } })}
    {/if}
  </p>
</div>
