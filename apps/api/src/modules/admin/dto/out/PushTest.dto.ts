/**
 * What the owner's test push did (`0054`): whether push is set up at all, how
 * many of their browsers are subscribed, and how many accepted the message.
 * Three numbers, because "sent" and "nothing arrived" look alike from the screen.
 */
export type PushTestDto = { readonly configured: boolean; readonly delivered: number; readonly devices: number };
