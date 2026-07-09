/**
 * Web link detail (ports `web_links#show`): the link target and its metadata.
 */
import { Link as RouterLink, useParams } from 'react-router'
import { Box, Button, Link, Stack, Typography } from '@mui/material'
import { nameDisplay } from '@/domain/webLinks'
import { useWebLinks } from '@/stores/entities/webLinks'

export function WebLinkShowPage() {
  const { id } = useParams()
  const link = useWebLinks((s) => (id ? s.byId.get(id) : undefined))

  if (!link) {
    return <Typography>Web link not found.</Typography>
  }

  return (
    <Box data-testid="web-link-show-page">
      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <Button component={RouterLink} to="/web-links" size="small">
          &lt; Web Links
        </Button>
        <Button
          component={RouterLink}
          to={`/web-links/${link.id}/edit`}
          size="small"
        >
          Edit
        </Button>
      </Stack>
      <Typography variant="h5">{nameDisplay(link)}</Typography>
      {link.url && (
        <Typography sx={{ mt: 1 }}>
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
