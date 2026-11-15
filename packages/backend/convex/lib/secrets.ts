import {
  CreateSecretCommand,
  GetSecretValueCommand,
  type GetSecretValueCommandOutput,
  PutSecretValueCommand,
  ResourceExistsException,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

/**
 * Validates an AWS Secrets Manager secret name to prevent path traversal
 * and injection attacks. Enforces the strict naming convention:
 *   tenant/{organizationId}/{service}
 *
 * AWS secret names allow [a-zA-Z0-9/_+=.@-] up to 512 chars.
 * We further restrict to our safe hierarchical pattern to block:
 * - Directory traversal (../)
 * - Null bytes, control characters
 * - Deviations from the established tenant/{orgId}/{service} schema
 */
function assertSafeSecretName(secretName: string): void {
  if (
    !secretName ||
    secretName.length > 256 ||
    // Must match tenant/<orgId>/<service> — alphanumeric with - and _ only
    !/^tenant\/[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9_-]{1,64}$/.test(secretName)
  ) {
    throw new Error(
      `[Secrets] Invalid secret name "${secretName}". Must follow tenant/{orgId}/{service} pattern.`,
    );
  }
}

export function createSecretsManagerClient(): SecretsManagerClient {
  return new SecretsManagerClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  })
};

export async function getSecretValue(
  secretName: string,
): Promise<GetSecretValueCommandOutput> {
  assertSafeSecretName(secretName);
  const client = createSecretsManagerClient();
  return await client.send(new GetSecretValueCommand({ SecretId: secretName }));
};

export async function upsertSecret(
  secretName: string,
  secretValue: Record<string, unknown>,
): Promise<void> {
  assertSafeSecretName(secretName);
  const client = createSecretsManagerClient();

  try {
    await client.send(
      new CreateSecretCommand({
        Name: secretName,
        SecretString: JSON.stringify(secretValue),
      }),
    );
  } catch (error) {
    if (error instanceof ResourceExistsException) {
      await client.send(
        new PutSecretValueCommand({
          SecretId: secretName,
          SecretString: JSON.stringify(secretValue),
        }),
      );
    } else {
      throw error;
    }
  }
}

export function parseSecretString<T = Record<string, unknown>>(
  secret: GetSecretValueCommandOutput
): T | null {
  if (!secret.SecretString) {
    return null;
  }

  try {
    return JSON.parse(secret.SecretString) as T;
  } catch {
    return null;
  }
};
