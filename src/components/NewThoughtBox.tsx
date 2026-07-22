/**
 * The "Pensieve" quick-capture box: a new thought defaults
 * onto today's virtual day parent via the thought factory.
 */
import { useState } from 'react'
import { Alert, Box, Button, Snackbar, TextField } from '@mui/material'
import { createThought } from '@/domain/factories'
import { getClientId } from '@interop/was-react'
import { useThoughts } from '@/stores/entities/thoughts'

export function NewThoughtBox() {
  const insert = useThoughts((s) => s.insert)
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(false)

  async function save() {
    const name = text.trim()
    if (name === '') {
      return
    }
    await insert(createThought({ name, clientId: getClientId() }))
    setText('')
    setSaved(true)
  }

  return (
    <Box
      sx={{ display: 'flex', gap: 1, mb: 3, alignItems: 'flex-start' }}
      data-testid="new-thought-box"
    >
      <TextField
        fullWidth
        multiline
        minRows={1}
        size="small"
        label="Pensieve -- capture a thought"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            void save()
          }
        }}
        slotProps={{ htmlInput: { 'data-testid': 'new-thought-input' } }}
      />
      <Button
        variant="contained"
        onClick={() => void save()}
        data-testid="new-thought-save"
        sx={{ mt: 0.5 }}
      >
        Save
      </Button>
      <Snackbar
        open={saved}
        autoHideDuration={3000}
        onClose={() => setSaved(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setSaved(false)}
          data-testid="new-thought-saved"
        >
          Thought saved
        </Alert>
      </Snackbar>
    </Box>
  )
}
