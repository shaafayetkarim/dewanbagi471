// app/api/dashboard/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";


const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }
    
    // Fetch user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        generationsLeft: true,
        generationsTotal: true,
      },
    });
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    // Count total posts
    const totalPosts = await prisma.post.count({
      where: { authorId: userId },
    });
    
    // Count published posts
    const publishedPosts = await prisma.post.count({
      where: { 
        authorId: userId,
        status: "published" 
      },
    });
    
    // Count draft posts
    const draftPosts = await prisma.post.count({
      where: { 
        authorId: userId,
        status: "draft" 
      },
    });
    
    // Fetch recent posts (ideas)
    const recentPosts = await prisma.post.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
    });
    
    // Fetch draft posts
    const drafts = await prisma.post.findMany({
      where: { 
        authorId: userId,
        status: "draft" 
      },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
      },
    });
    
    return NextResponse.json({
      stats: {
        totalPosts,
        publishedPosts,
        draftPosts,
        generations: `${user.generationsLeft}/${user.generationsTotal}`,
      },
      recentPosts: recentPosts.map(post => ({
        id: post.id,
        title: post.title,
        date: formatDate(post.createdAt),
      })),
      drafts: drafts.map(draft => ({
        id: draft.id,
        title: draft.title,
        status: draft.status === "draft" ? "Needs Editing" : "Ready to Publish",
        date: formatDate(draft.updatedAt),
      })),
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}

// Helper function to format dates
function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const day = 24 * 60 * 60 * 1000;
  const week = 7 * day;
  
  if (diff < day) {
    return "Today";
  } else if (diff < 2 * day) {
    return "Yesterday";
  } else if (diff < week) {
    return `${Math.floor(diff / day)} days ago`;
  } else {
    return `${Math.floor(diff / week)} week${Math.floor(diff / week) > 1 ? 's' : ''} ago`;
  }
}