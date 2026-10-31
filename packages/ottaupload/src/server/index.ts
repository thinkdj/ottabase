/**
 * Server side of @ottabase/ottaupload: the files service (`createFiles`) and the pieces it is
 * made of, exported for the apps and packages that serve or test files.
 */

export {
    applySafeObjectHeaders,
    canChangeFile,
    canModerateFile,
    canReadFile,
    createFiles,
    DEFAULT_PUBLIC_FILES_URL,
    dispositionFor,
    FILE_VARIANT_WIDTHS,
    FILES_ROUTE,
    fileIdFromKey,
    fileKey,
    newFileId,
    PRIVATE_CACHE_CONTROL,
    PUBLIC_CACHE_CONTROL,
    quotaBytes,
    servePublicFile,
    signFileToken,
    variantKey,
    verifyFileToken,
    type Files,
    type FilesOptions,
    type PutFileInput,
    type QuarantineResult,
    type ReadFileInput,
} from './files';
export { imageSize, RASTER_IMAGE_TYPES, sniff, type SniffedType } from './sniff';
export {
    FilesError,
    type FileAudience,
    type FileEdit,
    type FileOwner,
    type FilePurpose,
    type FileRecord,
    type FileStatus,
    type FileStore,
    type FileUpdate,
    type FileVariant,
    type FileVariantInfo,
    type FileView,
    type FileViewer,
    type FilesBucket,
    type FilesObject,
    type ImagesBindingLike,
} from '../types';
export { minimalExifSegment, stripMetadata } from './strip';
