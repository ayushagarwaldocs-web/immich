<script lang="ts">
  import { albumDropTarget } from '#lib/actions/album-drag-and-drop.ts';
  import { Route } from '#lib/route.ts';
  import { type AlbumResponseDto } from '@immich/sdk';
  import { Icon, Link } from '@immich/ui';
  import { mdiChevronRight, mdiImageAlbum } from '@mdi/js';
  import { t } from 'svelte-i18n';

  type Props = {
    ancestors: AlbumResponseDto[];
  };

  const { ancestors }: Props = $props();

  const linkClass = 'flex items-center gap-1 text-primary data-drop-target:bg-primary/10 data-drop-target:ring-2';
</script>

<nav class="mb-2 flex flex-wrap items-center gap-1">
  <Link href={Route.albums()} class={linkClass} {@attach albumDropTarget(null)}>
    <Icon icon={mdiImageAlbum} size="1.25rem" />
    <span>{$t('albums')}</span>
  </Link>
  {#each ancestors as ancestor (ancestor.id)}
    <Icon icon={mdiChevronRight} size="1rem" directional />
    <Link href={Route.viewAlbum(ancestor)} class={linkClass} {@attach albumDropTarget(ancestor)}>
      {ancestor.albumName || $t('unnamed_album')}
    </Link>
  {/each}
</nav>
