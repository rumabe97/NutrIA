'use client';
import { Button } from 'ui/components/Button';
import { toast } from 'ui/components/Toaster';

export function ToastExamples() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      <Button onClick={() => toast('Your changes have been saved.')}>Default</Button>
      <Button onClick={() => toast.success('Profile updated successfully.')}>Success</Button>
      <Button onClick={() => toast.error('Something went wrong. Please try again.')}>Error</Button>
      <Button onClick={() => toast.warning('Your session is about to expire.')}>Warning</Button>
      <Button onClick={() => toast.info('A new version is available.')}>Info</Button>
      <Button onClick={() => toast('File deleted', { description: 'The file has been moved to trash.' })}>With description</Button>
    </div>
  );
}
