// Series exports
export { PostSeries, seriesTable } from "./PostSeries";
export type {
  NewPostSeriesType,
  NewSeries,
  PostSeriesType,
  Series,
} from "./PostSeries";

// Category exports
export { categoriesTable, PostCategory } from "./PostCategory";
export type {
  Category,
  NewCategory,
  NewPostCategoryType,
  PostCategoryType,
} from "./PostCategory";

// Note: For tags, use the core Tag model from @ottabase/ottaorm
// PostTag (below) is the junction table linking posts to core tags

// Post exports
export { Post, postsTable } from "./Post";
export type { NewPost, NewPostType, PostType } from "./Post";

// PostTag exports
export { PostTag, postTagsTable } from "./PostTag";
export type { NewPostTag } from "./PostTag";

// PostVersion exports
export { PostVersion, postVersionsTable } from "./PostVersion";
export type {
  NewPostVersion,
  NewPostVersionType,
  PostVersionType,
} from "./PostVersion";
