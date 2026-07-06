import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const totalChannels = await db.channel.count();
    return NextResponse.json({
      status: "healthy",
      message: "Database handshake verified successfully over Serverless WebSockets.",
      timestamp: new Date().toISOString(),
      activeChannels: totalChannels,
    }, { status: 200 });
  } catch (error: any) {
    console.error("Root API Connection Error:", error);
    return NextResponse.json({
      status: "unhealthy",
      error: "Database handshake failed.",
      details: error.message || "Could not resolve connection string pools.",
    }, { status: 500 });
  }
}