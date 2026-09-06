'use client';
import { useState } from 'react';

import styles from '../../Preview.module.css';

interface CopyButtonProps {
  className?: string;
  code: string;
}

export function CopyButton({ className, code }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button className={className ?? styles.copy} onClick={handleCopy} type="button">
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}
