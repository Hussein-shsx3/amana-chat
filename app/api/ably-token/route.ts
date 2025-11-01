import { NextRequest, NextResponse } from "next/server";
import Ably from "ably";

export async function GET(request: NextRequest) {
  try {
    // Get the API key from environment variables
    const apiKey = process.env.NEXT_PUBLIC_ABLY_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Ably API key is not configured" },
        { status: 500 }
      );
    }

    // Get clientId from query parameters
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId is required" },
        { status: 400 }
      );
    }

    // Create Ably REST client
    const client = new Ably.Rest(apiKey);

    // Create a token request with the provided client ID
    const tokenRequest = await client.auth.createTokenRequest({
      clientId: clientId,
      capability: {
        "chat-room": ["publish", "subscribe", "presence"],
      },
    });

    return NextResponse.json(tokenRequest);
  } catch (error) {
    console.error("Error creating Ably token:", error);
    return NextResponse.json(
      { error: "Failed to create authentication token" },
      { status: 500 }
    );
  }
}

// Optional: Add CORS headers if needed
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
