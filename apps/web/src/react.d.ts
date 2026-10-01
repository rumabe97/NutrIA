import 'react';

// `passwordrules` is what Safari's and iCloud Keychain's generator read to make a password
// the site accepts. React passes the attribute through as written; only its types lack it.
declare module 'react' {
  // The type parameter must match React's own declaration for the two to merge.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface InputHTMLAttributes<T> {
    passwordrules?: string;
  }
}
