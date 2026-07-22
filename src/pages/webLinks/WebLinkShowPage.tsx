/**
 * Web link detail: the link target and its metadata.
 */
import { useParams } from 'react-router'
import { Box, Link, Typography } from '@mui/material'
import { linkLabel } from '@/domain/webLinks'
import { useWebLinks } from '@/stores/entities/webLinks'
import { EntityShowHeader } from '@/components/EntityShowHeader'
import { NotFound } from '@/components/NotFound'

export function WebLinkShowPage() {
  const { id } = useParams()
  const link = useWebLinks((s) => (id ? s.byId.get(id) : undefined))

  if (!link) {
    return <NotFound label="Web link" />
  }

  return (
    <Box data-testid="web-link-show-page">
      <EntityShowHeader
        backTo="/web-links"
        backLabel="Web Links"
        editTo={`/web-links/${link.id}/edit`}
      />
      <Typography variant="h5" sx={{ overflowWrap: 'anywhere' }}>
        {linkLabel(link)}
      </Typography>
      {link.url && (
        <Typography sx={{ mt: 1, overflowWrap: 'anywhere' }}>
          <Link href={link.url} target="_blank" rel="noreferrer">
            {link.url}
          </Link>
        </Typography>
      )}
      {link.description && (
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {link.description}
        </Typography>
      )}
    </Box>
  )
}
