const fs = require('fs');
const path = require('path');

let cachedPath = null;

function normalizeInlineCredentials(rawValue) {
  if (!rawValue) return null;

  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return trimmed;
  }

  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
    if (decoded.trim().startsWith('{')) {
      return decoded;
    }
  } catch (error) {
    console.warn('[GoogleCredentials] Falha ao decodificar credencial base64:', error.message);
  }

  return trimmed;
}

function ensureGoogleCredentialsFile() {
  if (cachedPath && fs.existsSync(cachedPath)) {
      return cachedPath;
  }

  const inline =
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
    process.env.GOOGLE_CREDENTIALS_JSON ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;

  const normalized = normalizeInlineCredentials(inline);

  const candidatePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (candidatePath) {
    const resolvedPath = path.isAbsolute(candidatePath)
      ? candidatePath
      : path.resolve(__dirname, '..', candidatePath);

    if (fs.existsSync(resolvedPath)) {
      cachedPath = resolvedPath;
      return cachedPath;
    }
  }

  if (!normalized) {
    return null;
  }

  try {
    const targetDir = path.resolve(__dirname, '..', '.runtime');
    fs.mkdirSync(targetDir, { recursive: true });
    const targetPath = path.join(targetDir, 'google-credentials.json');
    fs.writeFileSync(targetPath, normalized, { encoding: 'utf8', mode: 0o600 });
    process.env.GOOGLE_APPLICATION_CREDENTIALS = targetPath;
    cachedPath = targetPath;
    return cachedPath;
  } catch (error) {
    console.error('[GoogleCredentials] Não foi possível escrever o arquivo de credenciais:', error.message);
    return null;
  }
}

module.exports = {
  ensureGoogleCredentialsFile,
};
