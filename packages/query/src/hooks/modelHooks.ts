// ============================================================
// @ottabase/query - Pre-built Model Hooks
// ============================================================
// Ready-to-use hooks for OttaORM core models
// ============================================================

import { createModelHooks } from "./createModelHooks";

/**
 * User type for query hooks
 */
export interface UserQueryType {
  id: string;
  name: string | null;
  email: string;
  emailVerified: Date | null;
  image: string | null;
  createdAt: Date;
}

/**
 * Post type for query hooks
 */
export interface PostQueryType {
  id: string;
  title: string;
  content: string | null;
  published: boolean;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tag type for query hooks
 */
export interface TagQueryType {
  id: string;
  name: string;
  slug: string;
}

/**
 * Pre-configured hooks for User model
 *
 * @example
 * ```typescript
 * import { useUsers } from "@ottabase/query";
 *
 * function UserList() {
 *   const { data: users, isLoading, error } = useUsers.useList();
 *   const createUser = useUsers.useCreate();
 *
 *   if (isLoading) return <Loading />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return (
 *     <div>
 *       {users?.map(user => <UserCard key={user.id} user={user} />)}
 *       <button onClick={() => createUser.mutate({ name: "New User", email: "new@example.com" })}>
 *         Add User
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export const useUsers = createModelHooks<UserQueryType>({
  entityName: "users",
  apiPath: "/api/ottaorm/users",
});

/**
 * Pre-configured hooks for Post model
 *
 * @example
 * ```typescript
 * import { usePosts } from "@ottabase/query";
 *
 * function PostList() {
 *   const { data: posts } = usePosts.useList({ where: { published: true } });
 *   const { data, fetchNextPage, hasNextPage } = usePosts.useInfiniteList();
 *
 *   return (
 *     <div>
 *       {posts?.map(post => <PostCard key={post.id} post={post} />)}
 *       {hasNextPage && <button onClick={() => fetchNextPage()}>Load More</button>}
 *     </div>
 *   );
 * }
 * ```
 */
export const usePosts = createModelHooks<PostQueryType>({
  entityName: "posts",
  apiPath: "/api/ottaorm/posts",
});

/**
 * Pre-configured hooks for Tag model
 */
export const useTags = createModelHooks<TagQueryType>({
  entityName: "tags",
  apiPath: "/api/ottaorm/tags",
});

/**
 * Factory to create hooks for custom models
 *
 * @example
 * ```typescript
 * // Define your model type
 * interface Product {
 *   id: string;
 *   name: string;
 *   price: number;
 *   inStock: boolean;
 * }
 *
 * // Create hooks
 * export const useProducts = createEntityHooks<Product>("products", "/api/products");
 *
 * // Use in component
 * const { data: products } = useProducts.useList({ where: { inStock: true } });
 * ```
 */
export function createEntityHooks<T extends { id: string | number }>(
  entityName: string,
  apiPath: string
) {
  return createModelHooks<T>({
    entityName,
    apiPath,
  });
}
