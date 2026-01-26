/**
 * OttaORM Posts API
 *
 * Demonstrates CRUD operations using OttaORM Post model
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createD1Driver } from "@ottabase/db/drizzle-d1";
import { registerConnection } from "@ottabase/ottaorm";
import { Post } from "@ottabase/ottablog";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "edge";

/**
 * GET /api/ottaorm/posts - Get all posts
 */
export async function GET(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext();

    if (!env.OBCF_D1) {
      return NextResponse.json(
        { error: "D1 database not configured" },
        { status: 500 }
      );
    }

    registerConnection("default", createD1Driver(env.OBCF_D1));

    // Eloquent-like syntax!
    const posts = await Post.all({
      orderBy: "createdAt",
      orderDirection: "desc",
    });

    return NextResponse.json({
      posts: posts.map(p => p.toJson()),
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch posts",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ottaorm/posts - Create a new post
 */
export async function POST(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext();

    if (!env.OBCF_D1) {
      return NextResponse.json(
        { error: "D1 database not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { title, content, authorId } = body;

    if (!title || !authorId) {
      return NextResponse.json(
        { error: "Title and authorId are required" },
        { status: 400 }
      );
    }

    registerConnection("default", createD1Driver(env.OBCF_D1));

    // Eloquent-like syntax!
    const post = await Post.create({
      id: crypto.randomUUID(),
      title,
      slug: Post.generateSlug(title),
      content: content || null,
      published: false,
      authorId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({
      post: post.toJson(),
    });
  } catch (error) {
    console.error("Error creating post:", error);
    return NextResponse.json(
      {
        error: "Failed to create post",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
