<script lang="ts">
  import { getAllAlbumsQuery } from '#lib/queries/album.query.ts';
  import { queryClient } from '#lib/queries/client.ts';
  import { locale } from '#lib/stores/preferences.store.ts';
  import { AlbumTree, sortAlbumsByName } from '#lib/utils/album-tree.ts';
  import { normalizeSearchString } from '#lib/utils/string-utils.ts';
  import { type AlbumResponseDto } from '@immich/sdk';
  import { Icon, Input, ListButton, LoadingSpinner, Modal, ModalBody, Text } from '@immich/ui';
  import { mdiFolderMoveOutline, mdiHomeOutline, mdiImageAlbum, mdiMagnify } from '@mdi/js';
  import { createQuery } from '@tanstack/svelte-query';
  import { t } from 'svelte-i18n';

  type Props = {
    album: AlbumResponseDto;
    onClose: (parentId?: string | null) => void;
  };

  const { album, onClose }: Props = $props();

  type Destination = { album: AlbumResponseDto; depth: number; parentPath?: string };

  const query = createQuery(
    () => getAllAlbumsQuery({ isOwned: true }),
    () => queryClient,
  );
  let search = $state('');

  const getName = ({ albumName }: AlbumResponseDto) => albumName || $t('unnamed_album');

  const destinations = $derived.by(() => {
    const tree = new AlbumTree(query.data ?? []);
    const excludedIds = new Set([album.id, ...tree.getDescendantIds(album.id)]);
    const destinations: Destination[] = [];

    const addDestinations = (albums: AlbumResponseDto[], depth: number) => {
      for (const candidate of sortAlbumsByName(albums, $locale)) {
        if (excludedIds.has(candidate.id)) {
          continue;
        }

        const parent = tree.getParent(candidate);
        destinations.push({ album: candidate, depth, parentPath: parent && tree.getPathLabel(parent, getName) });
        addDestinations(tree.getChildren(candidate.id), depth + 1);
      }
    };

    addDestinations(tree.getRoots(), 0);
    return destinations;
  });

  const normalizedSearch = $derived(normalizeSearchString(search));
  const matchingDestinations = $derived(
    normalizedSearch
      ? destinations.filter(({ album }) => normalizeSearchString(album.albumName).includes(normalizedSearch))
      : destinations,
  );
  const isTopLevel = $derived(!album.parentId);
</script>

<Modal title={$t('move_to')} icon={mdiFolderMoveOutline} {onClose} size="small">
  <ModalBody>
    <Input bind:value={search} placeholder={$t('search_albums')} leadingIcon={mdiMagnify} autofocus />

    <div class="mt-4 flex max-h-100 immich-scrollbar flex-col gap-1 overflow-y-auto">
      <ListButton selected={isTopLevel} disabled={isTopLevel} onclick={() => onClose(null)}>
        <span class="flex grow items-center gap-3 text-start">
          <Icon icon={mdiHomeOutline} size="1.5rem" class="shrink-0" />
          <span>{$t('top_level')}</span>
        </span>
      </ListButton>

      {#if query.isPending}
        <div class="flex justify-center py-4">
          <LoadingSpinner />
        </div>
      {:else}
        {#each matchingDestinations as destination (destination.album.id)}
          {const isCurrentParent = $derived(destination.album.id === album.parentId)}
          <ListButton
            selected={isCurrentParent}
            disabled={isCurrentParent}
            onclick={() => onClose(destination.album.id)}
          >
            <span
              class="flex min-w-0 grow items-center gap-3 text-start"
              style:padding-inline-start="{normalizedSearch ? 0 : destination.depth * 1.5}rem"
            >
              <Icon icon={mdiImageAlbum} size="1.5rem" class="shrink-0" />
              <span class="flex min-w-0 flex-col">
                <span class="truncate">{getName(destination.album)}</span>
                {#if normalizedSearch && destination.parentPath}
                  <Text size="tiny" color="muted" class="truncate">{destination.parentPath}</Text>
                {/if}
              </span>
            </span>
          </ListButton>
        {:else}
          {#if normalizedSearch}
            <Text size="small" color="muted" class="px-4 py-2">{$t('album_search_not_found')}</Text>
          {/if}
        {/each}
      {/if}
    </div>
  </ModalBody>
</Modal>
