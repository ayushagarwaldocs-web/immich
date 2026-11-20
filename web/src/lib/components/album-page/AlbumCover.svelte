<script lang="ts">
  import AssetCover from '#lib/components/sharedlinks-page/covers/AssetCover.svelte';
  import NoCover from '#lib/components/sharedlinks-page/covers/NoCover.svelte';
  import { getAssetMediaUrl } from '#lib/utils.ts';
  import { type AlbumResponseDto } from '@immich/sdk';
  import { Icon } from '@immich/ui';
  import { mdiFolder } from '@mdi/js';
  import { t } from 'svelte-i18n';

  interface Props {
    album: AlbumResponseDto;
    preload?: boolean;
    class?: string;
    coverAssetId?: string | null;
    isFolder?: boolean;
  }

  let { album, preload = false, class: className, coverAssetId, isFolder = false }: Props = $props();

  let alt = $derived(album.albumName || $t('unnamed_album'));
  let thumbnailAssetId = $derived(coverAssetId === undefined ? album.albumThumbnailAssetId : coverAssetId);
  let thumbnailUrl = $derived(thumbnailAssetId ? getAssetMediaUrl({ id: thumbnailAssetId }) : null);
</script>

{#snippet cover()}
  {#if thumbnailUrl}
    <AssetCover {alt} class={className} src={thumbnailUrl} {preload} />
  {:else}
    <NoCover {alt} class={className} {preload} />
  {/if}
{/snippet}

{#if isFolder}
  <div class="relative">
    {@render cover()}
    <span
      class="absolute start-2 bottom-2 flex rounded-md bg-black/60 p-1 text-white"
      title={$t('sub_albums')}
      data-testid="album-folder-badge"
    >
      <Icon icon={mdiFolder} size="1rem" />
    </span>
  </div>
{:else}
  {@render cover()}
{/if}
