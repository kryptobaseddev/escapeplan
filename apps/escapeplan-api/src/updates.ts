import { FastifyInstance } from 'fastify';
import { env } from './env.js';

export async function setupUpdateRoutes(server: FastifyInstance) {
  // Check for updates
  server.get('/api/updates/check', async (_request, reply) => {
    if (!env.enableAutoUpdate) {
      return reply.code(503).send({
        error: {
          code: 'AUTO_UPDATE_DISABLED',
          message: 'Auto-update is disabled in this environment'
        }
      });
    }

    try {
      const response = await fetch(
        `https://api.github.com/repos/${env.githubRepo}/releases/latest`,
        {
          headers: {
            'User-Agent': 'EscapePlan-App',
            'Accept': 'application/vnd.github+json'
          }
        }
      );

      if (!response.ok) {
        return reply.code(500).send({
          error: {
            code: 'UPDATE_CHECK_FAILED',
            message: 'Failed to check for updates'
          }
        });
      }

      const release = await response.json();
      const latestVersion = release.tag_name.replace(/^v/, '');
      const currentVersion = env.version.replace(/^v/, '');

      const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;

      const debAsset = release.assets.find((a: any) => a.name.endsWith('.deb'));

      return reply.send({
        current: currentVersion,
        latest: latestVersion,
        updateAvailable,
        release: updateAvailable ? {
          version: latestVersion,
          url: release.html_url,
          notes: release.body,
          publishedAt: release.published_at,
          downloadUrl: debAsset?.browser_download_url,
          size: debAsset?.size
        } : null
      });
    } catch (error) {
      server.log.error(error, 'Update check failed');
      return reply.code(500).send({
        error: {
          code: 'UPDATE_CHECK_ERROR',
          message: 'Error checking for updates'
        }
      });
    }
  });

  // Get current version
  server.get('/api/updates/version', async (_request, reply) => {
    return reply.send({
      version: env.version,
      buildDate: env.buildDate,
      githubRepo: env.githubRepo,
      environment: env.isProd ? 'production' : 'development'
    });
  });
}

function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aNum = aParts[i] || 0;
    const bNum = bParts[i] || 0;

    if (aNum > bNum) return 1;
    if (aNum < bNum) return -1;
  }

  return 0;
}
