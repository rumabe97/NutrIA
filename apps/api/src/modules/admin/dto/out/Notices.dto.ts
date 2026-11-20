import type { NoticePreviewView, NoticeSendView } from 'core/controllers/Notice';

/** Who a send would mail, and the counts, with nothing sent (project 025 phase 10). */
export type NoticePreviewDto = NoticePreviewView;

/** What one press of the send did: accepted, failed, skipped as unconfirmed, and still owed. */
export type NoticeSendDto = NoticeSendView;
