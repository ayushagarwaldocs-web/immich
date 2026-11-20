<script lang="ts">
  import { type AlbumResponseDto } from '@immich/sdk';
  import { Button, Modal, ModalBody, ModalFooter, Text } from '@immich/ui';
  import { mdiTrashCanOutline } from '@mdi/js';
  import { t } from 'svelte-i18n';

  type Props = {
    album: AlbumResponseDto;
    parent?: AlbumResponseDto;
    subAlbumCount: number;
    descendantCount: number;
    onClose: (choice?: 'album' | 'branch') => void;
  };

  const { album, parent, subAlbumCount, descendantCount, onClose }: Props = $props();

  const confirmation = $derived(
    album.albumName
      ? $t('album_delete_confirmation', { values: { album: album.albumName } })
      : $t('unnamed_album_delete_confirmation'),
  );
  const moveDescription = $derived(
    parent
      ? $t('album_delete_sub_albums_to_parent', {
          values: { count: subAlbumCount, parent: parent.albumName || $t('unnamed_album') },
        })
      : $t('album_delete_sub_albums_to_top_level', { values: { count: subAlbumCount } }),
  );
</script>

<Modal title={$t('delete_album')} icon={mdiTrashCanOutline} size="small" onClose={() => onClose()}>
  <ModalBody>
    <Text>{confirmation}</Text>
    <div class="mt-4 flex flex-col gap-3">
      <div>
        <Text fontWeight="medium">{$t('delete_album_only')}</Text>
        <Text size="small" color="muted">{moveDescription}</Text>
      </div>
      <div>
        <Text fontWeight="medium">{$t('delete_with_sub_albums')}</Text>
        <Text size="small" color="muted">
          {$t('album_delete_with_sub_albums_description', { values: { count: descendantCount } })}
        </Text>
      </div>
    </div>
    <Text class="mt-4">{$t('album_delete_photos_kept')} {$t('album_delete_confirmation_description')}</Text>
  </ModalBody>

  <ModalFooter>
    <div class="flex w-full flex-col gap-2">
      <Button shape="round" color="danger" fullWidth onclick={() => onClose('album')}>
        {$t('delete_album_only')}
      </Button>
      <Button shape="round" color="danger" variant="outline" fullWidth onclick={() => onClose('branch')}>
        {$t('delete_with_sub_albums')}
      </Button>
      <Button shape="round" color="secondary" fullWidth onclick={() => onClose()}>{$t('cancel')}</Button>
    </div>
  </ModalFooter>
</Modal>
