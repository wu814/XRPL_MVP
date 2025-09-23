import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/utils/supabase/hashPassword";
import { CreateUserAPIRequest, APIResponse } from "@/types/apiTypes";

export async function POST(req: NextRequest) {
  try {
    const { username, password, email, role }: CreateUserAPIRequest = await req.json();
    
    // Validate input
    if (!username || !password || !email || !role) {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "All fields are required." },
        { status: 400 }
      );
    }
    
    if (typeof username !== "string" || username.trim() === "" || /\s/.test(username)) {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "Username must be non-empty and contain no spaces." },
        { status: 400 }
      );
    }
    
    if (password.length < 5) {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "Password must be at least 5 characters long." },
        { status: 400 }
      );
    }
    
    if (!["USER", "BUSINESS"].includes(role)) {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "Role must be either USER or BUSINESS." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseAnonClient();
    
    // Check if username is already taken
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("username")
      .eq("username", username.trim())
      .maybeSingle();
      
    if (checkError) {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "Failed to check username" },
        { status: 500 }
      );
    }
    
    if (existingUser) {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "This username is already taken." },
        { status: 409 }
      );
    }
    
    // Check if user with this email already exists
    const { data: existingEmail, error: emailError } = await supabase
      .from("users")
      .select("user_id")
      .eq("email_address", email)
      .maybeSingle();
      
    if (emailError) {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "Failed to check email" },
        { status: 500 }
      );
    }
    
    if (existingEmail) {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "User with this email already exists." },
        { status: 409 }
      );
    }
    
    // Hash the password
    const hashedPassword = await hashPassword(password);
    
    // Create user
    const { data: userData, error: userError } = await supabase
      .from("users")
      .insert({
        username: username.trim(),
        email_address: email,
        role: role,
        is_verified: true, // Google users are verified
        created_at: new Date().toISOString()
      })
      .select("user_id")
      .single();
      
    if (userError) {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "Failed to create user" },
        { status: 500 }
      );
    }
    
    // Create password entry
    const { error: passwordError } = await supabase
      .from("passwords")
      .insert({
        user_id: userData.user_id,
        password: hashedPassword
      });
      
    if (passwordError) {
      // If password creation fails, we should clean up the user entry
      await supabase
        .from("users")
        .delete()
        .eq("user_id", userData.user_id);
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "Failed to create password" },
        { status: 500 }
      );
    }

    return NextResponse.json<APIResponse<never>>(
      { success: true, message: "User created successfully!" },
      { status: 201 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIResponse<never>>(
      { success: false, message: `Error creating user: ${errorMessage}` },
      { status: 500 }
    );
  }
}
