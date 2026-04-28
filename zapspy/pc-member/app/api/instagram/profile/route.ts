import { type NextRequest, NextResponse } from "next/server"

const cache = new Map<string, { profile: any; timestamp: number }>()
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json()

    if (!username) {
      return NextResponse.json(
        { success: false, error: "Username is required" },
        {
          status: 400,
          headers: { "Access-Control-Allow-Origin": "*" },
        },
      )
    }

    // Remove @ if present
    const cleanUsername = username.replace("@", "")

    // Check cache first
    const cached = cache.get(cleanUsername)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log("[v0] Returning cached Instagram profile")
      return NextResponse.json(
        {
          success: true,
          profile: cached.profile,
        },
        {
          status: 200,
          headers: { "Access-Control-Allow-Origin": "*" },
        },
      )
    }

    const rapidapiKey = process.env.INSTAGRAM_RAPIDAPI_KEY || ""

    console.log("[v0] Fetching Instagram profile for:", cleanUsername)

    const url = "https://instagram120.p.rapidapi.com/api/instagram/profile"
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-rapidapi-key": rapidapiKey,
        "x-rapidapi-host": "instagram120.p.rapidapi.com",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: cleanUsername,
      }),
    })

    const responseText = await response.text()
    console.log("[v0] API response status:", response.status)
    console.log("[v0] API response:", responseText.substring(0, 500))

    if (!response.ok) {
      console.error("[v0] API error - Status:", response.status)
      console.error("[v0] API error - Response:", responseText)
      return NextResponse.json(
        {
          success: false,
          error: `Failed to fetch profile: ${response.status}`,
        },
        {
          status: response.status,
          headers: { "Access-Control-Allow-Origin": "*" },
        },
      )
    }

    let data
    try {
      data = JSON.parse(responseText)
    } catch (e) {
      console.error("[v0] Failed to parse response:", e)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to parse profile data",
        },
        {
          status: 500,
          headers: { "Access-Control-Allow-Origin": "*" },
        },
      )
    }

    console.log("[v0] Parsed data:", JSON.stringify(data, null, 2))

    const user = data.result || data.data || data

    if (!user || !user.username) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found",
        },
        {
          status: 404,
          headers: { "Access-Control-Allow-Origin": "*" },
        },
      )
    }

    const extractedProfile = {
      username: user.username || cleanUsername,
      full_name: user.full_name || user.fullName || user.name || "",
      biography: user.biography || user.bio || "",
      profile_pic_url:
        user.profile_pic_url ||
        user.profile_pic_url_hd ||
        user.profile_picture_url ||
        user.hd_profile_pic_url ||
        user.profile_pic ||
        "",
      follower_count: user.edge_followed_by?.count || user.follower_count || user.followers || 0,
      following_count: user.edge_follow?.count || user.following_count || user.following || 0,
      media_count: user.edge_owner_to_timeline_media?.count || user.media_count || user.posts || user.post_count || 0,
      is_private: user.is_private || user.private || false,
      is_verified: user.is_verified || user.verified || false,
      pk: user.id || user.pk || user.user_id || "",
    }

    console.log("[v0] Final extracted profile:", JSON.stringify(extractedProfile, null, 2))

    const profileWithProxy = {
      ...extractedProfile,
      profile_pic_url: extractedProfile.profile_pic_url
        ? `/api/instagram/image?url=${encodeURIComponent(extractedProfile.profile_pic_url)}`
        : "",
    }

    // Cache the result
    cache.set(cleanUsername, {
      profile: profileWithProxy,
      timestamp: Date.now(),
    })

    return NextResponse.json(
      {
        success: true,
        profile: profileWithProxy,
      },
      {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
      },
    )
  } catch (err) {
    console.error("[v0] Error fetching Instagram profile:", err)
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      },
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
