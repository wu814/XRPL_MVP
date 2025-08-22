import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";

import { hashPassword, verifyPassword } from "@/utils/supabase/hashPassword";

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentPassword, newPassword }: ChangePasswordRequest = await req.json();

    // Validate input
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 5) {
      return NextResponse.json(
        { error: "New password must be at least 5 characters long" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseAnonClient();
    const userId = session.user.user_id;

    // Get current password hash from database
    const { data: passwordData, error: fetchError } = await supabase
      .from("passwords")
      .select("password")
      .eq("user_id", userId)
      .single();

    if (fetchError) {
      console.error("Error fetching password:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch current password" },
        { status: 500 }
      );
    }

    if (!passwordData) {
      return NextResponse.json(
        { error: "No password found for user" },
        { status: 404 }
      );
    }

    // Verify current password
    const isCurrentPasswordValid = await verifyPassword(
      currentPassword,
      passwordData.password
    );

    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedNewPassword = await hashPassword(newPassword);

    // Update password in database
    const { error: updateError } = await supabase
      .from("passwords")
      .update({ password: hashedNewPassword })
      .eq("user_id", userId);

    if (updateError) {
      console.error("Error updating password:", updateError);
      return NextResponse.json(
        { error: "Failed to update password" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Password changed successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in changePassword:", error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
