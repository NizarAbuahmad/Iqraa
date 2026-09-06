/**
 * Messaging service — direct threads between a teacher and a parent or
 * student, auto-managed class-group threads, and teacher-created custom
 * groups with optional attachments.
 *
 * Same reasoning as roster.ts: no AsyncStorage fallback. A thread or message
 * invented locally is not something the other participant could ever see.
 */
import * as ImagePicker from 'expo-image-picker';
import { apiFetch } from './apiClient.ts';
import { downscaleImage } from './imageDownscale.ts';

export type ChatAttachmentKind = 'image' | 'audio' | 'document';

/**
 * One photo, downscaled the same way a lesson-media photo is (see
 * imageDownscale.ts). Single-pick, not multi — a chat message carries at
 * most one attachment (see chatMessages's schema comment). Null on
 * cancel/no permission, same shape pickLessonPhotos() uses.
 */
export async function pickChatImage(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    base64: true,
  });
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset?.base64) return null;

  return downscaleImage(`data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`);
}

export type ChatRole = 'teacher' | 'school_admin' | 'system_admin' | 'student' | 'parent';
export type ChatThreadType = 'direct' | 'class_group' | 'custom_group';

export interface ChatParticipantInfo {
  userId: string;
  firstName: string;
  lastName: string;
  role: ChatRole;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  attachmentKind: ChatAttachmentKind | null;
  attachmentMime: string | null;
  /** Time-limited signed R2 URL, or null if there's no attachment (or R2 couldn't presign it right now). */
  attachmentUrl: string | null;
  createdAt: string;
}

export interface ChatThreadSummary {
  id: string;
  type: ChatThreadType;
  title: string;
  titleAr: string;
  /** The creator for a direct/custom_group thread; null for a class_group (owner is the class's teacher instead). */
  createdBy: string | null;
  /** Only set for type='direct'. Group threads use title/titleAr + participants instead. */
  otherParticipant: ChatParticipantInfo | null;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  updatedAt: string;
}

export interface ContactStudent {
  studentId: string;
  studentName: string;
  /**
   * Every class of this teacher's that the student sits in — a student can be
   * in several. Drives the picker's "select a whole class".
   *
   * Optional because the API is deployed by hand while the web app deploys on
   * merge (see docs/deploying.md), so the client will meet a server that
   * predates this field. Callers must treat it as possibly absent; the picker
   * simply shows no class chips.
   */
  classes?: Array<{ id: string; name: string; nameAr: string }>;
  /** The people this user may start a thread with about this student. */
  contacts: Array<{ userId: string; firstName: string; lastName: string; role: ChatRole }>;
}

/** A parent/student's contacts response shapes each entry as one contact per student instead. */
export interface ContactEntry {
  studentId: string;
  studentName: string;
  userId: string;
  firstName: string;
  lastName: string;
  role: ChatRole;
}

export class MessagingError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'MessagingError';
    this.status = status;
    this.code = code;
  }

  get isStorageUnavailable(): boolean {
    return this.code === 'messaging_storage_unavailable';
  }
}

async function readJson<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) {
    let detail = '';
    let code = '';
    try {
      const body = (await res.json()) as { error?: string; code?: string };
      detail = body.error ?? '';
      code = body.code ?? '';
    } catch {
      /* body wasn't JSON — the status is all we have */
    }
    throw new MessagingError(detail || `${action} failed (${res.status})`, res.status, code);
  }
  return (await res.json()) as T;
}

/** Who this user is allowed to start a thread with. Teacher shape: grouped by student. */
export async function getTeacherContacts(): Promise<ContactStudent[]> {
  const res = await apiFetch('/messaging/contacts');
  const data = await readJson<{ students: ContactStudent[] }>(res, 'Loading contacts');
  return data.students;
}

/** Parent/student shape: one entry per linked student, carrying that student's teacher. */
export async function getMyContacts(): Promise<ContactEntry[]> {
  const res = await apiFetch('/messaging/contacts');
  const data = await readJson<{ students: ContactEntry[] }>(res, 'Loading contacts');
  return data.students;
}

export async function listThreads(): Promise<ChatThreadSummary[]> {
  const res = await apiFetch('/messaging/threads');
  const data = await readJson<{ threads: ChatThreadSummary[] }>(res, 'Loading conversations');
  return data.threads;
}

/** Get-or-create a direct thread with the given user, then navigate to it. */
export async function startThread(counterpartUserId: string): Promise<{ id: string }> {
  const res = await apiFetch('/messaging/threads', {
    method: 'POST',
    body: JSON.stringify({ counterpartUserId }),
  });
  const data = await readJson<{ thread: { id: string } }>(res, 'Starting conversation');
  return data.thread;
}

export interface ThreadDetail {
  id: string;
  type: ChatThreadType;
  title: string;
  titleAr: string;
  /** The creator for a direct/custom_group thread; null for a class_group. */
  createdBy: string | null;
  /** The class this thread belongs to; null for direct/custom_group threads. */
  classGroupId: string | null;
  /** Set only for type='direct'. */
  otherParticipant: ChatParticipantInfo | null;
  /** Set only for non-direct (group) threads. */
  participants: ChatParticipantInfo[] | null;
  /** Set only for type='direct' — whether I have blocked the other participant. */
  isBlocked: boolean;
  /** Group threads: am I the teacher who owns this group (and so may change its settings)? */
  isOwner: boolean;
  /** Group threads: may non-teachers post? False means announcement-only — see the server's file header. */
  studentPostingEnabled: boolean;
}

interface ApiThread {
  id: string;
  type: ChatThreadType;
  title: string;
  titleAr: string;
  createdBy: string | null;
  classGroupId: string | null;
  studentPostingEnabled: boolean;
}

export async function getThread(threadId: string): Promise<ThreadDetail> {
  const res = await apiFetch(`/messaging/threads/${threadId}`);
  const data = await readJson<{
    thread: ApiThread;
    otherParticipant: ChatParticipantInfo | null;
    participants?: ChatParticipantInfo[];
    isBlocked?: boolean;
    isOwner?: boolean;
  }>(res, 'Loading conversation');
  return {
    ...data.thread,
    otherParticipant: data.otherParticipant,
    participants: data.participants ?? null,
    isBlocked: data.isBlocked ?? false,
    isOwner: data.isOwner ?? false,
  };
}

/** Get-or-create the thread for a class — reachable by its teacher or a linked student. */
export async function getClassThread(classGroupId: string): Promise<ThreadDetail> {
  const res = await apiFetch(`/messaging/threads/class/${classGroupId}`);
  const data = await readJson<{
    thread: ApiThread;
    participants: ChatParticipantInfo[];
    isOwner?: boolean;
  }>(res, 'Loading class chat');
  return {
    ...data.thread,
    otherParticipant: null,
    participants: data.participants,
    isBlocked: false,
    isOwner: data.isOwner ?? false,
  };
}

/** Owning teacher only. False means the group is announcement-only — teachers post, everyone else reads. */
export async function setStudentPosting(threadId: string, enabled: boolean): Promise<void> {
  const res = await apiFetch(`/messaging/threads/${threadId}`, {
    method: 'PATCH',
    body: JSON.stringify({ studentPostingEnabled: enabled }),
  });
  await readJson(res, 'Updating group');
}

/** Teacher-only. Every id in `participantUserIds` must already be a contact (see getTeacherContacts). */
export async function createGroup(
  title: string,
  participantUserIds: string[],
): Promise<ThreadDetail> {
  const res = await apiFetch('/messaging/threads/custom', {
    method: 'POST',
    body: JSON.stringify({ title, participantUserIds }),
  });
  const data = await readJson<{
    thread: ApiThread;
    participants: ChatParticipantInfo[];
  }>(res, 'Creating group');
  return {
    ...data.thread,
    otherParticipant: null,
    participants: data.participants,
    isBlocked: false,
    isOwner: true,
  };
}

/** Owning teacher only. */
export async function addGroupMembers(threadId: string, participantUserIds: string[]): Promise<ChatParticipantInfo[]> {
  const res = await apiFetch(`/messaging/threads/${threadId}/participants`, {
    method: 'POST',
    body: JSON.stringify({ participantUserIds }),
  });
  const data = await readJson<{ participants: ChatParticipantInfo[] }>(res, 'Adding members');
  return data.participants;
}

/** The owning teacher may remove anyone else; anyone else may only remove themselves (leave). */
export async function removeGroupMember(threadId: string, userId: string): Promise<void> {
  const res = await apiFetch(`/messaging/threads/${threadId}/participants/${userId}`, { method: 'DELETE' });
  await readJson(res, 'Removing member');
}

/** Newest page first. Also marks the thread read for the caller — see messaging.ts on the server. */
export async function listMessages(
  threadId: string,
  before?: string,
): Promise<ChatMessage[]> {
  const query = before ? `?before=${encodeURIComponent(before)}` : '';
  const res = await apiFetch(`/messaging/threads/${threadId}/messages${query}`);
  const data = await readJson<{ messages: ChatMessage[] }>(res, 'Loading messages');
  return data.messages;
}

/** Merging a polled page into what is on screen lives in ./messageMerge.ts — see the note there on why it is not in this file. */

/** `attachmentDataUrl` is a `data:<mime>;base64,...` string — see services/lessonMediaPick.ts for how one gets built. */
export async function sendMessage(
  threadId: string,
  body: string,
  attachmentDataUrl?: string,
): Promise<ChatMessage> {
  const res = await apiFetch(`/messaging/threads/${threadId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body, attachmentDataUrl }),
  });
  const data = await readJson<{ message: ChatMessage }>(res, 'Sending message');
  return data.message;
}

/**
 * Hides, does not remove — a block only filters the blocked user's messages
 * from my own view and stops a new direct thread forming between us. See
 * the server's file header for the full reasoning.
 */
export async function blockUser(blockedUserId: string): Promise<void> {
  const res = await apiFetch('/messaging/blocks', {
    method: 'POST',
    body: JSON.stringify({ blockedUserId }),
  });
  await readJson(res, 'Blocking user');
}

export async function unblockUser(blockedUserId: string): Promise<void> {
  const res = await apiFetch(`/messaging/blocks/${blockedUserId}`, { method: 'DELETE' });
  await readJson(res, 'Unblocking user');
}

/** Logs a concern for the thread's owning teacher — not a moderation queue, an accountability trail. */
export async function reportUser(input: {
  threadId: string;
  reportedUserId: string;
  messageId?: string;
  reason: string;
}): Promise<void> {
  const res = await apiFetch('/messaging/reports', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  await readJson(res, 'Sending report');
}
