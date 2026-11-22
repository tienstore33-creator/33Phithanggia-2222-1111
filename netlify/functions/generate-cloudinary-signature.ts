
import type { Handler, HandlerEvent } from "@netlify/functions";
import { generateCloudinarySignatureCore } from "../../services/backend/cloudinaryCore.js";

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: "Method Not Allowed" }),
      headers: { "Content-Type": "application/json" },
    };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const result = generateCloudinarySignatureCore(body.paramsToSign || {});

    return {
      statusCode: result.status,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result.body),
    };
  } catch (error) {
    console.error("Error generating Cloudinary signature:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error during signature generation.";
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to generate signature.", error: errorMessage }),
      headers: { "Content-Type": "application/json" },
    };
  }
};

export { handler };
