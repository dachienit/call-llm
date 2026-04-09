import "dotenv/config";

async function getOAuth2AccessToken(): Promise<{
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}> {
  const params = new URLSearchParams();
  params.append("client_id", process.env.CLIENT_ID ?? "");
  params.append("scope", process.env.SCOPE ?? "");
  params.append("client_secret", process.env.CLIENT_SECRET ?? "");
  params.append("grant_type", process.env.GRANT_TYPE ?? "");

  console.log("=== DEBUG OAuth2 ===");
  console.log("URL_TOKEN:", process.env.URL_TOKEN);
  console.log("CLIENT_ID:", process.env.CLIENT_ID);
  console.log("SCOPE:", process.env.SCOPE);
  console.log("GRANT_TYPE:", process.env.GRANT_TYPE);
  console.log("Request body:", params.toString());

  const response = await fetch(process.env.URL_TOKEN ?? "", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  console.log("Response status:", response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Error response:", errorText);
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const tokenData = await response.json();
  console.log("Token data:", JSON.stringify(tokenData, null, 2));

  if (!tokenData.access_token) {
    throw new Error("No access token received in response");
  }

  return {
    accessToken: tokenData.access_token,
    tokenType: tokenData.token_type || "Bearer",
    expiresIn: tokenData.expires_in,
  };
}

(async () => {
  try {
    const result = await getOAuth2AccessToken();
    console.log("\n=== SUCCESS ===");
    console.log("Access Token:", result.accessToken.substring(0, 50) + "...");
    console.log("Token Type:", result.tokenType);
    console.log("Expires In:", result.expiresIn, "seconds");
  } catch (error) {
    console.error("\n=== ERROR ===");
    console.error(error);
  }
})();
