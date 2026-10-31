import type { FileVariant } from '@ottabase/utils/media';

/**
 * File upload types and interfaces
 */

/**
 * Upload status for tracking file upload progress
 */
export type UploadStatus = 'pending' | 'uploading' | 'success' | 'error';

/**
 * File upload item with metadata and progress
 */
export interface UploadFile {
    id: string;
    file: File;
    status: UploadStatus;
    progress: number;
    error?: string;
    /** The stored file's view URL, once uploaded. */
    url?: string;
    /** The stored file, as `POST /api/files` returned it. */
    uploaded?: FileView;
}

/**
 * Upload configuration options
 */
export interface UploadConfig {
    /**
     * Maximum number of files allowed
     * @default 1
     */
    maxFiles?: number;

    /**
     * Maximum file size in bytes (a UX hint: the purpose's `maxBytes` is enforced on the server)
     * @default undefined (no limit)
     */
    maxFileSize?: number;

    /**
     * Accepted MIME types (e.g., ['image/*', 'application/pdf']). A UX hint: the server sniffs
     * the real type and checks it against the purpose's allow-list.
     * @default undefined (all types)
     */
    acceptedFileTypes?: string[];

    /**
     * API endpoint for file upload
     * @default '/api/files'
     */
    uploadEndpoint?: string;

    /**
     * The purpose the file is stored under (a manifest `files` entry, e.g. 'media').
     * @default 'media'
     */
    purpose?: string;

    /**
     * Auto-upload files on selection
     * @default false
     */
    autoUpload?: boolean;
}

/**
 * File uploader variant
 */
export type FileUploaderVariant = 'dropzone' | 'button';

/**
 * File uploader props
 */
export interface FileUploaderProps extends UploadConfig {
    /**
     * Upload handler
     */
    onUpload?: (files: File[]) => Promise<void> | void;

    /**
     * Upload complete callback
     */
    onUploadComplete?: (files: UploadFile[]) => void;

    /**
     * Upload error callback
     */
    onUploadError?: (error: Error) => void;

    /**
     * Upload progress callback
     */
    onUploadProgress?: (progress: number, file: UploadFile) => void;

    /**
     * UI variant
     * @default 'dropzone'
     */
    variant?: FileUploaderVariant;

    /**
     * Disabled state
     * @default false
     */
    disabled?: boolean;

    /**
     * Custom class name
     */
    className?: string;
}

/**
 * What the client upload helpers resolve to: `POST /api/files` answers `{ success, file }`.
 */
export interface UploadResponse {
    success: boolean;
    file?: FileView;
    error?: string;
}

// ─── The files system (server) ──────────────────────────────────────────────

/** Who may read a file: anyone (CDN), signed-in members of the owning org, or the uploader and admins. */
export type FileAudience = 'public' | 'members' | 'owner';

/** Fixed-width WebP renditions made at upload: thumb 160, card 640, full 1600. */
export type { FileVariant };

/** `ready` is served; `quarantined` is refused by every read path. */
export type FileStatus = 'ready' | 'quarantined';

/**
 * One kind of file an app stores, declared in a kernel manifest's `files` field.
 * `types` is an allow-list of SNIFFED MIME types: the browser's label and the extension never count.
 */
export interface FilePurpose {
    /** Becomes part of every key: `<appId>/<purpose>/<id>.<ext>`. `^[a-z][a-z0-9-]{1,48}$`. */
    purpose: string;
    label: string;
    audience: FileAudience;
    types: string[];
    maxBytes: number;
    variants?: FileVariant[];
    /** SVG is accepted (and served under the sandbox CSP). Only for purposes trusted admins write. */
    svg?: true;
    /** Written only by server code behind its own guard (a package route); `POST /api/files` refuses it. */
    server?: true;
}

/** Who a file belongs to. Always derived server-side from a verified session, never from the request. */
export interface FileOwner {
    appId: string;
    userId: string | null;
    organizationId: string | null;
}

/** Who is asking to read or change a file. Null means anonymous. */
export interface FileViewer {
    userId: string;
    organizationId: string | null;
    /** Administers `organizationId` (org admin or `media:manage`). */
    admin: boolean;
    /** Platform administrator: every file of the app. */
    platformAdmin: boolean;
}

export interface FileVariantInfo {
    key: string;
    width: number;
    height: number;
    size: number;
}

/** One stored file: the `media` row. */
export interface FileRecord {
    /** 32 hex chars; the same id is in the storage key. */
    id: string;
    appId: string;
    organizationId: string | null;
    userId: string | null;
    purpose: string;
    audience: FileAudience;
    storageKey: string;
    mimeType: string;
    mediaKind: string;
    status: FileStatus;
    originalName: string;
    title: string | null;
    altText: string | null;
    caption: string | null;
    extension: string | null;
    fileSize: number;
    width: number | null;
    height: number | null;
    variants: Partial<Record<FileVariant, FileVariantInfo>> | null;
    metadata: Record<string, unknown> | null;
    createdAt?: number | string | Date | null;
    updatedAt?: number | string | Date | null;
}

/** A record with its URLs: what every API returns and every UI reads. */
export interface FileView extends FileRecord {
    url: string;
    /** The thumb variant, else the original. */
    thumbnailUrl: string;
    /** The card variant, else the original. */
    previewUrl: string;
    /** Width descriptors over the variants (see `imageSources`), for a public image that has them. */
    srcSet: string | null;
}

/** Fields a person may change after upload. */
export type FileEdit = Partial<Pick<FileRecord, 'title' | 'altText' | 'caption'>>;

/** What the store may change on a row: the describing text, and the status (quarantine). */
export type FileUpdate = FileEdit & Partial<Pick<FileRecord, 'status'>>;

/**
 * Where records live. `@ottabase/ottaorm` ships `mediaFileStore` (the Media model); a test passes
 * an in-memory one.
 */
export interface FileStore {
    insert(record: FileRecord): Promise<void>;
    get(id: string): Promise<FileRecord | null>;
    update(id: string, fields: FileUpdate): Promise<FileRecord | null>;
    delete(id: string): Promise<void>;
    /** SUM(fileSize) of the owner's files: the organization's, or the user's when there is none. */
    usedBytes(owner: FileOwner): Promise<number>;
    /** Every file one user uploaded in the app, a page at a time (`removeOwned` deletes as it goes). */
    uploadedBy(appId: string, userId: string, limit: number): Promise<FileRecord[]>;
}

/**
 * The slice of an R2 bucket binding the files system uses. Option and value types are loose on
 * purpose: Workers and the DOM each declare their own streams and Headers, and an app's R2Bucket
 * must fit whichever set this package compiles against.
 */
export interface FilesBucket {
    put(key: string, value: Uint8Array | ArrayBuffer | string, options?: unknown): Promise<unknown>;
    get(key: string, options?: unknown): Promise<FilesObject | null>;
    delete(keys: string | string[]): Promise<unknown>;
}

/** An R2 object as `get` returns it: no `body` when an `onlyIf` precondition failed. */
export interface FilesObject {
    key: string;
    size: number;
    httpEtag: string;
    uploaded: Date;
    body?: unknown;
    range?: unknown;
    /** The object's stored HTTP metadata, carried over as is when an object moves buckets. */
    httpMetadata?: unknown;
    writeHttpMetadata(headers: never): void;
}

/** The slice of Cloudflare's Images binding: variants, and re-encoding what cannot be stripped in code. */
export interface ImagesBindingLike {
    input(stream: ReadableStream<Uint8Array>): ImageTransformerLike;
}

export interface ImageTransformerLike {
    transform(options: { width?: number; fit?: 'scale-down' }): ImageTransformerLike;
    output(options: {
        format: 'image/webp';
        quality?: number;
        /** Keep every frame of an animated input. */
        anim?: boolean;
    }): Promise<{ response(): { arrayBuffer(): Promise<ArrayBuffer> } }>;
}

/** A refused files operation. `status` and `code` map straight onto `errorResponse`. */
export class FilesError extends Error {
    constructor(
        public readonly status: number,
        public readonly code: string,
        message: string,
    ) {
        super(message);
        this.name = 'FilesError';
    }
}
