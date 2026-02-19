function decodePublishableKeyFrontendApi(key: string) {
  try {
    const encodedPart = key.split("_")[2];
    if (!encodedPart) {
      return null;
    }
    const decoded = atob(encodedPart);
    if (!decoded.endsWith("$")) {
      return null;
    }
    return decoded.slice(0, -1);
  } catch {
    return null;
  }
}

function isPlaceholderValue(value: string | undefined) {
  if (!value) {
    return true;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return (
    normalized.includes("xxx") ||
    normalized.includes("example") ||
    normalized.includes("your_") ||
    normalized === "pk_test_xxx" ||
    normalized === "sk_test_xxx"
  );
}

function hasValidPublishableKey(key: string | undefined) {
  if (!key || isPlaceholderValue(key)) {
    return false;
  }
  if (!(key.startsWith("pk_test_") || key.startsWith("pk_live_"))) {
    return false;
  }

  const frontendApi = decodePublishableKeyFrontendApi(key);
  if (!frontendApi) {
    return false;
  }

  if (frontendApi.includes("example.com") || frontendApi.includes("clerk.example")) {
    return false;
  }

  return true;
}

function hasValidSecretKey(key: string | undefined) {
  if (!key || isPlaceholderValue(key)) {
    return false;
  }
  return key.startsWith("sk_test_") || key.startsWith("sk_live_");
}

export function isClerkEnabled() {
  return hasValidPublishableKey(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) && hasValidSecretKey(process.env.CLERK_SECRET_KEY);
}
