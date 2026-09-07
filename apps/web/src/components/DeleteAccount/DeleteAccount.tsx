'use client';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './DeleteAccount.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Text } from 'ui/components/Text';

import { api, messageFor } from 'lib/api';

const CONFIRMATION = 'BORRAR';

/**
 * Typed confirmation rather than a second "are you sure" button.
 *
 * This deletes health data irreversibly, and a confirm dialog is dismissed by
 * reflex. Making the user type the word is the cheapest way to ensure the
 * action was intended.
 */
export function DeleteAccount() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function remove() {
    setError(undefined);
    setPending(true);

    try {
      await api('/users/me', { method: 'DELETE' });
      router.push('/');
      router.refresh();
    } catch (caught) {
      setError(messageFor(caught));
      setPending(false);
    }
  }

  if (!confirming) {
    return (
      <div className={styles.wrapper}>
        <Button onClick={() => setConfirming(true)} type="button" variant="secondary">
          Borrar mi cuenta
        </Button>
      </div>
    );
  }

  return (
    <div className={`${styles.wrapper} ${styles.confirm}`}>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <Text size="sm" tone="secondary">
        Escribe <strong>{CONFIRMATION}</strong> para confirmar.
      </Text>

      <Input
        autoComplete="off"
        label={`Escribe ${CONFIRMATION}`}
        onChange={event => setValue(event.target.value)}
        value={value}
      />

      <div className={styles.actions}>
        <Button disabled={value !== CONFIRMATION || pending} onClick={remove} type="button">
          {pending ? 'Borrando…' : 'Borrar definitivamente'}
        </Button>
        <Button onClick={() => setConfirming(false)} type="button" variant="secondary">
          Cancelar
        </Button>
      </div>
    </div>
  );
}
