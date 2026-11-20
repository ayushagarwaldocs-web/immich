<script lang="ts">
  import { albumDragSource, albumDropTarget } from '#lib/actions/album-drag-and-drop.ts';
  import AlbumCard from '#lib/components/album-page/AlbumCard.svelte';
  import AlbumTile from '#lib/components/album-page/AlbumTile.svelte';
  import Portal from '#lib/elements/Portal.svelte';
  import { Route } from '#lib/route.ts';
  import { getAlbumActions } from '#lib/services/album.service.ts';
  import { albumViewSettings, locale } from '#lib/stores/preferences.store.ts';
  import type { AlbumTree } from '#lib/utils/album-tree.ts';
  import { isAlbumGroupCollapsed, toggleAlbumGroupCollapsing, type AlbumGroup } from '#lib/utils/album-utils.ts';
  import type { AlbumResponseDto } from '@immich/sdk';
  import { Icon, menuManager, type ActionItem } from '@immich/ui';
  import { mdiChevronRight } from '@mdi/js';
  import { t } from 'svelte-i18n';
  import { flip } from 'svelte/animate';
  import { slide } from 'svelte/transition';

  type Props = {
    albums: AlbumResponseDto[];
    albumTree?: AlbumTree<AlbumResponseDto>;
    group?: AlbumGroup | undefined;
    showOwner?: boolean;
    showDateRange?: boolean;
    showItemCount?: boolean;
    tiles?: boolean;
  };

  const {
    albums,
    albumTree,
    group = undefined,
    showOwner = false,
    showDateRange = false,
    showItemCount = false,
    tiles = false,
  }: Props = $props();

  let isCollapsed = $derived(!!group && isAlbumGroupCollapsed($albumViewSettings, group.id));
  let iconRotation = $derived(isCollapsed ? 'rotate-0' : 'rotate-90');
  let contextMenuAnchor: HTMLDivElement | undefined = $state();

  const oncontextmenu = async (event: MouseEvent, items: ActionItem[]) => {
    event.preventDefault();
    contextMenuAnchor?.setAttribute('style', `left: ${event.x}px; top: ${event.y}px;`);
    await menuManager.show({
      target: contextMenuAnchor ?? (event.currentTarget as HTMLElement),
      items,
    });
  };
</script>

<Portal>
  <div bind:this={contextMenuAnchor} class="absolute"></div>
</Portal>

{#if group}
  <div class="grid">
    <button
      type="button"
      onclick={() => toggleAlbumGroupCollapsing(group.id)}
      class="mt-2 w-full cursor-pointer rounded-md py-2 pe-2 text-start transition-colors hover:bg-subtle hover:text-primary dark:text-immich-dark-fg dark:hover:bg-immich-dark-gray"
      aria-expanded={!isCollapsed}
    >
      <Icon icon={mdiChevronRight} size="24" class="-mt-2.5 inline-block transition-all duration-250 {iconRotation}" />
      <span class="text-3xl font-bold text-black dark:text-white">{group.name}</span>
      <span class="ms-1.5">({$t('albums_count', { values: { count: albums.length } })})</span>
    </button>
    <hr class="dark:border-immich-dark-gray" />
  </div>
{/if}

<div class="mt-4">
  {#if !isCollapsed}
    <div
      class={tiles
        ? 'grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7'
        : 'grid grid-auto-fill-56 gap-y-4'}
      transition:slide={{ duration: 300 }}
    >
      {#each albums as album, index (album.id)}
        {const { Edit, Share, CreateSubAlbum, Move, Download, Leave, Delete } = $derived(getAlbumActions($t, album))}
        {const items = $derived([Edit, Share, CreateSubAlbum, Move, Download, Leave, Delete])}
        <a
          href={Route.viewAlbum(album)}
          class={[
            'h-fit data-drop-target:bg-primary/10 data-drop-target:ring-2 data-drop-target:ring-primary',
            tiles ? 'rounded-xl' : 'rounded-2xl',
          ]}
          animate:flip={{ duration: 400 }}
          oncontextmenu={(event) => oncontextmenu(event, items)}
          {@attach albumDragSource(album, albumTree)}
          {@attach albumDropTarget(album)}
        >
          {#if tiles}
            <AlbumTile
              {album}
              preload={index < 20}
              contextMenuItems={items}
              subAlbumCount={albumTree?.getChildren(album.id).length}
              coverAssetId={albumTree?.getCoverAssetId(album, $locale)}
            />
          {:else}
            <AlbumCard
              {album}
              {showOwner}
              {showDateRange}
              {showItemCount}
              preload={index < 20}
              contextMenuItems={items}
              subAlbumCount={albumTree?.getChildren(album.id).length}
              coverAssetId={albumTree?.getCoverAssetId(album, $locale)}
            />
          {/if}
        </a>
      {/each}
    </div>
  {/if}
</div>
