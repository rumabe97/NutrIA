'use client';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from 'ui/components/Button';
import { useDictionary } from 'i18n/LocaleProvider';

import { forgetOfflineCopies } from 'lib/offline';
import { forgetPushOnThisDevice } from 'lib/push';
import { SIGN_IN_AGAIN_PATH } from 'lib/accountDeletion';
import { signOut } from 'lib/auth-client';

/**
 * "Cerrar sesión y volver a entrar", for what Better Auth gives only to a recent session
 * (`SESSION_NOT_FRESH`): the menu's sign-out, then the sign-in page, which brings them
 * back to the profile.
 */
export function SignInAgainButton() {
  const router = useRouter();
  const dictionary = useDictionary();
  const [signingOut, setSigningOut] = useState(false);

  async function signOutAndBack() {
    setSigningOut(true);

    try {
      await forgetPushOnThisDevice();
      await signOut();
      await forgetOfflineCopies();
      router.push(SIGN_IN_AGAIN_PATH);
      router.refresh();
    } catch {
      // Offline, most likely: the button comes back.
      setSigningOut(false);
    }
  }

  return (
    <Button loading={signingOut} onClick={() => void signOutAndBack()} type="button" variant="secondary">
      {dictionary.security.signInAgain}
    </Button>
  );
}
