import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // 1. We now expect an array called 'images'
    const { images, userId } = await req.json();

    if (!images || images.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 });
    }

    // 2. Prepare the message for OpenAI
    // We start with the text instruction...
    const userContent: any[] = [
      { type: "text", text: "These images are parts of a SINGLE recipe. Combine the text from all images into one structured recipe. Ignore duplicates or overlapping text." }
    ];

    // ...and then loop through every image to add it to the message
    images.forEach((imgBase64: string) => {
      userContent.push({
        type: "image_url",
        image_url: { url: imgBase64 }
      });
    });

    // 3. Send to GPT-4o
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a recipe digitizer. Extract text verbatim. 
          If the recipe spans multiple images, stitch them together logically.
          Return JSON: { "title": string, "description": string, "ingredients": string[], "instructions": string[] }`
        },
        {
          role: "user",
          content: userContent
        }
      ]
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error("No content returned from AI");
    
    const recipeData = JSON.parse(content);

    // 4. Save to Supabase
    const { error } = await supabase
      .from('recipes')
      .insert({
        user_id: userId,
        title: recipeData.title,
        description: recipeData.description,
        ingredients: recipeData.ingredients,
        instructions: recipeData.instructions,
        // We can mark this as a multi-page upload in the DB if we want, 
        // or just leave the image URL blank for now since we are focused on text.
      });

    if (error) {
      console.error("Supabase Error:", error);
      throw new Error("Failed to save to database");
    }

    return NextResponse.json({ success: true, recipe: recipeData });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}