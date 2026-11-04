// ─── TodoList ────────────────────────────────────────────────────────────────

export type TodoListIconType = "fontawesome" | "emoji" | "image";

export interface TodoListDoc {
  _id: string;
  title: string;
  projectId: string | null;
  slug: string;
  subdomain: string;
  accentColor: string;
  backgroundColor: string;
  faviconUrl: string;
  iconType: TodoListIconType;
  /** FA class string (e.g. "fa-solid fa-star"), emoji char, or image URL */
  iconValue: string;
  order: number;
  createdBy: string;
  /** If non-empty, only createdBy + members can see this list */
  members: string[];
  /** Global AI Context for the list */
  aiContext?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TodoListPlain {
  _id: string;
  title: string;
  projectId: string | null;
  slug: string;
  subdomain: string;
  accentColor: string;
  backgroundColor: string;
  faviconUrl: string;
  iconType: TodoListIconType;
  iconValue: string;
  order: number;
  createdBy: string;
  /** If non-empty, only createdBy + members can see this list */
  members: string[];
  /** Global AI Context for the list */
  aiContext?: string;
  createdAt: string;
  updatedAt: string;
  /** Open top-level tasks, as listed by the active tab (returned by the lists API) */
  openTaskCount?: number;
}

// ─── TodoTag ─────────────────────────────────────────────────────────────────

export interface TodoTagDoc {
  _id: string;
  name: string;
  color: string;
  listId: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TodoTagPlain {
  _id: string;
  name: string;
  color: string;
  listId: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── TodoTask ────────────────────────────────────────────────────────────────

export interface TodoAttachment {
  name: string;
  url: string;
  mimeType: string;
}

export interface TodoTaskDoc {
  _id: string;
  listId: string;
  /** null = root task; ObjectId string = parent task id */
  parentTaskId: string | null;
  title: string;
  description: string;
  /** Array of user _id strings */
  assignedTo: string[];
  dueDate: Date | null;
  isFavorite: boolean;
  isCompleted: boolean;
  completedAt: Date | null;
  /** User _id of who completed it */
  completedBy: string | null;
  /** Populated display name / email (virtual, not persisted) */
  completedByUser?: { username?: string; name?: string; email?: string };
  attachments: TodoAttachment[];
  tags: string[];
  order: number;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TodoTaskPlain {
  _id: string;
  listId: string;
  parentTaskId: string | null;
  title: string;
  description: string;
  assignedTo: string[];
  /** Populated [{_id,username,name,email}] returned by API */
  assignedToUsers?: {
    _id: string;
    username?: string;
    name?: string;
    email?: string;
  }[];
  dueDate: string | null;
  isFavorite: boolean;
  isCompleted: boolean;
  completedAt: string | null;
  completedBy: string | null;
  completedByUser?: { username?: string; name?: string; email?: string };
  attachments: TodoAttachment[];
  tags: string[];
  order: number;
  createdBy: string | null;
  /** Populated creator user info (returned by single-task API) */
  createdByUser?: {
    _id: string;
    username?: string;
    name?: string;
    email?: string;
  };
  createdAt: string;
  updatedAt: string;
  /** Number of open direct children (returned by API) */
  childCount?: number;
  /** Number of direct children, open and completed (returned by API) */
  subtaskCount?: number;
  /** Number of completed direct children (returned by API) */
  subtaskDoneCount?: number;
}

export interface TodoProjectPlain {
  _id: string;
  title: string;
  slug: string;
  description: string;
  iconValue: string;
  color: string;
  members: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  listCount?: number;
  activeTaskCount?: number;
}
