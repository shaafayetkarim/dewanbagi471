// /api/posts/index.js or /app/api/posts/route.js (depending on your Next.js setup)

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]'; // Adjust the import path as needed
import { v4 as uuidv4 } from 'uuid'; // You may need to install this package
import { writeFile } from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

// For Next.js App Router
export async function POST(request) {
  try {
    // Get the authenticated user
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse the form data
    const formData = await request.formData();
    const title = formData.get('title');
    const content = formData.get('content');
    const status = formData.get('status') || 'draft';
    const file = formData.get('file'); // Get the file if it exists

    // Calculate word count
    const wordCount = content ? content.trim().split(/\s+/).length : 0;
    
    // Create excerpt (first 150 characters)
    const excerpt = content ? content.substring(0, 150) + (content.length > 150 ? '...' : '') : '';

    // Initialize a transaction
    const result = await prisma.$transaction(async (prisma) => {
      // Create the post
      const post = await prisma.post.create({
        data: {
          title,
          content,
          excerpt,
          status: status === 'Ready to Publish' ? 'published' : 'draft',
          wordCount,
          authorId: session.user.id,
        },
      });

      // If there's a file, save it as an attachment
      if (file && file instanceof File) {
        // Create a unique filename
        const fileName = `${uuidv4()}-${file.name}`;
        
        // Set the directory for file storage (create this directory in your project)
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        
        // Convert the file to a buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        
        // Write the file to the uploads directory
        const filePath = path.join(uploadsDir, fileName);
        await writeFile(filePath, buffer);
        
        // Create the attachment record in the database
        await prisma.attachment.create({
          data: {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            fileUrl: `/uploads/${fileName}`, // The URL where the file can be accessed
            postId: post.id,
          },
        });
      }

      return post;
    });

    return NextResponse.json({ success: true, post: result });
  } catch (error) {
    console.error('Error creating post:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// For Next.js Pages Router
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the authenticated user
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Parse the form data
    const { title, content, status } = req.body;
    
    // Handle file upload if using formidable or similar
    // This is just a placeholder for the file handling logic
    const file = req.file;

    // Calculate word count
    const wordCount = content ? content.trim().split(/\s+/).length : 0;
    
    // Create excerpt (first 150 characters)
    const excerpt = content ? content.substring(0, 150) + (content.length > 150 ? '...' : '') : '';

    // Create the post
    const post = await prisma.post.create({
      data: {
        title,
        content,
        excerpt,
        status: status === 'Ready to Publish' ? 'published' : 'draft',
        wordCount,
        authorId: session.user.id,
      },
    });

    // If there's a file, save it as an attachment
    if (file) {
      await prisma.attachment.create({
        data: {
          fileName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          fileUrl: file.path, // This would be the path where your file upload middleware saved the file
          postId: post.id,
        },
      });
    }

    return res.status(200).json({ success: true, post });
  } catch (error) {
    console.error('Error creating post:', error);
    return res.status(500).json({ error: error.message });
  }
}