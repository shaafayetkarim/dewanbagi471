// app/api/admin/users/[id]/route.ts
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function PATCH(request, { params }) {
  const { id } = params
  const data = await request.json()
  
  try {
    const updatedUser = await prisma.user.update({
      where: { id },
      data: data
    })
    
    return NextResponse.json(updatedUser)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  const { id } = params
  
  try {
    // First delete all related entities
    // Delete saved posts by the user
    await prisma.savedPost.deleteMany({
      where: { userId: id }
    })
    
    // Get user's posts to delete their saved posts
    const userPosts = await prisma.post.findMany({
      where: { authorId: id },
      select: { id: true }
    })
    
    const postIds = userPosts.map(post => post.id)
    
    // Delete saved posts of the user's posts
    if (postIds.length > 0) {
      await prisma.savedPost.deleteMany({
        where: { postId: { in: postIds } }
      })
    }
    
    // Delete user's collections
    await prisma.collection.deleteMany({
      where: { userId: id }
    })
    
    // Delete user's posts
    await prisma.post.deleteMany({
      where: { authorId: id }
    })
    
    // Finally delete the user
    const deletedUser = await prisma.user.delete({
      where: { id }
    })
    
    return NextResponse.json(deletedUser)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}